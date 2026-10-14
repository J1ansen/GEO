import { db } from "@workspace/lib/db/db";
import { sql } from "drizzle-orm";
import { getBoss } from "./boss";
import { registerRestaurantGeo } from "./jobs/restaurant-geo";

async function main() {
	const schema = await db.execute(sql`select to_regclass('public.restaurant_geo_records') as name`);
	if (!schema.rows[0]?.name) throw new Error("GEO 数据表尚未安装；先取得迁移授权并完成数据库验收");
	const boss = getBoss();
	boss.on("error", (error) => console.error("GEO queue error", error.message));
	await boss.start();
	await registerRestaurantGeo(boss);
	console.log("GEO website/channel worker ready; AI provider queues are not started.");
}
async function stop() {
	await getBoss().stop({ graceful: true, timeout: 30000 });
	await db.$client.end();
	process.exit(0);
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
main().catch(async (error) => {
	console.error(error.message);
	await db.$client.end();
	process.exit(1);
});
