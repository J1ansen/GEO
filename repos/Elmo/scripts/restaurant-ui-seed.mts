import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { hashPassword } from "../packages/lib/node_modules/better-auth/dist/crypto/password.mjs";
import { db } from "../packages/lib/src/db/db.ts";
import { account, member, organization, user } from "../packages/lib/src/db/schema-auth.ts";

if (new URL(process.env.DATABASE_URL ?? "").pathname !== "/restaurant_p1_test") throw new Error("UI fixtures require restaurant_p1_test");
const id = randomUUID(), org = randomUUID(), password = randomBytes(24).toString("hex"), email = `${id}@example.test`;
try {
	await db.insert(user).values({ id, name: "P1 软件验收", email, emailVerified: true, role: "admin" });
	await db.insert(account).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: await hashPassword(password) });
	await db.insert(organization).values({ id: org, name: "P1 软件验收（模拟数据）", slug: `p1-qa-${org}`, createdAt: new Date() });
	await db.insert(member).values({ id: randomUUID(), organizationId: org, userId: id, role: "admin", createdAt: new Date() });
	await mkdir(".restaurant-test", { recursive: true });
	await writeFile(".restaurant-test/ui-account.json", JSON.stringify({ email, password, org: `p1-qa-${org}` }));
	console.log("UI-only test account created in isolated test database. Credentials not printed.");
} finally { await db.$client.end(); }
