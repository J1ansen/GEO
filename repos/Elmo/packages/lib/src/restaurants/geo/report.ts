import { spawn } from "node:child_process";
import path from "node:path";
import { geoRoot } from "./runtime";
import type { pilotReport } from "./service";

type Report = Awaited<ReturnType<typeof pilotReport>>;
const labels: Record<string, string> = {
	pending: "待运行",
	running: "运行中",
	succeeded: "已采集",
	failed: "失败",
	paused: "暂停",
	needs_review: "待复核",
	yes: "是",
	no: "否",
	unknown: "未知",
	matched: "正确分店",
	wrong_branch: "其他分店",
	requires_human_evidence_review: "待人工核验证据",
};
const label = (value: string) => labels[value] ?? value;
const escapeHtml = (value: unknown) =>
	String(value ?? "").replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
	);
export function renderPilotHtml(report: Report) {
	const groups = report.groups
		.map(
			(g) =>
				`<tr><td>${escapeHtml(g.platform)}<br>${g.type === "discovery" ? "发现" : "事实核验"} · ${escapeHtml(g.language)}</td><td>${g.planned}</td><td>${g.collected}</td><td>${g.reviewed}</td><td>${g.recommended} / ${g.judgedRecommendation}</td><td>${g.correctBranchRecommended}</td></tr>`,
		)
		.join("");
	const bySample = new Map(report.judgments.map((j) => [j.sampleId, j]));
	const samples = report.batch.samples
		.map((s) => {
			const review = bySample.get(s.id);
			return `<article><p class="eyebrow">${escapeHtml(s.platform)} · ${escapeHtml(s.question.language)} · D${s.day} / R${s.repeat} · ${escapeHtml(label(s.status))}</p><h3>${escapeHtml(s.question.text)}</h3><p>提及：${escapeHtml(label(review?.mention ?? "未复核"))} · 推荐：${escapeHtml(label(review?.recommendation ?? "未复核"))} · 分店：${escapeHtml(label(review?.branch ?? "未知"))} · 顺序：${escapeHtml(review?.rank ?? "未知")}</p>${review ? `<blockquote>${escapeHtml(review.quote)}</blockquote><p>复核说明：${escapeHtml(review.note)}</p>` : ""}${s.response ? `<pre>${escapeHtml(s.response.text)}</pre><p class="small">可见来源：${s.response.citations.map((c) => escapeHtml(c.url)).join("<br>") || "未采集到可见引用"}</p>` : "<p>无可用回答；不判为未推荐。</p>"}<p class="small">样本 ${escapeHtml(s.id)}<br>证据指纹 ${escapeHtml(s.evidenceHash ?? "尚无成功证据")}</p></article>`;
		})
		.join("");
	return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"><title>Easy Joy GEO 试点报告</title><style>@page{size:A4;margin:18mm 16mm}body{font:12px/1.65 'Microsoft YaHei','Noto Sans CJK SC',sans-serif;color:#17353a;max-width:960px;margin:auto;padding:24px}h1{font-size:28px}h2{font-size:20px;margin-top:30px}h3{font-size:14px;margin:6px 0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #d5e1df}th{background:#eef5f3}article{border-top:1px solid #c9d8d4;padding:16px 0}pre,blockquote{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}blockquote{border-left:3px solid #117668;padding-left:12px;margin-left:0}.small{font-size:10px;color:#526967;overflow-wrap:anywhere}.eyebrow{color:#117668;font-size:11px}.notice{background:#fff6d9;border-left:4px solid #d9a528;padding:14px}thead{display:table-header-group}tr{break-inside:avoid}h2,h3{break-after:avoid}@media print{body{padding:0}article{orphans:3;widows:3}}</style></head><body><p class="eyebrow">RESTAURANT GEO / INTERNAL PILOT</p><h1>Easy Joy 试点报告</h1><p>批次 ${escapeHtml(report.batch.batchId)} · 生成时间 ${escapeHtml(report.generatedAt)}</p><div class="notice">当前验收：${escapeHtml(label(report.batch.acceptance))}。采集完成不等于推荐有效；历史 Excel 记录不进入本轮基线。事实核验是单轮检查，不计算稳定准确率。</div><h2>样本与复核覆盖</h2><table><thead><tr><th>分组</th><th>计划</th><th>采集</th><th>复核</th><th>推荐 / 明确判断</th><th>正确分店推荐</th></tr></thead><tbody>${groups}</tbody></table><p>推荐分母仅包括明确判断的回答；未知、失败与未复核不视作未推荐。</p><h2>固定条件与来源</h2><p>ChatGPT / Gemini 免费账号；默认聊天，每题新会话；不强制联网搜索。<br>原题语言逐题保留；地点以题目原文为准，实际网络位置未验证。<br>记忆、历史个性化与自定义指令由账号维护人确认关闭。<br>测试日期按纽约时区记录；模型采用产品默认，未固定后台模型版本。</p><p class="small">计划指纹 ${escapeHtml(report.batch.planSha256)}<br>题库 ${escapeHtml(report.batch.questionBankId)}</p>${report.limitations.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}<h2>逐条证据与判断</h2>${samples}</body></html>`;
}
export async function renderPilotPdf(html: string) {
	return new Promise<string>((resolve, reject) => {
		const child = spawn(process.execPath, [path.join(geoRoot(), "scripts/render-geo-report.mjs")], {
			windowsHide: true,
			shell: false,
			stdio: ["pipe", "pipe", "pipe"],
		});
		let output = "",
			errorText = "";
		const timer = setTimeout(() => {
			child.kill();
			reject(new Error("PDF 导出超时"));
		}, 90000);
		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
			if (output.length > 40_000_000) {
				child.kill();
				reject(new Error("PDF 超出大小限制"));
			}
		});
		child.stderr.on("data", (chunk: Buffer) => {
			errorText = (errorText + chunk.toString()).slice(-2000);
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0 && output.startsWith("JVBER")) resolve(output);
			else reject(new Error(`PDF 生成失败：${errorText}`));
		});
		child.stdin.on("error", () => {});
		child.stdin.end(html);
	});
}
