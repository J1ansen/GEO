import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePlan, digest } from '../src/plan.mjs';
import { acquireLock, assertDay, createBatch, loadBatch, recoverInterrupted, saveState, summary } from '../src/store.mjs';
import { runBatch } from '../src/runner.mjs';
import { buildReport } from '../src/report.mjs';
import { startFixture } from '../src/fixture.mjs';
import { adapterFor } from '../src/adapters.mjs';
import { approveProbe, requireProbeReview } from '../src/review.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.test-output');
const timing = { timeoutMs: 1800, stableMs: 300, pollMs: 50, intervalMs: 0 };
async function setup({ mode = 'fixture', kind = 'probe', id = 'test-batch' } = {}) {
  await mkdir(workspace, { recursive: true });
  const root = await mkdtemp(path.join(workspace, 'case-'));
  await createBatch(root, makePlan({ id, kind, mode }));
  return { root, id, batch: await loadBatch(root, id) };
}

test('P0 freezes 40 planned samples; natural discovery prompts contain no target branding', () => {
  const plan = makePlan({ id: 'p0-test' });
  assert.equal(plan.samples.length, 40);
  assert.equal(new Set(plan.samples.map(s => s.id)).size, 40);
  assert.equal(plan.samples.filter(s => s.platform === 'chatgpt').length, 20);
  assert.equal(plan.samples.filter(s => s.day === 2).length, 20);
  for (const s of plan.samples.filter(s => s.question.type === 'discovery')) assert.doesNotMatch(s.question.text, /easy\s*joy|意中人|easyjoybuffet/i);
});

test('existing batches cannot be overwritten and edited manifests cannot resume', async () => {
  const { root, id, batch } = await setup();
  await assert.rejects(createBatch(root, makePlan({ id })), /EEXIST/);
  const envelope = JSON.parse(await readFile(path.join(batch.dir, 'manifest.json')));
  envelope.plan.samples[0].question.text = 'Changed after the batch was frozen';
  await writeFile(path.join(batch.dir, 'manifest.json'), JSON.stringify(envelope));
  await assert.rejects(loadBatch(root, id), /计划内容已变化/);
});

test('live day two requires a later New York date and completed day one', async () => {
  const { batch } = await setup({ mode: 'live', kind: 'p0' });
  batch.state.day_dates[1] = '2026-10-13';
  assert.throws(() => assertDay(batch, 2, new Date('2026-10-13T18:00:00Z')), /必须晚于/);
  assert.throws(() => assertDay(batch, 2, new Date('2026-10-14T18:00:00Z')), /还有未完成/);
  for (const s of batch.plan.samples.filter(s => s.day === 1)) batch.state.samples[s.id].status = 'failed';
  assert.equal(assertDay(batch, 2, new Date('2026-10-14T18:00:00Z')), '2026-10-14');
  assert.throws(() => assertDay(batch, 1, new Date('2026-10-14T18:00:00Z')), /绑定其他日期/);
});

test('a runner lock prevents concurrent use of the same profiles', async () => {
  const { root } = await setup();
  const release = await acquireLock(root);
  await assert.rejects(acquireLock(root), /已有采集或登录任务/);
  await release();
  const next = await acquireLock(root); await next();
});

test('missing accounts pause a live batch without launching a browser or submitting queries', async () => {
  const { root, id } = await setup({ mode: 'live' });
  const result = await runBatch(root, id);
  assert.equal(result.counts.paused, 4);
  assert.equal(result.by_platform.chatgpt.submitted_attempts, 0);
  const batch = await loadBatch(root, id);
  assert.deepEqual(batch.state.day_dates, {});
  assert.equal(batch.state.samples[batch.plan.samples[0].id].last_error.code, 'account_not_ready');
});

test('an exceeded external-service cap stops dispatch even when account setup is incomplete', async () => {
  const { root, id, batch } = await setup({ mode: 'live' });
  batch.state.external_service_spend_usd = 21; await saveState(batch);
  await assert.rejects(runBatch(root, id), /超过预算/);
  assert.equal(summary(await loadBatch(root, id)).by_platform.chatgpt.submitted_attempts, 0);
});

test('interrupted attempts require review and are never automatically treated as success', async () => {
  const { batch } = await setup();
  const s = batch.state.samples[batch.plan.samples[0].id];
  s.status = 'running'; s.attempts.push({ id: 'interrupted', status: 'running', dispatched: true });
  assert.equal(recoverInterrupted(batch), 1);
  assert.equal(s.status, 'needs_review');
  assert.equal(summary(batch).counts.succeeded, 0);
  assert.equal(recoverInterrupted(batch), 0);
});

