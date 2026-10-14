import { readFile, writeFile } from "node:fs/promises";
import { Client } from "../packages/lib/node_modules/pg/esm/index.mjs";

const [host, file] = process.argv.slice(2);
if (![".env", ".env.p1-test"].includes(file) || !/^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error("Expected a local P1 environment and WSL address");
const text = await readFile(file, "utf8");
const match = text.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error("DATABASE_URL is missing");
const url = new URL(match[1].trim());
if (!["/restaurant_p1", "/restaurant_p1_test"].includes(url.pathname)) throw new Error("Not a dedicated P1 database");
url.hostname = host;
const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
try {
	await client.connect();
	const result = await client.query("SELECT to_regclass('public.restaurant_stores') AS stores");
	if (!result.rows[0].stores) throw new Error("P1 database has not been initialized");
	await writeFile(file, text.replace(match[0], `DATABASE_URL=${url.href}`));
	console.log(`P1 database connected: ${url.pathname.slice(1)}`);
} catch (error) {
	console.error(`P1 database unavailable (${error.code ?? error.message}). Check WSL PostgreSQL and its host-specific access rule.`);
	process.exitCode = 1;
} finally { await client.end(); }
