import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { sha256 } from "./compare";
import { bankSchema, publicUrl, type QuestionBank, questionSchema } from "./contracts";

const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
const attemptSchema = z.object({
	id: z.uuid(),
	status: z.enum(["running", "succeeded", "failed", "paused", "interrupted"]),
	dispatched: z.boolean(),
	evidence_path: z.string(),
	evidence_complete: z.boolean().optional(),
});
const stateSchema = z.object({
	plan_sha256: z.string(),
	day_dates: z.record(z.string(), z.string()),
	samples: z.record(
		id,
		z.object({
			status: z.enum(["pending", "running", "succeeded", "paused", "failed", "needs_review"]),
			attempts: z.array(attemptSchema).max(100),
		}),
	),
});
const planSchema = z.object({
	id,
	kind: z.literal("pilot"),
	mode: z.literal("live"),
	question_bank: z.object({ id: z.string(), sha256: z.string(), source: bankSchema.shape.source }),
	conditions: z
		.object({
			account_tier: z.literal("free"),
			interaction: z.literal("default_chat"),
			new_conversation: z.literal(true),
			force_search: z.literal(false),
			language: z.literal("per_question"),
			calendar_timezone: z.literal("America/New_York"),
			actual_network_location: z.literal("unverified"),
			requested_model: z.literal("product_default"),
			custom_instructions: z.literal("disabled_by_account_setup"),
			memory: z.literal("disabled_by_account_setup"),
		})
		.passthrough(),
	samples: z
		.array(
			z.object({
				id,
				day: z.number().int().min(1).max(2),
				repeat: z.number().int().min(1).max(5),
				platform: z.enum(["chatgpt", "gemini"]),
				question: questionSchema,
			}),
		)
		.length(166),
	baseline: z.object({ id, plan_sha256: z.string() }).optional(),
});
async function confinedRead(root: string, file: string, maxBytes = 2_000_000) {
	const target = await realpath(path.resolve(root, file));
	const relative = path.relative(root, target);
	if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("证据路径越出批次目录");
	if ((await stat(target)).size > maxBytes) throw new Error("证据文件超出大小限制");
	return readFile(target);
}
type Plan = z.infer<typeof planSchema>;
type SampleSpec = Plan["samples"][number];
type SampleState = z.infer<typeof stateSchema>["samples"][string];
type Attempt = z.infer<typeof attemptSchema>;
const readJsonFile = async (root: string, file: string) =>
	JSON.parse((await confinedRead(root, file)).toString("utf8"));

