'use strict';

/**
 * `sds_excel_mapping` — suppress the SHARED (machine_type_name IS NULL) mapping rows
 * for machines running the "Turning_PB" template (`sds_grid_template` id=9).
 * ------------------------------------------------------------------------------
 * Same bug class as `20260916b_suppress_shared_mapping_for_turning.js` (the older
 * "Turning" id=8 template), caused by the same mechanism: `sds_excel_mapping`
 * resolves per CELL ADDRESS, not per param_key, so a shared row and a
 * machine-specific row both fire whenever their addresses differ.
 *
 * Checked directly against the live `sds_grid_template` id=9 `grid_json` (not
 * assumed) before writing this list — three classes of damage, worst first:
 *
 *   - DESTRUCTIVE: shared `parts_no`/`cn`/`material` target M3/M4/M5, which on
 *     this template are the STATIC LABEL cells "PART NO:  "/"C/N :"/"MAT'L SIZE :"
 *     (bold, pre-styled, no `#ff0000` value-box styling) — writing there replaces
 *     the sheet's own caption with the raw value, the exact "LABELS themselves
 *     overwritten" failure the id=8 bug report described.
 *   - COLLISION with this migration's own machine-specific rows: shared `sds_rev`
 *     (AH4) vs this template's `program_name` (AH4); shared `tool_name_T02`/`_T04`
 *     (R16/AD16) vs this template's AP value for tool slots 5/9.
 *   - WRONG POSITION, not destructive but wrong: shared `description_1-5`/
 *     `remark_1-5` target J9-13/AH9-13, but this template's own revision-log table
 *     has "DESCRIPTION"/"REMARK" headers at M8/Y8 — the machine-specific seed
 *     migration re-maps them to M9-13/Y9-13; the shared J9-13/AH9-13 cells are
 *     genuinely blank on this template, so left unsuppressed they would not
 *     collide with anything but would print in the wrong place (a visible gap
 *     between the DATE and DESCRIPTION columns, and a floating value to the
 *     right of the REMARK column) — suppressed for a correct sheet regardless.
 *
 * Simplest safe rule, same one `20260916b_` used: suppress every shared address
 * EXCEPT the ones confirmed correct for this template. `rev_1-5`/`ecn_no_1-5`/
 * `date_1-5` (A9-13/B9-13/G9-13) are kept — the live grid's own "REV."/"ECN NO."/
 * "DATE" header row (row 8) uses those exact columns too.
 *
 * Fix: for each machine, add an override row at every SHARED address NOT in
 * KEEP_ADDRESSES, pointing at the inert param_key `_suppressed` — never set in
 * `valueMap`/`params`, so the scalar write loop's blank-value check skips it and
 * the cell keeps whatever the Turning_PB template itself designed there (usually
 * nothing). A machine-specific row at the same address as a shared one wins
 * (query orders `machine_type_name IS NULL` first, machine-specific applied last).
 *
 * Idempotent: deletes this machine's `_suppressed` rows first, then re-inserts
 * from the CURRENT shared list. `--revert` removes them (only do this when
 * reverting the whole Turning_PB rollout for a machine, not as a partial fix).
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20261104c_suppress_shared_mapping_for_turning_pb.js --machine="LB12" --dry-run
 *   node api/engineer/mtc/db_migrations/20261104c_suppress_shared_mapping_for_turning_pb.js --machine="LB12"
 *   node api/engineer/mtc/db_migrations/20261104c_suppress_shared_mapping_for_turning_pb.js --machine="LB12" --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_excel_mapping';
const SUPPRESS_KEY = '_suppressed';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const MACHINES = process.argv
  .filter((a) => a.startsWith('--machine='))
  .map((a) => a.slice('--machine='.length).replace(/^"|"$/g, ''))
  .filter(Boolean);

const KEEP_ADDRESSES = new Set([
  'A9', 'A10', 'A11', 'A12', 'A13',   // rev_1..5
  'B9', 'B10', 'B11', 'B12', 'B13',   // ecn_no_1..5
  'G9', 'G10', 'G11', 'G12', 'G13',   // date_1..5
]);

async function main() {
  if (!MACHINES.length) {
    console.error('[error] at least one --machine="<sds_machine_type_code.machine_type_name>" is required');
    process.exitCode = 1;
    return;
  }
  if (await guard({ file: __filename, revert, alwaysRerun: true })) return;

  const client = await engPool.connect();
  try {
    if (revert) {
      await client.query('BEGIN');
      const del = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type_name = ANY($1) AND param_key = $2`,
        [MACHINES, SUPPRESS_KEY]
      );
      await client.query('COMMIT');
      console.log(`[revert] removed ${del.rowCount} suppression row(s) for machines: ${MACHINES.join(', ')}`);
      await recordRevert({ file: __filename });
      return;
    }

    const shared = await client.query(
      `SELECT DISTINCT cell_address FROM ${TABLE} WHERE machine_type_name IS NULL`
    );
    const toSuppress = shared.rows.map((r) => r.cell_address).filter((a) => !KEEP_ADDRESSES.has(a));
    console.log(`[seed] ${toSuppress.length} shared address(es) to consider x ${MACHINES.length} machine(s)`);

    if (dryRun) {
      toSuppress.forEach((a) => console.log(`  suppress ${a}`));
      console.log('\n[seed] --dry-run — no changes written. machines:', MACHINES.join(', '));
      return;
    }

    await client.query('BEGIN');
    for (const machine of MACHINES) {
      const del = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type_name = $1 AND param_key = $2`,
        [machine, SUPPRESS_KEY]
      );
      // Skip any address this machine's OWN mapping already owns (would violate
      // the (machine_type_name, cell_address) unique constraint on insert).
      const owned = await client.query(
        `SELECT cell_address FROM ${TABLE} WHERE machine_type_name = $1 AND param_key != $2`,
        [machine, SUPPRESS_KEY]
      );
      const ownedSet = new Set(owned.rows.map((r) => r.cell_address));
      const addrsToInsert = toSuppress.filter((a) => !ownedSet.has(a));
      const skipped = toSuppress.length - addrsToInsert.length;

      if (addrsToInsert.length) {
        const COLS = 3;
        const placeholders = addrsToInsert.map((_, i) =>
          `($${i * COLS + 1},$${i * COLS + 2},$${i * COLS + 3})`
        ).join(',');
        const values = addrsToInsert.flatMap((a) => [machine, a, SUPPRESS_KEY]);
        await client.query(
          `INSERT INTO ${TABLE} (machine_type_name, cell_address, param_key) VALUES ${placeholders}`,
          values
        );
      }
      console.log(`  ${machine}: removed ${del.rowCount} old suppression row(s), inserted ${addrsToInsert.length} (skipped ${skipped} already owned by this machine's own mapping)`);
    }
    await client.query('COMMIT');
    console.log('[seed] done');
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[seed] FAILED:', e.message); process.exit(1); });
