import { Actor, log } from 'apify';
import {
    clampInt, clientFromEnv, ERRORS_KEY, failureRecord, fatalMessage, missingKeyMessage, normalizeList, resolveApiKey, runPool, statusSummary,
} from './client.js';
import { toItem, transcriptRequest, videoRequest } from './transform.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const apiKey = resolveApiKey(input);
if (!apiKey) {
    log.error(missingKeyMessage());
    await Actor.fail(missingKeyMessage());
}

const videos = normalizeList(input.videos);
if (videos.length === 0) {
    const message = 'Input "videos" is empty. Add at least one YouTube video URL or 11-character video ID.';
    log.error(message);
    await Actor.fail(message);
}

const options = {
    lang: typeof input.lang === 'string' && input.lang.trim() ? input.lang.trim() : null,
    includeVideoDetails: input.includeVideoDetails === true,
    includeSegments: input.includeSegments !== false,
    cacheDays: clampInt(input.cacheDays, { min: 0, max: 14, fallback: 0 }),
};
const concurrency = clampInt(input.maxConcurrency, { min: 1, max: 20, fallback: 3 });
const client = clientFromEnv(apiKey);

log.info(`Fetching ${videos.length} YouTube transcript(s)`, { ...options, concurrency });

let ok = 0;
const failures = [];
const saveFailures = async () => {
    if (failures.length > 0) await Actor.setValue(ERRORS_KEY, failures);
};
try {
    await runPool(videos, concurrency, async (video) => {
        try {
            const tReq = transcriptRequest(video, options);
            const transcript = await client.call(tReq.path, tReq.body);
            let credits = transcript.meta?.credits_charged ?? 0;
            let details = null;
            if (options.includeVideoDetails) {
                const vReq = videoRequest(video, options);
                const res = await client.call(vReq.path, vReq.body);
                details = res.data;
                credits += res.meta?.credits_charged ?? 0;
            }
            await Actor.pushData(toItem(video, transcript.data, details, options, credits));
            ok += 1;
            log.info(`OK ${video}`, { credits });
        } catch (error) {
            if (error.fatal) throw error;
            failures.push(failureRecord(video, error));
            log.warning(`Failed ${video}: ${error.code} ${error.message}`);
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
