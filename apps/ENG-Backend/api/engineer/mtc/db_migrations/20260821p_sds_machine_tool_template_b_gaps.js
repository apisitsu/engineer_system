'use strict';

/**
 * SDS Machine Tool Config — close the 12 TEMPLATE_B gaps that are unambiguous (M-1).
 * ------------------------------------------------------------------------------
 * Auditing `sds_machine_tool` against TEMPLATE_B at the (process_code, family) level
 * found 58 pairs the workbook specifies and the config lacks. A family missing here
 * is never drawn on the SDS PDF and keeps its C/Ns counted PENDING in the coverage
 * report, so each gap is real output that is silently absent.
 *
 * 12 of the 58 are unambiguous. Each one satisfies all three tests:
 *
 *   1. the owning machine is identified by the code↔family rule
 *      (`sds_machine_type_code.machine_type_code` = the family's middle digits),
 *   2. that machine ALREADY has rows at that process — so this appends to a list
 *      rather than inventing a process configuration, and
 *   3. TEMPLATE_B carries it as a WHITE row (selected), not grey (not selected).
 *
 * The other 46 fail at least one test and are deliberately left alone: machines with
 * no rows in the table at all (T-111B, GI-20N, KS-B100, IG-15N), KN-113A at process
 * 1161 (the workbook names it `KN-113A (2つ爪チャック)` / `改造 (3つ爪チャック)`, which may
 * be a different machine), grey-only rows, and families the registry attributes to
 * `その他`. Each needs a decision, not a lookup. See the audit findings doc.
 *
 * SLOT ORDER: new slots go at the END, per the 2026-08-25 decision — `tool_number` is
 * the printed slot order, so inserting mid-sequence shifts sheets people already read.
 * The next number comes from the live MAX per (machine, process), which is also what
 * makes a re-run a no-op instead of a duplicate.
 *
 * PROCESS SCOPE was checked against the plan rather than assumed. XD-8 and J-WAVE
 * carry identical lists at 2031 and 2071, which invites mirroring both — but the plan
 * uses `4858-11` and `4879-02` at 2071 and never at 2031, and TEMPLATE_B files them
 * under 2071 only. They are added to 2071 alone. Likewise `4866-10` is also planned at
 * 1022 (17 C/N) and `4651-12` at 0041/0451/0191/0101 (1,098 C/N combined), but
 * TSG-300ZNC and LNC45/C200 have no rows at those processes, so those stay out.
 *
 * `7559-02` (VERTICAL PLATE, KS-03A) is included for completeness but will print an
 * empty slot until J-3 is resolved — Tooling Select has no shelf rows for that family.
 *
 * Idempotent; `--revert` removes exactly the (machine, process, drawing) rows added.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';

// ordered by planned C/N volume — the order only affects the log, not the slots
const ADDITIONS = [
  { machine: 'LNC45/C200', process: '0351', dwg: '4651-12', name: 'BODY HOLDER (OLD TYPE)', cns: 1693 },
  { machine: 'TSG-300ZNC', process: '1021', dwg: '4866-10', name: 'BASE PLATE / PLATE',      cns: 726 },
  { machine: 'XD-8',       process: '2071', dwg: '4858-11', name: 'WORK STOPPER',            cns: 276 },
  { machine: 'MD-V9910WA', process: '3491', dwg: '4918-03', name: 'PALLET, SPACER',          cns: 211 },
  { machine: 'MD-V9910WA', process: '3491', dwg: '4918-01', name: 'UNIVERSAL PALLET ASSY',   cns: 145 },
  { machine: 'J-WAVE',     process: '2071', dwg: '4879-02', name: 'INVERSION JAW',           cns: 24 },
  { machine: 'KS-400B6',   process: '1161', dwg: '4931-14', name: 'WORK PUSHER',             cns: 23 },
  { machine: 'OC-16A',     process: '1011', dwg: '4560-10', name: 'COLLAR',                  cns: 14 },
  { machine: 'KS-B80',     process: '1061', dwg: '4021-05', name: 'WHEEL',                   cns: 12 },
  { machine: 'KS-03A',     process: '1061', dwg: '7559-02', name: 'VERTICAL PLATE',          cns: 8 },
  { machine: 'KS-400B5',   process: '1041', dwg: '4906-09', name: 'WORK CHUTE GUIDE',        cns: 2 },
  { machine: 'KS-400B6',   process: '1011', dwg: '4931-14', name: 'WORK PUSHER',             cns: 1 },
];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const tNum = (t) => Number(String(t || '').replace(/^T/i, '')) || 0;

async function main() {

  if (await guard({ file: __filename, revert })) return;
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
      await recordRevert({ file: __filename });
      return;
    }

    const groups = new Map();
    for (const a of ADDITIONS) {
      const k = `${a.machine}||${a.process}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(a);
    }

    let inserted = 0;
    let skipped = 0;
    let covered = 0;

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
          `${machine} @${process} has no rows in ${TABLE} — this migration only appends ` +
          `to an existing list; creating a process configuration is a separate decision`);
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
        console.log(`   + ${slot} = ${a.dwg}  ${a.name}  (แผน ${a.cns} C/N)`);
        if (!dryRun) {
          await client.query(
            `INSERT INTO ${TABLE} (machine_type, process_code, tool_number, tool_drawing_no, machine_type_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (tool_number, process_code, machine_type) DO NOTHING`,
            [machine, process, slot, a.dwg, typeId]);
        }
        have.add(a.dwg);
        inserted += 1;
        covered += a.cns;
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log(`\ndry run — would insert ${inserted}, skip ${skipped} · ครอบคลุม ${covered.toLocaleString()} C/N`);
      return;
    }

    await client.query('COMMIT');
    console.log(`\ninserted ${inserted} · skipped ${skipped} · ครอบคลุมเพิ่ม ${covered.toLocaleString()} C/N`);
    await recordRun({ file: __filename });
    console.log(`undo with:  node api/engineer/mtc/db_migrations/20260821p_sds_machine_tool_template_b_gaps.js --revert`);
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
