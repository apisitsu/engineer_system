'use strict';

/**
 * X-100 — put LOADER JAW `4857-06` and INVERSION JAW `4857-08` back on the sheet.
 * ------------------------------------------------------------------------------
 * NOT RUN AUTOMATICALLY. These two slots were added by `20260821k_`/`20260821n_` and removed
 * by hand afterwards, deliberately. This migration exists so restoring them is one command
 * once the floor confirms — it is not a gap that was closed on anyone's behalf.
 *
 * -- WHAT THE SHEET LOSES TODAY -------------------------------------------------
 * X-100 @2031 carries a whitelist (T1..T4 = 4857-01..04), and `buildValueMap` filters the
 * part's own process plan through it. The two families have no slot, so they are dropped from
 * every sheet — **414 of 531 C/Ns (78 %)** lose a tool the plan names for them. At 2071 it is
 * 116 and 102 C/Ns. Verified on real parts:
 *
 *     A41-00056  plan  4857-01-0070 · -02-0031 · -03-0073 · -04-0056 · -06-0009 · -08-0015
 *                sheet T01 -01-0070 · T02 -02-0031 · T03 -03-0073 · T04 -04-0056
 *                lost  4857-06-0009 · 4857-08-0015
 *
 * These are FACTORY PLAN tools, so they would print without the ` *` marker — as the part's
 * own data, not a Tooling Select suggestion.
 *
 * -- THE SYSTEM ALREADY DISAGREES WITH ITSELF -----------------------------------
 * Nothing else was removed with the slots. `tooling_x100` still stocks both (3 and 16 rows)
 * and `tooling_partno_map` still pins them per C/N (522 and 498 rows, seeded by `20260821k_`),
 * so `_applyLookupOnlyToolings` returns them and **the Tooling Select page shows them**:
 *
 *     Tooling Select, A41-00056 → LOADER JAW 4857-06-0009 [pinned by cn]
 *                                 INVERSION JAW 4857-08-0015 [pinned by cn]
 *     SDS sheet,      A41-00056 → neither appears
 *
 * One system, one part, two answers. That is the part worth fixing whichever way the decision
 * goes — see below.
 *
 * -- IF THE ANSWER IS "THEY DO NOT BELONG ON THE SHEET" --------------------------
 * Then this migration is the wrong fix and the shelf and the C/N map should go instead
 * (`20260821k_ --revert` removes both), so Tooling Select stops offering them too. Leaving
 * the current state — selectable on one screen, invisible on the other — is the only option
 * that is wrong either way.
 *
 * -- CONTEXT -------------------------------------------------------------------
 * TEMPLATE_B lists both for X-100 (white, i.e. selected). XD-8, which runs the same operation,
 * keeps its equivalents configured (`4858-08` LOADER JAW, `4858-12` INVERSION JAW at 2071 and
 * 2021) — X-100 is the only one of the pair without them.
 *
 * Appended at the end (T5, T6) per the 2026-08-25 decision, so no printed sheet renumbers.
 * Idempotent; `--revert` removes them again.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const MACHINE = 'X-100';
const MACHINE_TYPE_ID = 361;
const FAMILIES = ['4857-06', '4857-08'];   // LOADER JAW, INVERSION JAW
const PROCESSES = ['2071', '2031'];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function show(label) {
  const { rows } = await engPool.query(
    `SELECT process_code, tool_number, tool_drawing_no FROM ${TABLE}
      WHERE machine_type = $1 ORDER BY process_code,
            LPAD(SUBSTRING(tool_number FROM 2), 3, '0')`, [MACHINE]);
  console.log(`\n${label}`);
  for (const p of PROCESSES) {
    const s = rows.filter(r => r.process_code === p);
    console.log(`   @${p}  ${s.map(r => `${r.tool_number}:${r.tool_drawing_no}`).join('  ') || '(none)'}`);
  }
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  await show(revert ? '-- before revert --' : '-- before --');
  if (dryRun) {
    console.log(`\n--dry-run: would append ${FAMILIES.join(', ')} to @${PROCESSES.join(' and @')}`);
    return;
  }

  const client = await engPool.connect();
  let added = 0, removed = 0;
  try {
    await client.query('BEGIN');
    for (const process_code of PROCESSES) {
      if (revert) {
        for (const dwg of FAMILIES) {
          const r = await client.query(
            `DELETE FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
            [MACHINE, process_code, dwg]);
          removed += r.rowCount;
        }
        continue;
      }
      const { rows: mx } = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(tool_number FROM 2) AS int)), 0) AS mx
           FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2`,
        [MACHINE, process_code]);
      let next = mx[0].mx + 1;
      for (const dwg of FAMILIES) {
        const { rows: dup } = await client.query(
          `SELECT 1 FROM ${TABLE}
            WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
          [MACHINE, process_code, dwg]);
        if (dup.length) continue;
        await client.query(
          `INSERT INTO ${TABLE} (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [`T${next}`, process_code, MACHINE, dwg, MACHINE_TYPE_ID]);
        next++; added++;
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  await show(revert ? '-- after revert --' : '-- after --');
  if (revert) {
    console.log(`\nreverted: ${removed} slots removed`);
    await recordRevert({ file: __filename });
    return;
  }
  console.log(`\nrestored ${added} slots`);
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260827b_x100_restore_loader_inversion_jaw.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
