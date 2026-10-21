// Runs an actor's src/main.js in Apify local mode with a temp storage dir and the given input.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function runActor(actor, input, { env = {}, storageDir } = {}) {
    const storage = storageDir || mkdtempSync(join(tmpdir(), `se-${actor}-`));
    const kvs = join(storage, 'key_value_stores', 'default');
    mkdirSync(kvs, { recursive: true });
    writeFileSync(join(kvs, 'INPUT.json'), JSON.stringify(input));

    const main = join(REPO_ROOT, 'actors', actor, 'src', 'main.js');
    const childEnv = {
        ...process.env,
        SCRAPEEVERYTHING_API_KEY: '',
        SCRAPEEVERYTHING_RETRY_BASE_MS: '5',
        CRAWLEE_STORAGE_DIR: storage,
        APIFY_LOCAL_STORAGE_DIR: storage,
        CRAWLEE_PURGE_ON_START: '0',
        APIFY_IS_AT_HOME: '',
        APIFY_TOKEN: '',
        ...env,
    };

    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [main], { cwd: storage, env: childEnv });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { stdout += d; });
        child.stderr.on('data', (d) => { stderr += d; });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr, output: stdout + stderr, items: readDataset(storage), errors: readRecord(storage, 'ERRORS'), storage }));
    });
}

export function readRecord(storage, key) {
    const file = join(storage, 'key_value_stores', 'default', `${key}.json`);
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function readDataset(storage) {
    const dir = join(storage, 'datasets', 'default');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((f) => /^\d+\.json$/.test(f))
        .sort()
        .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}
