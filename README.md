# Scrape Everything actors for Apify

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Public social data as clean JSON. This repo holds the source for three [Apify](https://apify.com) actors powered by the [Scrape Everything API](https://scrapeeverything.com/?utm_source=github&utm_medium=apify):

| Actor | Folder | API endpoints | Credits per input |
| --- | --- | --- | --- |
| Instagram Profile Scraper (Scrape Everything API) | `actors/instagram-profile-scraper` | `instagram.profile` / `instagram.photos` | 1 / 2 |
| TikTok Profile & Videos Scraper | `actors/tiktok-profile-videos-scraper` | `tiktok.profile` + `tiktok.posts` | 1-2 |
| YouTube Transcript Scraper | `actors/youtube-transcript-scraper` | `youtube.transcript` (+ `youtube.video`) | 1-2 |

Failed inputs are kept out of the dataset and saved as the `ERRORS` key-value store record, and the final status reads like `Scraped 8/10, 2 failed (see ERRORS in key-value store)`.

Users bring their own Scrape Everything API key through a secret `apiKey` input. New accounts get 100 free credits. If there is no key, the actor fails at once with setup instructions.

## Layout

```
shared/client.js        API client (source of truth): auth, retries, errors, concurrency pool
scripts/sync-shared.mjs copies shared/client.js into actors/*/src/client.js (--check verifies)
scripts/run-local.mjs   runs one actor against the mock API (or --live against the real API)
test/mock-server.mjs    mock Scrape Everything API (node:http)
test/*.test.mjs         client unit tests + end-to-end actor runs in Apify local mode
actors/<name>/
  .actor/actor.json            actor definition
  .actor/input_schema.json     input UI (apiKey is a secret input)
  .actor/dataset_schema.json   dataset views for the Output tab
  src/main.js, src/transform.js, src/client.js (synced copy)
  test/transform.test.js       pure unit tests
  Dockerfile, package.json, README.md (the Store page)
```

Each actor folder is self-contained, because Apify builds each one on its own. Edit `shared/client.js`, never the copies, then run `npm run sync`.

## Develop

```bash
npm install
npm run install:all      # installs the apify SDK in each actor
npm test                 # sync check + client tests + e2e actor runs on the mock API + actor unit tests
npm run local:instagram  # also local:tiktok, local:youtube; prints the dataset
SCRAPEEVERYTHING_API_KEY=ssk_live_... node scripts/run-local.mjs youtube-transcript-scraper --live
```

Environment overrides: `SCRAPEEVERYTHING_API_KEY` (used when the `apiKey` input is empty), `SCRAPEEVERYTHING_BASE_URL` (default `https://api.scrapeeverything.com`) and `SCRAPEEVERYTHING_RETRY_BASE_MS`.

## Publish to the Apify Store (founder checklist)

1. **Push this repo** to GitHub as `scrapeeverything/apify-actors`. It can be public or private.
2. **Create each actor** in Apify Console > Actors > Develop new > *Link Git repository*:
   - Git URL: `https://github.com/scrapeeverything/apify-actors#main:actors/instagram-profile-scraper` (the `#branch:folder` syntax builds from a subfolder). Repeat this for the other two folders.
   - Alternative: `npm i -g apify-cli && apify login`, then run `apify push` inside each `actors/<name>` folder.
3. **Build** each actor once, then run it with your own key to check the Output tab views.
4. **Publication tab** for each actor:
   - Title: use the one in `.actor/actor.json`. Set a short description and an icon (the Scrape Everything logo).
   - Categories: Instagram uses *Social media, Lead generation*. TikTok uses *Social media, Videos*. YouTube uses *Videos, AI*.
   - SEO title and description: lead with the keyword, for example "Instagram Profile Scraper", "TikTok Profile Scraper", "YouTube Transcript API".
   - The README is picked up from the actor folder.
5. **Monetization** (Publication > Monetization > *Pay per result*): set the price per 1,000 dataset items. Pricing notes:
   - The user also pays Scrape Everything credits with their own key, so the Apify price is a convenience fee on top. Keep it low to win Store ranking, for example `$X` per 1,000 results, and compare it with competing actors in the same category.
   - Credits per result: Instagram 1 (2 with posts), TikTok 1-2, YouTube 1-2. Flat TikTok mode makes up to 13 rows per profile, so tell users that, or price per profile row only by suggesting `flattenVideos: false`.
   - Only successful results are pushed to the dataset. Failed inputs go to the `ERRORS` key-value store record (`[{input, error:{code,message,request_id}}]`), so users never pay per-result for failures. A run where every input fails is marked as failed.
6. **Make it public** and add the Store links to scrapeeverything.com, the docs, and the `scrapeeverything/skills` README.

## About Scrape Everything

Scrape Everything is a REST API for public social media data. Send a username, link or ID and get clean, typed JSON from Instagram, TikTok, X, YouTube, Facebook, Telegram, Spotify, Pinterest and Twitch. Pay per successful request with prepaid credits that never expire. New accounts start with 100 free credits. https://scrapeeverything.com

## License

MIT
