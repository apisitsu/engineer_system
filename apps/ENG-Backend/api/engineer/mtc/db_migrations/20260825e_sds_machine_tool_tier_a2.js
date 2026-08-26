'use strict';

/**
 * SDS Machine Tool Config — extend beyond grinding (tier A2).
 * ------------------------------------------------------------------------------
 * `20260825c_` split the 34 unconfigured machines on one question — is the machine's
 * work at a process `sds_machine_tool` already serves? — and deliberately shipped only
 * the 8 that were, flagging the other 28 as "a decision about what SDS is for".
 *
 * **That decision is made (2026-08-25): SDS covers the whole factory. Grinding was
 * where it started, not what it is limited to.** This migration is the other 28.
 *
 *     28 machines · 93 slots · 13,371 C/N · 28 process codes new to this table
 *
 *     turning     0311 0321 0411 0431 0541 0561 0562 0563 0011 0091 0151 0451
 *     pressing    2201 2202 2211 2212
 *     assembly    3001 3002 3102
 *     marking     3091
 *     other       1811 1851 2561 2562 2611 3161 3821
 *
 * SAME RULES AS THE GRINDING ROUNDS, unchanged so the table stays one thing:
 *   • slot order ascending by family sub-number; later additions append
 *   • a process is configured when one of the machine's families reaches 20 distinct
 *     C/Ns there; inside it, a family is included at 3+
 *   • families, processes and tool names all read from `lpb.eng_r_pi_tool` joined to
 *     `lpb.eng_tooling` — the plan, never a guess
 *
 * CHECKED BEFORE RUNNING — the one assumption elsewhere that a widening could break:
 * `services/noJigRule.js` relies on processes 1101/1102 being served by exactly PSG-64,
 * GS-64PFII and MSG-410 and by nothing else ("PROCESS ↔ MACHINE is a verified 1:1 set
 * correspondence, which is what lets Tooling Select apply this rule at all"). **None of
 * these 28 machines touches 1101 or 1102**, so that correspondence is untouched. Anyone
 * adding a machine at those two processes later must revisit that rule.
 *
 * EXPECT THE COVERAGE REPORT TO GROW. Every (machine, process) here becomes a triple the
 * report evaluates, so both COMPLETE and PENDING counts rise — that is the point, those
 * sheets were invisible before. `sdsBacklogIntake.syncNoStampBacklog` caps a run at
 * `MAX_CARDS_PER_RUN = 150` and aborts rather than flooding the Kanban board, so it fails
 * safe; if it starts aborting, that cap is the thing to look at, not this config.
 *
 * TSG-300W IS STILL EXCLUDED — it qualifies (952 C/N @1021) but shares a `machine_group`
 * with TSG-300ZNC, which already has a list at 1021 that includes TSG-300W's own family.
 * Giving it rows of its own switches it off the group fallback and drops `4866-14` from
 * its sheet. Unchanged from `20260825c_`: that needs a decision of its own.
 *
 * Idempotent; `--revert` removes only what it added.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const PROCESS_MIN_CN = 20;
const FAMILY_MIN_CN = 3;

// Listed explicitly rather than re-derived at run time: a migration should do the same
// thing in six months as it does today, whatever the plan has moved to since.
const MACHINES = [
  { machine: 'PHK3FLS',         family: '4574' },
  { machine: 'PRS-15',          family: '4591' },
  { machine: 'TM330',           family: '4009' },
  { machine: 'KL-20',           family: '4030' },
  { machine: 'NSV-1555FE',      family: '4863' },
  { machine: 'QTN200',          family: '4007' },
  { machine: '1MP-H',           family: '4516' },
  { machine: 'SL545A-5',        family: '4639' },
  { machine: 'AP-500-L',        family: '4645' },
  { machine: 'α-T14iFsa',       family: '4895' },
  { machine: 'TRC-130N-R-CⅣ',   family: '4916' },
  { machine: 'MX-40HA',         family: '4806' },
  { machine: 'US-70・150',       family: '4843' },
  { machine: 'HCN5000',         family: '4888' },
  { machine: 'MC-5VA',          family: '4655' },
  { machine: 'MC-4VA',          family: '4678' },
  { machine: 'MC-40VA',         family: '4505' },
  { machine: 'MC-710V',         family: '4693' },
  { machine: 'PAX2',            family: '4894' },   // gains @0071; @0401/@1011 came from 20260825c_
  { machine: 'MS-50',           family: '4541' },   // gains @0041; @0351 came from 20260825c_
  { machine: 'M21-2338',        family: '4817' },
  { machine: 'MC-600H',         family: '4530' },
  { machine: 'VCS530C',         family: '4908' },
  { machine: 'D05',             family: '4923' },
  { machine: 'MARKTRONIC 3000', family: '4902' },
  { machine: 'VARIAXIS730-5X',  family: '4859' },
  { machine: 'NK20',            family: '4667' },
  { machine: 'VMP-8',           family: '4526' },
];

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

    let inserted = 0;
    let skipped = 0;
    let coveredCn = 0;
    const newProcs = new Set();
    const before = new Set(
      (await client.query(`SELECT DISTINCT process_code FROM ${TABLE}`)).rows.map((r) => r.process_code));

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

        const label = existing.length ? `  (มีอยู่ ${existing.length} ช่อง)`
                    : before.has(process) ? '' : '  ← process ใหม่ของตาราง';
        console.log(`\n── ${machine} @${process}${label}`);
        if (!before.has(process)) newProcs.add(process);

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

    const tail = `${inserted} ช่อง · ${coveredCn.toLocaleString()} CN×tool · process ใหม่ ${newProcs.size} ตัว (${[...newProcs].sort().join(' ')})`;
    if (dryRun) {
      await client.query('ROLLBACK');
      console.log(`\ndry run — would insert ${tail} · skip ${skipped}`);
      return;
    }

    await client.query('COMMIT');
    console.log(`\ninserted ${tail} · skipped ${skipped}`);
    await recordRun({ file: __filename });
    console.log(`undo with:  node api/engineer/mtc/db_migrations/20260825e_sds_machine_tool_tier_a2.js --revert`);
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