test('fixtures can never target external hosts or be substituted for a live batch', async () => {
  assert.throws(() => adapterFor('chatgpt', 'https://example.com'), /回环地址/);
  const { root, id } = await setup({ mode: 'live' });
  await assert.rejects(runBatch(root, id, { fixtureOrigin: 'http://127.0.0.1:1234' }), /不能混用/);
});

test('neither fixture nor incomplete real probes can authorize the full P0 batch', async () => {
  const fixture = await setup();
  await assert.rejects(approveProbe(fixture.root, fixture.id, 'test review'), /本地模拟结果不能/);
  const live = await setup({ mode: 'live' });
  await assert.rejects(approveProbe(live.root, live.id, 'test review'), /未成功/);
  await assert.rejects(requireProbeReview(live.root, 'chatgpt', {}), /先完成真实 probe/);
});

test('browser collection waits for completion, saves evidence, escapes report text and resumes without duplicates', async () => {
  const { root, id } = await setup();
  const fixture = await startFixture({ answer: 'FINAL FIXTURE ANSWER <script>alert("untrusted")</script> You have reached your usage limit (quoted answer, not a UI alert).' });
  try {
    const result = await runBatch(root, id, { fixtureOrigin: fixture.origin, timing });
    assert.equal(result.counts.succeeded, 4);
    assert.equal(result.formal_acceptance, 'ineligible_fixture');
    assert.equal(result.collection_threshold_met, false);
    const batch = await loadBatch(root, id);
    const attempt = batch.state.samples[batch.plan.samples[0].id].attempts[0];
    const dir = path.join(batch.dir, attempt.evidence_path);
    const response = JSON.parse(await readFile(path.join(dir, 'response.json')));
    assert.match(response.text, /FINAL FIXTURE ANSWER/);
    assert.doesNotMatch(response.text, /^Working$/);
    assert.equal(response.citations.length, 1);
    assert.equal(response.actual_search, 'unknown');
    const evidence = JSON.parse(await readFile(path.join(dir, 'evidence.json')));
    assert.ok(evidence.files['before-submit.png']);
    assert.ok(evidence.files['page.png']);
    assert.equal(evidence.files['answer.txt'], digest(await readFile(path.join(dir, 'answer.txt'), 'utf8')));
    const html = await readFile(await buildReport(root, id), 'utf8');
    assert.match(html, /不是 ChatGPT \/ Gemini 实测/);
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>alert'));
    const rerun = await runBatch(root, id, { fixtureOrigin: fixture.origin, timing });
    assert.equal(rerun.by_platform.chatgpt.attempts + rerun.by_platform.gemini.attempts, 4);
  } finally { await fixture.close(); }
});

for (const [scenario, code] of [['login', 'login_required'], ['captcha', 'verification_required'], ['quota', 'quota_exhausted'], ['anonymous', 'account_unverified'], ['stale', 'not_new_conversation']]) {
  test(`${scenario} pauses before any prompt is dispatched`, async () => {
    const { root, id } = await setup();
    const fixture = await startFixture({ scenarios: { chatgpt: scenario } });
    try {
      const result = await runBatch(root, id, { fixtureOrigin: fixture.origin, timing, limit: 1 });
      assert.equal(result.by_platform.chatgpt.submitted_attempts, 0);
      const batch = await loadBatch(root, id), sample = batch.state.samples[batch.plan.samples[0].id];
      assert.equal(sample.status, 'paused');
      assert.equal(sample.last_error.code, code);
    } finally { await fixture.close(); }
  });
}

test('a streaming timeout retries within the bound but counts as one failed logical sample', async () => {
  const { root, id } = await setup();
  const fixture = await startFixture({ scenarios: { chatgpt: 'timeout' } });
  try {
    const result = await runBatch(root, id, { fixtureOrigin: fixture.origin, timing: { ...timing, timeoutMs: 500 }, limit: 1 });
    assert.equal(result.counts.failed, 1);
    assert.equal(result.counts.succeeded, 0);
    assert.equal(result.by_platform.chatgpt.submitted_attempts, 2);
    const batch = await loadBatch(root, id), sample = batch.state.samples[batch.plan.samples[0].id];
    assert.equal(sample.attempts.length, 2);
    assert.equal(sample.last_error.code, 'answer_timeout');
  } finally { await fixture.close(); }
});
