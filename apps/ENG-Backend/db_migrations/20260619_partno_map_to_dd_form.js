'use strict';
/**
 * Convert tooling_partno_map.tool_dwg_no from the full 4800-42-XXXX form to the DD#### form
 * (4800-42-0226 → DD0226). DD#### is how the engineering TOOLING LIST and the SDS sheet name
 * the rotary diamond dresser. The SDS controller round-trips DD ⇄ 4800-42 (utils/rotaryDwg)
 * for matching against the Machine Tool Config family and the factory plan, and prints DD.
 *
 * Idempotent: rows already in DD form pass through unchanged (toDD is a no-op for them).
 *
 * Run: node db_migrations/20260619_partno_map_to_dd_form.js
 */

const { engPool } = require('../instance/eng_db');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');
const { toDD } = require('../api/engineer/mtc/utils/rotaryDwg');

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, tool_dwg_no FROM ${TABLES.TOOLING_PARTNO_MAP} WHERE tool_dwg_no LIKE '4800-42-%' FOR UPDATE`
    );
    let n = 0;
    for (const r of rows) {
      const dd = toDD(r.tool_dwg_no);
      if (dd !== r.tool_dwg_no) {
        await client.query(`UPDATE ${TABLES.TOOLING_PARTNO_MAP} SET tool_dwg_no = $1 WHERE id = $2`, [dd, r.id]);
        n++;
      }
    }
    await client.query('COMMIT');
    console.log(`✅ tooling_partno_map: converted ${n} rows to DD#### form`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ conversion failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { run };
