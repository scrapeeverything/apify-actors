import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRequest, engagementStats, toItem } from '../src/transform.js';

test('buildRequest picks the endpoint by includePosts', () => {
    assert.deepEqual(buildRequest('nasa', { includePosts: false, postsLimit: 12, cacheDays: 0 }), { path: '/v1/instagram/profile', body: { username: 'nasa' } });
    assert.deepEqual(buildRequest('nasa', { includePosts: true, postsLimit: 5, cacheDays: 2 }), { path: '/v1/instagram/photos', body: { username: 'nasa', limit: 5, cache_days: 2 } });
});

test('engagementStats ignores posts with hidden or missing counts', () => {
    const stats = engagementStats({
        follower_count: 1000,
        posts: [
            { like_count: 40, comment_count: 10 },
            { like_count: 60, comment_count: 10 },
            { like_count: null, comment_count: null },
            { like_count: 999, comment_count: 1, like_and_view_counts_disabled: true },
        ],
    });
    assert.deepEqual(stats, { avg_likes: 50, avg_comments: 10, engagement_rate_pct: 6, engagement_sample_size: 2 });
    assert.equal(engagementStats({ follower_count: 0, posts: [] }).engagement_rate_pct, null);
});

test('toItem keeps input, meta and timestamp', () => {
    const item = toItem('@nasa', { username: 'nasa' }, { credits_charged: 1, cached: false }, { includePosts: false });
    assert.equal(item.type, 'profile');
    assert.equal(item.input, '@nasa');
    assert.equal(item.credits_charged, 1);
    assert.ok(item.scrapedAt);
});
