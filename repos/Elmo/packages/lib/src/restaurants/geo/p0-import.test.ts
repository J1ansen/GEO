import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { sha256 } from "./compare";
import { bankSchema } from "./contracts";
import bankJson from "./easyjoy-bank.json";
import { readPilotBatch } from "./p0-import";

const bank = bankSchema.parse(bankJson);
const temporary: string[] = [];
afterEach(async () => {
	for (const folder of temporary.splice(0)) {
		const absolute = path.resolve(folder);
		if (path.dirname(absolute) !== path.resolve(os.tmpdir()) || !path.basename(absolute).startsWith("geo-import-test-"))
			throw new Error("Refuse cleanup outside the test temporary directory");
		await rm(absolute, { recursive: true, force: true });
	}
});
async function fixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), "geo-import-test-"));
	temporary.push(root);
	const samples = [];
	const slots = [1, 2].flatMap((day) => [1, 2, 3, 4, 5].map((repeat) => ({ day, repeat })));
	for (const { day, repeat } of slots)
		for (const question of bank.questions) {
			if (question.type === "brand_verification" && (day !== 1 || repeat !== 1)) continue;
			for (const platform of ["chatgpt", "gemini"])
				samples.push({ id: `d${day}-${platform}-${question.id}-r${repeat}`, day, repeat, platform, question });
		}
	const plan = {
		id: "import-test",
		kind: "pilot",
		mode: "live",
		question_bank: { id: bank.id, sha256: sha256(JSON.stringify(bank)), source: bank.source },
		conditions: {
			account_tier: "free",
			interaction: "default_chat",
			new_conversation: true,
			force_search: false,
			language: "per_question",
			calendar_timezone: "America/New_York",
			actual_network_location: "unverified",
			requested_model: "product_default",
			custom_instructions: "disabled_by_account_setup",
			memory: "disabled_by_account_setup",
		},
		samples,
	};
	const folder = path.join(root, plan.id);
	await mkdir(folder);
	const state = {
		plan_sha256: sha256(JSON.stringify(plan)),
		day_dates: {},
		samples: Object.fromEntries(samples.map((s) => [s.id, { status: "pending", attempts: [] }])),
	};
	await writeFile(path.join(folder, "manifest.json"), JSON.stringify({ plan, sha256: state.plan_sha256 }));
	await writeFile(path.join(folder, "state.json"), JSON.stringify(state));
	return { root, folder, plan, state };
}
it("imports 166 pending samples without turning historical observations into answers", async () => {
	const data = await fixture();
	const result = await readPilotBatch(data.root, data.plan.id, bank);
	expect(result.samples).toHaveLength(166);
	expect(result.samples.every((s) => s.response === null)).toBe(true);
});
it("rejects edited plans and fabricated success without evidence", async () => {
	const data = await fixture();
	const manifest = JSON.parse(await readFile(path.join(data.folder, "manifest.json"), "utf8"));
	manifest.plan.samples[0].question.text += " modified";
	await writeFile(path.join(data.folder, "manifest.json"), JSON.stringify(manifest));
	await expect(readPilotBatch(data.root, data.plan.id, bank)).rejects.toThrow("计划校验");
	await writeFile(
		path.join(data.folder, "manifest.json"),
		JSON.stringify({ plan: data.plan, sha256: data.state.plan_sha256 }),
	);
	data.state.samples[data.plan.samples[0].id].status = "succeeded";
	await writeFile(path.join(data.folder, "state.json"), JSON.stringify(data.state));
	await expect(readPilotBatch(data.root, data.plan.id, bank)).rejects.toThrow("尝试记录不一致");
});
it("rejects traversal batch names", async () => {
	const data = await fixture();
	await expect(readPilotBatch(data.root, "../another", bank)).rejects.toThrow();
});
