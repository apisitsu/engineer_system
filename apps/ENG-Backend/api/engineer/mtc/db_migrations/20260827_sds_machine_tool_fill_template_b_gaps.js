'use strict';

/**
 * `sds_machine_tool` — fill the (machine, process) pairs TEMPLATE_B specifies and the
 * config lacked: 38 combos, 106 slots, 16 machines.
 * ------------------------------------------------------------------------------
 * The conformance sweep (see api/engineer/mtc/doc/tooling_select_audit_findings.md, รอบที่ห้า) left 60 of
 * TEMPLATE_B's 108 (machine, process) pairs short. This closes the ones that can be closed
 * with evidence, and each of the four exclusion rules below removed rows a naive
 * "copy the workbook" pass would have written.
 *
 * -- RULE 1: A WHITELIST HIDES A PLANNED TOOL THAT IS NOT ON IT ------------------
 * `buildValueMap` filters the part's own process plan through `configSlotOf`, so creating a
 * combo's FIRST whitelist row can REMOVE tools that render today. The slot list is therefore
 * TEMPLATE_B's families UNION **every** family of that machine the plan actually uses at that
 * process — including the `4800-10`, `4866-10`, `9901-14`-style families the workbook never
 * lists. Measured per combo before and after: with the workbook's list alone, 12 combos would
 * have lost a planned tool on up to 100% of their C/Ns (TSG-300ZNC @1031 was 2 of 2); with the
 * union it is **zero**.
 *
 * -- RULE 2: A FAMILY THE PLAN NEVER USES AT THAT PROCESS IS NOT CONFIGURED ------
 * A (machine, process, family) with no plan row is exactly the shape `20260826d_` deleted from
 * KN-312A @1161: it puts the machine in the PDF picker for parts that can only ever render a
 * blank sheet, and — worse — its whitelist then hides the tools those parts really carry.
 * 22 families were dropped for this, all at 0 C/N:
 *
 *   TM330 @0311                4009-05
 *   LNC45/C200 @1061           4651-20
 *   GI-20N @1061               4652-13
 *   LNC45/C200 @0111           4651-13
 *   OC-16A @3491               4560-18, 4560-21, 4560-11, 4560-04
 *   KS-B80 @0351               4021-01, 4021-02
 *   OC-16A @0401               4560-04
 *   KS-400B5 @1041             4906-15
 *   DTS-IS @1081               4691-20, 4691-01, 4691-03, 4691-10, 4691-19, 4691-18, 4691-02
 *   測定用治具全般 @1081              9901-21
 *   HAMAI 5B @1022             4564-03
 *   US-70・150 @3002            4843-20
 *
 * -- RULE 3: NOTHING REMOVED BY HAND IS RESTORED --------------------------------
 * X-100 `4857-06` LOADER JAW and `4857-08` INVERSION JAW are missing against TEMPLATE_B and are
 * left missing: `20260821k_`/`20260821n_` added them and they were deleted afterwards.
 *
 * > **That deletion has a live cost, and it is not this migration's to pay.** X-100 @2031
 * > already carries a whitelist (4857-01..04), so those two families are filtered out of every
 * > sheet: **414 of 531 C/Ns (78%) lose a tool the factory plan assigns them.** X-100 is
 * > excluded here entirely rather than half-patched — the only family left to add at 2031 is
 * > `4857-05` (1 C/N), which would not touch the 78%. Restoring -06/-08 is a decision for the
 * > floor, not a gap to close.
 *
 * -- RULE 4: CONFIG THAT CAN NEVER RENDER IS NOT WRITTEN ------------------------
 * Every combo was rendered before shipping. `APL-001 @2211` and `AXPL-01 @2211` were dropped
 * on the result: process 2211 is **entirely class F00/F01** (assembled rod-ends) and
 * `getSearchData` has no part-type mapping for those prefixes, so every C/N there fails with
 * `Unknown CN prefix`. 316 C/N in the plan, 0 sheets openable. 37 of the 39 remaining combos
 * were confirmed to render a real Tool No.
 *
 * -- STILL BLOCKED --------------------------------------------------------------
 * 9 pairs cannot be configured at all: their `sds_machine_type_code` row has no machine name
 * (codes 571 SWAGE, 577 INSERT JIG, 656 CHUCK JAW are `no data`). That is 13,686 C/N — the
 * largest gap in the workbook — and it needs a NAME before a single row can be written.
 *
 * -- SLOT ORDER ------------------------------------------------------------------
 * Ascending by family sub-number, the house convention every existing list follows. The two
 * combos that already had rows (GI-20N @1061, MD-V9910WA @3491) get theirs APPENDED at the
 * end, per the 2026-08-25 decision, so no printed sheet renumbers.
 *
 * Idempotent — a (machine, process, drawing) already present is skipped, and the slot number
 * is computed from the live MAX so a re-run is a no-op. `--revert` removes only what it added.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// m = machine_type, p = process_code, id = machine_type_id, at = first slot number,
// f = drawing families in slot order. The comment under each row is the process name and
// how many C/Ns the factory plan gives each family at that process.
const SLOTS = [
  { m: 'GI-20N', p: '1061', id: 191, at: 7, f: ['4652-03'] },
  //   ID SPH GRIND ID GRIND | 4652-03 1
  { m: 'HAMAI 5B', p: '1031', id: 103, at: 1, f: ['4564-03', '4564-05'] },
  //   FACE GRIND FACE LAP | 4564-03 17  4564-05 6
  { m: 'IG-15N', p: '1161', id: 210, at: 1, f: ['4671-03', '4671-04', '4671-05'] },
  //   GROOVE GRIND | 4671-03 4  4671-04 3  4671-05 4
  { m: 'KN-113A', p: '1161', id: 321, at: 1, f: ['4853-01', '4853-03', '4853-05', '4853-06', '4853-07', '4853-10', '4853-11'] },
  //   GROOVE GRIND | 4853-01 9  4853-03 9  4853-05 5  4853-06 9  4853-07 9  4853-10 8  4853-11 9
  { m: 'KS-400B1', p: '1011', id: 203, at: 1, f: ['4664-34'] },
  //   OD GRIND (FINISH OD) | 4664-34 1
  { m: 'KS-400B1', p: '1161', id: 203, at: 1, f: ['4664-34'] },
  //   GROOVE GRIND | 4664-34 23
  { m: 'KS-B22G', p: '0351', id: 27, at: 1, f: ['4027-01', '4027-02'] },
  //   FINISH ID CHAMFER | 4027-01 1  4027-02 1
  { m: 'LB15', p: '0091', id: 188, at: 1, f: ['4649-03'] },
  //   BLANK HEAD※Male screw おねじ | 4649-03 193
  { m: 'LNC45/C200', p: '0041', id: 190, at: 1, f: ['4651-10', '4651-12', '4651-13', '4651-20'] },
  //   FINISH ID CHAMFER | 4651-10 8  4651-12 734  4651-13 844  4651-20 646
  { m: 'LNC45/C200', p: '0101', id: 190, at: 1, f: ['4651-12', '4651-13', '4651-20'] },
  //   ROUGH FINISH ID | 4651-12 158  4651-13 181  4651-20 145
  { m: 'LNC45/C200', p: '0191', id: 190, at: 1, f: ['4651-10', '4651-12', '4651-13', '4651-20'] },
  //   FINISH ID CHAMFER ID SPH TURN | 4651-10 30  4651-12 196  4651-13 208  4651-20 167
  { m: 'LNC45/C200', p: '0341', id: 190, at: 1, f: ['4651-10', '4651-12', '4651-13', '4651-20', '4651-26'] },
  //   ROUGH BORE | 4651-10 1  4651-12 8  4651-13 11  4651-20 10  4651-26 2
  { m: 'LNC45/C200', p: '0611', id: 190, at: 1, f: ['4651-10', '4651-12', '4651-13', '4651-20'] },
  //   NC CONTOUR | 4651-10 16  4651-12 22  4651-13 28  4651-20 2
  { m: 'LNC45/C200', p: '1061', id: 190, at: 1, f: ['4651-10', '4651-12', '4651-13'] },
  //   ID SPH GRIND ID GRIND | 4651-10 4  4651-12 8  4651-13 7
  { m: 'MA-3CN', p: '1111', id: 320, at: 1, f: ['4815-02', '4815-05', '4815-06', '4815-10'] },
  //   SHANK GRIND | 4815-02 8  4815-05 8  4815-06 6  4815-10 6
  { m: 'MD-V9910WA', p: '3491', id: 421, at: 3, f: ['4918-03', '4918-10'] },
  //   OD GRIND | 4918-03 211  4918-10 2
  { m: 'NK20', p: '0111', id: 206, at: 1, f: ['4667-10'] },
  //   SHANK TURNING | 4667-10 11
  { m: 'OC-16A', p: '0401', id: 99, at: 1, f: ['4560-10', '4560-11', '4560-18', '4560-21'] },
  //   OD GRIND FINISH OD | 4560-10 5  4560-11 2  4560-18 15  4560-21 15
  { m: 'TSG-300W', p: '1021', id: 95, at: 1, f: ['4556-01', '4556-05', '4556-08', '4556-10', '4556-11'] },
  //   FACE GRIND | 4556-01 947  4556-05 1  4556-08 5  4556-10 1  4556-11 1
  { m: 'TSG-300W', p: '1022', id: 95, at: 1, f: ['4556-01'] },
  //   FACE GRIND(2) | 4556-01 18
  { m: 'TSG-300W', p: '1031', id: 95, at: 1, f: ['4556-01'] },
  //   FACE GRIND FACE LAP | 4556-01 7
  { m: 'TSG-300ZNC', p: '1022', id: 370, at: 1, f: ['4866-10', '4866-14'] },
  //   FACE GRIND(2) | 4866-10 17  4866-14 18
  { m: 'TSG-300ZNC', p: '1031', id: 370, at: 1, f: ['4866-10', '4866-14'] },
  //   FACE GRIND FACE LAP | 4866-10 2  4866-14 2
  { m: 'その他', p: '1011', id: 305, at: 1, f: ['4800-42', '4800-68'] },
  //   OD GRIND (FINISH OD) | 4800-42 1  4800-68 1
  { m: 'その他', p: '1041', id: 305, at: 1, f: ['4800-10', '4800-42', '4800-49', '4800-68'] },
  //   SPHERICAL GRIND | 4800-10 3  4800-42 47  4800-49 1  4800-68 2
  { m: 'その他', p: '1061', id: 305, at: 1, f: ['4800-10', '4800-42'] },
  //   ID SPH GRIND ID GRIND | 4800-10 1  4800-42 17
  { m: 'その他', p: '1121', id: 305, at: 1, f: ['4800-40', '4800-42', '4800-68'] },
  //   ID SPH GRIND ID GRIND | 4800-40 1  4800-42 88  4800-68 2
  { m: 'その他', p: '1161', id: 305, at: 1, f: ['4800-42', '4800-68'] },
  //   GROOVE GRIND | 4800-42 83  4800-68 1
  { m: 'その他', p: '1181', id: 305, at: 1, f: ['4800-42'] },
  //   NC GRIND | 4800-42 64
  { m: 'その他', p: '1841', id: 305, at: 1, f: ['4800-57', '4800-61'] },
  //   THREAD ROLL | 4800-57 536  4800-61 5
  { m: 'その他', p: '2501', id: 305, at: 1, f: ['4800-38', '4800-43', '4800-68'] },
  //   SANDBLAST | 4800-38 1  4800-43 31  4800-68 5
  { m: 'その他', p: '2511', id: 305, at: 1, f: ['4800-08', '4800-11', '4800-38', '4800-43', '4800-66'] },
  //   TEFLON BONDING | 4800-08 1  4800-11 5  4800-38 887  4800-43 7  4800-66 683
  { m: 'その他', p: '3001', id: 305, at: 1, f: ['4800-10', '4800-38', '4800-43', '4800-47', '4800-50', '4800-64', '4800-68'] },
  //   ASSEMBLY | 4800-10 16  4800-38 1  4800-43 2  4800-47 6  4800-50 2  4800-64 5  4800-68 24
  { m: 'その他', p: '3002', id: 305, at: 1, f: ['4800-10', '4800-47', '4800-68'] },
  //   ASSEMBLY (2) | 4800-10 8  4800-47 2  4800-68 8
  { m: 'その他', p: '3491', id: 305, at: 1, f: ['4800-39', '4800-67', '4800-68'] },
  //   OD GRIND | 4800-39 2  4800-67 7  4800-68 15
  { m: 'その他', p: '3521', id: 305, at: 1, f: ['4800-43', '4800-68'] },
  //   DRY FILM (ID) | 4800-43 66  4800-68 14
  { m: '測定用治具全般', p: '1241', id: 404, at: 1, f: ['9901-21'] },
  //   SUPER FINISH | 9901-21 21
  { m: '測定用治具全般', p: '8012', id: 404, at: 1, f: ['9901-14', '9901-20', '9901-22'] },
  //   COMPONENT INSPECT(2) | 9901-14 11  9901-20 5  9901-22 1
];

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const { rows: before } = await engPool.query(
    `SELECT count(*)::int AS n FROM ${TABLE}`);
  console.log(`\nrows in ${TABLE} before: ${before[0].n}`);
  if (dryRun) {
    console.log(`--dry-run: would touch ${SLOTS.length} combos / ${SLOTS.reduce((s, r) => s + r.f.length, 0)} slots`);
    for (const r of SLOTS) console.log(`   ${r.m} @${r.p}  T${r.at}..  ${r.f.join(" ")}`);
    return;
  }

  const client = await engPool.connect();
  let added = 0, skipped = 0, removed = 0;
  try {
    await client.query('BEGIN');
    for (const r of SLOTS) {
      if (revert) {
        for (const dwg of r.f) {
          const res = await client.query(
            `DELETE FROM ${TABLE}
              WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
            [r.m, r.p, dwg]);
          removed += res.rowCount;
        }
        continue;
      }
      // Recompute the first free slot from the live table, so a combo that gained rows
      // elsewhere is appended to rather than renumbered.
      const { rows: mx } = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(tool_number FROM 2) AS int)), 0) AS mx
           FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2`,
        [r.m, r.p]);
      let next = Math.max(mx[0].mx + 1, 1);
      for (const dwg of r.f) {
        const { rows: dup } = await client.query(
          `SELECT 1 FROM ${TABLE}
            WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
          [r.m, r.p, dwg]);
        if (dup.length) { skipped++; continue; }
        await client.query(
          `INSERT INTO ${TABLE} (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [`T${next}`, r.p, r.m, dwg, r.id]);
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

  const { rows: after } = await engPool.query(
    `SELECT count(*)::int AS n FROM ${TABLE}`);
  if (revert) {
    console.log(`reverted: ${removed} rows removed - table now ${after[0].n}`);
    await recordRevert({ file: __filename });
    return;
  }
  console.log(`inserted ${added} slots (${skipped} already present) - table now ${after[0].n}`);
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260827_sds_machine_tool_fill_template_b_gaps.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
