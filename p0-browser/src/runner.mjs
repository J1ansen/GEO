import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { adapterFor, prepareConversation, collectAnswer, detectBlocker, CollectionError } from './adapters.mjs';
import { browserExecutable, launchContext, loadPlaywright } from './browser.mjs';
import { acquireLock, assertDay, loadBatch, readJson, recoverInterrupted, saveState, summary, writeJson } from './store.mjs';
import { platforms } from './plan.mjs';
import { requireProbeReview } from './review.mjs';

export const accountFile = (root, platform) => path.join(root, 'private', 'accounts', `${platform}.json`);
export async function loadAccount(root, platform, mode, now = new Date()) {
  if (mode === 'fixture') return { tier: 'free', basis: 'fixture_only', attested_at: now.toISOString(), account_label: 'SYNTHETIC-ACCOUNT' };
  let account;
  try { account = await readJson(accountFile(root, platform)); } catch (error) {
    if (error.code === 'ENOENT') throw new CollectionError('account_not_ready', `${platform} 免费测试账号待准备。请运行 login。`);
    throw error;
  }
  const age = now - new Date(account.attested_at);
  if (account.platform !== platform || account.tier !== 'free' || account.default_chat_confirmed !== true || account.memory_disabled !== true || account.custom_instructions_disabled !== true || !account.proof_sha256 || !Number.isFinite(age) || age < 0 || age > 7 * 86400000) throw new CollectionError('account_recheck_required', '免费账号、默认模式及个性化设置需要重新确认，请运行 login。');
  const proof = await readFile(path.join(root, 'private', 'accounts', `${platform}-plan.png`)).catch(() => null);
  if (!proof || createHash('sha256').update(proof).digest('hex') !== account.proof_sha256) throw new CollectionError('account_proof_missing', '账号确认截图缺失或不一致，请重新运行 login。');
  return account;
}

async function saveEvidence(page, attemptDir, request, response, error) {
  const files = [];
  try { await readFile(path.join(attemptDir, 'before-submit.png')); files.push('before-submit.png'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const put = async (name, body) => { await writeFile(path.join(attemptDir, name), body); files.push(name); };
  if (response) {
    await put('answer.txt', response.text);
    // Saved as text so untrusted HTML cannot execute when the evidence is opened.
    await put('answer.fragment.html.txt', response.answer_html);
    const { answer_html, ...json } = response;
    await put('response.json', `${JSON.stringify(json, null, 2)}\n`);
  }
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(attemptDir, 'page.png'), fullPage: true, timeout: 15000 });
    files.push('page.png');
    request.final_page_url = page.url();
  }
  await put('request.json', `${JSON.stringify(request, null, 2)}\n`);
  if (error) await put('error.json', `${JSON.stringify({ code: error.code ?? 'runtime_error', message: error.message }, null, 2)}\n`);
  const hashes = {};
  for (const file of files) hashes[file] = createHash('sha256').update(await readFile(path.join(attemptDir, file))).digest('hex');
  await writeJson(path.join(attemptDir, 'evidence.json'), { schema_version: 'geo.p0.evidence.v1', mode: request.mode, created_at: new Date().toISOString(), files: hashes, limitations: ['DOM extraction cannot prove server-side search activity or hidden model routing.', 'Live selectors require validation against current logged-in UI.'] });
}

