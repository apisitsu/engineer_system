'use strict';

/**
 * LNC45/C200 — CLAMP PLATE 4651-13.
 * ------------------------------------------------------------------------------
 * TEMPLATE_B M-BODY, F-BODY, ABR BODY, ROLLER BODY sheets all list:
 *   - BODY HOLDER (NEW TYPE) 4651-20
 *   - BODY HOLDER (OLD TYPE) 4651-12
 *   - CLAMP PLATE            4651-13
 *
 * In the production plan (process 0351/0101):
 *   - 4651-13 is planned on 1,166 C/Ns across 111 unique drawings!
 *
 * This migration:
 * 1. Loads 111 unique 4651-13 drawings onto tooling_finish_id shelf.
 * 2. Seeds tooling_partno_map for LNC45/C200 CLAMP PLATE from lpb.eng_r_pi_tool.
 *
 * Idempotent; `--revert` cleans up both shelf and map rows.
 */

const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');

const MACHINE = 'LNC45/C200';
const INVENTORY = 'tooling_finish_id';
const TOOLING = 'CLAMP PLATE';
const FAMILY = '4651-13';
const SOURCE = 'TEMPLATE_B Body sheets proc 0351 · lpb.eng_r_pi_tool · 20260821j_';

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (revert) {
    console.log(`\n── Reverting ${MACHINE} ${TOOLING} ──`);
    const m = await engPool.query(
      `DELETE FROM tooling_partno_map
        WHERE machine_name = $1 AND tooling_name = $2 AND cn IS NOT NULL`,
      [MACHINE, TOOLING]
    );
    const s = await engPool.query(
      `DELETE FROM ${INVENTORY} WHERE tooling_name = $1`, [TOOLING]
    );
    console.log(`  reverted ${TOOLING}: ${s.rowCount} shelf rows, ${m.rowCount} map rows removed`);
    return;
  }

  await ensureCnMapSchema(engPool);

  const drawings = (await maqPool.query(
    "SELECT DISTINCT tool_dwg_no FROM lpb.eng_r_pi_tool WHERE process_code IN ('0351', '0101') AND tool_dwg_no LIKE '4651-13%' ORDER BY tool_dwg_no"
  )).rows.map(r => r.tool_dwg_no);

  console.log(`\n── ${TOOLING} (${FAMILY}) ──`);
  if (dryRun) {
    console.log(`  [dry-run] would load ${drawings.length} drawings onto shelf and seed cn-map`);
    return;
  }

  // Load shelf
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${INVENTORY} WHERE tooling_name = $1`, [TOOLING]);
    const values = drawings.flatMap(d => [TOOLING, d]);
    const ph = drawings.map((_, ri) => `($${ri * 2 + 1}, $${ri * 2 + 2})`).join(',');
    const ins = await client.query(
      `INSERT INTO ${INVENTORY} (tooling_name, tooling_no) VALUES ${ph}`, values
    );
    await client.query('COMMIT');
    console.log(`  shelf: loaded ${ins.rowCount} drawings`);
  } catch(e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // Seed map
  const stats = await seedCnMapFromPlan({
    engPool, maqPool,
    machine: MACHINE, tooling: TOOLING, inventory: INVENTORY, family: FAMILY, source: SOURCE
  });
  console.log(`  map:   removed ${stats.removed}, inserted ${stats.inserted}` +
              ` · specced ${stats.specced}/${stats.mapped}` +
              ` · off-shelf ${stats.offShelf} · ambiguous ${stats.ambiguous.length}`);
  if (stats.ambiguous.length) {
    console.log(`  ambiguous C/Ns (skipped): ${stats.ambiguous.join(' ')}`);
  }

  console.log(`\nundo with:  node db_migrations/20260821j_lnc45_clamp_plate.js --revert`);
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => {
    console.error(e);
    await Promise.all([engPool.end(), maqPool.end()]).catch(() => {});
    process.exit(1);
  });
