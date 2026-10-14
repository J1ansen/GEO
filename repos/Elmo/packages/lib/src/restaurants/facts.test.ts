import { describe, expect, it } from "vitest";
import { canonicalExport, confirmFacts, emptyFacts, factSchemas, normalizeDraft } from "./facts";

describe("restaurant facts", () => {
	it("does not trust confirmed flags supplied by a draft client", () => {
		const draft = emptyFacts();
		draft.phone = { value: "+12125550100", status: "confirmed", evidenceIds: [] };
		expect(normalizeDraft(draft, emptyFacts()).phone.status).toBe("pending");
	});
	it("invalidates confirmation when a value or its evidence changes", () => {
		const previous = emptyFacts();
		previous.phone = { value: "+12125550100", status: "confirmed", evidenceIds: [crypto.randomUUID()] };
		expect(normalizeDraft(previous, previous).phone.status).toBe("confirmed");
		const changed = structuredClone(previous);
		changed.phone.evidenceIds = [];
		expect(normalizeDraft(changed, previous).phone.status).toBe("pending");
		changed.phone.value = "+12125550101";
		expect(normalizeDraft(changed, previous).phone.status).toBe("pending");
	});
	it("keeps unknown facts distinct and excludes unreviewed values from export", () => {
		const facts = emptyFacts();
		facts.phone = { value: "+12125550100", status: "pending", evidenceIds: [] };
		facts.pricing = { value: { range: "$$", currency: "USD", note: "" }, status: "confirmed", evidenceIds: [] };
		const exported = canonicalExport({ facts, version: 1, storeId: "test", brandId: "brand", confirmedAt: new Date() });
		expect(exported.facts.phone).toBeNull();
		expect(exported.field_status.website).toBe("unknown");
		expect(exported.facts.pricing).toEqual(facts.pricing.value);
		expect(exported).not.toHaveProperty("confirmedBy");
	});
	it("requires evidence and verified store identity before confirmation", () => {
		const facts = emptyFacts();
		expect(() => confirmFacts(facts, ["identity"])).toThrow("证据");
		facts.phone = { value: "+12125550100", status: "pending", evidenceIds: [crypto.randomUUID()] };
		expect(() => confirmFacts(facts, ["phone"])).toThrow("避免串店");
	});
	it("rejects active URLs and embedded credentials", () => {
		for (const url of ["javascript:alert(1)", "file:///C:/private", "https://user:secret@example.com/"])
			expect(factSchemas.website.safeParse(url).success).toBe(false);
	});
	it("requires explicit overnight hours, while keeping closed and unknown days distinct", () => {
		const weekly = Array.from({ length: 7 }, (_, index) => ({
			day: index + 1,
			state: index ? "unknown" : "open",
			intervals: index ? [] : [{ id: crypto.randomUUID(), open: "22:00", close: "02:00", closesNextDay: false }],
		}));
		expect(factSchemas.hours.safeParse({ weekly, holidayNote: "" }).success).toBe(false);
		weekly[0].intervals[0].closesNextDay = true;
		weekly[1].state = "closed";
		expect(factSchemas.hours.parse({ weekly, holidayNote: "" }).weekly[2].state).toBe("unknown");
	});
	it("limits important dishes to ten and validates price context", () => {
		const item = {
			id: crypto.randomUUID(),
			name: "Sample dish",
			price: 10,
			currency: "USD",
			portion: "one person",
			validTimes: "dinner",
			tax: "unknown",
		};
		expect(factSchemas.menu.safeParse({ packages: [], dishes: Array(10).fill(item) }).success).toBe(true);
		expect(factSchemas.menu.safeParse({ packages: [], dishes: Array(11).fill(item) }).success).toBe(false);
		expect(factSchemas.menu.safeParse({ packages: [{ ...item, price: -1 }], dishes: [] }).success).toBe(false);
	});
});
