import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "../packages/lib/node_modules/drizzle-orm/node-postgres/migrator.js";
import { db } from "../packages/lib/src/db/db.ts";

const url = new URL(process.env.DATABASE_URL ?? "");
const database = decodeURIComponent(url.pathname.slice(1));
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
if (process.platform === "win32") {
	const ips = execFileSync("wsl.exe", ["-d", "Ubuntu-22.04", "--", "hostname", "-I"], { encoding: "utf8", windowsHide: true }).trim().split(/\s+/);
	for (const ip of ips) localHosts.add(ip);
}
if (!localHosts.has(url.hostname) || !["restaurant_p1", "restaurant_p1_test"].includes(database)) throw new Error("Only the dedicated local P1 databases may be initialized with this script");
if (!process.argv.includes("--apply-p1-local")) throw new Error("Pass --apply-p1-local to apply the reviewed migrations to the dedicated P1 database");
try {
	await migrate(db, { migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../packages/lib/src/db/migrations") });
	console.log(`P1 schema ready: ${database}`);
} finally { await db.$client.end(); }
