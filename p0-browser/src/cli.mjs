import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { makePlan, makeRetest, platforms, safeId } from './plan.mjs';
import { acquireLock, batchDir, createBatch, loadBatch, recoverInterrupted, recoverLock, saveState, summary, writeJson } from './store.mjs';
import { browserExecutable, launchContext, loadPlaywright } from './browser.mjs';
import { adapters } from './adapters.mjs';
import { accountFile, loadAccount, runBatch } from './runner.mjs';
import { buildReport } from './report.mjs';
import { startFixture } from './fixture.mjs';
import { approveProbe } from './review.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { batch: { type: 'string' }, kind: { type: 'string' }, bank: { type: 'string' }, baseline: { type: 'string' }, day: { type: 'string' }, limit: { type: 'string' }, platform: { type: 'string' }, sample: { type: 'string' }, reason: { type: 'string' } },
});
function batchId() { if (!values.batch) throw new Error('请指定 --batch，例如 easyjoy-p0-001。'); return safeId(values.batch); }
function positive(value, fallback) { if (value === undefined) return fallback; const n = Number(value); if (!Number.isInteger(n) || n < 1) throw new Error('day / limit 必须是正整数。'); return n; }
const print = object => console.log(JSON.stringify(object, null, 2));

async function login(platform) {
  if (!platforms.includes(platform)) throw new Error('请指定 --platform chatgpt 或 gemini。');
  if (!process.stdin.isTTY) throw new Error('login 需要你在本机交互终端操作；密码只在浏览器输入。');
  const release = await acquireLock(root);
  let context, terminal;
  try {
    context = await launchContext(root, platform);
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(adapters[platform].url, { waitUntil: 'domcontentloaded' });
    terminal = createInterface({ input: process.stdin, output: process.stdout });
    console.log('请在打开的专用浏览器中登录项目免费账号。不要使用个人主浏览器档案。');
    console.log('打开账号套餐页，确认没有付费订阅。截图将保存在本机 private 目录，不进入报告。');
    const tier = await terminal.question('套餐页已显示免费状态后，输入 FREE 并回车；其他输入取消：');
    if (tier.trim() !== 'FREE') throw new Error('未确认免费账号，未登记就绪状态。');
    const accountDir = path.dirname(accountFile(root, platform));
    await mkdir(accountDir, { recursive: true });
    const proof = path.join(accountDir, `${platform}-plan.png`);
    const visiblePage = context.pages().at(-1) ?? page;
    await visiblePage.screenshot({ path: proof, fullPage: true });
    console.log('请关闭记忆／历史个性化与自定义指令，返回默认聊天，不选择搜索、深度研究或专用模式。');
    const ready = await terminal.question('上述设置已检查后输入 READY；其他输入取消：');
    if (ready.trim() !== 'READY') throw new Error('默认聊天条件尚未确认。');
    const label = (await terminal.question(`账号代号（不用邮箱，回车采用 ${platform}-free-01）：`)).trim() || `${platform}-free-01`;
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(label)) throw new Error('账号代号只接受字母、数字、下划线和短横线。');
    await writeJson(accountFile(root, platform), {
      platform, tier: 'free', account_label: label, basis: 'human_confirmed_with_local_plan_screenshot',
      attested_at: new Date().toISOString(), default_chat_confirmed: true,
      memory_disabled: true, custom_instructions_disabled: true,
      proof_sha256: createHash('sha256').update(await readFile(proof)).digest('hex'),
      limitations: 'Human attestation, not automated subscription verification. Runtime still checks visible signed-in UI.',
    });
    console.log(`${platform} 已记录账号确认，可运行 probe。真实页面选择器仍需首轮验证。`);
  } finally { terminal?.close(); await context?.close(); await release(); }
}

