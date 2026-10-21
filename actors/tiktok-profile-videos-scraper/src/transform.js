// Pure helpers (no SDK, no network) so they can be unit-tested.

export const CREDITS = { profile: 1, posts: 1 };

function withCache(body, cacheDays) {
    if (cacheDays > 0) body.cache_days = cacheDays;
    return body;
}

export function profileRequest(username, { cacheDays }) {
    return { path: '/v1/tiktok/profile', body: withCache({ username }, cacheDays) };
}

export function postsRequest(username, { videosLimit, cacheDays }) {
    return { path: '/v1/tiktok/posts', body: withCache({ username, limit: videosLimit }, cacheDays) };
}

export function videoStats(videos) {
    const plays = (videos || []).map((v) => v.play_count).filter((n) => typeof n === 'number');
    if (plays.length === 0) return { avg_play_count: null, median_play_count: null, max_play_count: null };
    const sorted = [...plays].sort((a, b) => a - b);
    return {
        avg_play_count: Math.round(plays.reduce((a, b) => a + b, 0) / plays.length),
        median_play_count: sorted[Math.floor(sorted.length / 2)],
        max_play_count: sorted[sorted.length - 1],
    };
}

// Returns the dataset items for one username.
// Nested mode: one profile item with a `videos` array.
// Flat mode: one profile item (no array) plus one `type: "video"` item per video.
export function toItems(input, profile, posts, { includeVideos, flattenVideos }, credits) {
    const scrapedAt = new Date().toISOString();
    const videos = includeVideos && posts ? posts.posts || [] : [];
    const base = {
        type: 'profile',
        input,
        ...profile,
        ...(includeVideos ? { videos_fetched: videos.length, ...videoStats(videos) } : {}),
        credits_charged: credits,
        scrapedAt,
    };
    if (!includeVideos) return [base];
    if (!flattenVideos) return [{ ...base, videos }];
    return [
        base,
        ...videos.map((video, position) => ({
            type: 'video',
            input,
            profile_username: profile?.username ?? null,
            profile_follower_count: profile?.follower_count ?? null,
            position: position + 1,
            ...video,
            scrapedAt,
        })),
    ];
}
