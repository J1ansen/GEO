import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['repos/Elmo/.env', 'repos/Elmo/apps/web/.env'].map(p => path.join(root, p));
let input = '';
try {
  if (targets.some(p => existsSync(p))) throw new Error('Configuration exists; no files were changed.');
  for await (const chunk of process.stdin) {
    input += chunk.toString('utf8');
    if (input.length > 8192) throw new Error('Input exceeds the supported size.');
  }
  const fields = input.split('\n');
  if (fields.length !== 4 || fields[3] !== '') throw new Error('Use bash mac/configure.sh to enter configuration.');
  const [user, port, password] = fields;
  if (!user.trim() || !password || /[\r\0]/.test(input) || !/^\d+$/.test(port) || +port < 1 || +port > 65535) {
    throw new Error('Invalid database user, password or port.');
  }
  const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${+port}/restaurant_p1`;
  const content = [
    `DATABASE_URL=${databaseUrl}`,
    'DEPLOYMENT_MODE=local', 'VITE_DEPLOYMENT_MODE=local',
    `BETTER_AUTH_SECRET=${randomBytes(32).toString('base64')}`,
    `ELMO_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
    'APP_URL=http://localhost:3010', 'VITE_APP_URL=http://localhost:3010',
    'DISABLE_TELEMETRY=1', 'SCRAPE_TARGETS=stub:stub', 'ONBOARDING_LLM_TARGET=stub:stub', '',
  ].join('\n');
  const created = [];
  try {
    for (const target of targets) {
      writeFileSync(target, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      created.push(target);
    }
  } catch (error) {
    // Roll back only the new files created by this invocation.
    for (const target of created) unlinkSync(target);
    throw error;
  }
  console.log('Created local configuration with fresh keys; no database was changed.');
} catch (error) {
  console.error(error.code ? `Configuration failed (${error.code}). Check local paths and permissions.` : error.message);
  process.exitCode = 1;
} finally { input = ''; }
