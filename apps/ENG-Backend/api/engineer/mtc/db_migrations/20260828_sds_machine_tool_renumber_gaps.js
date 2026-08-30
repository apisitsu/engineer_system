'use strict';

/**
 * `sds_machine_tool` — close the tool_number gaps left by row deletes.
 * ------------------------------------------------------------------------------
 * `20260827c_` (and earlier trims) removed slots with a plain
 * `DELETE ... WHERE tool_drawing_no = $3` and never renumbered the survivors. So a
 * combo that had T1 T2 T3 and lost T2 is now stored as **T1 T3** — and the SDS grid,
 * whose template has fixed T01..T20 cells, renders a blank T2 and a visible T3.
 *
 * Reported from the floor: "the TSG-300 PDF shows T03 although only 2 tools are
 * configured" — TSG-300W @1021 is stored as T1 (`4556-01`) + T3 (`4556-08`), the hole
 * at T2 being the deleted `4556-05`.
 *
 * 14 (machine_type, process_code) combos are affected (found dynamically, not hard-
 * coded): every combo where MAX(numeric tool_number) <> COUNT(*). Each is renumbered
 * to a gapless T1..TN, keeping the current order. Nothing else keys on the literal
 * slot number — checked: no `sds_parameter` / `sds_excel_mapping` row references a
 * `T0x` param_key for any affected machine — so this is a pure display fix.
 *
 * The renumber is ONE `UPDATE ... FROM (row_number() OVER ...)` statement: Postgres
 * applies it atomically, so the UNIQUE (tool_number, process_code, machine_type)
 * never sees a transient collision. The `WHERE tool_number <> new` guard makes a
 * re-run a no-op → idempotent.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260828_sds_machine_tool_renumber_gaps.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260828_sds_machine_tool_renumber_gaps.js
 *   node api/engineer/mtc/db_migrations/20260828_sds_machine_tool_renumber_gaps.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const BACKUP = 'sds_machine_tool_backup_20260828';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const numOf = `CAST(NULLIF(regexp_replace(tool_number, '[^0-9]', '', 'g'), '') AS int)`;

async function affectedCombos(client) {
  const { rows } = await client.query(
    `SELECT machine_type, process_code,
            array_agg(tool_number ORDER BY ${numOf})        AS have,
            array_agg(tool_drawing_no ORDER BY ${numOf})    AS dwgs
       FROM ${TABLE}
      GROUP BY machine_type, process_code
     HAVING MAX(${numOf}) <> COUNT(*)`);
  return rows;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    if (revert) {
      const { rows: hasBackup } = await client.query(`SELECT to_regclass($1) AS t`, [BACKUP]);
      if (!hasBackup[0].t) {
        console.log(`[revert] no ${BACKUP} — nothing to restore`);
        await recordRevert({ file: __filename });
        return;
      }
      await client.query('BEGIN');
      // restore tool_number for every backed-up (id) — only the number changed
      await client.query(
        `UPDATE ${TABLE} t SET tool_number = b.tool_number
           FROM ${BACKUP} b WHERE b.id = t.id AND b.tool_number <> t.tool_number`);
      await client.query(`DROP TABLE ${BACKUP}`);
      await client.query('COMMIT');
      console.log('[revert] tool_number restored from backup; backup dropped');
      await recordRevert({ file: __filename });
      return;
    }

    const combos = await affectedCombos(client);
    if (!combos.length) {
      console.log('[renumber] no gaps — nothing to do');
      await recordRun({ file: __filename });
      return;
    }

    console.log(`[renumber] ${combos.length} (machine, process) combos with a tool_number gap:\n`);
    for (const c of combos) {
      const after = c.have.map((_, i) => `T${i + 1}`);
      const map = c.have.map((tn, i) => tn === after[i] ? tn : `${tn}->${after[i]}`).join('  ');
      console.log(`  ${(`${c.machine_type} @${c.process_code}`).padEnd(28)} ${map}`);
      console.log(`  ${''.padEnd(28)} ${c.dwgs.map((d, i) => `${after[i]}:${d}`).join('  ')}\n`);
    }

    if (dryRun) { console.log('[renumber] --dry-run — no changes written'); return; }

    await client.query('BEGIN');
    await client.query(`DROP TABLE IF EXISTS ${BACKUP}`);
    await client.query(
      `CREATE TABLE ${BACKUP} AS
         SELECT t.*, now() AS _backed_up_at
           FROM ${TABLE} t
           JOIN (SELECT machine_type, process_code FROM ${TABLE}
                  GROUP BY 1, 2 HAVING MAX(${numOf}) <> COUNT(*)) g
             ON g.machine_type = t.machine_type AND g.process_code = t.process_code`);

    const { rowCount } = await client.query(
      `UPDATE ${TABLE} t
          SET tool_number = 'T' || r.rn
         FROM (
           SELECT id,
                  row_number() OVER (PARTITION BY machine_type, process_code ORDER BY ${numOf}) AS rn
             FROM ${TABLE}
            WHERE (machine_type, process_code) IN (
              SELECT machine_type, process_code FROM ${TABLE}
               GROUP BY 1, 2 HAVING MAX(${numOf}) <> COUNT(*))
         ) r
        WHERE t.id = r.id AND t.tool_number <> 'T' || r.rn`);

    const left = await affectedCombos(client);
    if (left.length) {
      await client.query('ROLLBACK');
      throw new Error(`still ${left.length} combos with a gap after renumber — rolled back`);
    }
    await client.query('COMMIT');
    console.log(`[renumber] ${rowCount} rows renumbered · backup → ${BACKUP}`);
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[renumber] FAILED:', e.message); process.exit(1); });
