# TikTok Profile & Videos Scraper

Scrape **public TikTok profiles** together with their **newest videos**: nickname, bio, link, verification, follower, following, like and video counts, region and creation date, plus the newest 12 videos with captions, covers and play counts. You can keep the videos nested under each profile or get one row per video for easy CSV and Sheets export.

The actor runs on the [Scrape Everything API](https://scrapeeverything.com/?utm_source=apify&utm_medium=actor), so there are no logins, cookies or proxies for you to handle.

## Use cases

- Shortlisting creators by followers, total likes and recent play counts
- Monitoring competitor accounts on a schedule
- Collecting recent video links for content research or an AI pipeline

## Before you start: get an API key (100 free credits)

1. Sign up at **https://scrapeeverything.com/?utm_source=apify&utm_medium=actor**. New accounts get **100 free credits**.
2. Copy your API key from the dashboard.
3. Paste it into the **Scrape Everything API key** input, which is a secret field.

Without a key the run fails at once with these steps and nothing is charged.

## Input

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `usernames` | list | required | `khaby.lame`, `@khaby.lame` or `https://www.tiktok.com/@khaby.lame` |
| `includeVideos` | boolean | `true` | Adds the newest videos (+1 credit per profile) |
| `videosLimit` | integer | `12` | 1-12. TikTok's public embed exposes at most 12 |
| `flattenVideos` | boolean | `false` | `true` gives one profile row plus one row per video |
| `apiKey` | secret string | none | Your Scrape Everything key |
| `maxConcurrency` | integer | `3` | Parallel profiles |
| `cacheDays` | integer | `0` | 1-14 lets the API reuse a recent result for 0 credits |

```json
{ "usernames": ["khaby.lame", "@charlidamelio"], "includeVideos": true, "videosLimit": 12, "apiKey": "ssk_live_..." }
```

## Output

Nested mode (default) gives one row per profile:

```json
{
  "type": "profile",
  "input": "khaby.lame",
  "user_id": "6727327145951183878",
  "username": "khaby.lame",
  "full_name": "Khabane lame",
  "biography": "...",
  "is_verified": true,
  "follower_count": 160000000,
  "following_count": 80,
  "like_count": 2500000000,
  "video_count": 1300,
  "region": "IT",
  "created_at": "2019-08-07T00:00:00Z",
  "videos_fetched": 12,
  "avg_play_count": 9200000,
  "median_play_count": 7100000,
  "max_play_count": 31000000,
  "videos": [{ "id": "74...", "link": "https://www.tiktok.com/@khaby.lame/video/74...", "description": "...", "cover_url": "...", "play_count": 7100000 }],
  "credits_charged": 2,
  "scrapedAt": "2026-10-21T12:00:00.000Z"
}
```

Flat mode (`flattenVideos: true`) gives the profile row (without `videos`) followed by rows like this one:

```json
{ "type": "video", "input": "khaby.lame", "profile_username": "khaby.lame", "profile_follower_count": 160000000, "position": 1, "id": "74...", "link": "...", "description": "...", "play_count": 7100000 }
```

### Failed inputs (not charged)

Failed usernames are **never written to the dataset**, so with pay-per-result pricing you only pay for successful rows. Instead they are saved to the run's default key-value store as the record `ERRORS`:

```json
[{ "input": "doesnotexist123", "error": { "code": "NOT_FOUND", "message": "Not found", "request_id": "req_..." } }]
```

Each failure is also logged as a warning. The run ends with a status like `Scraped 8/10, 2 failed (see ERRORS in key-value store)`. If every input fails, the run is marked as failed.

## Cost

| Mode | API endpoints | Credits per username |
| --- | --- | --- |
| Profile only | `POST /v1/tiktok/profile` | 1 |
| Profile + videos | `/v1/tiktok/profile` + `/v1/tiktok/posts` | 2 |

Platform-side failures are refunded. A definite "not found" answer is billed. Cache hits are free.

Pricing on Apify: this actor uses pay-per-result. You pay Apify per dataset row at the price shown on the Store page, and your Scrape Everything credits cover the API calls.

## Limits

- The newest 12 videos come from TikTok's public embed. For full per-video stats (likes, shares, saves), use the `tiktok.video` endpoint of the API.
- `401` and `402` stop the run with a clear message. `429` and `5xx` are retried up to 3 times.

## Responsible use

This actor reads public data only. Respect TikTok's terms and the privacy laws that apply to you, and do not use it to harvest personal data.

## About Scrape Everything

Scrape Everything is a REST API for public social media data. Send a username, link or ID and get clean, typed JSON from Instagram, TikTok, X, YouTube, Facebook, Telegram, Spotify, Pinterest and Twitch. Pay per successful request with prepaid credits that never expire. New accounts start with 100 free credits. https://scrapeeverything.com
