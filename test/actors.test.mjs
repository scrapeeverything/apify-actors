import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { BROKE_KEY, startMockServer, VALID_KEY } from './mock-server.mjs';
import { runActor } from './run-actor.mjs';

let mock;
before(async () => { mock = await startMockServer(); });
after(async () => { await mock.close(); });

const env = (key = VALID_KEY) => ({ SCRAPEEVERYTHING_BASE_URL: mock.url, SCRAPEEVERYTHING_API_KEY: key });
const TIMEOUT = { timeout: 60_000 };

describe('instagram-profile-scraper', () => {
    test('profiles only: failures go to ERRORS record, not the dataset', TIMEOUT, async () => {
        const r = await runActor('instagram-profile-scraper', { usernames: ['nasa', '@natgeo', 'missing', 'nasa'] }, { env: env() });
        assert.equal(r.code, 0, r.output);
        assert.equal(r.items.length, 2);
        assert.ok(r.items.every((i) => i.type === 'profile'));
        const nasa = r.items.find((i) => i.input === 'nasa');
        assert.equal(nasa.follower_count, 100000);
        assert.equal(nasa.credits_charged, 1);
        assert.equal(nasa.posts, undefined);
        assert.equal(r.errors.length, 1);
        assert.equal(r.errors[0].input, 'missing');
        assert.equal(r.errors[0].error.code, 'NOT_FOUND');
        assert.ok(r.errors[0].error.request_id);
        assert.deepEqual(Object.keys(r.errors[0].error).sort(), ['code', 'message', 'request_id']);
        assert.match(r.output, /Failed missing: NOT_FOUND/);
        assert.ok(r.output.includes('Scraped 2/3, 1 failed (see ERRORS in key-value store)'), r.output);
    });

    test('all inputs failed fails the run', TIMEOUT, async () => {
        const r = await runActor('instagram-profile-scraper', { usernames: ['missing'] }, { env: env() });
        assert.notEqual(r.code, 0);
        assert.equal(r.items.length, 0);
        assert.equal(r.errors.length, 1);
        assert.ok(r.output.includes('All inputs failed: Scraped 0/1, 1 failed'), r.output);
    });

    test('no failures: no ERRORS record', TIMEOUT, async () => {
        const r = await runActor('instagram-profile-scraper', { usernames: ['nasa'] }, { env: env() });
        assert.equal(r.code, 0, r.output);
        assert.equal(r.errors, null);
        assert.ok(r.output.includes('Scraped 1/1.'), r.output);
    });

    test('includePosts uses instagram.photos and adds engagement rate', TIMEOUT, async () => {
        const r = await runActor('instagram-profile-scraper', { usernames: ['nasa'], includePosts: true, postsLimit: 5, cacheDays: 3 }, { env: env() });
        assert.equal(r.code, 0, r.output);
        const [item] = r.items;
        assert.equal(item.posts.length, 5);
        assert.equal(item.credits_charged, 2);
        assert.ok(item.engagement_rate_pct > 0);
        const req = mock.requests.findLast((q) => q.path === '/v1/instagram/photos');
        assert.deepEqual(req.body, { username: 'nasa', limit: 5, cache_days: 3 });
        assert.equal(req.auth, `Bearer ${VALID_KEY}`);
    });

    test('retries a 503 and succeeds', TIMEOUT, async () => {
        const r = await runActor('instagram-profile-scraper', { usernames: ['flaky'] }, { env: env() });
        assert.equal(r.code, 0, r.output);
        assert.equal(r.items[0].type, 'profile');
    });

    test('missing API key fails clearly with setup instructions', TIMEOUT, async () => {
        const r = await runActor('instagram-profile-scraper', { usernames: ['nasa'] }, { env: { SCRAPEEVERYTHING_BASE_URL: mock.url } });
        assert.notEqual(r.code, 0);
        assert.match(r.output, /Missing Scrape Everything API key/);
        assert.match(r.output, /scrapeeverything\.com\/\?utm_source=apify/);
        assert.equal(r.items.length, 0);
    });

    test('invalid API key (401) fails the run', TIMEOUT, async () => {
        const r = await runActor('instagram-profile-scraper', { usernames: ['nasa', 'natgeo'] }, { env: env('wrong-key') });
        assert.notEqual(r.code, 0);
        assert.match(r.output, /API key was rejected \(INVALID_API_KEY\)/);
    });

    test('apiKey input wins over env', TIMEOUT, async () => {
        const r = await runActor('instagram-profile-scraper', { usernames: ['nasa'], apiKey: VALID_KEY }, { env: { SCRAPEEVERYTHING_BASE_URL: mock.url } });
        assert.equal(r.code, 0, r.output);
        assert.equal(r.items.length, 1);
    });
});

