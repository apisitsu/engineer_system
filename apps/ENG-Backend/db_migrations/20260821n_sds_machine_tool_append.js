'use strict';

/**
 * SDS Machine Tool Config — append the families the T-Select audit added (L-1).
 * ------------------------------------------------------------------------------
 * `sds_machine_tool` holds the same statement TEMPLATE_B does — which fixture
 * families a (machine_type, process_code) uses, in T01–Tn slot order — and it is
 * read in two places that both decide real output:
 *
 *   • sdsV2HeadlessController.js — the ordered whitelist the SDS PDF prints from.
 *     A family absent here is simply never drawn on the sheet.
 *   • sdsV2ReportController.js   — COMPLETE vs PENDING. "has process plan BUT tool
 *     doesn't match sds_machine_tool" is exactly the PENDING branch.
 *
 * Four migrations from the machine-by-machine audit added families to Tooling
 * Select and left this table untouched, so the work they cover is still invisible
 * to SDS: the PDF omits the slot and the coverage report still counts the CN as
 * PENDING. No error is raised anywhere — that is why it went unnoticed.
 *
 *     20260821c_  KS-B80       4021-03 QUILL        229 C/N @1061
 *                              4021-04 QUILL BOLT   201 C/N @1061
 *     20260821i_  TP-SW-03他   4606-03 WORK GUIDE  1423 C/N @2411
 *                              4606-10 PIN          312 C/N @2411
 *     20260821j_  LNC45/C200   4651-13 CLAMP PLATE 1858 C/N @0351
 *     20260821k_  X-100        4857-06 LOADER JAW   408 C/N @2031 · 116 @2071
 *                              4857-08 INVERSION    400 C/N @2031 · 102 @2071
 *
 * NEW SLOTS GO AT THE END, per the decision on 2026-08-25. `tool_number` is the
 * slot order on the printed form, so inserting mid-sequence would shift every
 * existing slot on sheets people already read. The next number is computed from
 * the live MAX per (machine_type, process_code) rather than hardcoded, which is
 * also what makes a second run a no-op rather than a duplicate.
 *
 * X-100 gets both 2031 and 2071 because the plan uses both families on both
 * processes and the machine already has a configured row set for each. The other
 * three machines are appended only to the process they already have configured —
 * `4606-03`/`4606-10` are also planned at 2412 and `4651-13` at 0041/0451/0191/0101,
 * but those processes have NO rows for these machines at all, so adding them would
 * be creating a new process configuration rather than completing an existing one.
 * Left out deliberately; see the audit findings doc.
 *
 * ALSO LEFT OUT, same reason (real, planned, missing from SDS — but not part of the
 * four migrations this one completes): `4021-05` WHEEL (12 C/N), `4906-09` on
 * KS-400B5, `4560-10` on OC-16A, and `4651-12` BODY HOLDER OLD TYPE (1,790 C/N,
 * the single largest gap in the table). Each needs its own slot-order decision.
 *
 * `machine_type_id` is copied from an existing row of the same machine_type rather
 * than hardcoded — the column carries an FK to sds_machine_type_code, and KS-B80
 * appears there under two codes (021 and 909), so guessing is not safe.
 *
 * Idempotent; `--revert` removes exactly the (machine, process, drawing) rows added.
 */

const { engPool } = require('../instance/eng_db');

const TABLE = 'sds_machine_tool';

// (machine_type, process_code, tool_drawing_no) — slot number is assigned at run time
const ADDITIONS = [
  { machine: 'KS-B80',     process: '1061', dwg: '4021-03', name: 'QUILL' },
  { machine: 'KS-B80',     process: '1061', dwg: '4021-04', name: 'QUILL BOLT' },
  { machine: 'TP-SW-03他', process: '2411', dwg: '4606-03', name: 'WORK GUIDE' },
  { machine: 'TP-SW-03他', process: '2411', dwg: '4606-10', name: 'PIN' },
  { machine: 'LNC45/C200', process: '0351', dwg: '4651-13', name: 'CLAMP PLATE' },
  { machine: 'X-100',      process: '2031', dwg: '4857-06', name: 'LOADER JAW' },
  { machine: 'X-100',      process: '2031', dwg: '4857-08', name: 'INVERSION JAW' },
  { machine: 'X-100',      process: '2071', dwg: '4857-06', name: 'LOADER JAW' },
  { machine: 'X-100',      process: '2071', dwg: '4857-08', name: 'INVERSION JAW' },
];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const tNum = (t) => Number(String(t || '').replace(/^T/i, '')) || 0;

async function main() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      let removed = 0;
      for (const a of ADDITIONS) {
        const r = await client.query(
          `DELETE FROM ${TABLE}
            WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
          [a.machine, a.process, a.dwg]);
        if (r.rowCount) console.log(`  − ${a.machine} @${a.process} ${a.dwg} (${a.name})`);
        removed += r.rowCount;
      }
      await client.query('COMMIT');
      console.log(`\nreverted ${removed} row(s)`);
      return;
    }

    let inserted = 0;
    let skipped = 0;

    // group by (machine, process) so slot numbers continue within each list
    const groups = new Map();
    for (const a of ADDITIONS) {
      const k = `${a.machine}||${a.process}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(a);
    }

    for (const [key, items] of groups) {
      const [machine, process] = key.split('||');

      const { rows: existing } = await client.query(
        `SELECT tool_number, tool_drawing_no, machine_type_id
           FROM ${TABLE}
          WHERE machine_type = $1 AND process_code = $2
          FOR UPDATE`,
        [machine, process]);

      if (!existing.length) {
        throw new Error(
          `${machine} @${process} has no rows in ${TABLE} — this migration only ` +
          `appends to an existing list, it does not create a process configuration`);
      }

      const typeId = existing[0].machine_type_id;
      const have = new Set(existing.map((r) => r.tool_drawing_no));
      let next = existing.reduce((m, r) => Math.max(m, tNum(r.tool_number)), 0);

      console.log(`\n── ${machine} @${process}  (มีอยู่ ${existing.length} ช่อง, ล่าสุด T${next})`);

      for (const a of items) {
        if (have.has(a.dwg)) {
          console.log(`   = ${a.dwg} ${a.name} — มีอยู่แล้ว ข้าม`);
          skipped += 1;
          continue;
        }
        next += 1;
        const slot = `T${next}`;
        console.log(`   + ${slot} = ${a.dwg}  ${a.name}`);
        if (!dryRun) {
          await client.query(
            `INSERT INTO ${TABLE} (machine_type, process_code, tool_number, tool_drawing_no, machine_type_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (tool_number, process_code, machine_type) DO NOTHING`,
            [machine, process, slot, a.dwg, typeId]);
        }
        have.add(a.dwg);
        inserted += 1;
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log(`\ndry run — would insert ${inserted}, skip ${skipped}`);
      return;
    }

    await client.query('COMMIT');
    console.log(`\ninserted ${inserted} · skipped ${skipped}`);
    console.log(`undo with:  node db_migrations/20260821n_sds_machine_tool_append.js --revert`);
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
