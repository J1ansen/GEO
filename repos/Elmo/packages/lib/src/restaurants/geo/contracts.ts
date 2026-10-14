import { z } from "zod";
import { storeInput } from "../facts";
import { judgmentSchema } from "./judgment";

export const publicUrl = z
	.url()
	.max(2000)
	.refine((value) => {
		const url = new URL(value);
		return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
	}, "仅接受不含凭据的 HTTP/HTTPS 链接");
const short = z.string().trim().min(1).max(500);
export const channel = z.enum(["official", "google_maps", "yelp", "other"]);
export const observation = z
	.object({
		state: z.enum(["observed", "missing", "not_collected", "failed", "not_applicable"]),
		value: z.json().optional(),
		evidenceIds: z.array(z.string().min(1).max(200)).max(30),
		excerpt: z.string().max(10000).default(""),
	})
	.superRefine((field, ctx) => {
		if (field.state === "observed" && (field.value === undefined || field.value === null || field.value === ""))
			ctx.addIssue({ code: "custom", message: "已观察字段必须提供值；未知请标记未采集" });
	});
export const snapshotSchema = z.object({
	schemaVersion: z.literal("geo.snapshot.v1"),
	id: z.uuid(),
	storeId: z.uuid(),
	channel,
	listingId: short,
	url: publicUrl,
	collectedAt: z.iso.datetime({ offset: true }),
	method: z.enum(["automatic", "manual"]),
	collectorVersion: short,
	status: z.enum(["succeeded", "failed", "blocked"]),
	error: z.string().max(2000).nullable(),
	evidence: z
		.array(
			z.object({
				id: short,
				sha256: z.string().regex(/^[a-f0-9]{64}$/),
				url: publicUrl,
				text: z.string().min(1).max(200000),
			}),
		)
		.max(20),
	fields: z.record(z.string().min(1).max(100), observation),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export const questionSchema = z.object({
	id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
	type: z.enum(["discovery", "brand_verification"]),
	language: z.enum(["en", "zh"]),
	location: short,
	text: z.string().min(1).max(5000),
	source_cells: z.array(z.string()),
	origin: z.string().optional(),
});
export const bankSchema = z.object({
	schema_version: z.literal("geo.question-bank.v1"),
	id: short,
	store_label: short,
	source: z.object({
		filename: short,
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
		sheet: short,
		identity_mapping_cell: short,
	}),
	questions: z.array(questionSchema).length(11),
	historical_observations: z
		.array(
			z.object({
				question_id: short,
				platform: short,
				source_range: short,
				reported_repeat: z.string(),
				reported_presence: z.string(),
				entries: z.array(
					z.object({ row: z.number().int(), reported_restaurant: z.string(), source_links_text: z.string() }),
				),
				evidence_status: z.literal("user_provided_conditions_unknown"),
				observed_at: z.null(),
				eligible_for_baseline: z.literal(false),
			}),
		)
		.length(32),
	limitations: z.array(z.string()),
});
export type QuestionBank = z.infer<typeof bankSchema>;
export const geoRecordKinds = [
	"question_bank",
	"snapshot",
	"audit",
	"website_audit",
	"batch_plan",
	"batch_result",
	"judgment",
	"correction",
	"publication",
	"verification",
	"schedule",
	"job_request",
	"job_result",
] as const;
export const recordInput = storeInput.extend({ recordId: z.uuid() });
export const collectInput = storeInput.extend({ url: publicUrl, channel, listingId: short });
export const importSnapshotInput = storeInput.extend({ snapshot: snapshotSchema });
export const auditInput = recordInput.extend({ factVersion: z.number().int().min(1) });
export const correctionInput = recordInput.extend({ findingId: short });
export const publicationInput = recordInput.extend({
	publishedUrl: publicUrl,
	publishedAt: z.iso.datetime({ offset: true }),
	note: z.string().trim().min(1).max(2000),
});
export const verifyInput = recordInput.extend({ snapshotId: z.uuid() });
export const scheduleInput = collectInput.extend({ enabled: z.boolean() });
export const batchImportInput = storeInput.extend({ batchId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/) });
export const judgmentInput = recordInput.extend({ judgment: judgmentSchema });
export type Scope = z.infer<typeof storeInput>;
