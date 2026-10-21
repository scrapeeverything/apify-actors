# Instagram Profile Scraper (Scrape Everything API)

Scrape **public Instagram profiles** in bulk: bio, website, follower, following and post counts, verified and business flags, category, profile pictures and story highlight counts. Turn on **Include recent posts** to also get the newest posts (up to 60) with likes, comments and captions, plus a ready-made **engagement rate**.

No login, no cookies, no proxies to manage. The actor calls the [Scrape Everything API](https://scrapeeverything.com/?utm_source=apify&utm_medium=actor) with your own API key.

## What you can use it for

- Vetting influencers before a sponsorship (followers, engagement rate, category, business account)
- Building creator or brand lead lists with website links from the bio
- Tracking competitor follower growth on a schedule
- Feeding profile data to a CRM, Google Sheets or an AI agent

## Before you start: get an API key (100 free credits)

1. Create a free account at **https://scrapeeverything.com/?utm_source=apify&utm_medium=actor**. New accounts get **100 free credits**.
2. Copy your API key from the dashboard.
3. Paste it into the **Scrape Everything API key** input. It is stored as an encrypted secret input.

If the key is missing, the run fails at once with these instructions and spends nothing.

## Input

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `usernames` | list | required | `nasa`, `@nasa` or `https://www.instagram.com/nasa/` |
| `includePosts` | boolean | `false` | Adds recent posts and engagement stats (2 credits instead of 1) |
| `postsLimit` | integer | `12` | 1-60, used with `includePosts` |
| `apiKey` | secret string | none | Your Scrape Everything key |
| `maxConcurrency` | integer | `3` | Parallel requests (free plan allows 5, paid plans 20) |
| `cacheDays` | integer | `0` | 1-14 accepts a result you fetched within N days. Cache hits cost 0 credits |

```json
{
  "usernames": ["nasa", "@natgeo", "https://www.instagram.com/spacex/"],
  "includePosts": true,
  "postsLimit": 12,
  "apiKey": "ssk_live_..."
}
```

## Output

You get one dataset row per successfully scraped username. Failed usernames go to the `ERRORS` record (see below), and the run keeps going for the others.

```json
{
  "type": "profile",
  "input": "nasa",
  "id": "528817151",
  "username": "nasa",
  "full_name": "NASA",
  "biography": "Exploring the universe and our home planet.",
  "external_url": "https://www.nasa.gov/",
  "is_private": false,
  "is_verified": true,
  "is_business_account": true,
  "category_name": "Government organization",
  "follower_count": 98000000,
  "following_count": 80,
  "post_count": 4300,
  "highlight_count": 12,
  "posts": [{ "shortcode": "...", "type": "photo", "like_count": 512000, "comment_count": 1800, "caption": "...", "taken_at": 1760000000 }],
  "avg_likes": 480000,
  "avg_comments": 1650,
  "engagement_rate_pct": 0.492,
  "engagement_sample_size": 12,
  "credits_charged": 2,
  "cached": false,
  "scrapedAt": "2026-10-21T12:00:00.000Z"
}
```

### Failed inputs (not charged)

Failed usernames are **never written to the dataset**, so with pay-per-result pricing you only pay for successful rows. Instead they are saved to the run's default key-value store as the record `ERRORS`:

```json
[{ "input": "doesnotexist123", "error": { "code": "NOT_FOUND", "message": "Not found", "request_id": "req_..." } }]
```

Each failure is also logged as a warning. The run ends with a status like `Scraped 8/10, 2 failed (see ERRORS in key-value store)`. If every input fails, the run is marked as failed.

The `posts`, `avg_*` and `engagement_*` fields appear only with `includePosts`. The engagement rate is `(avg likes + avg comments) / followers × 100`, calculated over posts that show their counts.

## Cost

| Mode | API endpoint | Credits per username |
| --- | --- | --- |
| Profile only | `POST /v1/instagram/profile` | 1 |
| Profile + recent posts | `POST /v1/instagram/photos` | 2 |

- Failed requests on the platform side (blocked, timeout) are refunded automatically.
- A definite "not found / private / age-restricted" answer is billed, because the lookup was done.
- With `cacheDays`, repeated lookups cost 0 credits.

Pricing on Apify: this actor uses pay-per-result. You pay Apify per dataset row, as listed on the Store page, and your Scrape Everything credits pay for the underlying API calls.

## Errors and limits

- `401 INVALID_API_KEY` or `402 INSUFFICIENT_CREDITS` stops the run with a clear status message.
- `429` and `5xx` responses are retried up to 3 times with exponential backoff.
- Private accounts return the public subset of fields, and `posts` is empty.

## Responsible use

This actor reads **public** data only. Do not use it to collect personal data about private individuals or to bypass privacy settings, and follow the laws that apply to you, such as GDPR and CCPA, as well as Instagram's terms.

## Other actors

- TikTok Profile & Videos Scraper
- YouTube Transcript Scraper
- The full API covers 40 endpoints on 9 platforms (Instagram, TikTok, X, YouTube, Facebook, Telegram, Spotify, Pinterest and Twitch): https://scrapeeverything.com/?utm_source=apify&utm_medium=actor

## About Scrape Everything

Scrape Everything is a REST API for public social media data. Send a username, link or ID and get clean, typed JSON from Instagram, TikTok, X, YouTube, Facebook, Telegram, Spotify, Pinterest and Twitch. Pay per successful request with prepaid credits that never expire. New accounts start with 100 free credits. https://scrapeeverything.com
