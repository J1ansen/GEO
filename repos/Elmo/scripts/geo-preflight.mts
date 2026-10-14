import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runCollector } from "../packages/lib/src/restaurants/geo/runtime.ts";
import { channel, publicUrl } from "../packages/lib/src/restaurants/geo/contracts.ts";

const url = publicUrl.parse(process.argv[2]);
const source = channel.parse(process.argv[3] ?? "official");
const output = process.argv[4];
if (!output) throw new Error("Usage: geo-preflight.mts URL CHANNEL OUTPUT_JSON");
const result = await runCollector({ organizationId: "unbound-preflight", storeId: "00000000-0000-4000-8000-000000000001", snapshotId: crypto.randomUUID(), url, channel: source, listingId: "easyjoy-mulberry-preflight" });
await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await writeFile(output, JSON.stringify({ bindingStatus: "unbound_preflight_not_confirmed_merchant_facts", ...result }, null, 2));
console.log(JSON.stringify({ status: result.snapshot.status, fields: Object.keys(result.snapshot.fields), error: result.snapshot.error, websiteAudit: !!result.websiteAudit, output }));
