import { Actor, log } from 'apify';
import {
    clampInt, clientFromEnv, ERRORS_KEY, failureRecord, fatalMessage, missingKeyMessage, normalizeList, resolveApiKey, runPool, statusSummary,
} from './client.js';
import { postsRequest, profileRequest, toItems } from './transform.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const apiKey = resolveApiKey(input);
if (!apiKey) {
    log.error(missingKeyMessage());
    await Actor.fail(missingKeyMessage());
}

const usernames = normalizeList(input.usernames);
if (usernames.length === 0) {
    const message = 'Input "usernames" is empty. Add at least one TikTok username, @handle or profile URL.';
    log.error(message);
    await Actor.fail(message);
}

const options = {
    includeVideos: input.includeVideos !== false,
    videosLimit: clampInt(input.videosLimit, { min: 1, max: 12, fallback: 12 }),
    flattenVideos: input.flattenVideos === true,
    cacheDays: clampInt(input.cacheDays, { min: 0, max: 14, fallback: 0 }),
};
const concurrency = clampInt(input.maxConcurrency, { min: 1, max: 20, fallback: 3 });
const client = clientFromEnv(apiKey);

log.info(`Scraping ${usernames.length} TikTok profile(s)`, { ...options, concurrency });

let ok = 0;
const failures = [];
const saveFailures = async () => {
    if (failures.length > 0) await Actor.setValue(ERRORS_KEY, failures);
};
try {
    await runPool(usernames, concurrency, async (username) => {
        try {
            const profileReq = profileRequest(username, options);
            const profile = await client.call(profileReq.path, profileReq.body);
            let credits = profile.meta?.credits_charged ?? 0;
            let posts = null;
            if (options.includeVideos) {
                const postsReq = postsRequest(username, options);
                const res = await client.call(postsReq.path, postsReq.body);
                posts = res.data;
                credits += res.meta?.credits_charged ?? 0;
            }
            for (const item of toItems(username, profile.data, posts, options, credits)) {
                await Actor.pushData(item);
            }
            ok += 1;
            log.info(`OK ${username}`, { credits });
        } catch (error) {
            if (error.fatal) throw error;
            failures.push(failureRecord(username, error));
            log.warning(`Failed ${username}: ${error.code} ${error.message}`);
        }
    });
} catch (error) {
    await saveFailures();
    const message = fatalMessage(error);
    log.error(message);
    await Actor.fail(message);
}

await saveFailures();
const summary = statusSummary(ok, failures);
if (ok === 0 && failures.length > 0) {
    const message = `All inputs failed: ${summary}`;
    log.error(message);
    await Actor.fail(message);
}
if (failures.length > 0) log.warning(summary);
else log.info(summary);
await Actor.exit(summary);
