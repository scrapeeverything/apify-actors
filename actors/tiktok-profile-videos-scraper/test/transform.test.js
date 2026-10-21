import assert from 'node:assert/strict';
import { test } from 'node:test';
import { postsRequest, profileRequest, toItems, videoStats } from '../src/transform.js';

test('requests', () => {
    assert.deepEqual(profileRequest('khaby.lame', { cacheDays: 0 }), { path: '/v1/tiktok/profile', body: { username: 'khaby.lame' } });
    assert.deepEqual(postsRequest('khaby.lame', { videosLimit: 6, cacheDays: 1 }), { path: '/v1/tiktok/posts', body: { username: 'khaby.lame', limit: 6, cache_days: 1 } });
});

test('videoStats', () => {
    assert.deepEqual(videoStats([{ play_count: 10 }, { play_count: 30 }, { play_count: null }]), { avg_play_count: 20, median_play_count: 30, max_play_count: 30 });
    assert.equal(videoStats([]).avg_play_count, null);
});

test('toItems nested vs flat', () => {
    const posts = { posts: [{ id: '1', play_count: 5 }, { id: '2', play_count: 7 }] };
    const nested = toItems('k', { username: 'k', follower_count: 9 }, posts, { includeVideos: true, flattenVideos: false }, 2);
    assert.equal(nested.length, 1);
    assert.equal(nested[0].videos.length, 2);
    const flat = toItems('k', { username: 'k', follower_count: 9 }, posts, { includeVideos: true, flattenVideos: true }, 2);
    assert.equal(flat.length, 3);
    assert.deepEqual(flat.slice(1).map((v) => [v.type, v.position, v.profile_username]), [['video', 1, 'k'], ['video', 2, 'k']]);
    const bare = toItems('k', { username: 'k' }, null, { includeVideos: false, flattenVideos: false }, 1);
    assert.equal(bare[0].videos, undefined);
});
