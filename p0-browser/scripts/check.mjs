import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let checked = 0;
for (const dir of ['src', 'scripts', 'test']) {
  for (const file of await readdir(path.join(root, dir))) {
    if (!file.endsWith('.mjs')) continue;
    const result = spawnSync(process.execPath, ['--check', path.join(root, dir, file)], { encoding: 'utf8' });
    if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
    checked++;
  }
}
console.log(`Syntax checked ${checked} JavaScript modules.`);
