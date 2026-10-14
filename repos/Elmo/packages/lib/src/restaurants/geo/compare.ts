import { createHash } from "node:crypto";
import { z } from "zod";
import type { Facts, FactValues } from "../facts";
import type { Snapshot } from "./contracts";

export const RULE_VERSION = "store-facts-2.0.0";
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export function stableJson(value: unknown): string {
	if (value === undefined) return "null";
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	const entries = Object.entries(value)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`);
	return `{${entries.join(",")}}`;
}

// Ported from the user's GEO.rar auditor; see SOURCE-NOTICES.md for provenance and repairs.
export const normalizeText = (value: unknown) =>
	String(value ?? "")
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
export function normalizeAddress(value: unknown) {
	let text = normalizeText(value);
	const replacements: Record<string, string> = {
		"united states of america": "us",
		"united states": "us",
		street: "st",
		avenue: "ave",
		boulevard: "blvd",
		road: "rd",
		drive: "dr",
		lane: "ln",
		highway: "hwy",
		suite: "ste",
		north: "n",
		south: "s",
		east: "e",
		west: "w",
	};
	for (const [from, to] of Object.entries(replacements)) text = text.replace(new RegExp(`\\b${from}\\b`, "g"), to);
	return text
		.replace(/\bus\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
function normalizePhone(value: unknown) {
	const digits = String(value ?? "").replace(/\D/g, "");
	return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}
function normalizeUrl(value: unknown) {
	try {
		const url = new URL(String(value));
		url.hash = "";
		for (const key of [...url.searchParams.keys()])
			if (/^utm_/i.test(key) || ["gclid", "fbclid", "yclid", "mc_cid", "mc_eid"].includes(key.toLowerCase()))
				url.searchParams.delete(key);
		url.searchParams.sort();
		url.hostname = url.hostname.replace(/^www\./, "");
		url.pathname = url.pathname.replace(/\/+$/, "") || "/";
		return url.toString();
	} catch {
		return "";
	}
}
type Expected = { value: unknown; evidenceIds: string[]; semantic?: boolean };
export function expectedFields(facts: Facts): Record<string, Expected> {
	const result: Record<string, Expected> = {};
	function add<K extends keyof FactValues>(group: K, fields: (value: FactValues[K]) => Record<string, unknown>) {
		const entry = facts[group];
		if (entry.status === "confirmed" && entry.value !== null && entry.evidenceIds.length) {
			for (const [key, value] of Object.entries(fields(entry.value as FactValues[K])))
				result[key] = { value, evidenceIds: entry.evidenceIds };
		}
	}
	add("identity", (v) => ({ name: [v.name, v.nativeName, ...v.aliases].filter(Boolean) }));
	add("location", (v) => ({ address: v.address }));
	add("phone", (v) => ({ phone: v }));
	add("website", (v) => ({ website: v }));
	add("pricing", (v) => ({ priceRange: v.range }));
	add("actions", (v) => ({ reservationUrl: v.reservationUrl, orderUrl: v.orderUrl, menuUrl: v.menuUrl }));
	add("hours", (v) =>
		Object.fromEntries(
			v.weekly
				.filter((day) => day.state !== "unknown")
				.map((day) => [
					`hours.${day.day}`,
					{
						state: day.state,
						intervals: day.intervals
							.map((i) => ({ open: i.open, close: i.close, closesNextDay: i.closesNextDay }))
							.sort((a, b) => a.open.localeCompare(b.open)),
					},
				]),
		),
	);
	add("classification", (v) => ({ classification: v }));
	add("menu", (v) => ({ menu: v }));
	for (const key of ["classification", "menu"]) if (result[key]) result[key].semantic = true;
	return result;
}
export type FindingStatus =
	| "consistent"
	| "mismatch"
	| "missing"
	| "unknown"
	| "unverifiable"
	| "not_applicable"
	| "needs_review";
export type Finding = {
	id: string;
	issueKey: string;
	field: string;
	status: FindingStatus;
	expected: unknown;
	observed: unknown;
	evidenceIds: string[];
	factEvidenceIds: string[];
	reason: string;
};
const coreFields = [
	"name",
	"address",
	"phone",
	"website",
	"priceRange",
	"reservationUrl",
	"orderUrl",
	"menuUrl",
	...Array.from({ length: 7 }, (_, i) => `hours.${i + 1}`),
	"businessStatus",
	"specialHours",
	"coordinates",
	"classification",
	"menu",
];
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const observedHours = z
	.object({
		state: z.enum(["open", "closed", "24h"]),
		intervals: z.array(z.object({ open: clock, close: clock, closesNextDay: z.boolean() })).max(4),
	})
	.refine((day) => (day.state === "open" ? day.intervals.length > 0 : day.intervals.length === 0));
function equalHours(expected: unknown, observed: unknown) {
	const parsed = observedHours.safeParse(observed);
	if (!parsed.success) return null;
	const { state, intervals } = parsed.data;
	return (
		stableJson(expected) === stableJson({ state, intervals: intervals.sort((a, b) => a.open.localeCompare(b.open)) })
	);
}
const textComparators: Record<string, (expected: unknown, observed: string) => boolean | null> = {
	name: (expected, observed) =>
		Array.isArray(expected) &&
		expected.some((value) => normalizeText(value) && normalizeText(value) === normalizeText(observed)),
	address: (expected, observed) =>
		!!normalizeAddress(expected) && normalizeAddress(expected) === normalizeAddress(observed),
	phone: (expected, observed) =>
		normalizePhone(expected).length >= 7 && normalizePhone(expected) === normalizePhone(observed),
	priceRange: (expected, observed) => (/^\${1,4}$/.test(observed.trim()) ? String(expected) === observed.trim() : null),
};
function equal(field: string, expected: unknown, observed: unknown): boolean | null {
	if (field.startsWith("hours.")) return equalHours(expected, observed);
	if (typeof observed !== "string") return null;
	if (textComparators[field]) return textComparators[field](expected, observed);
	if (field.toLowerCase().endsWith("url") || field === "website")
		return !!normalizeUrl(expected) && normalizeUrl(expected) === normalizeUrl(observed);
	return null;
}
function classifyField(
	field: string,
	target: Expected | undefined,
	observation: Snapshot["fields"][string] | undefined,
	usable: boolean,
): { status: FindingStatus; reason: string } {
	if (!target || target.value === null)
		return { status: "unknown", reason: "标准事实尚未确认或该字段尚不支持确定性比较" };
	if (!usable || !observation)
		return { status: "unverifiable", reason: "未成功采集、证据缺失/损坏或快照超过七天；不能据此判为一致或缺失" };
	if (observation.state === "missing")
		return { status: "missing", reason: "采集证据显示页面未提供该字段；需人工核实后修正" };
	if (observation.state === "not_applicable")
		return { status: "needs_review", reason: "渠道声明不适用，需复核其与已确认事实的关系" };
	const match = target.semantic ? null : equal(field, target.value, observation.value);
	if (match === null) return { status: "needs_review", reason: "语义或结构无法可靠比较，等待人工复核" };
	if (match) return { status: "consistent", reason: "已确认事实与本次有证据的观察一致" };
	return { status: "mismatch", reason: "观察与已确认事实不同，先核实是否同一分店" };
}
function hasEvidence(observation: Snapshot["fields"][string] | undefined, evidence: Set<string>) {
	if (!observation || ["not_collected", "failed"].includes(observation.state)) return false;
	return observation.evidenceIds.length > 0 && observation.evidenceIds.every((id) => evidence.has(id));
}
export function compareSnapshot(input: {
	storeId: string;
	factVersion: number;
	facts: Facts;
	snapshot: Snapshot;
	now?: Date;
}) {
	const { storeId, factVersion, facts, snapshot } = input;
	if (snapshot.storeId !== storeId) throw new Error("快照属于其他门店");
	const expected = expectedFields(facts);
	const age = (input.now ?? new Date()).getTime() - Date.parse(snapshot.collectedAt);
	const fresh = Number.isFinite(age) && age >= 0 && age <= 7 * 86400000;
	const evidence = new Set(snapshot.evidence.filter((e) => sha256(e.text) === e.sha256).map((e) => e.id));
	const findings: Finding[] = [...new Set([...coreFields, ...Object.keys(snapshot.fields)])].map((field) => {
		const target = expected[field];
		const observation = snapshot.fields[field];
		const { status, reason } = classifyField(
			field,
			target,
			observation,
			fresh && snapshot.status === "succeeded" && hasEvidence(observation, evidence),
		);
		const issueKey = sha256(stableJson([storeId, snapshot.channel, snapshot.listingId, field]));
		return {
			id: sha256(stableJson([issueKey, snapshot.id, factVersion, RULE_VERSION])),
			issueKey,
			field,
			status,
			expected: target?.value ?? null,
			observed: observation?.value ?? null,
			evidenceIds: observation?.evidenceIds ?? [],
			factEvidenceIds: target?.evidenceIds ?? [],
			reason,
		};
	});
	const identity = findings.filter((f) => ["name", "address"].includes(f.field));
	const identityStatus = identity.every((f) => f.status === "consistent")
		? "matched"
		: identity.some((f) => f.status === "mismatch")
			? "possible_wrong_branch"
			: "unverified";
	return {
		schemaVersion: "geo.audit.v1",
		storeId,
		factVersion,
		snapshotId: snapshot.id,
		ruleVersion: RULE_VERSION,
		generatedAt: (input.now ?? new Date()).toISOString(),
		identityStatus,
		coverage: {
			evaluated: findings.filter((f) => ["consistent", "mismatch", "missing"].includes(f.status)).length,
			total: findings.length,
		},
		overallStatus:
			identityStatus !== "matched"
				? "needs_review"
				: findings.some((f) => ["mismatch", "missing"].includes(f.status))
					? "action_required"
					: findings.every((f) => f.status === "consistent")
						? "consistent"
						: "partial",
		findings,
	};
}
export type Audit = ReturnType<typeof compareSnapshot>;
