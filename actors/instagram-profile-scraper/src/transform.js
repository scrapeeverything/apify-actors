// Pure helpers (no SDK, no network) so they can be unit-tested.

export const CREDITS = { profile: 1, photos: 2 };

function average(values) {
    const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Engagement rate = (avg likes + avg comments) / followers * 100, over posts that expose counts.
export function engagementStats(profile) {
    const posts = Array.isArray(profile?.posts) ? profile.posts : [];
    const usable = posts.filter((p) => !p.like_and_view_counts_disabled && typeof p.like_count === 'number');
    const avgLikes = average(usable.map((p) => p.like_count));
    const avgComments = average(usable.map((p) => p.comment_count));
    const followers = profile?.follower_count;
    let engagementRate = null;
    if (avgLikes !== null && typeof followers === 'number' && followers > 0) {
        engagementRate = Number((((avgLikes + (avgComments || 0)) / followers) * 100).toFixed(3));
    }
    return {
        avg_likes: avgLikes === null ? null : Math.round(avgLikes),
        avg_comments: avgComments === null ? null : Math.round(avgComments),
        engagement_rate_pct: engagementRate,
        engagement_sample_size: usable.length,
    };
}

export function buildRequest(username, { includePosts, postsLimit, cacheDays }) {
    const body = includePosts ? { username, limit: postsLimit } : { username };
    if (cacheDays > 0) body.cache_days = cacheDays;
    return { path: includePosts ? '/v1/instagram/photos' : '/v1/instagram/profile', body };
}

export function toItem(input, data, meta, { includePosts }) {
    const item = { type: 'profile', input, ...data };
    if (includePosts) Object.assign(item, engagementStats(data));
    item.credits_charged = meta?.credits_charged ?? null;
    item.cached = meta?.cached ?? null;
    item.scrapedAt = new Date().toISOString();
    return item;
}
