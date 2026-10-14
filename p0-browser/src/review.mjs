import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { adapters, CollectionError } from './adapters.mjs';
import { digest, platforms } from './plan.mjs';
import { loadBatch, readJson, writeJson } from './store.mjs';

export async function approveProbe(root, id, reason) {
  if (!reason?.trim()) throw new Error('请用 --reason 记录账号类型、默认模式、回答完整性及引用抽查结果。');
  const batch = await loadBatch(root, id);
  if (batch.plan.kind !== 'probe' || batch.plan.mode !== 'live') throw new Error('只能确认真实平台的 probe；本地模拟结果不能放行正式 P0。');
  const receipts = {};
  for (const platform of platforms) {
    const samples = batch.plan.samples.filter(s => s.platform === platform);
    if (!samples.length || samples.some(s => batch.state.samples[s.id].status !== 'succeeded')) throw new Error(`${platform} 仍有未成功的探针样本。`);
    const evidence = [];
    let account;
    for (const spec of samples) {
      const attempt = batch.state.samples[spec.id].attempts.find(a => a.status === 'succeeded');
      if (!attempt?.evidence_complete) throw new Error('探针证据不完整。');
      const dir = path.join(batch.dir, attempt.evidence_path);
      const index = await readJson(path.join(dir, 'evidence.json'));
      if (index.mode !== 'live') throw new Error('发现模拟证据，不能放行。');
      for (const [file, expected] of Object.entries(index.files)) {
        if (path.basename(file) !== file) throw new Error('证据文件名无效。');
        const actual = createHash('sha256').update(await readFile(path.join(dir, file))).digest('hex');
        if (actual !== expected) throw new Error('探针证据已变化，不能放行。');
      }
      const request = await readJson(path.join(dir, 'request.json'));
      if (request.mode !== 'live' || request.adapter_revision !== adapters[platform].revision || request.account.tier !== 'free') throw new Error('探针条件与当前采集器不匹配。');
      if (account && digest(account) !== digest(request.account)) throw new Error('探针使用了不同账号确认记录，请重新采集。');
      account = request.account;
      evidence.push({ sample_id: spec.id, attempt_id: attempt.id, evidence_sha256: digest(index) });
    }
    receipts[platform] = { platform, reviewed_at: new Date().toISOString(), review_basis: 'human_review', reason, probe_batch: id, adapter_revision: adapters[platform].revision, account, evidence };
  }
  for (const platform of platforms) await writeJson(path.join(root, 'private', 'probe-reviews', `${platform}.json`), receipts[platform]);
  return { status: 'human_reviewed', probe_batch: id, platforms };
}

export async function requireProbeReview(root, platform, account) {
  let receipt;
  try { receipt = await readJson(path.join(root, 'private', 'probe-reviews', `${platform}.json`)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const expected = { tier: account.tier, basis: account.basis, attested_at: account.attested_at, account_label: account.account_label, proof_sha256: account.proof_sha256 ?? null };
  if (!receipt || receipt.adapter_revision !== adapters[platform].revision || digest(receipt.account) !== digest(expected)) throw new CollectionError('probe_review_required', '先完成真实 probe 并复核，再运行 approve-probe；账号或适配器改变后需重新验证。');
  return receipt;
}
