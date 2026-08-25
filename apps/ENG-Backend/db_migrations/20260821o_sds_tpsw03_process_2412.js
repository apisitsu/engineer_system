'use strict';

/**
 * SDS Machine Tool Config — create the missing process 2412 for TP-SW-03他.
 * ------------------------------------------------------------------------------
 * `sds_machine_tool` had TP-SW-03他 configured for process 2411 only. Process 2412
 * returned zero rows, and because this machine_type has no `machine_group`, the
 * group-wide fallback in sdsV2HeadlessController finds nothing either — so an SDS
 * sheet for a 2412 job printed NO fixture slots at all, and every 2412 C/N counted
 * as PENDING in the coverage report.
 *
 * THE PAIRED-PROCESS CONVENTION SAYS THIS IS AN OMISSION, NOT A DESIGN
 *
 * Every other machine in the table that owns an OP1 process also owns its OP2
 * sibling, configured with the identical list:
 *
 *     KS-400B1 / B2 / B7   1041 + 1042
 *     GS-64PFII / MSG-410 / PSG-64   1101 + 1102
 *     OC-16A               1011 + 1012
 *     KS-H70               1081 + 1082, 1241 + 1242
 *     KVD-300CRII          1021 + 1022
 *     X-100 / XD-8 / J-WAVE / FTL-10(I) / 測定用治具全般   2031 + 2071
 *
 * TP-SW-03他 with 2411 and no 2412 was the only unpaired case.
 *
 * THE PLAN CONFIRMS ALL THREE FAMILIES RUN AT 2412
 *
 *     family     tooling        @2411    @2412
 *     4606-08    SET STICK       1371      569
 *     4606-03    WORK GUIDE      1423      580
 *     4606-10    PIN              312      135
 *
 * So the 2412 list is the 2411 list, in the same slot order — which is also what
 * every paired machine above does. Slot order is copied from the live 2411 rows
 * rather than hardcoded, so if 2411 is ever re-ordered this migration cannot
 * silently disagree with it.
 *
 * `4606-03` and `4606-10` reached 2411 via 20260821n_; this migration is what
 * carries them (and SET STICK, which was never at 2412 either) to the OP2 side.
 *
 * Idempotent; `--revert` deletes the 2412 rows for this machine only.
 */

const { engPool } = require('../instance/eng_db');

const TABLE = 'sds_machine_tool';
const MACHINE = 'TP-SW-03他';
const SRC_PROCESS = '2411';
const NEW_PROCESS = '2412';

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      const r = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2`,
        [MACHINE, NEW_PROCESS]);
      await client.query('COMMIT');
      console.log(`reverted: ${r.rowCount} row(s) removed from ${MACHINE} @${NEW_PROCESS}`);
      return;
    }

    const { rows: src } = await client.query(
      `SELECT tool_number, tool_drawing_no, machine_type_id
         FROM ${TABLE}
        WHERE machine_type = $1 AND process_code = $2
        ORDER BY LPAD(SUBSTRING(tool_number FROM 2), 5, '0')`,
      [MACHINE, SRC_PROCESS]);

    if (!src.length) {
      throw new Error(`${MACHINE} @${SRC_PROCESS} has no rows — nothing to mirror`);
    }

    const { rows: already } = await client.query(
      `SELECT tool_number, tool_drawing_no FROM ${TABLE}
        WHERE machine_type = $1 AND process_code = $2`,
      [MACHINE, NEW_PROCESS]);
    const have = new Set(already.map((r) => r.tool_drawing_no));

    console.log(`ต้นแบบ ${MACHINE} @${SRC_PROCESS}: ` +
                src.map((r) => `${r.tool_number}=${r.tool_drawing_no}`).join(' '));
    if (already.length) console.log(`มีอยู่แล้วที่ @${NEW_PROCESS}: ${already.length} ช่อง`);

    let inserted = 0;
    let skipped = 0;
    for (const r of src) {
      if (have.has(r.tool_drawing_no)) {
        console.log(`   = ${r.tool_number} ${r.tool_drawing_no} — มีอยู่แล้ว ข้าม`);
        skipped += 1;
        continue;
      }
      console.log(`   + ${r.tool_number} = ${r.tool_drawing_no}`);
      if (!dryRun) {
        await client.query(
          `INSERT INTO ${TABLE} (machine_type, process_code, tool_number, tool_drawing_no, machine_type_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tool_number, process_code, machine_type) DO NOTHING`,
          [MACHINE, NEW_PROCESS, r.tool_number, r.tool_drawing_no, r.machine_type_id]);
      }
      inserted += 1;
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log(`\ndry run — would insert ${inserted}, skip ${skipped}`);
      return;
    }

    await client.query('COMMIT');
    console.log(`\ninserted ${inserted} · skipped ${skipped}`);
    console.log(`undo with:  node db_migrations/20260821o_sds_tpsw03_process_2412.js --revert`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
