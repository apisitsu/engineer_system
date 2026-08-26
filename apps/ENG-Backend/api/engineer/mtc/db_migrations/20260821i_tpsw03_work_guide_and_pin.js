'use strict';

/**
 * TP-SW-03他 — WORK GUIDE 4606-03 and PIN 4606-10.
 * ------------------------------------------------------------------------------
 * TEMPLATE_B process 2411 (RELEASE) specifies three families:
 *   - SET STICK   4606-08 (1,371 CNs - existing in system)
 *   - WORK GUIDE  4606-03 (1,423 CNs - missing)
 *   - PIN         4606-10 (  312 CNs - missing)
 *
 * This migration:
 * 1. Loads WORK GUIDE shelf (4606-03-0001-99, 4606-03-0002-99, plus components) into tooling_tpsw03.
 * 2. Loads PIN shelf (4606-10-0003...0031) into tooling_tpsw03.
 * 3. Seeds tooling_partno_map for WORK GUIDE and PIN from lpb.eng_r_pi_tool.
 *
 * Idempotent; `--revert` cleans up both shelf and map rows.
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');

const MACHINE = 'TP-SW-03他';
const INVENTORY = 'tooling_tpsw03';
const SOURCE = 'TEMPLATE_B JWAVE/SPH proc 2411 · lpb.eng_r_pi_tool · 20260821i_';

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (revert) {
    console.log(`\n── Reverting ${MACHINE} WORK GUIDE & PIN ──`);
    for (const tooling of ['WORK GUIDE', 'PIN']) {
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

  // 1. Fetch shelf drawings from plan
  const wgDrawings = (await maqPool.query(
    "SELECT DISTINCT tool_dwg_no FROM lpb.eng_r_pi_tool WHERE process_code = '2411' AND tool_dwg_no LIKE '4606-03%' ORDER BY tool_dwg_no"
  )).rows.map(r => r.tool_dwg_no);

  const pinDrawings = (await maqPool.query(
    "SELECT DISTINCT tool_dwg_no FROM lpb.eng_r_pi_tool WHERE process_code = '2411' AND tool_dwg_no LIKE '4606-10%' ORDER BY tool_dwg_no"
  )).rows.map(r => r.tool_dwg_no);

  const families = [
    { tooling: 'WORK GUIDE', family: '4606-03', drawings: wgDrawings },
    { tooling: 'PIN', family: '4606-10', drawings: pinDrawings }
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

  console.log(`\nundo with:  node api/engineer/mtc/db_migrations/20260821i_tpsw03_work_guide_and_pin.js --revert`);
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => {
    console.error(e);
    await Promise.all([engPool.end(), maqPool.end()]).catch(() => {});
    process.exit(1);
  });
