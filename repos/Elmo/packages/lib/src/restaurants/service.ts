import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../db/db";
import type { DbConnection } from "../db/db-connection";
import { brands, member, restaurantEvidence, restaurantFactVersions, restaurantStores, user } from "../db/schema";
import {
	canonicalExport,
	confirmFacts,
	type confirmInput,
	type createStoreInput,
	emptyFacts,
	type evidenceInput,
	type Facts,
	factKeys,
	normalizeDraft,
	type saveDraftInput,
	type storeInput,
} from "./facts";

type Scope = z.infer<typeof storeInput>;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function membership(conn: DbConnection, actor: string, organizationId: string, approve = false) {
	const [row] = await conn
		.select({ role: member.role, name: user.name })
		.from(member)
		.innerJoin(user, eq(user.id, member.userId))
		.where(and(eq(member.userId, actor), eq(member.organizationId, organizationId)));
	if (!row) throw new Error("无权访问此组织");
	if (approve && !["owner", "admin"].includes(row.role)) throw new Error("只有组织管理员可以确认事实版本");
	return row;
}

async function scopedStore(conn: DbConnection, actor: string, scope: Scope, lock = false) {
	await membership(conn, actor, scope.organizationId);
	const query = conn
		.select({ store: restaurantStores })
		.from(restaurantStores)
		.innerJoin(brands, eq(brands.id, restaurantStores.brandId))
		.where(and(eq(restaurantStores.id, scope.storeId), eq(brands.organizationId, scope.organizationId)));
	const [row] = await (lock ? query.for("update") : query);
	if (!row) throw new Error("门店不存在或无权访问");
	return row.store;
}

export async function authorizeRestaurantScope(conn: DbConnection, actor: string, scope: Scope, write = false) {
	await membership(conn, actor, scope.organizationId, write);
	return scopedStore(conn, actor, scope, write);
}

function checkRevision(actual: number, expected: number) {
	if (actual !== expected) throw new Error("资料已被其他人更新，请重新加载后再编辑；本次修改未覆盖已有数据");
}

async function checkEvidence(conn: DbConnection, storeId: string, facts: Facts) {
	const rows = await conn
		.select({ id: restaurantEvidence.id })
		.from(restaurantEvidence)
		.where(eq(restaurantEvidence.storeId, storeId));
	const valid = new Set(rows.map((row) => row.id));
	for (const key of factKeys) {
		if (facts[key].evidenceIds.some((id) => !valid.has(id))) throw new Error("证据不存在或属于其他门店");
	}
}

export async function listRestaurantStores(actor: string, organizationId: string) {
	const viewer = await membership(db, actor, organizationId);
	const [stores, brandList] = await Promise.all([
		db
			.select({
				id: restaurantStores.id,
				label: restaurantStores.label,
				brandName: brands.name,
				currentVersion: restaurantStores.currentVersion,
				updatedAt: restaurantStores.updatedAt,
			})
			.from(restaurantStores)
			.innerJoin(brands, eq(brands.id, restaurantStores.brandId))
			.where(eq(brands.organizationId, organizationId))
			.orderBy(desc(restaurantStores.updatedAt)),
		db.select({ id: brands.id, name: brands.name }).from(brands).where(eq(brands.organizationId, organizationId)),
	]);
	return { stores, brands: brandList, canConfirm: ["owner", "admin"].includes(viewer.role) };
}

export async function createRestaurantStore(actor: string, input: z.infer<typeof createStoreInput>) {
	return db.transaction(async (tx) => {
		await membership(tx, actor, input.organizationId);
		let brandId = input.brandId;
		if (brandId) {
			const [brand] = await tx
				.select({ id: brands.id })
				.from(brands)
				.where(and(eq(brands.id, brandId), eq(brands.organizationId, input.organizationId)));
			if (!brand) throw new Error("品牌不存在或属于其他组织");
		} else {
			if (!input.brandName) throw new Error("请输入品牌名称");
			brandId = crypto.randomUUID();
			// Restaurant facts own the optional, verified website. Legacy brand tracking stays disabled until configured.
			await tx.insert(brands).values({
				id: brandId,
				name: input.brandName,
				slug: `restaurant-${brandId}`,
				organizationId: input.organizationId,
				website: "",
				enabled: false,
			});
		}
		const [store] = await tx
			.insert(restaurantStores)
			.values({ brandId, label: input.label, draft: emptyFacts(), updatedBy: actor })
			.returning();
		return store;
	});
}

const evidenceSummary = {
	id: restaurantEvidence.id,
	title: restaurantEvidence.title,
	sourceKind: restaurantEvidence.sourceKind,
	sourceUrl: restaurantEvidence.sourceUrl,
	observedAt: restaurantEvidence.observedAt,
	sha256: restaurantEvidence.sha256,
	createdAt: restaurantEvidence.createdAt,
};

