// Mock of the Scrape Everything API for tests and local runs. No credits are spent.
//
// Keys:      "test-key" works, "broke-key" -> 402 INSUFFICIENT_CREDITS, anything else -> 401.
// Targets:   "missing" -> 404 NOT_FOUND, "flaky" -> one 503 then success,
//            "notranscript" -> 404 NO_TRANSCRIPT (YouTube).
// Run standalone: node test/mock-server.mjs [port]
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

export const VALID_KEY = 'test-key';
export const BROKE_KEY = 'broke-key';

const handleOf = (value) => String(value || '')
    .replace(/^https?:\/\/(www\.)?[^/]+\//, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .replace(/^@/, '') || 'unknown';

const videoIdOf = (value) => {
    const s = String(value || '');
    const m = s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
    return m ? m[1] : s;
};

const igPosts = (n) => Array.from({ length: n }, (_, i) => ({
    shortcode: `MOCK${i}`,
    link: `https://www.instagram.com/p/MOCK${i}/`,
    type: i % 3 === 0 ? 'video' : 'photo',
    is_video: i % 3 === 0,
    like_count: 1000 + i * 100,
    like_and_view_counts_disabled: false,
    comment_count: 50 + i,
    caption: `Mock caption ${i}`,
    thumbnail_url: `https://example.com/thumb${i}.jpg`,
    taken_at: 1760000000 - i * 86400,
    taken_at_text: 'October 09, 2025',
}));

const igProfile = (username) => ({
    id: '528817151',
    username,
    full_name: `${username} (mock)`,
    biography: 'Mock biography',
    external_url: 'https://example.com',
    profile_pic_url: 'https://example.com/a.jpg',
    profile_pic_url_hd: 'https://example.com/a_hd.jpg',
    is_private: false,
    is_verified: true,
    is_business_account: true,
    category_name: 'Science',
    follower_count: 100000,
    following_count: 80,
    post_count: 4200,
    has_highlights: true,
    highlight_count: 12,
});

const ttProfile = (username) => ({
    user_id: '6727327145951183878',
    username,
    full_name: `${username} (mock)`,
    biography: 'Mock bio',
    external_url: null,
    is_private: false,
    is_verified: true,
    follower_count: 160000000,
    following_count: 80,
    like_count: 2500000000,
    video_count: 1300,
    profile_image_url: 'https://example.com/tt.jpg',
    region: 'IT',
    created_at: '2019-08-07T00:00:00Z',
});

const ttPosts = (username, limit) => {
    const n = Math.min(limit || 12, 12);
    return {
        user_id: '6727327145951183878',
        username,
        nickname: `${username} (mock)`,
        signature: 'Mock bio',
        is_verified: true,
        is_private: false,
        follower_count: 160000000,
        following_count: 80,
        heart_count: 2500000000,
        avatar_url: 'https://example.com/tt.jpg',
        posts: Array.from({ length: n }, (_, i) => ({
            id: `74000000000000000${i}`,
            link: `https://www.tiktok.com/@${username}/video/74000000000000000${i}`,
            description: `Mock video ${i}`,
            cover_url: `https://example.com/c${i}.jpg`,
            origin_cover_url: null,
            dynamic_cover_url: null,
            play_url: null,
            play_count: (i + 1) * 1000,
            width: 576,
            height: 1024,
            ratio: '540p',
            is_private: false,
        })),
        posts_fetched: n,
        has_more: true,
    };
};

const ytTranscript = (id, lang) => ({
    video_id: id,
    language: lang || 'en',
    language_name: 'English',
    is_auto_generated: false,
    available_languages: [{ code: 'en', name: 'English', is_auto_generated: false }],
    segment_count: 2,
    text: 'All right, so here we are in front of the elephants.',
    segments: [
        { start: 1.2, duration: 2.16, text: 'All right, so here we are' },
        { start: 3.36, duration: 2.0, text: 'in front of the elephants.' },
    ],
});

const ytVideo = (id) => ({
    video_id: id,
    link: `https://www.youtube.com/watch?v=${id}`,
    title: 'Me at the zoo (mock)',
    description: 'Mock description',
    duration_seconds: 19,
    view_count: 380000000,
    like_count: 18000000,
    published_at: '2005-04-24T03:31:52Z',
    category: 'Film & Animation',
    is_live: false,
    is_family_safe: true,
    playability: 'OK',
    keywords: [],
    thumbnail_url: 'https://example.com/yt.jpg',
    channel: { channel_id: 'UC4QobU6STFB0P71PMvOGN5A', name: 'jawed', handle: '@jawed' },
});

const ROUTES = {
    '/v1/instagram/profile': { credits: 1, target: (b) => handleOf(b.username), data: (t) => igProfile(t) },
    '/v1/instagram/photos': {
        credits: 2,
        target: (b) => handleOf(b.username),
        data: (t, b) => {
            const posts = igPosts(Math.min(b.limit || 12, 60));
            return { ...igProfile(t), posts, posts_fetched: posts.length, posts_source: 'mock', has_more: true };
        },
    },
    '/v1/tiktok/profile': { credits: 1, target: (b) => handleOf(b.username), data: (t) => ttProfile(t) },
    '/v1/tiktok/posts': { credits: 1, target: (b) => handleOf(b.username), data: (t, b) => ttPosts(t, b.limit) },
    '/v1/youtube/transcript': {
        credits: 1,
        target: (b) => videoIdOf(b.url || b.id),
        data: (t, b) => ytTranscript(t, b.lang),
        notFoundCode: { notranscript: 'NO_TRANSCRIPT' },
    },
    '/v1/youtube/video': { credits: 1, target: (b) => videoIdOf(b.url || b.id), data: (t) => ytVideo(t) },
};

export function startMockServer(port = 0) {
    const requests = [];
    const flakySeen = new Set();
    let seq = 0;

    const server = createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            seq += 1;
            const requestId = `mock_${seq}`;
            const send = (status, payload) => {
                res.writeHead(status, { 'Content-Type': 'application/json', 'X-Request-Id': requestId });
                res.end(JSON.stringify(payload));
            };
            const fail = (status, code, message) => send(status, { success: false, message, code, request_id: requestId });

            let body = {};
            try { body = raw ? JSON.parse(raw) : {}; } catch { return fail(400, 'INVALID_JSON', 'Body is not valid JSON'); }
            const auth = req.headers.authorization || '';
            requests.push({ method: req.method, path: req.url, body, auth });

            if (req.method === 'GET' && req.url === '/v1/account') {
                if (auth !== `Bearer ${VALID_KEY}`) return fail(401, 'INVALID_API_KEY', 'Invalid or revoked API key');
                return send(200, { success: true, data: { email: 'mock@example.com', plan: 'free', credits: 100 } });
            }
            const route = ROUTES[req.url];
            if (req.method !== 'POST' || !route) return fail(404, 'UNKNOWN_ENDPOINT', `Unknown endpoint: ${req.method} ${req.url}`);
            if (auth === `Bearer ${BROKE_KEY}`) return fail(402, 'INSUFFICIENT_CREDITS', 'Insufficient credits');
            if (auth !== `Bearer ${VALID_KEY}`) return fail(401, 'INVALID_API_KEY', 'Invalid or revoked API key');

            const target = route.target(body);
            if (target === 'missing') return fail(404, 'NOT_FOUND', 'Not found');
            if (route.notFoundCode?.[target]) return fail(404, route.notFoundCode[target], 'No transcript for this video');
            if (target === 'flaky' && !flakySeen.has(req.url)) {
                flakySeen.add(req.url);
                return fail(503, 'TARGET_BLOCKED', 'The platform blocked this request. Your credit was refunded, please try again shortly.');
            }
            return send(200, {
                success: true,
                data: route.data(target, body),
                meta: { request_id: requestId, scraper: req.url.slice(4).replace('/', '.'), cached: false, credits_charged: route.credits, credits_remaining: 99 },
            });
        });
    });

    return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
            const { port: actual } = server.address();
            resolve({
                url: `http://127.0.0.1:${actual}`,
                requests,
                close: () => new Promise((r) => server.close(r)),
            });
        });
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const mock = await startMockServer(Number(process.argv[2]) || 4010);
    console.log(`Scrape Everything mock API listening on ${mock.url} (key: ${VALID_KEY})`);
}