describe('tiktok-profile-videos-scraper', () => {
    test('nested mode: profile with videos array', TIMEOUT, async () => {
        const r = await runActor('tiktok-profile-videos-scraper', { usernames: ['khaby.lame'], videosLimit: 4 }, { env: env() });
        assert.equal(r.code, 0, r.output);
        assert.equal(r.items.length, 1);
        const [item] = r.items;
        assert.equal(item.username, 'khaby.lame');
        assert.equal(item.video_count, 1300);
        assert.equal(item.videos.length, 4);
        assert.equal(item.credits_charged, 2);
        assert.equal(item.max_play_count, 4000);
    });

    test('flat mode: profile row plus one row per video', TIMEOUT, async () => {
        const r = await runActor('tiktok-profile-videos-scraper', { usernames: ['khaby.lame'], videosLimit: 3, flattenVideos: true }, { env: env() });
        assert.equal(r.code, 0, r.output);
        assert.equal(r.items.length, 4);
        assert.equal(r.items.filter((i) => i.type === 'video').length, 3);
        assert.equal(r.items.find((i) => i.type === 'video').profile_username, 'khaby.lame');
    });

    test('includeVideos=false calls only tiktok.profile', TIMEOUT, async () => {
        const before = mock.requests.filter((q) => q.path === '/v1/tiktok/posts').length;
        const r = await runActor('tiktok-profile-videos-scraper', { usernames: ['khaby.lame'], includeVideos: false }, { env: env() });
        assert.equal(r.code, 0, r.output);
        assert.equal(r.items[0].videos, undefined);
        assert.equal(mock.requests.filter((q) => q.path === '/v1/tiktok/posts').length, before);
    });

    test('failed profile is kept out of the dataset', TIMEOUT, async () => {
        const r = await runActor('tiktok-profile-videos-scraper', { usernames: ['khaby.lame', 'missing'], flattenVideos: true, videosLimit: 2 }, { env: env() });
        assert.equal(r.code, 0, r.output);
        assert.equal(r.items.length, 3);
        assert.ok(r.items.every((i) => i.input === 'khaby.lame'));
        assert.deepEqual(r.errors.map((e) => [e.input, e.error.code]), [['missing', 'NOT_FOUND']]);
    });

    test('out of credits (402) fails the run clearly', TIMEOUT, async () => {
        const r = await runActor('tiktok-profile-videos-scraper', { usernames: ['khaby.lame'] }, { env: env(BROKE_KEY) });
        assert.notEqual(r.code, 0);
        assert.match(r.output, /out of credits/);
    });
});

describe('youtube-transcript-scraper', () => {
    test('transcript with segments and details', TIMEOUT, async () => {
        const r = await runActor('youtube-transcript-scraper', {
            videos: ['https://www.youtube.com/watch?v=jNQXAC9IVRw', 'notranscript'],
            includeVideoDetails: true,
            lang: 'en',
        }, { env: env() });
        assert.equal(r.code, 0, r.output);
        assert.equal(r.items.length, 1);
        const ok = r.items[0];
        assert.equal(ok.type, 'transcript');
        assert.equal(ok.video_id, 'jNQXAC9IVRw');
        assert.equal(ok.segments.length, 2);
        assert.equal(ok.title, 'Me at the zoo (mock)');
        assert.equal(ok.credits_charged, 2);
        assert.ok(ok.word_count > 5);
        assert.equal(r.errors.length, 1);
        assert.equal(r.errors[0].input, 'notranscript');
        assert.equal(r.errors[0].error.code, 'NO_TRANSCRIPT');
        assert.ok(r.output.includes('Scraped 1/2, 1 failed'), r.output);
        const req = mock.requests.findLast((q) => q.path === '/v1/youtube/transcript');
        assert.equal(req.body.lang, 'en');
    });

    test('includeSegments=false drops segments', TIMEOUT, async () => {
        const r = await runActor('youtube-transcript-scraper', { videos: ['jNQXAC9IVRw'], includeSegments: false }, { env: env() });
        assert.equal(r.code, 0, r.output);
        assert.equal(r.items[0].segments, undefined);
        assert.equal(typeof r.items[0].text, 'string');
    });

    test('empty input fails with a clear message', TIMEOUT, async () => {
        const r = await runActor('youtube-transcript-scraper', { videos: [] }, { env: env() });
        assert.notEqual(r.code, 0);
        assert.match(r.output, /Input "videos" is empty/);
    });
});
