/**
 * X-100 @2031 / @2071 — add 9901-09 CONCENTRICITY MEASURING PIN as T1.
 *
 * TEMPLATE_B lists 9901-09 as the FIRST tool of every X-100 block (sheets
 * JWAVE, SPH(DT), SPH(D->T), SPH(D->DT), SPH-medium), ahead of 4857-01 ARBOR.
 * The config never carried it: the code<->family rule resolves 9901 -> registry
 * code 901 -> the standalone inspection-jig machine `測定用治具全般`, so every
 * 99xx family in TEMPLATE_B was filed there instead of in the machine block the
 * document puts it in.
 *
 * That is not merely a missing row. `sds_machine_tool` is a whitelist that
 * FILTERS the part's own process plan, so X-100's incomplete list was actively
 * HIDING a tool the plan placed:
 *
 *   603 C/N plan both a 9901-09 and X-100 tooling at 2071  -> pin dropped
 *   320 C/N ditto at 2031                                  -> pin dropped
 *
 * Verified on A41-00082 / A41-00222 / A41-00224: plan carries 9901-09-000x,
 * rendered sheet showed only the 4857 rows. Same failure class as the
 * KN-312A/4837 whitelist (see 20260826d).
 *
 * `測定用治具全般`'s own 9901-09 rows are LEFT IN PLACE — that sheet is a real
 * standalone inspection-jig sheet, not a mis-file to clean up.
 *
 * TUGAMI @2071 (9901-09) and RA-10 @1081/@1241 (9901-21) have the same shape in
 * TEMPLATE_B but neither name exists in `sds_machine_type_code`, so neither has
 * a whitelist and neither is hiding anything. They stay in the "blocked on the
 * naming registry" bucket until a registry code is assigned.
 *
 * Slot order follows TEMPLATE_B: 4857-01..-08 shift from T1..T6 down to T2..T7.
 * The UNIQUE (tool_number, process_code, machine_type) index means the shift
 * must run highest-first.
 *
 * Run:     node api/engineer/mtc/db_migrations/20260827d_x100_concentricity_measuring_pin.js
 * Revert:  ... --revert
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });
const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const MACHINE = 'X-100';
const PIN = '9901-09';
const PROCS = ['2031', '2071'];
const SHIFTED = ['4857-01', '4857-02', '4857-03', '4857-04', '4857-06', '4857-08'];

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const { rows: mt } = await client.query(
      `SELECT id FROM sds_machine_type_code WHERE machine_type_name = $1`, [MACHINE]);
    if (!mt.length) throw new Error(`${MACHINE} not found in sds_machine_type_code`);
    const machineTypeId = mt[0].id;

    for (const pc of PROCS) {
      const { rows: before } = await client.query(
        `SELECT tool_number, tool_drawing_no FROM sds_machine_tool
          WHERE machine_type = $1 AND process_code = $2
          ORDER BY LPAD(SUBSTRING(tool_number FROM 2), 3, '0')`, [MACHINE, pc]);
      console.log(`\n${MACHINE} @${pc} before: ${before.map((r) => `${r.tool_number}=${r.tool_drawing_no}`).join('  ') || '(empty)'}`);

      if (revert) {
        // drop the pin, then pull the 4857 rows back up (lowest-first this time)
        const del = await client.query(
          `DELETE FROM sds_machine_tool
            WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
          [MACHINE, pc, PIN]);
        console.log(`  removed ${PIN}: ${del.rowCount} row(s)`);
        for (let i = 0; i < SHIFTED.length; i += 1) {
          await client.query(
            `UPDATE sds_machine_tool SET tool_number = $4
              WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3
                AND tool_number = $5`,
            [MACHINE, pc, SHIFTED[i], `T${i + 1}`, `T${i + 2}`]);
        }
      } else {
        const { rows: exists } = await client.query(
          `SELECT 1 FROM sds_machine_tool
            WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
          [MACHINE, pc, PIN]);
        if (exists.length) { console.log(`  ${PIN} already present — skipped`); continue; }

        // highest-first so each UPDATE lands on a free tool_number
        for (let i = SHIFTED.length - 1; i >= 0; i -= 1) {
          await client.query(
            `UPDATE sds_machine_tool SET tool_number = $4
              WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3
                AND tool_number = $5`,
            [MACHINE, pc, SHIFTED[i], `T${i + 2}`, `T${i + 1}`]);
        }
        await client.query(
          `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
           VALUES ('T1', $1, $2, $3, $4)
           ON CONFLICT (tool_number, process_code, machine_type) DO NOTHING`,
          [pc, MACHINE, PIN, machineTypeId]);
      }

      const { rows: after } = await client.query(
        `SELECT tool_number, tool_drawing_no FROM sds_machine_tool
          WHERE machine_type = $1 AND process_code = $2
          ORDER BY LPAD(SUBSTRING(tool_number FROM 2), 3, '0')`, [MACHINE, pc]);
      console.log(`${MACHINE} @${pc} after : ${after.map((r) => `${r.tool_number}=${r.tool_drawing_no}`).join('  ')}`);
    }

    if (dryRun) { await client.query('ROLLBACK'); console.log('\n--dry-run: rolled back'); return; }
    await client.query('COMMIT');
    console.log(`\n${revert ? 'Reverted' : 'Applied'}.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  if (revert) await recordRevert({ file: __filename });
  else await recordRun({ file: __filename });
}

main()
  .then(() => engPool.end())
  .catch((e) => { console.error(e); engPool.end(); process.exit(1); });
