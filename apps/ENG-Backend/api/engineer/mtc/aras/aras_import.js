'use strict';
/**
 * Aras PLM → EngineerSystem periodic importer ("แบบ A": pull, don't live-query).
 *
 * Pulls an Aras OData entity set and upserts the raw rows into a JSONB staging table
 * `aras_<entity>` in eng_system, so the rest of EngineerSystem can read PLM data from
 * its own DB without hitting Aras on every request.
 *
 * Auth: uses ./aras_plm.js. Easiest for Windows-SSO users — grab a Bearer token
 * from the browser (DevTools → any OData request → Authorization header, or
 * sessionStorage `oidc.user:*`.access_token) and run:
 *
 *   PowerShell:  $env:ARAS_URL='http://wk10.kz.minebea.local/InnovatorServer'
 *                $env:ARAS_TOKEN='eyJ...'; node api/engineer/mtc/aras/aras_import.js Part "?$top=200&$select=item_number,name"
 *
 * Or, with a service account configured in .env (ARAS_USER/PASS), omit ARAS_TOKEN.
 *
 * Usage:  node api/engineer/mtc/aras/aras_import.js <EntitySet> [odataQuery] [--max N]
 *   <EntitySet>   e.g. Part, Document, "Manufacturer Part"
 *   [odataQuery]  e.g. "?$top=200&$select=item_number,name&$filter=..."
 *   --max N       stop after N rows (default 5000)
 */
const { aras, isConfigured } = require('./aras_plm');
const { engPool } = require('../../../../instance/eng_db');
const crypto = require('crypto');

const args = process.argv.slice(2);
const maxIdx = args.indexOf('--max');
const MAX = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) : 5000;
const positional = args.filter((a, i) => a !== '--max' && args[i - 1] !== '--max');
const ENTITY = positional[0];
const QUERY = positional[1] || '';

if (!ENTITY) {
  console.error('Usage: node api/engineer/mtc/aras/aras_import.js <EntitySet> [odataQuery] [--max N]');
  process.exit(1);
}
if (!isConfigured()) {
  console.error('Aras not configured. Set ARAS_URL and either ARAS_TOKEN (browser token) or ARAS_USER/ARAS_PASS/ARAS_DB.');
  process.exit(1);
}

const tableName = 'aras_' + ENTITY.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const rowId = (r) => r.id || r['@odata.id'] || crypto.createHash('md5').update(JSON.stringify(r)).digest('hex');

async function ensureTable() {
  await engPool.query(
    `CREATE TABLE IF NOT EXISTS ${tableName} (
       aras_id     TEXT PRIMARY KEY,
       data        JSONB NOT NULL,
       imported_at TIMESTAMP NOT NULL DEFAULT now()
     )`
  );
}

async function upsertChunk(rows) {
  if (!rows.length) return 0;
  const values = [];
  const placeholders = rows.map((r, i) => {
    values.push(rowId(r), JSON.stringify(r));
    return `($${i * 2 + 1}, $${i * 2 + 2}::jsonb, now())`;
  });
  await engPool.query(
    `INSERT INTO ${tableName} (aras_id, data, imported_at) VALUES ${placeholders.join(',')}
     ON CONFLICT (aras_id) DO UPDATE SET data = EXCLUDED.data, imported_at = now()`,
    values
  );
  return rows.length;
}

(async () => {
  console.log(`Importing Aras "${ENTITY}" -> table ${tableName} (max ${MAX})`);
  await ensureTable();

  let path = `${ENTITY}${QUERY}`;
  let total = 0;
  const CHUNK = 1000;
  try {
    while (path && total < MAX) {
      const page = await aras.odata(path);
      const rows = page.value || (Array.isArray(page) ? page : [page]);
      for (let i = 0; i < rows.length && total < MAX; i += CHUNK) {
        total += await upsertChunk(rows.slice(i, Math.min(i + CHUNK, MAX - total + i)));
      }
      process.stdout.write(`  fetched ${total} rows\r`);
      // Follow OData server-driven paging.
      const next = page['@odata.nextLink'];
      path = next ? next.replace(/^.*\/OData\//, '') : null;
    }
    console.log(`\n✅ Done. ${total} rows upserted into ${tableName}.`);
    const { rows: [{ count }] } = await engPool.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
    console.log(`   Table ${tableName} now holds ${count} rows total.`);
  } catch (e) {
    console.error(`\n❌ Import failed: ${e.message}`);
    if (/401|token/i.test(e.message)) console.error('   Token may be missing/expired — grab a fresh one from the browser.');
    process.exitCode = 2;
  } finally {
    await engPool.end();
  }
})();
