# YouTube Transcript Scraper

Get **YouTube transcripts** in bulk, as plain text and as timed segments, from the video's captions (hand-written or automatic). You can pick the caption language and optionally add the **video details**: title, channel, publish date, duration, views and likes.

The actor runs on the [Scrape Everything API](https://scrapeeverything.com/?utm_source=apify&utm_medium=actor), so you do not need a YouTube Data API quota, browser or proxies.

## Use cases

- Feeding transcripts to ChatGPT, Claude or a RAG pipeline for summaries and key quotes
- Podcast and interview notes, show notes and subtitle checks
- Content research: what competitors actually say in their videos
- Building searchable archives of a channel or playlist

## Before you start: get an API key (100 free credits)

1. Sign up at **https://scrapeeverything.com/?utm_source=apify&utm_medium=actor**. New accounts get **100 free credits**, which is about 100 transcripts.
2. Copy your API key from the dashboard.
3. Paste it into the **Scrape Everything API key** input, which is a secret field.

If the key is missing, the run stops at once with these steps and nothing is charged.

## Input

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `videos` | list | required | watch, youtu.be, shorts, live or embed links, or a bare 11-character ID |
| `lang` | string | original language | `en`, `de`, `pt-BR`, `es-419` and so on. `pt` matches `pt-BR` |
| `includeSegments` | boolean | `true` | Timed segments `{ start, duration, text }` |
| `includeVideoDetails` | boolean | `false` | Title, channel, views and likes (+1 credit per video) |
| `apiKey` | secret string | none | Your Scrape Everything key |
| `maxConcurrency` | integer | `3` | Parallel videos |
| `cacheDays` | integer | `0` | 1-14 reuses a recent result for 0 credits |

```json
{
  "videos": ["https://www.youtube.com/watch?v=jNQXAC9IVRw", "dQw4w9WgXcQ"],
  "lang": "en",
  "includeVideoDetails": true,
  "apiKey": "ssk_live_..."
}
```

## Output

```json
{
  "type": "transcript",
  "input": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  "video_id": "jNQXAC9IVRw",
  "language": "en",
  "language_name": "English",
  "is_auto_generated": false,
  "available_languages": [{ "code": "en", "name": "English", "is_auto_generated": false }],
  "segment_count": 6,
  "text": "All right, so here we are in front of the elephants...",
  "word_count": 38,
  "segments": [{ "start": 1.2, "duration": 2.16, "text": "All right, so here we are" }],
  "title": "Me at the zoo",
  "channel": { "channel_id": "UC4QobU6STFB0P71PMvOGN5A", "name": "jawed" },
  "published_at": "2005-04-24T03:31:52Z",
  "duration_seconds": 19,
  "view_count": 380000000,
  "like_count": 18000000,
  "credits_charged": 2,
  "scrapedAt": "2026-10-21T12:00:00.000Z"
}
```

### Failed inputs (not charged)

Failed videos are **never written to the dataset**, so with pay-per-result pricing you only pay for successful rows. Instead they are saved to the run's default key-value store as the record `ERRORS`:

```json
[{ "input": "doesnotexist123", "error": { "code": "NOT_FOUND", "message": "Not found", "request_id": "req_..." } }]
```

Each failure is also logged as a warning. The run ends with a status like `Scraped 8/10, 2 failed (see ERRORS in key-value store)`. If every input fails, the run is marked as failed. For a video with no captions in the requested language, the code is `NO_TRANSCRIPT` and the message lists the language codes that are available.

## Cost

| Mode | API endpoints | Credits per video |
| --- | --- | --- |
| Transcript | `POST /v1/youtube/transcript` | 1 |
| Transcript + details | `/v1/youtube/transcript` + `/v1/youtube/video` | 2 |

Platform-side failures are refunded. A definite `NO_TRANSCRIPT` or `NOT_FOUND` answer is billed. Cache hits are free.

Pricing on Apify: this actor uses pay-per-result. You pay Apify per transcript row at the price shown on the Store page, and your Scrape Everything credits cover the API calls.

## Limits

- Only videos with captions have a transcript. Machine-translated tracks are not offered.
- `401` and `402` stop the run with a clear message. `429` and `5xx` are retried up to 3 times.

## Responsible use

Transcripts are public captions. Respect creators' copyright when you republish them and follow YouTube's terms.

## About Scrape Everything

Scrape Everything is a REST API for public social media data. Send a username, link or ID and get clean, typed JSON from Instagram, TikTok, X, YouTube, Facebook, Telegram, Spotify, Pinterest and Twitch. Pay per successful request with prepaid credits that never expire. New accounts start with 100 free credits. https://scrapeeverything.com
