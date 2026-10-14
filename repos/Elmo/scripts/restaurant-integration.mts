import assert from "node:assert/strict";
import { after, test } from "node:test";
import { eq } from "../packages/lib/node_modules/drizzle-orm/index.js";
import { db } from "../packages/lib/src/db/db.ts";
import { restaurantEvidence, restaurantFactVersions } from "../packages/lib/src/db/schema.ts";
import { member, organization, user } from "../packages/lib/src/db/schema-auth.ts";
import { emptyFacts } from "../packages/lib/src/restaurants/facts.ts";
import { addRestaurantEvidence, confirmRestaurantFacts, createRestaurantStore, exportRestaurantFacts, getRestaurantEvidence, getRestaurantStore, listRestaurantStores, saveRestaurantDraft } from "../packages/lib/src/restaurants/service.ts";

if (new URL(process.env.DATABASE_URL ?? "").pathname !== "/restaurant_p1_test") throw new Error("Requires isolated restaurant_p1_test database");
after(async () => db.$client.end());

test("P1 store, evidence, review, tenancy and immutable export workflow", async (suite) => {
	const owner = crypto.randomUUID(), reader = crypto.randomUUID(), outsider = crypto.randomUUID();
	const org = crypto.randomUUID(), otherOrg = crypto.randomUUID();
	await db.insert(user).values([owner, reader, outsider].map((id) => ({ id, name: id === owner ? "P1 test reviewer" : "P1 test member", email: `${id}@example.test` })));
	await db.insert(organization).values([org, otherOrg].map((id) => ({ id, name: "P1 test organization", slug: id, createdAt: new Date() })));
	await db.insert(member).values([{ id: crypto.randomUUID(), organizationId: org, userId: owner, role: "admin", createdAt: new Date() }, { id: crypto.randomUUID(), organizationId: org, userId: reader, role: "member", createdAt: new Date() }, { id: crypto.randomUUID(), organizationId: otherOrg, userId: outsider, role: "admin", createdAt: new Date() }]);
	const store = await createRestaurantStore(owner, { organizationId: org, brandName: "P1 test cafe", label: "P1 test location" });
	const second = await createRestaurantStore(owner, { organizationId: org, brandId: store.brandId, label: "P1 second branch" });
	const scope = { organizationId: org, storeId: store.id };
	const evidenceInput = { title: "Simulated merchant review", sourceKind: "merchant_review" as const, sourceUrl: null, observedAt: new Date().toISOString(), text: "TEST ONLY: fictional name and address verified for software QA", attachment: null };
	const evidence = await addRestaurantEvidence(owner, { ...scope, ...evidenceInput });
	const otherEvidence = await addRestaurantEvidence(owner, { ...scope, storeId: second.id, ...evidenceInput });
	const facts = emptyFacts();
	facts.identity = { value: { name: "P1 test cafe", nativeName: "", aliases: [] }, status: "confirmed", evidenceIds: [evidence.id] };
	facts.location = { value: { address: "1 Example St", city: "New York", region: "NY", postalCode: "10001", country: "US", timezone: "America/New_York" }, status: "confirmed", evidenceIds: [evidence.id] };
	facts.phone = { value: "+12125550100", status: "pending", evidenceIds: [] };
	await suite.test("creates two branches without requiring a website", async () => {
		assert.equal((await listRestaurantStores(owner, org)).stores.length, 2);
		assert.equal(store.draft.website.value, null);
		await assert.rejects(exportRestaurantFacts(owner, { ...scope, version: 1 }), /只能导出/);
	});
	await suite.test("rejects organization and branch evidence leakage", async () => {
		await assert.rejects(getRestaurantStore(outsider, scope), /无权/);
		await assert.rejects(getRestaurantStore(outsider, { ...scope, organizationId: otherOrg }), /无权/);
		await assert.rejects(getRestaurantEvidence(owner, { ...scope, evidenceId: otherEvidence.id }), /无权/);
		await assert.rejects(createRestaurantStore(outsider, { organizationId: otherOrg, brandId: store.brandId, label: "bad" }), /其他组织/);
		const bad = structuredClone(facts); bad.identity.evidenceIds = [otherEvidence.id];
		await assert.rejects(saveRestaurantDraft(owner, { ...scope, revision: 0, facts: bad }), /其他门店/);
	});
	await suite.test("accepts exactly one concurrent edit and distrusts client confirmation", async () => {
		const results = await Promise.allSettled([saveRestaurantDraft(owner, { ...scope, revision: 0, facts }), saveRestaurantDraft(reader, { ...scope, revision: 0, facts })]);
		assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
		assert.equal((await getRestaurantStore(owner, scope)).store.draft.identity.status, "pending");
	});
	const confirmation = { ...scope, revision: 1, fields: ["identity", "location"] as ("identity" | "location")[], verifiedWith: "Test merchant (fictional)", note: "Test fixture; not a restaurant finding" };
	await suite.test("limits approval to administrators", async () => {
		await assert.rejects(confirmRestaurantFacts(reader, confirmation), /管理员/);
	});
	await suite.test("confirms only reviewed fields and records reviewer identity", async () => {
		const version = await confirmRestaurantFacts(owner, confirmation);
		assert.equal(version.version, 1); assert.equal(version.confirmedBy, owner);
		const result = await exportRestaurantFacts(owner, { ...scope, version: 1 });
		assert.equal(result.facts.phone, null); assert.equal(result.field_status.phone, "pending"); assert.equal(result.field_status.website, "unknown");
	});
	await suite.test("preserves old confirmed values when a later draft changes", async () => {
		const prior = await exportRestaurantFacts(owner, { ...scope, version: 1 });
		const snapshot = await getRestaurantStore(owner, scope);
		const edit = snapshot.store.draft;
		edit.identity.value = { name: "Updated test cafe", nativeName: "", aliases: [] };
		const saved = await saveRestaurantDraft(owner, { ...scope, revision: snapshot.store.revision, facts: edit });
		assert.equal(saved.draft.identity.status, "pending");
		assert.deepEqual(await exportRestaurantFacts(owner, { ...scope, version: 1 }), prior);
		await confirmRestaurantFacts(owner, { ...confirmation, revision: saved.revision });
		assert.equal((await getRestaurantStore(owner, scope)).versions.length, 2);
		assert.deepEqual(await exportRestaurantFacts(owner, { ...scope, version: 1 }), prior);
	});
	await suite.test("blocks direct modification and deletion of audit records in PostgreSQL", async () => {
		await assert.rejects(db.update(restaurantEvidence).set({ text: "tampered" }).where(eq(restaurantEvidence.id, evidence.id)));
		await assert.rejects(db.delete(restaurantFactVersions).where(eq(restaurantFactVersions.storeId, store.id)));
		assert.equal((await getRestaurantEvidence(owner, { ...scope, evidenceId: evidence.id })).text, evidenceInput.text);
	});
	await suite.test("rejects fake attachment types and future observations", async () => {
		await assert.rejects(addRestaurantEvidence(owner, { ...scope, ...evidenceInput, attachment: { filename: "fake.png", mime: "image/png", base64: Buffer.from("not an image").toString("base64") } }), /内容不符/);
		await assert.rejects(addRestaurantEvidence(owner, { ...scope, ...evidenceInput, observedAt: "2099-01-01T00:00:00Z" }), /当前时间/);
	});
});
