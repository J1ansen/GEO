import { describe, expect, it } from "vitest";
import { emptyFacts } from "../facts";
import { compareSnapshot, sha256 } from "./compare";
import type { Snapshot } from "./contracts";

const storeId = "00000000-0000-4000-8000-000000000001";
const now = new Date("2026-10-14T12:00:00Z");
function setup() {
	const facts = emptyFacts();
	facts.identity = {
		status: "confirmed",
		evidenceIds: ["merchant-name"],
		value: { name: "Easy Joy", nativeName: "意中人", aliases: [] },
	};
	facts.location = {
		status: "confirmed",
		evidenceIds: ["merchant-address"],
		value: {
			address: "145 Mulberry Street, New York, NY 10013",
			city: "New York",
			country: "US",
			region: "NY",
			postalCode: "10013",
			timezone: "America/New_York",
		},
	};
	facts.pricing = {
		status: "confirmed",
		evidenceIds: ["merchant-price"],
		value: { range: "$$", currency: "USD", note: "" },
	};
	const snapshot: Snapshot = {
		schemaVersion: "geo.snapshot.v1",
		id: "00000000-0000-4000-8000-000000000002",
		storeId,
		channel: "google_maps",
		listingId: "listing-one",
		url: "https://maps.google.com/",
		collectedAt: now.toISOString(),
		collectorVersion: "test-fixture",
		method: "manual",
		status: "succeeded",
		error: null,
		evidence: [
			{
				id: "page",
				sha256: sha256("SYNTHETIC TEST EVIDENCE"),
				text: "SYNTHETIC TEST EVIDENCE",
				url: "https://maps.google.com/",
			},
		],
		fields: {
			name: { state: "observed", value: "Easy Joy", evidenceIds: ["page"], excerpt: "" },
			address: { state: "observed", value: "145 Mulberry St, New York, NY 10013", evidenceIds: ["page"], excerpt: "" },
			priceRange: { state: "observed", value: "$$$$", evidenceIds: ["page"], excerpt: "" },
		},
	};
	return { storeId, factVersion: 1, facts, snapshot, now };
}
describe("store facts adapted from the supplied GEO component", () => {
	it("preserves price symbols and keeps incomplete coverage explicit", () => {
		const report = compareSnapshot(setup());
		expect(report.findings.find((f) => f.field === "priceRange")?.status).toBe("mismatch");
		expect(report.identityStatus).toBe("matched");
		expect(report.findings.find((f) => f.field === "businessStatus")?.status).toBe("unknown");
	});
	it("does not turn unavailable capture into missing information", () => {
		const input = setup();
		delete input.snapshot.fields.priceRange;
		expect(compareSnapshot(input).findings.find((f) => f.field === "priceRange")?.status).toBe("unverifiable");
		input.snapshot.fields.priceRange = { state: "missing", evidenceIds: ["page"], excerpt: "Field not displayed" };
		expect(compareSnapshot(input).findings.find((f) => f.field === "priceRange")?.status).toBe("missing");
	});
	it.each(["old", "future", "bad-hash", "no-evidence", "failed"])(
		"does not certify consistency for %s evidence",
		(condition) => {
			const input = setup();
			if (condition === "old") input.snapshot.collectedAt = "2026-10-01T00:00:00Z";
			if (condition === "future") input.snapshot.collectedAt = "2026-10-15T00:00:00Z";
			if (condition === "bad-hash") input.snapshot.evidence[0].text += "tamper";
			if (condition === "no-evidence") input.snapshot.evidence = [];
			if (condition === "failed") input.snapshot.status = "failed";
			expect(compareSnapshot(input).findings.some((f) => f.status === "consistent")).toBe(false);
		},
	);
	it("does not treat another branch address as the selected branch", () => {
		const input = setup();
		input.snapshot.fields.address.value = "999 Other Street, New York, NY 10013";
		expect(compareSnapshot(input).identityStatus).toBe("possible_wrong_branch");
		input.snapshot.storeId = "00000000-0000-4000-8000-000000000099";
		expect(() => compareSnapshot(input)).toThrow("其他门店");
	});
	it("retains distinct occurrences for multiple listings and versions", () => {
		const input = setup();
		const one = compareSnapshot(input).findings[0];
		input.snapshot.listingId = "listing-two";
		const two = compareSnapshot(input).findings[0];
		expect(two.id).not.toBe(one.id);
		expect(two.issueKey).not.toBe(one.issueKey);
		input.factVersion = 2;
		const three = compareSnapshot(input).findings[0];
		expect(three.id).not.toBe(two.id);
		expect(three.issueKey).toBe(two.issueKey);
	});
	it("preserves overnight boundaries and unknown days", () => {
		const input = setup();
		input.facts.hours = {
			status: "confirmed",
			evidenceIds: ["merchant-hours"],
			value: {
				holidayNote: "",
				weekly: Array.from({ length: 7 }, (_, i) => ({
					day: i + 1,
					state: i === 0 ? "open" : "unknown",
					intervals: i === 0 ? [{ id: crypto.randomUUID(), open: "18:00", close: "02:00", closesNextDay: true }] : [],
				})),
			},
		};
		input.snapshot.fields["hours.1"] = {
			state: "observed",
			value: { state: "open", intervals: [{ open: "18:00", close: "02:00", closesNextDay: true }] },
			evidenceIds: ["page"],
			excerpt: "",
		};
		const report = compareSnapshot(input);
		expect(report.findings.find((f) => f.field === "hours.1")?.status).toBe("consistent");
		expect(report.findings.find((f) => f.field === "hours.2")?.status).toBe("unknown");
	});
});