async function main() {
  const command = positionals[0] ?? 'help';
  if (command === 'doctor') {
    const report = { node: process.version, root, playwright: 'missing', browser: 'missing', accounts: {} };
    try { const { chromium } = await loadPlaywright(); report.playwright = 'available'; const executable = browserExecutable(chromium); report.browser = existsSync(executable) ? executable : 'missing'; } catch (error) { report.runtime_error = error.message; }
    for (const platform of platforms) {
      try { const account = await loadAccount(root, platform, 'live'); report.accounts[platform] = { status: 'human_attested', account_label: account.account_label, attested_at: account.attested_at }; }
      catch (error) { report.accounts[platform] = { status: error.code ?? 'unavailable', message: error.message }; }
    }
    report.live_platform_validation = 'not_run'; print(report); return;
  }
  if (command === 'init') {
    const bank = values.kind === 'pilot' ? JSON.parse(await readFile(values.bank ?? path.join(root, '../repos/Elmo/packages/lib/src/restaurants/geo/easyjoy-bank.json'), 'utf8')) : undefined;
    const plan = makePlan({ id: batchId(), kind: values.kind ?? 'p0', bank });
    const dir = await createBatch(root, plan); await buildReport(root, plan.id);
    print({ batch: plan.id, planned: plan.samples.length, directory: dir, status: 'pending_real_accounts' }); return;
  }
  if (command === 'retest') {
    if (!values.baseline) throw new Error('请指定 --baseline 原始批次。');
    const baseline = await loadBatch(root, safeId(values.baseline));
    const plan = makeRetest(baseline.plan, { id: batchId() });
    const directory = await createBatch(root, plan);
    await buildReport(root, plan.id);
    print({ batch: plan.id, baseline: baseline.plan.id, planned: plan.samples.length, directory, status: 'pending' });
    return;
  }
  if (command === 'login') return login(values.platform);
  if (command === 'approve-probe') {
    const release = await acquireLock(root);
    try { print(await approveProbe(root, batchId(), values.reason)); } finally { await release(); }
    return;
  }
  if (command === 'run') {
    const controller = new AbortController();
    const cancel = () => { console.log('正在停止，保存当前状态……'); controller.abort(); };
    process.once('SIGINT', cancel);
    try {
      print(await runBatch(root, batchId(), { day: positive(values.day, 1), limit: positive(values.limit, Infinity), onProgress: console.log, signal: controller.signal }));
      console.log(await buildReport(root, batchId()));
    } finally { process.removeListener('SIGINT', cancel); }
    return;
  }
  if (command === 'status' || command === 'report') {
    if (command === 'status') print(summary(await loadBatch(root, batchId())));
    else console.log(await buildReport(root, batchId()));
    return;
  }
  if (command === 'recover') {
    await recoverLock(root);
    const release = await acquireLock(root);
    try { const batch = await loadBatch(root, batchId()); const recovered = recoverInterrupted(batch); await saveState(batch); print({ interrupted_attempts: recovered, next: '中断样本需要复核，再使用 retry 或 close；不会自动重复提交。' }); }
    finally { await release(); }
    return;
  }
  if (command === 'retry' || command === 'close') {
    const release = await acquireLock(root);
    try {
      const batch = await loadBatch(root, batchId());
      const id = safeId(values.sample), sample = batch.state.samples[id];
      if (!sample || !['paused', 'failed', 'needs_review'].includes(sample.status)) throw new Error('只能处理暂停、失败或中断待复核的样本。');
      if (!values.reason?.trim()) throw new Error('请用 --reason 记录处理原因。');
      if (command === 'retry' && sample.attempts.filter(a => a.dispatched).length >= batch.plan.limits.max_submitted_attempts_per_sample) throw new Error('已到达样本尝试上限；保留此失败，重新测试须建新批次。');
      (sample.operator_actions ??= []).push({ action: command, reason: values.reason, at: new Date().toISOString() });
      sample.status = command === 'retry' ? 'pending' : 'failed';
      await saveState(batch); await buildReport(root, batch.plan.id); print({ sample: id, status: sample.status });
    } finally { await release(); }
    return;
  }
  if (command === 'demo') {
    const id = values.batch ? batchId() : `fixture-${Date.now()}`;
    await createBatch(root, makePlan({ id, kind: 'probe', mode: 'fixture' }));
    const fixture = await startFixture();
    try {
      print(await runBatch(root, id, { fixtureOrigin: fixture.origin, timing: { timeoutMs: 8000, stableMs: 350, pollMs: 50, intervalMs: 0 }, onProgress: console.log }));
      console.log(await buildReport(root, id));
    } finally { await fixture.close(); }
    return;
  }
  if (command !== 'help') throw new Error(`未知命令：${command}`);
  console.log(`餐厅 GEO P0（Node 24）\n\nnode src/cli.mjs doctor\nnode src/cli.mjs demo\nnode src/cli.mjs init --batch easyjoy-probe-001 --kind probe\nnode src/cli.mjs login --platform chatgpt\nnode src/cli.mjs login --platform gemini\nnode src/cli.mjs run --batch easyjoy-probe-001 --day 1\nnode src/cli.mjs init --batch easyjoy-p0-001 --kind p0\nnode src/cli.mjs run --batch easyjoy-p0-001 --day 1\nnode src/cli.mjs run --batch easyjoy-p0-001 --day 2\nnode src/cli.mjs status --batch easyjoy-p0-001\nnode src/cli.mjs report --batch easyjoy-p0-001\nnode src/cli.mjs recover --batch easyjoy-p0-001\nnode src/cli.mjs retry --batch <id> --sample <id> --reason <reason>\nnode src/cli.mjs close --batch <id> --sample <id> --reason <reason>\n\n真实运行会打开可见的专用浏览器；demo 只访问本机测试页面。`);
}
main().catch(error => { console.error(`P0: ${error.message}`); process.exitCode = 1; });
