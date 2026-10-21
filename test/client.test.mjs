import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import {
    ApiError, clampInt, createClient, failureRecord, normalizeList, resolveApiKey, runPool, statusSummary,
} from '../shared/client.js';
import { REPO_ROOT } from './run-actor.mjs';

const jsonResponse = (status, body, headers = {}) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
});

test('actor copies of client.js match shared/client.js', () => {
    execFileSync(process.execPath, [join(REPO_ROOT, 'scripts', 'sync-shared.mjs'), '--check'], { stdio: 'pipe' });
});

test('resolveApiKey prefers input over env', () => {
    assert.equal(resolveApiKey({ apiKey: ' a ' }, { SCRAPEEVERYTHING_API_KEY: 'b' }), 'a');
    assert.equal(resolveApiKey({}, { SCRAPEEVERYTHING_API_KEY: 'b' }), 'b');
    assert.equal(resolveApiKey({ apiKey: '' }, {}), null);
});

test('normalizeList trims and dedupes case-insensitively', () => {
    assert.deepEqual(normalizeList([' nasa ', 'NASA', '', null, 'natgeo']), ['nasa', 'natgeo']);
    assert.deepEqual(normalizeList(undefined), []);
});

test('clampInt', () => {
    assert.equal(clampInt('99', { min: 1, max: 60, fallback: 12 }), 60);
    assert.equal(clampInt(undefined, { min: 1, max: 60, fallback: 12 }), 12);
});

test('client sends bearer auth and returns data + meta', async () => {
    let seen;
    const client = createClient({
        apiKey: 'k',
        baseUrl: 'https://api.test/',
        fetchImpl: async (url, init) => { seen = { url, init }; return jsonResponse(200, { success: true, data: { a: 1 }, meta: { credits_charged: 1 } }); },
    });
    const res = await client.call('/v1/x/profile', { username: 'tesla' });
    assert.deepEqual(res, { data: { a: 1 }, meta: { credits_charged: 1 } });
    assert.equal(seen.url, 'https://api.test/v1/x/profile');
    assert.equal(seen.init.headers.Authorization, 'Bearer k');
    assert.equal(seen.init.body, '{"username":"tesla"}');
});

test('client retries 429/5xx up to maxRetries then throws', async () => {
    let calls = 0;
    const client = createClient({
        apiKey: 'k',
        maxRetries: 3,
        sleep: async () => {},
        fetchImpl: async () => { calls += 1; return jsonResponse(429, { success: false, code: 'RATE_LIMITED', message: 'slow down', request_id: 'r1' }); },
    });
    await assert.rejects(client.call('/v1/a/b', {}), (e) => e instanceof ApiError && e.code === 'RATE_LIMITED' && e.requestId === 'r1');
    assert.equal(calls, 4);
});

test('client does not retry 4xx and marks 401/402 as fatal', async () => {
    let calls = 0;
    const make = (status, code) => createClient({
        apiKey: 'k',
        sleep: async () => {},
        fetchImpl: async () => { calls += 1; return jsonResponse(status, { success: false, code, message: code }); },
    });
    await assert.rejects(make(404, 'NOT_FOUND').call('/p', {}), (e) => e.fatal === false);
    await assert.rejects(make(401, 'INVALID_API_KEY').call('/p', {}), (e) => e.fatal === true);
    await assert.rejects(make(402, 'INSUFFICIENT_CREDITS').call('/p', {}), (e) => e.fatal === true);
    assert.equal(calls, 3);
});

test('runPool respects concurrency and stops on error', async () => {
    let active = 0;
    let peak = 0;
    const done = [];
    await runPool([1, 2, 3, 4, 5], 2, async (n) => {
        active += 1; peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        done.push(n); active -= 1;
    });
    assert.equal(peak, 2);
    assert.equal(done.length, 5);

    const started = [];
    await assert.rejects(runPool([1, 2, 3, 4], 1, async (n) => { started.push(n); if (n === 2) throw new Error('stop'); }), /stop/);
    assert.deepEqual(started, [1, 2]);
});

test('failureRecord and statusSummary', () => {
    const rec = failureRecord('nasa', new ApiError('Not found', { status: 404, code: 'NOT_FOUND', requestId: 'r9' }));
    assert.deepEqual(rec, { input: 'nasa', error: { code: 'NOT_FOUND', message: 'Not found', request_id: 'r9' } });
    assert.equal(failureRecord('x', new Error('boom')).error.code, 'INTERNAL_ERROR');
    assert.equal(statusSummary(8, new Array(2).fill(rec)), 'Scraped 8/10, 2 failed (see ERRORS in key-value store)');
    assert.equal(statusSummary(3, []), 'Scraped 3/3.');
});
