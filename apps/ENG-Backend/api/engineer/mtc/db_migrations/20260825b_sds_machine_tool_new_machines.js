'use strict';

/**
 * SDS Machine Tool Config — first configuration for 8 machines that had none (L-2).
 * ------------------------------------------------------------------------------
 * `sds_machine_tool` is the ordered T01–Tn whitelist the SDS PDF prints from and the
 * matcher that decides COMPLETE vs PENDING in the coverage report. These eight machines
 * are in `sds_machine_type_code` and are `is_active`, but had **zero rows** here — so a
 * sheet for any of their work printed with no fixture slots at all, and every C/N counted
 * as PENDING.
 *
 * They are 78 % of the measured gap (6,906 of 8,854 CN×tool). This closes 5,434.
 *
 * WHERE THE CONTENT COMES FROM — the factory plan, not a guess
 *
 * Each machine's `machine_type_code` names its own drawing family (566 → 4566, 586 → 4586,
 * …), the same code↔family rule the picker's `byCode` fallback already relies on. The
 * families, the processes and the tool NAMES are all read from `lpb.eng_r_pi_tool` joined
 * to `lpb.eng_tooling` — this is what the shop actually plans, per C/N.
 *
 * TWO EXPLICIT RULES, so a later reader can tell what was decided from what was measured:
 *
 *   1. **Slot order is ascending by family sub-number.** That is the house convention in
 *      every list already here — KS-400B1 (4664-01,02,03,06,07,21,22 then the foreign
 *      4931-03), KS-400B5 (4906-01…12 then 4800-42), X-100 (4857-01…04), KS-B80
 *      (4021-01…04). OC-16A @1011 is the one exception and was not taken as the model.
 *      Later additions still append at the end, per the 2026-08-25 decision.
 *
 *   2. **A process is configured when at least one of the machine's families reaches 20
 *      distinct C/Ns there**, and within a configured process a family is included at 3+.
 *      The plan puts every machine on a long tail of processes with 3–15 C/Ns; configuring
 *      those would print slots almost no sheet uses. The threshold is a judgement, not a
 *      measurement — it is stated here so it can be changed deliberately. Lowering it only
 *      adds rows; nothing here has to be undone first.
 *
 * `AUG25-4` IS CONFIGURED UNDER A NAME THAT LOOKS WRONG, DELIBERATELY. Its registry name
 * matches no other machine's pattern and reads like a placeholder someone typed, but the
 * row is `is_active` and code 586 owns family 4586 (外研アーバー — an OD-grind arbor set,
 * 964 C/N at process 1011). Renaming it later is safe and does not orphan this config:
 * `PUT /api/sds/v2/admin/machine-types/:id` cascades the rename into `sds_machine_tool`.
 * Ask about the name; do not let it block the 1,187 C/N.
 *
 * Idempotent — skips any (machine, process, drawing) already present, and computes the next
 * slot from the live MAX, so a re-run is a no-op and a machine that gains rows elsewhere is
 * appended to rather than renumbered. `--revert` removes only the rows it added.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';

// machine → its own drawing family. Everything else is read from the plan at run time.
const MACHINES = [
  { machine: 'T-PG 350', family: '4566' },
  { machine: 'AUG25-4',  family: '4586' },
  { machine: 'GI-20N',   family: '4652' },
  { machine: 'T-111B',   family: '4561' },
  { machine: 'IG-15N',   family: '4671' },
  { machine: 'KS-450C',  family: '4029' },
  { machine: 'GI-5N',    family: '4674' },
  { machine: 'KS-B100',  family: '4924' },
];

const PROCESS_MIN_CN = 20;   // configure a process at all
const FAMILY_MIN_CN = 3;     // include a family inside a configured process

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const tNum = (t) => Number(String(t || '').replace(/^T/i, '')) || 0;

async function planFor(maqPool, family) {
  const { rows } = await maqPool.query(
    `SELECT substring(t.tool_dwg_no FROM 1 FOR 7) AS fam,
            t.process_code,
            count(DISTINCT t.process_plan_no)::int AS cns,
            min(g.tool_name) AS tool_name
       FROM lpb.eng_r_pi_tool t
       LEFT JOIN lpb.eng_tooling g ON g.tool_dwg_no = t.tool_dwg_no
      WHERE t.tool_dwg_no LIKE $1
      GROUP BY 1, 2`,
    [`${family}-%`]);

  const byProcess = new Map();
  for (const r of rows) {
    if (!byProcess.has(r.process_code)) byProcess.set(r.process_code, []);
    byProcess.get(r.process_code).push(r);
  }

  const out = [];
  for (const [process, fams] of byProcess) {
    if (!fams.some((f) => f.cns >= PROCESS_MIN_CN)) continue;
    const use = fams.filter((f) => f.cns >= FAMILY_MIN_CN)
                    .sort((a, b) => a.fam.localeCompare(b.fam));
    if (use.length) out.push({ process, fams: use });
  }
  return out.sort((a, b) => a.process.localeCompare(b.process));
}

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

    let inserted = 0;
    let skipped = 0;
    let coveredCn = 0;

    for (const { machine, family } of MACHINES) {
      const { rows: reg } = await client.query(
        `SELECT id, machine_type_name FROM sds_machine_type_code
          WHERE machine_type_name = $1 LIMIT 1`, [machine]);
      if (!reg.length) throw new Error(`${machine} is not in sds_machine_type_code — refusing to invent a machine`);
      const typeId = reg[0].id;

      const plan = await planFor(maqPool, family);
      if (!plan.length) { console.log(`\n── ${machine}: the plan uses no ${family} family above the threshold — skipped`); continue; }

      for (const { process, fams } of plan) {
        const { rows: existing } = await client.query(
          `SELECT tool_number, tool_drawing_no FROM ${TABLE}
            WHERE machine_type = $1 AND process_code = $2 FOR UPDATE`,
          [machine, process]);
        const have = new Set(existing.map((r) => r.tool_drawing_no));
        let next = existing.reduce((m, r) => Math.max(m, tNum(r.tool_number)), 0);

        console.log(`\n── ${machine} @${process}` + (existing.length ? `  (มีอยู่ ${existing.length} ช่อง)` : ''));
        for (const f of fams) {
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
    console.log(`undo with:  node api/engineer/mtc/db_migrations/20260825b_sds_machine_tool_new_machines.js --revert`);
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
