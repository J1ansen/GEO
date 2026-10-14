import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadBatch, readJson, summary, writeJson } from './store.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const labels = { pending: '待运行', running: '运行中', succeeded: '采集完成／待复核', paused: '已暂停', failed: '失败', needs_review: '中断待复核' };
export async function buildReport(root, id) {
  const batch = await loadBatch(root, id);
  const stats = summary(batch);
  const acceptanceLabel = stats.formal_acceptance === 'ineligible_fixture' ? '模拟数据，不可验收' : '待人工核对真实证据';
  const rows = [];
  for (const spec of batch.plan.samples) {
    const sample = batch.state.samples[spec.id];
    const completed = sample.attempts.find(a => a.status === 'succeeded');
    let response;
    if (completed) response = await readJson(path.join(batch.dir, completed.evidence_path, 'response.json'));
    const evidence = sample.attempts.map((a, index) => {
      const links = [['request.json', `第 ${index + 1} 次请求`], ['error.json', '错误记录'], ['page.png', '截图'], ['evidence.json', '文件校验']];
      return links.filter(([file]) => existsSync(path.join(batch.dir, a.evidence_path, file))).map(([file, label]) => `<a href="${escape(a.evidence_path)}/${file}">${label}</a>`).join(' · ');
    }).join('<br>');
    const links = (response?.citations ?? []).filter(link => /^https?:\/\//i.test(link.url)).map(link => `<li><a href="${escape(link.url)}" target="_blank" rel="noopener noreferrer">${escape(link.label || link.url)}</a></li>`).join('');
    rows.push(`<article><div class="row"><span class="tag">D${spec.day} · ${escape(spec.platform)} · 第 ${spec.repeat} 次</span><strong>${labels[sample.status]}</strong></div><h3>${escape(spec.question.text)}</h3><p class="muted">${escape(spec.id)} · ${spec.question.type === 'discovery' ? '自然发现' : '门店核验'}</p>${sample.last_error ? `<p class="error">${escape(sample.last_error.code)}：${escape(sample.last_error.message)}</p>` : ''}${response ? `<details><summary>查看回答与可见外链（${response.citations.length}）</summary><pre>${escape(response.text)}</pre><ul>${links}</ul><p>折叠来源面板未展开，外链不等于完整引用清单。实际搜索行为：未知；观察到的模型标签：${escape(response.observed_model_label || '未知')}</p></details>` : '<p class="muted">尚无可用回答；不计为未推荐。</p>'}<p class="evidence">${evidence}</p></article>`);
  }
  const totals = Object.entries(stats.by_platform).map(([name, p]) => `<tr><td>${escape(name)}</td><td>${p.planned}</td><td>${p.succeeded}</td><td>${(p.success_rate * 100).toFixed(1)}%</td><td>${p.submitted_attempts}</td></tr>`).join('');
  const banner = batch.plan.mode === 'fixture' ? '本地模拟页面 · 不是 ChatGPT / Gemini 实测 · 不计入正式验收' : 'P0 采集草稿 · 免费账号条件需人工确认 · 真实平台适配需复核';
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'"><title>GEO P0 · ${escape(id)}</title><style>body{margin:0;background:#f1f5f8;color:#183041;font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1080px;margin:0 auto;padding:32px 24px}h1{font-size:30px;margin:12px 0}.banner{background:#fff2ce;border-left:5px solid #c48700;padding:16px}article,.panel{background:white;border:1px solid #d9e3e9;border-radius:10px;padding:20px;margin:18px 0}.row{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.tag{color:#075f62}.muted{color:#5e6f7b;font-size:14px}.error{color:#99382c}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f8fa;padding:16px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:10px;border-bottom:1px solid #d9e3e9}a{color:#086c91;overflow-wrap:anywhere}.evidence{font-size:13px}h3{font-size:17px}summary{cursor:pointer}@media print{body{background:white}main{padding:0}article{break-inside:avoid}details:not([open])>*:not(summary){display:block}a{color:inherit}}</style><main><div class="banner">${banner}</div><h1>餐厅 GEO · P0 浏览器采集</h1><p>${escape(batch.plan.store.name)} · ${escape(id)} · 生成时间 ${escape(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))}（上海）</p><section class="panel"><p>目标条件：免费账号／默认聊天／独立新会话／${batch.plan.kind === 'pilot' ? '保留原题中英文与地名' : '英文地名查询'}。程序不点击搜索按钮；平台自行联网可以发生。实际网络位置未验证。</p><table><thead><tr><th>平台</th><th>计划样本</th><th>成功</th><th>成功率</th><th>已提交尝试</th></tr></thead><tbody>${totals}</tbody></table><p>数量门槛：${stats.collection_threshold_met ? '达到，仍需人工核验证据' : '未达到或不适用'}。正式验收：${acceptanceLabel}。</p><p>外部服务已计消耗 US$${stats.external_service_spend_usd.toFixed(2)}／上限 US$${batch.plan.limits.external_service_usd}；本采集器未接入付费 API，浏览器、网络及人工成本另计。</p><p>本页为采集报告，不输出未经实现的推荐率或事实准确率。无引用不自动判定未搜索；未获回答不判定餐厅遗漏。</p><a href="manifest.json">冻结的测试计划</a> · <a href="summary.json">统计 JSON</a></section>${rows.join('')}</main></html>`;
  await writeJson(path.join(batch.dir, 'summary.json'), stats);
  await writeFile(path.join(batch.dir, 'report.html'), html);
  return path.join(batch.dir, 'report.html');
}
