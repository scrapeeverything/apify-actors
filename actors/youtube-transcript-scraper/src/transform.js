// Pure helpers (no SDK, no network) so they can be unit-tested.

export const CREDITS = { transcript: 1, video: 1 };

function withCache(body, cacheDays) {
    if (cacheDays > 0) body.cache_days = cacheDays;
    return body;
}

export function transcriptRequest(video, { lang, cacheDays }) {
    const body = { url: video };
    if (lang) body.lang = lang;
    return { path: '/v1/youtube/transcript', body: withCache(body, cacheDays) };
}

export function videoRequest(video, { cacheDays }) {
    return { path: '/v1/youtube/video', body: withCache({ url: video }, cacheDays) };
}

// Picks the details worth keeping next to a transcript.
export function pickDetails(details) {
    if (!details) return {};
    return {
        title: details.title ?? null,
        link: details.link ?? null,
        channel: details.channel ?? null,
        published_at: details.published_at ?? null,
        duration_seconds: details.duration_seconds ?? null,
        view_count: details.view_count ?? null,
        like_count: details.like_count ?? null,
        category: details.category ?? null,
        thumbnail_url: details.thumbnail_url ?? null,
    };
}

export function toItem(input, transcript, details, { includeSegments }, credits) {
    const { segments, ...rest } = transcript || {};
    const item = {
        type: 'transcript',
        input,
        ...rest,
        word_count: typeof rest.text === 'string' ? rest.text.split(/\s+/).filter(Boolean).length : null,
        ...pickDetails(details),
    };
    if (includeSegments) item.segments = segments || [];
    item.credits_charged = credits;
    item.scrapedAt = new Date().toISOString();
    return item;
}
