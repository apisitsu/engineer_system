'use strict';

/**
 * X-100 @2031 / @2071 - put LOADER JAW 4857-06 and INVERSION JAW 4857-08 back on the SDS whitelist.
 * ------------------------------------------------------------------------------
 * Their slots were removed by hand after `20260827b_` restored them, but nothing else was:
 * `tooling_x100` still stocks both families (19 rows) and `tooling_partno_map` still pins them
 * per C/N (522 and 498 rows), so Tooling Select keeps returning them. The SDS sheet filters the
 * part's own process plan through the whitelist, so the plan's real tools were dropped from the
 * sheet while T-Select showed them - two screens, two answers.
 *
 * The plan carries them: 4857-06 on 406 C/N at 2031 and 116 at 2071, 4857-08 on 398 and 102.
 *
 * Slots follow the order `20260827d_` left (9901-09 T1, 4857-01..04 T2..T5, then -06, -08):
 *   4857-06 -> T6     4857-08 -> T7
 * Adding families to a whitelist only lets planned tools through - it removes nothing.
 *
 * Idempotent (a slot already carrying the family is skipped); `--revert` removes exactly these
 * rows. Clears the SDS coverage cache, which is derived from this config.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const MACHINE = 'X-100';
const PROCESSES = ['2031', '2071'];
const SLOTS = [['T6', '4857-06'], ['T7', '4857-08']];
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function show(c, label) {
  const { rows } = await c.query(
    `SELECT process_code, tool_number, tool_drawing_no FROM ${TABLE}
      WHERE machine_type = $1 AND process_code = ANY($2)
      ORDER BY process_code, LPAD(SUBSTRING(tool_number FROM 2), 3, '0')`, [MACHINE, PROCESSES]);
  console.log(`\n${label}`);
  for (const p of PROCESSES) console.log(`   ${p}: ${rows.filter(r => r.process_code === p).map(r => `${r.tool_number}=${r.tool_drawing_no}`).join('  ')}`);
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const c = await engPool.connect();
  try {
    const id = (await c.query(`SELECT machine_type_id FROM ${TABLE} WHERE machine_type = $1 AND machine_type_id IS NOT NULL LIMIT 1`, [MACHINE])).rows[0]?.machine_type_id ?? null;
    await show(c, revert ? '-- before revert --' : '-- before --');
    if (dryRun) { console.log(`\n(machine_type_id=${id})\n--dry-run: nothing written`); return; }

    await c.query('BEGIN');
    let n = 0;
    for (const p of PROCESSES) {
      for (const [tool, fam] of SLOTS) {
        if (revert) {
          const r = await c.query(`DELETE FROM ${TABLE} WHERE machine_type=$1 AND process_code=$2 AND tool_number=$3 AND tool_drawing_no=$4`, [MACHINE, p, tool, fam]);
          n += r.rowCount;
          continue;
        }
        const has = await c.query(`SELECT 1 FROM ${TABLE} WHERE machine_type=$1 AND process_code=$2 AND (tool_drawing_no=$3 OR tool_number=$4)`, [MACHINE, p, fam, tool]);
        if (has.rows.length) { console.log(`   skip ${p} ${tool}=${fam} (slot or family already present)`); continue; }
        await c.query(`INSERT INTO ${TABLE} (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id) VALUES ($1,$2,$3,$4,$5)`, [tool, p, MACHINE, fam, id]);
        n++;
      }
    }
    await c.query('COMMIT');
    console.log(`\n${revert ? 'removed' : 'inserted'} ${n} rows`);
    try { await engPool.query(`DELETE FROM sds_coverage_cache WHERE id = 'coverage'`); console.log('sds coverage cache cleared'); } catch (e) { console.warn('coverage cache not cleared:', e.message); }
    await show(c, revert ? '-- after revert --' : '-- after --');
    if (revert) { await recordRevert({ file: __filename }); return; }
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260921f_x100_restore_loader_inversion_jaw_slots.js --revert');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

main()
  .then(() => engPool.end())
  .catch(async (e) => { console.error(e); await engPool.end().catch(() => {}); process.exit(1); });
