'use strict';

/**
 * SDS Machine Tool Config — 7 more machines with no config, inside the existing scope.
 * ------------------------------------------------------------------------------
 * Continues `20260825b_`. Same evidence and the same two rules; what is new is the
 * scope test, because the search for "active machines with zero rows here" returned
 * **34 machines**, not the two or three the earlier estimate implied.
 *
 * THE SCOPE TEST, AND WHY IT EXISTS
 *
 * Those 34 split cleanly on one question — does the machine's work sit at a process
 * `sds_machine_tool` ALREADY serves?
 *
 *   A1   8 machines ·  35 slots ·  2,862 C/N   processes SDS already serves
 *   A2  28 machines ·  93 slots · 13,371 C/N   entirely new processes
 *
 * A2 is turning (0311, 0561), pressing (2201, 2211), assembly (3001, 3002), marking
 * (3091) and inspection — PHK3FLS, PRS-15, TM330, NSV-1555FE, QTN200 and the rest.
 * Configuring them would extend the Setup Data Sheet from grinding into most of the
 * factory. That is a decision about what SDS is for, not a config gap, so **A2 is
 * deliberately not in this migration.** The numbers are recorded so it can be taken up
 * on purpose.
 *
 * This migration is A1, minus TSG-300W — see below.
 *
 * TWO OF THESE ANSWER OPEN FINDINGS
 *
 *   • **KN-312B / 4832 @1161 (H-2, M-4).** The audit found KN-312B set up as a clone of
 *     KN-312A while every source said it runs 溝研 family `4832`, which existed nowhere
 *     in the system. It exists in the plan: 12 families, 150 C/N at 1161, with real tool
 *     names (バッキングプレート, UNLOADER PLUG, ワーク受け). This gives it its own list —
 *     it had no rows here at all — and is the SDS half of that finding.
 *
 *   • **DTS-IS / 4691 @1241 (M-3).** `4691-04` was flagged as "TEMPLATE_B greys it out but
 *     the plan uses it on 198 C/N", filed against KS-H70. `4691` is not KS-H70's family —
 *     code 691 is DTS-IS. The grey was correct for KS-H70; the tooling simply belongs to a
 *     machine that had no config. M-3's puzzle resolves as a misattribution, not a stale
 *     grey.
 *
 * TSG-300W IS DELIBERATELY EXCLUDED, THOUGH IT QUALIFIES (952 C/N @1021)
 *
 * It shares `machine_group` 'TSG-300W/TSG-300ZNC' with TSG-300ZNC, which HAS a list at
 * 1021 (`T1=4866-14 T2=4556-01`) — and `4556-01` is TSG-300W's own family, so TSG-300W is
 * already served through the group fallback in sdsV2HeadlessController ("only when a
 * machine has NO rows of its own do we fall back to the group-wide list"). Giving it rows
 * of its own would switch it off that fallback and **drop 4866-14 from its sheet**. That is
 * a real behaviour change on 952 C/N and needs a decision, not a bulk insert.
 *
 * Idempotent; `--revert` removes only what it added.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

// A1 minus TSG-300W. Families are derived from machine_type_code at run time.
const MACHINES = [
  { machine: 'DTS-IS',     family: '4691' },   // 971 C/N @1241  — resolves M-3
  { machine: 'PAX2',       family: '4894' },   // 592 C/N @0401, 1011
  { machine: 'KN-312B',    family: '4832' },   // 150 C/N @1161  — resolves H-2 / M-4 (SDS half)
  { machine: 'MS-50',      family: '4541' },   //  94 C/N @0351
  { machine: 'Sigma-18-I', family: '4805' },   //  52 C/N @1181
  { machine: 'KS-D80',     family: '4928' },   //  29 C/N @1081
  { machine: 'LC30',       family: '4536' },   //  22 C/N @0351
];

const TABLE = 'sds_machine_tool';
const PROCESS_MIN_CN = 20;
const FAMILY_MIN_CN = 3;

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const tNum = (t) => Number(String(t || '').replace(/^T/i, '')) || 0;

async function main() {

  if (await guard({ file: __filename, revert })) return;
  const { maqPool } = require('../../../../instance/maq_db');
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      let removed = 0;
      for (const { machine, family } of MACHINES) {
        const r = await client.query(
          `DELETE FROM ${TABLE} WHERE machine_type = $1 AND tool_drawing_no LIKE $2`,
          [machine, `${family}-%`]);
        if (r.rowCount) console.log(`  − ${machine}: ${r.rowCount} row(s)`);
        removed += r.rowCount;
      }
      await client.query('COMMIT');
      console.log(`\nreverted ${removed} row(s)`);
      await recordRevert({ file: __filename });
      return;
    }

    // Only processes this table already serves — the scope test, applied in code so a
    // re-run after the scope widens does not silently pull A2 in.
    const inScope = new Set(
      (await client.query(`SELECT DISTINCT process_code FROM ${TABLE}`)).rows.map((r) => r.process_code));

    let inserted = 0;
    let skipped = 0;
    let coveredCn = 0;

    for (const { machine, family } of MACHINES) {
      const { rows: reg } = await client.query(
        `SELECT id FROM sds_machine_type_code WHERE machine_type_name = $1 LIMIT 1`, [machine]);
      if (!reg.length) throw new Error(`${machine} is not in sds_machine_type_code — refusing to invent a machine`);
      const typeId = reg[0].id;

      const { rows } = await maqPool.query(
        `SELECT substring(t.tool_dwg_no FROM 1 FOR 7) AS fam, t.process_code,
                count(DISTINCT t.process_plan_no)::int AS cns, min(g.tool_name) AS tool_name
           FROM lpb.eng_r_pi_tool t
           LEFT JOIN lpb.eng_tooling g ON g.tool_dwg_no = t.tool_dwg_no
          WHERE t.tool_dwg_no LIKE $1
          GROUP BY 1, 2`, [`${family}-%`]);

      const byProcess = new Map();
      for (const r of rows) {
        if (!inScope.has(r.process_code)) continue;
        if (!byProcess.has(r.process_code)) byProcess.set(r.process_code, []);
        byProcess.get(r.process_code).push(r);
      }

      for (const [process, fams] of [...byProcess].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (!fams.some((f) => f.cns >= PROCESS_MIN_CN)) continue;
        const use = fams.filter((f) => f.cns >= FAMILY_MIN_CN).sort((a, b) => a.fam.localeCompare(b.fam));
        if (!use.length) continue;

        const { rows: existing } = await client.query(
          `SELECT tool_number, tool_drawing_no FROM ${TABLE}
            WHERE machine_type = $1 AND process_code = $2 FOR UPDATE`, [machine, process]);
        const have = new Set(existing.map((r) => r.tool_drawing_no));
        let next = existing.reduce((m, r) => Math.max(m, tNum(r.tool_number)), 0);

        console.log(`\n── ${machine} @${process}` + (existing.length ? `  (มีอยู่ ${existing.length} ช่อง)` : ''));
        for (const f of use) {
          if (have.has(f.fam)) { console.log(`   = ${f.fam} — มีอยู่แล้ว ข้าม`); skipped += 1; continue; }
          next += 1;
          const slot = `T${next}`;
          console.log(`   + ${slot.padEnd(4)} ${f.fam}  ${String(f.cns).padStart(5)} CN   ${f.tool_name || ''}`);
          if (!dryRun) {
            await client.query(
              `INSERT INTO ${TABLE} (machine_type, process_code, tool_number, tool_drawing_no, machine_type_id)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (tool_number, process_code, machine_type) DO NOTHING`,
              [machine, process, slot, f.fam, typeId]);
          }
          have.add(f.fam);
          inserted += 1;
          coveredCn += f.cns;
        }
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log(`\ndry run — would insert ${inserted}, skip ${skipped} · ครอบคลุม ${coveredCn.toLocaleString()} CN×tool`);
      return;
    }

    await client.query('COMMIT');
    console.log(`\ninserted ${inserted} · skipped ${skipped} · ครอบคลุมเพิ่ม ${coveredCn.toLocaleString()} CN×tool`);
    await recordRun({ file: __filename });
    console.log(`undo with:  node api/engineer/mtc/db_migrations/20260825c_sds_machine_tool_tier_a.js --revert`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main()
  .then(async () => {
    const { maqPool } = require('../../../../instance/maq_db');
    await Promise.all([engPool.end(), maqPool.end()]);
  })
  .catch(async (e) => {
    console.error(e);
    const { maqPool } = require('../../../../instance/maq_db');
    await Promise.all([engPool.end(), maqPool.end()]).catch(() => {});
    process.exit(1);
  });
