'use strict';

/**
 * X-100 — LOADER JAW 4857-06 and INVERSION JAW 4857-08.
 * ------------------------------------------------------------------------------
 * TEMPLATE_B SPH sheets (JWAVE, SPH(DT), SPH(D->T), SPH(D->DT), SPH 中型) specify:
 *   - LOADER JAW    4857-06  (note: RACE OD φ8～18: 0009, φ18～30: 0003, φ30～45: 0004)
 *   - INVERSION JAW 4857-08  (note: ID φ3～4: 0016, φ4～8: 0015, φ8～16: 0002, φ16～23: 0012)
 *
 * In the factory plan (process 2071/2031):
 *   - 4857-06 is planned on 408 C/Ns
 *   - 4857-08 is planned on 400 C/Ns
 *
 * This migration:
 * 1. Loads shelf drawings for LOADER JAW and INVERSION JAW into tooling_x100.
 * 2. Seeds tooling_partno_map for X-100 from lpb.eng_r_pi_tool.
 *
 * Idempotent; `--revert` cleans up both shelf and map rows.
 */

const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');

const MACHINE = 'X-100';
const INVENTORY = 'tooling_x100';
const SOURCE = 'TEMPLATE_B SPH sheets proc 2071/2031 · lpb.eng_r_pi_tool · 20260821k_';

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (revert) {
    console.log(`\n── Reverting ${MACHINE} LOADER JAW & INVERSION JAW ──`);
    for (const tooling of ['LOADER JAW', 'INVERSION JAW']) {
      const m = await engPool.query(
        `DELETE FROM tooling_partno_map
          WHERE machine_name = $1 AND tooling_name = $2 AND cn IS NOT NULL`,
        [MACHINE, tooling]
      );
      const s = await engPool.query(
        `DELETE FROM ${INVENTORY} WHERE tooling_name = $1`, [tooling]
      );
      console.log(`  reverted ${tooling}: ${s.rowCount} shelf rows, ${m.rowCount} map rows removed`);
    }
    return;
  }

  await ensureCnMapSchema(engPool);

  const ljDrawings = (await maqPool.query(
    "SELECT DISTINCT tool_dwg_no FROM lpb.eng_r_pi_tool WHERE process_code IN ('2071', '2031') AND tool_dwg_no LIKE '4857-06%' ORDER BY tool_dwg_no"
  )).rows.map(r => r.tool_dwg_no);

  const ijDrawings = (await maqPool.query(
    "SELECT DISTINCT tool_dwg_no FROM lpb.eng_r_pi_tool WHERE process_code IN ('2071', '2031') AND tool_dwg_no LIKE '4857-08%' ORDER BY tool_dwg_no"
  )).rows.map(r => r.tool_dwg_no);

  const families = [
    { tooling: 'LOADER JAW', family: '4857-06', drawings: ljDrawings },
    { tooling: 'INVERSION JAW', family: '4857-08', drawings: ijDrawings }
  ];

  for (const { tooling, family, drawings } of families) {
    console.log(`\n── ${tooling} (${family}) ──`);
    if (dryRun) {
      console.log(`  [dry-run] would load ${drawings.length} drawings onto shelf and seed cn-map`);
      continue;
    }

    // Load shelf
    const client = await engPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM ${INVENTORY} WHERE tooling_name = $1`, [tooling]);
      const values = drawings.flatMap(d => [tooling, d]);
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
      machine: MACHINE, tooling, inventory: INVENTORY, family, source: SOURCE
    });
    console.log(`  map:   removed ${stats.removed}, inserted ${stats.inserted}` +
                ` · specced ${stats.specced}/${stats.mapped}` +
                ` · off-shelf ${stats.offShelf} · ambiguous ${stats.ambiguous.length}`);
    if (stats.ambiguous.length) {
      console.log(`  ambiguous C/Ns (skipped): ${stats.ambiguous.join(' ')}`);
    }
  }

  console.log(`\nundo with:  node db_migrations/20260821k_x100_loader_and_inversion_jaw.js --revert`);
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => {
    console.error(e);
    await Promise.all([engPool.end(), maqPool.end()]).catch(() => {});
    process.exit(1);
  });