function validateDistribution(plan: Plan, bank: QuestionBank) {
	const groups = ["chatgpt", "gemini"].flatMap((platform) =>
		bank.questions.map((question) => ({ platform, question })),
	);
	for (const { platform, question } of groups) {
		const selected = plan.samples.filter((s) => s.platform === platform && s.question.id === question.id);
		if (selected.length !== (question.type === "discovery" ? 10 : 1)) throw new Error("样本分配数量已改变");
		if (
			selected.some(
				(s) =>
					s.question.text !== question.text ||
					s.question.language !== question.language ||
					s.question.type !== question.type,
			)
		)
			throw new Error("原题文字或语言已改变");
		const slots = new Set(selected.map((s) => `${s.day}:${s.repeat}`));
		if (slots.size !== selected.length) throw new Error("逻辑样本重复占用同一轮次");
	}
}
async function verifyEvidenceFiles(root: string, folder: string, files: Record<string, string>) {
	for (const required of ["request.json", "response.json", "answer.txt", "page.png", "before-submit.png"]) {
		if (!files[required]) throw new Error(`缺少原始证据 ${required}`);
	}
	for (const [file, expected] of Object.entries(files)) {
		if (path.basename(file) !== file || file.includes("\\")) throw new Error("非法证据文件名");
		const bytes = await confinedRead(root, `${folder}/${file}`, 15_000_000);
		if (createHash("sha256").update(bytes).digest("hex") !== expected) throw new Error(`证据校验失败：${file}`);
	}
}
function validateRequest(request: unknown, batchId: string, spec: SampleSpec, attempt: Attempt) {
	z.object({
		mode: z.literal("live"),
		batch_id: z.literal(batchId),
		sample_id: z.literal(spec.id),
		attempt_id: z.literal(attempt.id),
		platform: z.literal(spec.platform),
		prompt: z.literal(spec.question.text),
		account: z.object({ tier: z.literal("free") }),
		conditions: z.object({
			new_conversation: z.literal(true),
			interaction: z.literal("default_chat"),
			language: z.literal(spec.question.language),
			force_search: z.literal(false),
		}),
	}).parse(request);
}
async function readSuccessfulAttempt(root: string, batchId: string, spec: SampleSpec, attempt: Attempt) {
	if (!attempt.dispatched || !attempt.evidence_complete) throw new Error("成功回答缺少提交记录或完整证据");
	if (attempt.evidence_path !== `attempts/${spec.id}/${attempt.id}`) throw new Error("尝试证据目录不符");
	const evidenceText = (await confinedRead(root, `${attempt.evidence_path}/evidence.json`)).toString("utf8");
	const evidence = z
		.object({ mode: z.literal("live"), files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)) })
		.parse(JSON.parse(evidenceText));
	await verifyEvidenceFiles(root, attempt.evidence_path, evidence.files);
	validateRequest(await readJsonFile(root, `${attempt.evidence_path}/request.json`), batchId, spec, attempt);
	const response = z
		.object({
			text: z.string().min(1).max(200000),
			citations: z.array(z.object({ url: publicUrl, label: z.string().max(5000).optional() })).max(1000),
		})
		.parse(await readJsonFile(root, `${attempt.evidence_path}/response.json`));
	if ((await confinedRead(root, `${attempt.evidence_path}/answer.txt`)).toString("utf8") !== response.text)
		throw new Error("回答文本与响应证据不一致");
	return { response, evidenceHash: sha256(evidenceText) };
}
async function readSample(root: string, batchId: string, spec: SampleSpec, sample: SampleState | undefined) {
	if (!sample) throw new Error("样本状态缺失");
	const succeeded = sample.attempts.filter((a) => a.status === "succeeded");
	if (succeeded.length > 1 || (sample.status === "succeeded") !== (succeeded.length === 1))
		throw new Error("成功状态与尝试记录不一致");
	const result = succeeded.length
		? await readSuccessfulAttempt(root, batchId, spec, succeeded[0])
		: { response: null, evidenceHash: null };
	return {
		...spec,
		status: sample.status,
		attempts: sample.attempts.length,
		submittedAttempts: sample.attempts.filter((a) => a.dispatched).length,
		...result,
	};
}
export async function readPilotBatch(runsRoot: string, batchId: string, bank: QuestionBank) {
	id.parse(batchId);
	const runs = await realpath(runsRoot);
	const root = await realpath(path.join(runs, batchId));
	if (path.dirname(root) !== runs) throw new Error("批次目录不能指向其他位置");
	const envelope = await readJsonFile(root, "manifest.json");
	if (sha256(JSON.stringify(envelope.plan)) !== envelope.sha256) throw new Error("测试计划校验失败");
	const plan = planSchema.parse(envelope.plan);
	const state = stateSchema.parse(await readJsonFile(root, "state.json"));
	if (
		plan.id !== batchId ||
		state.plan_sha256 !== envelope.sha256 ||
		plan.question_bank.sha256 !== sha256(JSON.stringify(bank))
	)
		throw new Error("批次、题库或计划指纹不匹配");
	if (new Set(plan.samples.map((s) => s.id)).size !== 166 || Object.keys(state.samples).length !== 166)
		throw new Error("逻辑样本数量不符");
	validateDistribution(plan, bank);
	const samples = [];
	for (const spec of plan.samples) samples.push(await readSample(root, batchId, spec, state.samples[spec.id]));
	return {
		schemaVersion: "geo.batch-result.v1",
		batchId,
		planSha256: envelope.sha256 as string,
		questionBankId: bank.id,
		conditions: plan.conditions,
		baseline: plan.baseline ?? null,
		dayDates: state.day_dates,
		samples,
		importedAt: new Date().toISOString(),
		externalServiceUsd: 0,
		evidenceRoot: batchId,
		acceptance: "requires_human_evidence_review",
	};
}
export type PilotBatch = Awaited<ReturnType<typeof readPilotBatch>>;