export async function runBatch(root, id, {
  day = 1, limit = Infinity, fixtureOrigin, timing, onProgress = () => {}, signal,
} = {}) {
  const release = await acquireLock(root);
  const contexts = new Map();
  let batch;
  try {
    batch = await loadBatch(root, id);
    if ((batch.plan.mode === 'fixture') !== Boolean(fixtureOrigin)) throw new Error('真实与本地测试模式不能混用。');
    const today = assertDay(batch, day);
    recoverInterrupted(batch);
    await saveState(batch);
    if (batch.state.external_service_spend_usd > batch.plan.limits.external_service_usd) throw new Error('外部服务费用已超过预算，停止派发。');
    const pausedPlatforms = new Set();
    const accounts = new Map();
    for (const platform of platforms) {
      try {
        const account = await loadAccount(root, platform, batch.plan.mode);
        if (batch.plan.mode === 'live' && batch.plan.kind !== 'probe') await requireProbeReview(root, platform, account);
        accounts.set(platform, account);
      }
      catch (error) {
        pausedPlatforms.add(platform);
        for (const spec of batch.plan.samples.filter(s => s.day === day && s.platform === platform)) {
          const sample = batch.state.samples[spec.id];
          if (['pending', 'paused'].includes(sample.status)) { sample.status = 'paused'; sample.last_error = { code: error.code ?? 'account_error', message: error.message }; }
        }
        onProgress(`${platform}: ${error.message}`);
      }
    }
    let processed = 0;
    for (const spec of batch.plan.samples.filter(s => s.day === day)) {
      const sample = batch.state.samples[spec.id];
      if (signal?.aborted || processed >= limit) break;
      if (pausedPlatforms.has(spec.platform) || !['pending', 'paused'].includes(sample.status)) continue;
      const adapter = adapterFor(spec.platform, fixtureOrigin);
      if (!contexts.has(spec.platform)) {
        try { contexts.set(spec.platform, await launchContext(root, spec.platform, { fixture: batch.plan.mode === 'fixture' })); }
        catch (error) {
          sample.status = 'paused'; sample.last_error = { code: 'browser_launch_failed', message: error.message };
          pausedPlatforms.add(spec.platform); onProgress(`${spec.platform}: 浏览器启动失败。`); await saveState(batch); continue;
        }
      }
      const context = contexts.get(spec.platform);
      processed++;
      while (sample.attempts.filter(a => a.dispatched).length < batch.plan.limits.max_submitted_attempts_per_sample) {
        if (signal?.aborted) break;
        const attemptId = randomUUID();
        const evidencePath = path.posix.join('attempts', spec.id, attemptId);
        const attemptDir = path.join(batch.dir, evidencePath);
        await mkdir(attemptDir, { recursive: true });
        const attempt = { id: attemptId, status: 'running', started_at: new Date().toISOString(), dispatched: false, evidence_path: evidencePath };
        sample.attempts.push(attempt); sample.status = 'running'; sample.last_error = null; batch.state.status = 'running';
        await saveState(batch);
        const account = accounts.get(spec.platform);
        const request = {
          schema_version: 'geo.p0.request.v1', batch_id: id, sample_id: spec.id, attempt_id: attemptId,
          mode: batch.plan.mode, platform: spec.platform, adapter_revision: adapter.revision,
          adapter_live_verified: adapter.live_verified, prompt: spec.question.text, question_type: spec.question.type,
          conditions: { ...batch.plan.conditions, language: spec.question.language ?? batch.plan.conditions.language }, day, repeat: spec.repeat, started_at: attempt.started_at,
          account: { tier: account.tier, basis: account.basis, attested_at: account.attested_at, account_label: account.account_label, proof_sha256: account.proof_sha256 ?? null },
          actions: [], browser: { playwright_headless: batch.plan.mode === 'fixture', locale: 'en-US', timezone: 'America/New_York', version: context.browser()?.version() ?? null, executable: path.basename(browserExecutable((await loadPlaywright()).chromium)) },
          external_service_charge_usd: 0, charge_basis: 'browser_only_no_metered_API',
        };
        await writeJson(path.join(attemptDir, 'request.json'), request);
        let page, response;
        try {
          page = await context.newPage();
          const composer = await prepareConversation(page, adapter);
          request.actions.push({ action: 'navigate_to_new_chat', at: new Date().toISOString(), url: adapter.url });
          await composer.fill(spec.question.text);
          await page.screenshot({ path: path.join(attemptDir, 'before-submit.png'), fullPage: true, timeout: 15000 });
          request.actions.push({ action: 'submit_prompt', method: 'Enter', at: new Date().toISOString() });
          attempt.dispatched = true; attempt.submitted_at = new Date().toISOString();
          batch.state.day_dates[day] = today;
          await writeJson(path.join(attemptDir, 'request.json'), request);
          await saveState(batch);
          await composer.press('Enter');
          await page.waitForFunction(({ selector, prompt }) => [...document.querySelectorAll(selector)].some(el => el.textContent.includes(prompt)), { selector: adapter.users, prompt: spec.question.text }, { timeout: 15000 });
          response = await collectAnswer(page, adapter, {
            timeoutMs: timing?.timeoutMs ?? batch.plan.limits.answer_timeout_ms,
            stableMs: timing?.stableMs ?? batch.plan.limits.stable_answer_ms,
            pollMs: timing?.pollMs ?? batch.plan.limits.poll_ms,
            signal,
          });
          request.finished_at = new Date().toISOString();
          await saveEvidence(page, attemptDir, request, response);
          attempt.status = 'succeeded'; sample.status = 'succeeded';
          attempt.evidence_complete = true;
          onProgress(`${spec.id}: 已采集${batch.plan.mode === 'fixture' ? '（本地测试）' : '，待复核'}`);
        } catch (error) {
          const pageBlocker = !(error instanceof CollectionError) && page && !page.isClosed() ? await detectBlocker(page, adapter).catch(() => null) : null;
          const classified = error instanceof CollectionError ? error : pageBlocker ?? new CollectionError('runtime_or_ui_error', error.message, true);
          if (signal?.aborted) { classified.code = 'interrupted'; classified.pause = true; }
          attempt.status = classified.pause ? 'paused' : 'failed';
          sample.status = classified.pause ? 'paused' : 'pending';
          sample.last_error = { code: classified.code, message: classified.message };
          request.finished_at = new Date().toISOString();
          try { await saveEvidence(page, attemptDir, request, response, classified); }
          catch (evidenceError) { attempt.evidence_error = evidenceError.message; await writeJson(path.join(attemptDir, 'error.json'), sample.last_error); }
          onProgress(`${spec.id}: ${classified.code}`);
          if (classified.pause) pausedPlatforms.add(spec.platform);
        } finally {
          attempt.finished_at = new Date().toISOString();
          if (page) await page.close().catch(() => {});
          await saveState(batch);
        }
        if (['succeeded', 'paused'].includes(sample.status)) break;
        if (sample.attempts.filter(a => a.dispatched).length >= batch.plan.limits.max_submitted_attempts_per_sample) {
          sample.status = 'failed'; await saveState(batch); break;
        }
        await new Promise(resolve => setTimeout(resolve, timing?.intervalMs ?? batch.plan.limits.interval_ms));
      }
      if (sample.status === 'pending' && sample.attempts.filter(a => a.dispatched).length >= batch.plan.limits.max_submitted_attempts_per_sample) sample.status = 'failed';
      await saveState(batch);
      if (!signal?.aborted && processed < limit) await new Promise(resolve => setTimeout(resolve, timing?.intervalMs ?? batch.plan.limits.interval_ms));
    }
    const result = summary(batch);
    batch.state.status = result.counts.running ? 'running' : result.counts.needs_review ? 'needs_review' : result.counts.paused ? 'paused' : result.counts.pending ? 'pending' : 'completed';
    await saveState(batch);
    return summary(batch);
  } finally {
    for (const context of contexts.values()) await context.close().catch(() => {});
    await release();
  }
}
