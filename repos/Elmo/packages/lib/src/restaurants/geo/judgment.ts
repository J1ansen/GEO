import { z } from "zod";
import type { PilotBatch } from "./p0-import";

export const judgmentSchema = z.object({
	sampleId: z.string().min(1).max(100),
	mention: z.enum(["yes", "no", "unknown"]),
	recommendation: z.enum(["yes", "no", "unknown"]),
	branch: z.enum(["matched", "wrong_branch", "unknown"]),
	rank: z.number().int().min(1).max(1000).nullable(),
	quote: z.string().max(10000),
	note: z.string().trim().min(1).max(2000),
});
export type Judgment = z.infer<typeof judgmentSchema>;
export function validateJudgment(batch: PilotBatch, input: Judgment) {
	const sample = batch.samples.find((s) => s.id === input.sampleId);
	if (!sample || sample.status !== "succeeded" || !sample.response || !sample.evidenceHash)
		throw new Error("只能复核有完整回答证据的成功样本");
	if (input.quote && !sample.response.text.includes(input.quote)) throw new Error("引用摘录必须来自原始回答");
	if ((input.mention === "yes" || input.recommendation === "yes" || input.branch !== "unknown") && !input.quote.trim())
		throw new Error("肯定提及、推荐或分店判断需要回答摘录");
	if (input.recommendation === "yes" && input.mention !== "yes") throw new Error("推荐判断必须先确认提及");
	if (input.rank !== null && (input.recommendation !== "yes" || sample.question.type !== "discovery"))
		throw new Error("只有发现题中的明确推荐才能记录顺序");
	return {
		...input,
		evidenceHash: sample.evidenceHash,
		questionType: sample.question.type,
		platform: sample.platform,
		language: sample.question.language,
	};
}
export function summarizeBatch(batch: PilotBatch, judgments: Judgment[]) {
	const reviewed = new Map(judgments.map((j) => [j.sampleId, j]));
	const groups = [];
	const dimensions = ["chatgpt", "gemini"].flatMap((platform) =>
		["discovery", "brand_verification"].flatMap((type) =>
			["en", "zh"].map((language) => ({ platform, type, language })),
		),
	);
	for (const { platform, type, language } of dimensions) {
		const samples = batch.samples.filter(
			(s) => s.platform === platform && s.question.type === type && s.question.language === language,
		);
		if (!samples.length) continue;
		const valid = samples.filter((s) => s.status === "succeeded" && s.response && s.evidenceHash);
		const decisions = valid.map((s) => reviewed.get(s.id)).filter((j): j is Judgment => !!j);
		const known = decisions.filter((j) => j.recommendation !== "unknown");
		groups.push({
			platform,
			type,
			language,
			planned: samples.length,
			collected: valid.length,
			reviewed: decisions.length,
			judgedRecommendation: known.length,
			recommended: known.filter((j) => j.recommendation === "yes").length,
			correctBranchRecommended: known.filter((j) => j.recommendation === "yes" && j.branch === "matched").length,
			recommendationRate:
				type === "discovery" && known.length
					? known.filter((j) => j.recommendation === "yes").length / known.length
					: null,
			limitation:
				type === "brand_verification"
					? "单轮核验，不计算推荐率或稳定准确率"
					: "分母仅含已明确判断推荐与否的回答；未采集和未知不视作未推荐",
		});
	}
	return groups;
}
