// Copies shared/client.js into every actor (Apify builds each actor directory on its own).
//   node scripts/sync-shared.mjs          copy
//   node scripts/sync-shared.mjs --check  exit 1 if any copy differs
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'shared', 'client.js'), 'utf8');
const check = process.argv.includes('--check');
const actorsDir = join(root, 'actors');

let drift = 0;
for (const name of readdirSync(actorsDir)) {
    const target = join(actorsDir, name, 'src', 'client.js');
    if (!existsSync(join(actorsDir, name, 'src'))) continue;
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
    if (current === source) continue;
    if (check) {
        drift += 1;
        console.error(`out of sync: actors/${name}/src/client.js`);
    } else {
        writeFileSync(target, source);
        console.log(`synced actors/${name}/src/client.js`);
    }
}
if (check && drift) {
    console.error('Run `npm run sync` to copy shared/client.js into every actor.');
    process.exit(1);
}
if (check) console.log('All actor clients match shared/client.js');
