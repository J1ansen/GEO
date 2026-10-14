import { expect, it } from "vitest";
import { type Judgment, summarizeBatch, validateJudgment } from "./judgment";
import type { PilotBatch } from "./p0-import";

const question = {
	id: "q1",
	text: "Where to eat?",
	type: "discovery" as const,
	language: "en" as const,
	location: "NYC",
	source_cells: [],
};
const batch = {
	samples: [
		{
			id: "success",
			platform: "chatgpt",
			question,
			status: "succeeded",
			response: { text: "Easy Joy is mentioned in a negative example.", citations: [] },
			evidenceHash: "abc",
		},
		{ id: "failure", platform: "chatgpt", question, status: "failed", response: null, evidenceHash: null },
		{
			id: "unreviewed",
			platform: "chatgpt",
			question,
			status: "succeeded",
			response: { text: "Other restaurant.", citations: [] },
			evidenceHash: "def",
		},
	],
} as unknown as PilotBatch;
const decision: Judgment = {
	sampleId: "success",
	mention: "yes",
	recommendation: "no",
	branch: "unknown",
	rank: null,
	quote: "Easy Joy",
	note: "Mention is not a recommendation",
};
it("separates mentions, recommendations and missing samples in the denominator", () => {
	validateJudgment(batch, decision);
	const result = summarizeBatch(batch, [decision])[0];
	expect(result).toMatchObject({
		planned: 3,
		collected: 2,
		reviewed: 1,
		judgedRecommendation: 1,
		recommended: 0,
		recommendationRate: 0,
	});
});
it("requires original evidence for a claimed recommendation or branch match", () => {
	expect(() => validateJudgment(batch, { ...decision, quote: "Invented evidence" })).toThrow("原始回答");
	expect(() => validateJudgment(batch, { ...decision, quote: "", branch: "matched" })).toThrow("回答摘录");
	expect(() => validateJudgment(batch, { ...decision, sampleId: "failure" })).toThrow("完整回答");
	expect(() => validateJudgment(batch, { ...decision, rank: 1 })).toThrow("明确推荐");
});
