import { mkdir, writeFile } from "node:fs/promises";
import { bankSchema } from "../packages/lib/src/restaurants/geo/contracts.ts";
import bankData from "../packages/lib/src/restaurants/geo/easyjoy-bank.json";
import { readPilotBatch } from "../packages/lib/src/restaurants/geo/p0-import.ts";
import { summarizeBatch } from "../packages/lib/src/restaurants/geo/judgment.ts";
import { renderPilotHtml, renderPilotPdf } from "../packages/lib/src/restaurants/geo/report.ts";

const bank = bankSchema.parse(bankData);
const batch = await readPilotBatch("../../p0-browser/runs", "easyjoy-pilot-001", bank);
if (batch.samples.length !== 166 || batch.samples.some(sample => sample.response)) throw new Error("Preview requires the untouched pending pilot");
const groups = summarizeBatch(batch, []);
const preview = { ...batch, samples: batch.samples.slice(0, 4), acceptance: "软件排版预览：全部待运行，仅展示前四条计划；不是正式验收报告" };
const report = { batch: preview, groups, judgments: [], generatedAt: new Date().toISOString(), limitations: ["软件排版预览；未执行真实 AI 查询。", "样本分母来自完整的 166 条计划，逐条部分仅展示前四条供检查分页。"] };
const html = renderPilotHtml(report);
await mkdir(".restaurant-test/geo-report", { recursive: true });
await writeFile(".restaurant-test/geo-report/preview.html", html);
const pdf = await renderPilotPdf(html);
await writeFile(".restaurant-test/geo-report/preview.pdf", Buffer.from(pdf, "base64"));
console.log(JSON.stringify({ samples: batch.samples.length, groups: groups.length, successfulAnswers: 0, preview: ".restaurant-test/geo-report/preview.pdf" }));
