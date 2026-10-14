import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest, safeId, dateInZone } from './plan.mjs';

export const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}
export function batchDir(root, id) { return path.join(root, 'runs', safeId(id)); }
export async function createBatch(root, plan) {
  const dir = batchDir(root, plan.id);
  await mkdir(path.dirname(dir), { recursive: true });
  await mkdir(dir);
  await writeJson(path.join(dir, 'manifest.json'), { plan, sha256: digest(plan) });
  await writeJson(path.join(dir, 'state.json'), {
    schema_version: 'geo.p0.state.v1', plan_sha256: digest(plan), status: 'pending', day_dates: {},
    external_service_spend_usd: 0, external_service_spend_basis: 'No metered external API integrated in this browser-only P0.',
    samples: Object.fromEntries(plan.samples.map(s => [s.id, { status: 'pending', attempts: [], last_error: null }])),
  });
  return dir;
}
export async function loadBatch(root, id) {
  const dir = batchDir(root, id);
  const envelope = await readJson(path.join(dir, 'manifest.json'));
  const state = await readJson(path.join(dir, 'state.json'));
  if (digest(envelope.plan) !== envelope.sha256 || state.plan_sha256 !== envelope.sha256) throw new Error('计划内容已变化：请创建新批次，不要修改已有测试条件。');
  return { dir, plan: envelope.plan, state };
}
export const saveState = batch => writeJson(path.join(batch.dir, 'state.json'), batch.state);

export async function acquireLock(root) {
  const dir = path.join(root, 'private');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'runner.lock');
  const token = randomUUID();
  try {
    const handle = await open(file, 'wx', 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, token, started_at: new Date().toISOString() }));
    await handle.close();
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error('已有采集或登录任务，或上次退出留下锁。请先运行 recover；不要同时使用同一测试档案。');
  }
  return async () => {
    const lock = await readJson(file);
    if (lock.token === token) await unlink(file);
  };
}
export async function recoverLock(root) {
  const file = path.join(root, 'private', 'runner.lock');
  let lock;
  try { lock = await readJson(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  try { process.kill(lock.pid, 0); } catch (error) {
    if (error.code === 'ESRCH') { await unlink(file); return; }
    throw error;
  }
  throw new Error(`进程 ${lock.pid} 仍在运行；不移除其锁。`);
}
export function assertDay(batch, day, now = new Date()) {
  if (!Number.isInteger(day) || !batch.plan.samples.some(s => s.day === day)) throw new Error('无效测试日。');
  const today = dateInZone(now, batch.plan.conditions.calendar_timezone);
  const existing = batch.state.day_dates[day];
  if (existing && existing !== today && batch.plan.mode === 'live') throw new Error('本测试日已绑定其他日期，请建立新批次；不能把跨日补采混入原日期。');
  if (day === 2 && batch.plan.mode === 'live') {
    if (!batch.state.day_dates[1] || today <= batch.state.day_dates[1]) throw new Error('第 2 天必须晚于第 1 天，按纽约日期判断。');
    if (batch.plan.samples.some(s => s.day === 1 && !['succeeded', 'failed'].includes(batch.state.samples[s.id].status))) throw new Error('第 1 天还有未完成或待处理样本，请先完成或明确关闭。');
  }
  return today;
}
export function recoverInterrupted(batch) {
  let count = 0;
  for (const sample of Object.values(batch.state.samples)) {
    for (const attempt of sample.attempts) {
      if (attempt.status === 'running') {
        attempt.status = 'interrupted'; attempt.finished_at = new Date().toISOString();
        sample.status = 'needs_review'; sample.last_error = { code: 'interrupted', message: '运行中断，是否已经提交可能未知。请复核后显式 retry 或 close。' }; count++;
      }
    }
  }
  if (count) batch.state.status = 'needs_review';
  return count;
}
export function summary(batch) {
  const counts = { pending: 0, running: 0, succeeded: 0, paused: 0, failed: 0, needs_review: 0 };
  const byPlatform = {};
  for (const spec of batch.plan.samples) {
    const s = batch.state.samples[spec.id];
    counts[s.status] = (counts[s.status] ?? 0) + 1;
    const p = byPlatform[spec.platform] ??= { planned: 0, succeeded: 0, attempts: 0, submitted_attempts: 0 };
    p.planned++; p.succeeded += Number(s.status === 'succeeded'); p.attempts += s.attempts.length;
    p.submitted_attempts += s.attempts.filter(a => a.dispatched).length;
  }
  for (const p of Object.values(byPlatform)) p.success_rate = p.succeeded / p.planned;
  const completed = batch.plan.samples.every(s => ['succeeded', 'failed'].includes(batch.state.samples[s.id].status));
  const dates = new Set(Object.values(batch.state.day_dates));
  const quantitativeGate = completed && Object.values(byPlatform).every(p => p.success_rate >= batch.plan.acceptance.minimum_success_rate_per_platform) && (!batch.plan.acceptance.two_distinct_dates_required || dates.size >= 2);
  return {
    batch_id: batch.plan.id, mode: batch.plan.mode, kind: batch.plan.kind, planned: batch.plan.samples.length, counts, by_platform: byPlatform,
    collection_threshold_met: batch.plan.mode === 'live' && quantitativeGate,
    formal_acceptance: batch.plan.mode === 'fixture' ? 'ineligible_fixture' : 'requires_human_evidence_review',
    external_service_spend_usd: batch.state.external_service_spend_usd,
  };
}