export async function getRestaurantStore(actor: string, scope: Scope) {
	const store = await scopedStore(db, actor, scope);
	const [versions, evidence] = await Promise.all([
		db
			.select()
			.from(restaurantFactVersions)
			.where(eq(restaurantFactVersions.storeId, store.id))
			.orderBy(desc(restaurantFactVersions.version)),
		db
			.select(evidenceSummary)
			.from(restaurantEvidence)
			.where(eq(restaurantEvidence.storeId, store.id))
			.orderBy(desc(restaurantEvidence.createdAt)),
	]);
	return { store, versions, evidence };
}

export async function saveRestaurantDraft(actor: string, input: z.infer<typeof saveDraftInput>) {
	return db.transaction(async (tx) => {
		const store = await scopedStore(tx, actor, input, true);
		checkRevision(store.revision, input.revision);
		const draft = normalizeDraft(input.facts, store.draft);
		await checkEvidence(tx, store.id, draft);
		const [saved] = await tx
			.update(restaurantStores)
			.set({ draft, revision: store.revision + 1, updatedAt: new Date(), updatedBy: actor })
			.where(eq(restaurantStores.id, store.id))
			.returning();
		return saved;
	});
}

export async function confirmRestaurantFacts(actor: string, input: z.infer<typeof confirmInput>) {
	return db.transaction(async (tx) => {
		const reviewer = await membership(tx, actor, input.organizationId, true);
		const store = await scopedStore(tx, actor, input, true);
		checkRevision(store.revision, input.revision);
		const facts = confirmFacts(store.draft, input.fields);
		await checkEvidence(tx, store.id, facts);
		const [version] = await tx
			.insert(restaurantFactVersions)
			.values({
				storeId: store.id,
				version: store.currentVersion + 1,
				facts,
				confirmedBy: actor,
				confirmedByName: reviewer.name,
				verifiedWith: input.verifiedWith,
				note: input.note,
				sha256: hash(facts),
			})
			.returning();
		await tx
			.update(restaurantStores)
			.set({
				draft: facts,
				currentVersion: version.version,
				revision: store.revision + 1,
				updatedBy: actor,
				updatedAt: new Date(),
			})
			.where(eq(restaurantStores.id, store.id));
		return version;
	});
}

function validateAttachment(attachment: z.infer<typeof evidenceInput>["attachment"]) {
	if (!attachment) return null;
	const bytes = Buffer.from(attachment.base64, "base64");
	if (bytes.length > 2 * 1024 * 1024 || bytes.length === 0 || bytes.toString("base64") !== attachment.base64)
		throw new Error("附件须为有效文件且不超过 2 MB");
	const signature = { "image/png": "89504e470d0a1a0a", "image/jpeg": "ffd8ff", "application/pdf": "255044462d" }[
		attachment.mime
	];
	if (!bytes.toString("hex").startsWith(signature)) throw new Error("附件类型与文件内容不符");
	return { ...attachment, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function addRestaurantEvidence(actor: string, input: z.infer<typeof evidenceInput>) {
	await scopedStore(db, actor, input);
	if (new Date(input.observedAt).getTime() > Date.now() + 60000) throw new Error("证据时间不能晚于当前时间");
	const attachment = validateAttachment(input.attachment);
	const payload = {
		title: input.title,
		sourceKind: input.sourceKind,
		sourceUrl: input.sourceUrl,
		observedAt: input.observedAt,
		text: input.text,
		attachment,
	};
	const [saved] = await db
		.insert(restaurantEvidence)
		.values({
			...payload,
			observedAt: new Date(input.observedAt),
			storeId: input.storeId,
			createdBy: actor,
			sha256: hash(payload),
		})
		.returning(evidenceSummary);
	return saved;
}

export async function getRestaurantEvidence(actor: string, input: Scope & { evidenceId: string }) {
	await scopedStore(db, actor, input);
	const [evidence] = await db
		.select()
		.from(restaurantEvidence)
		.where(and(eq(restaurantEvidence.id, input.evidenceId), eq(restaurantEvidence.storeId, input.storeId)));
	if (!evidence) throw new Error("证据不存在或无权访问");
	return evidence;
}

export async function exportRestaurantFacts(actor: string, input: Scope & { version: number }) {
	const store = await scopedStore(db, actor, input);
	const [version] = await db
		.select()
		.from(restaurantFactVersions)
		.where(and(eq(restaurantFactVersions.storeId, store.id), eq(restaurantFactVersions.version, input.version)));
	if (!version) throw new Error("只能导出已确认的事实版本");
	return canonicalExport({ ...version, storeId: store.id, brandId: store.brandId });
}
