import { Actor, log } from 'apify';
import {
    clampInt, clientFromEnv, ERRORS_KEY, failureRecord, fatalMessage, missingKeyMessage, normalizeList, resolveApiKey, runPool, statusSummary,
} from './client.js';
import { buildRequest, toItem } from './transform.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const apiKey = resolveApiKey(input);
if (!apiKey) {
    log.error(missingKeyMessage());
    await Actor.fail(missingKeyMessage());
}

const usernames = normalizeList(input.usernames);
if (usernames.length === 0) {
    const message = 'Input "usernames" is empty. Add at least one Instagram username, @handle or profile URL.';
    log.error(message);
    await Actor.fail(message);
}

const options = {
    includePosts: input.includePosts === true,
    postsLimit: clampInt(input.postsLimit, { min: 1, max: 60, fallback: 12 }),
    cacheDays: clampInt(input.cacheDays, { min: 0, max: 14, fallback: 0 }),
};
const concurrency = clampInt(input.maxConcurrency, { min: 1, max: 20, fallback: 3 });
const client = clientFromEnv(apiKey);

log.info(`Scraping ${usernames.length} Instagram profile(s)`, { ...options, concurrency });

let ok = 0;
const failures = [];
const saveFailures = async () => {
    if (failures.length > 0) await Actor.setValue(ERRORS_KEY, failures);
};
try {
    await runPool(usernames, concurrency, async (username) => {
        const { path, body } = buildRequest(username, options);
        try {
            const { data, meta } = await client.call(path, body);
            await Actor.pushData(toItem(username, data, meta, options));
            ok += 1;
            log.info(`OK ${username}`, { credits: meta?.credits_charged });
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
