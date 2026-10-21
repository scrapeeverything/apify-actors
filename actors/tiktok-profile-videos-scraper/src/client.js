// Scrape Everything API client shared by every actor in this repo.
//
// Source of truth: shared/client.js at the repo root. `npm run sync` copies it into
// actors/*/src/client.js because Apify builds each actor directory on its own.
// Do not edit the copies; edit this file and run `npm run sync`.

export const DEFAULT_BASE_URL = 'https://api.scrapeeverything.com';
export const SIGNUP_URL = 'https://scrapeeverything.com/?utm_source=apify&utm_medium=actor';

// Errors that make every further request pointless, so the run stops instead of
// pushing one error item per input.
const FATAL_STATUS = new Set([401, 402, 403]);
const FATAL_CODES = new Set(['INVALID_API_KEY', 'UNAUTHORIZED', 'INSUFFICIENT_CREDITS', 'ACCOUNT_SUSPENDED']);

export class ApiError extends Error {
    constructor(message, { status = 0, code = 'UNKNOWN_ERROR', requestId = null } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.requestId = requestId;
    }

    get fatal() {
        return FATAL_STATUS.has(this.status) || FATAL_CODES.has(this.code);
    }

    toItemError() {
        return { code: this.code, message: this.message, status: this.status || null, request_id: this.requestId };
    }
}

export function resolveApiKey(input = {}, env = process.env) {
    const fromInput = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
    if (fromInput) return fromInput;
    const fromEnv = typeof env.SCRAPEEVERYTHING_API_KEY === 'string' ? env.SCRAPEEVERYTHING_API_KEY.trim() : '';
    return fromEnv || null;
}

export function missingKeyMessage() {
    return [
        'Missing Scrape Everything API key.',
        'This actor calls the Scrape Everything API with your own key.',
        `1) Create a free account at ${SIGNUP_URL} (new accounts get 100 free credits).`,
        '2) Copy your API key from the dashboard.',
        '3) Paste it into the "Scrape Everything API key" input field (it is stored as a secret),',
        '   or set the SCRAPEEVERYTHING_API_KEY environment variable on the actor.',
    ].join('\n');
}

export function fatalMessage(error) {
    if (error.code === 'INSUFFICIENT_CREDITS' || error.status === 402) {
        return `Your Scrape Everything account is out of credits (${error.code}). Top up at ${SIGNUP_URL} and run again.`;
    }
    if (error.status === 401 || error.code === 'INVALID_API_KEY' || error.code === 'UNAUTHORIZED') {
        return `The Scrape Everything API key was rejected (${error.code}). Check the "apiKey" input or create a new key at ${SIGNUP_URL}.`;
    }
    return `Scrape Everything API refused the request (${error.code}): ${error.message}`;
}

// Trims, drops empty values and duplicates while keeping the original order.
export function normalizeList(values) {
    if (!Array.isArray(values)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of values) {
        if (raw === null || raw === undefined) continue;
        const value = String(raw).trim();
        if (!value || seen.has(value.toLowerCase())) continue;
        seen.add(value.toLowerCase());
        out.push(value);
    }
    return out;
}

export function clampInt(value, { min, max, fallback }) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(attempt, baseMs, retryAfterHeader) {
    const retryAfter = Number.parseFloat(retryAfterHeader);
    if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, 30_000);
    return baseMs * 2 ** attempt;
}

export function createClient({
    apiKey,
    baseUrl = DEFAULT_BASE_URL,
    maxRetries = 3,
    retryBaseMs = 1000,
    timeoutMs = 90_000,
    fetchImpl = globalThis.fetch,
    sleep = defaultSleep,
    userAgent = 'scrapeeverything-apify-actor/0.1',
} = {}) {
    if (!apiKey) throw new Error('createClient: apiKey is required');
    const root = String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

    // POST <path> with a JSON body. Resolves to { data, meta } or throws ApiError.
    async function call(path, body = {}) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
            let response;
            try {
                response = await fetchImpl(`${root}${path}`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'User-Agent': userAgent,
                    },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(timeoutMs),
                });
            } catch (networkError) {
                lastError = new ApiError(`Network error: ${networkError.message}`, { code: 'NETWORK_ERROR' });
                if (attempt < maxRetries) {
                    await sleep(retryDelay(attempt, retryBaseMs));
                    continue;
                }
                throw lastError;
            }

            let payload = null;
            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

            if (response.ok && payload && payload.success !== false) {
                return { data: payload.data, meta: payload.meta || null };
            }

            lastError = new ApiError(payload?.message || `HTTP ${response.status}`, {
                status: response.status,
                code: payload?.code || (response.ok ? 'INVALID_RESPONSE' : `HTTP_${response.status}`),
                requestId: payload?.request_id || response.headers.get('x-request-id') || null,
            });

            const retryable = response.status === 429 || response.status >= 500;
            if (retryable && attempt < maxRetries) {
                await sleep(retryDelay(attempt, retryBaseMs, response.headers.get('retry-after')));
                continue;
            }
            throw lastError;
        }
        throw lastError;
    }

    return { call, baseUrl: root };
}

// Runs worker(item, index) with at most `concurrency` in flight. If a worker throws,
// no new items are started and the first error is rethrown after in-flight work ends.
export async function runPool(items, concurrency, worker) {
    let next = 0;
    let failure = null;
    const size = Math.max(1, Math.min(concurrency || 1, items.length || 1));
    const lanes = Array.from({ length: size }, async () => {
        while (failure === null && next < items.length) {
            const index = next;
            next += 1;
            try {
                await worker(items[index], index);
            } catch (error) {
                if (failure === null) failure = error;
            }
        }
    });
    await Promise.all(lanes);
    if (failure !== null) throw failure;
}

// Builds a client from actor input + env. Env overrides exist for tests and self-hosting.
export function clientFromEnv(apiKey, env = process.env) {
    return createClient({
        apiKey,
        baseUrl: env.SCRAPEEVERYTHING_BASE_URL || DEFAULT_BASE_URL,
        retryBaseMs: clampInt(env.SCRAPEEVERYTHING_RETRY_BASE_MS, { min: 0, max: 60_000, fallback: 1000 }),
    });
}

// Failed inputs are NOT pushed to the dataset (pay-per-result users must not pay for them).
// They are collected and saved to the default key-value store as record ERRORS_KEY.
export const ERRORS_KEY = 'ERRORS';

export function failureRecord(input, error) {
    const isApi = error instanceof ApiError;
    return {
        input,
        error: {
            code: isApi ? error.code : 'INTERNAL_ERROR',
            message: String(error?.message || error),
            request_id: isApi ? error.requestId : null,
        },
    };
}

// Final status message, e.g. "Scraped 8/10, 2 failed (see ERRORS in key-value store)".
export function statusSummary(ok, failures, verb = 'Scraped') {
    const total = ok + failures.length;
    if (failures.length === 0) return `${verb} ${ok}/${total}.`;
    return `${verb} ${ok}/${total}, ${failures.length} failed (see ${ERRORS_KEY} in key-value store)`;
}
