import { createRequire } from 'node:module';
const require = createRequire(new URL('../repos/Elmo/packages/lib/package.json', import.meta.url));
let client;
try {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/restaurant_p1') {
    throw new Error('Expected the dedicated local restaurant_p1 database.');
  }
  const { Client } = require('pg');
  client = new Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  await client.connect();
  const result = await client.query("SELECT to_regclass('public.restaurant_stores') AS stores, to_regclass('public.restaurant_geo_records') AS geo");
  if (!result.rows[0].stores) throw new Error('P1 schema is not installed.');
  console.log('Local P1 database is ready.');
  if (!result.rows[0].geo) console.log('The GEO extension is not installed; the GEO pilot tab remains unavailable.');
} catch {
  console.error('Local database check failed. Check service, credentials and approved P1 initialization in mac/README.txt.');
  process.exitCode = 1;
} finally { if (client) await client.end(); }
