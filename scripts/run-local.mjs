// Runs one actor locally against the mock API (no key, no credits) and prints the dataset.
//   node scripts/run-local.mjs instagram-profile-scraper
//   node scripts/run-local.mjs youtube-transcript-scraper --live   (real API, needs SCRAPEEVERYTHING_API_KEY)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startMockServer, VALID_KEY } from '../test/mock-server.mjs';
import { REPO_ROOT, runActor } from '../test/run-actor.mjs';

const actor = process.argv[2];
const live = process.argv.includes('--live');
if (!actor) {
    console.error('Usage: node scripts/run-local.mjs <actor-dir> [--live]');
    process.exit(1);
}

const schema = JSON.parse(readFileSync(join(REPO_ROOT, 'actors', actor, '.actor', 'input_schema.json'), 'utf8'));
const input = {};
for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.prefill !== undefined) input[key] = prop.prefill;
    else if (prop.default !== undefined) input[key] = prop.default;
}

let mock = null;
const env = {};
if (live) {
    if (!process.env.SCRAPEEVERYTHING_API_KEY) {
        console.error('Set SCRAPEEVERYTHING_API_KEY to run against the real API.');
        process.exit(1);
    }
    env.SCRAPEEVERYTHING_API_KEY = process.env.SCRAPEEVERYTHING_API_KEY;
    env.SCRAPEEVERYTHING_RETRY_BASE_MS = '1000';
} else {
    mock = await startMockServer();
    env.SCRAPEEVERYTHING_BASE_URL = mock.url;
    env.SCRAPEEVERYTHING_API_KEY = VALID_KEY;
}

console.log(`Running ${actor} with input`, JSON.stringify(input), live ? '(live API)' : `(mock API ${mock.url})`);
const result = await runActor(actor, input, { env });
process.stdout.write(result.output);
console.log(`\nExit code ${result.code}. Storage: ${result.storage}`);
console.log(JSON.stringify(result.items, null, 2));
if (mock) await mock.close();
process.exit(result.code ?? 1);
