'use strict';

/**
 * `sds_machine_tool` — disable KS-400B1 @1011 and KS-400B6 @1011.
 * ------------------------------------------------------------------------------
 * TEMPLATE_B's "INNER in BALL" sheet genuinely lists this tooling set at BOTH
 * process 1011 (OD GRIND) and 1161 (GROOVE GRIND) — so the config is not wrong,
 * and the factory plan confirms it: ONE real C/N, `C35-04036`, plans the
 * KS-400B1 STOCKER CHUTE (4664-34) and all 10 KS-400B6 families (4931-xx) at
 * process 1011, exactly matching the workbook.
 *
 * The problem is scope, not correctness. `SdsV2Page.jsx` groups a process row's
 * expanded content by `sds_machine_tool.process_code` ALONE — it has no notion of
 * part class/family — so EVERY other C/N that routes through process 1011 (the
 * OC-16A population: 4,137 of ~4,229 planned 1011 tools factory-wide) also
 * renders a KS-400B1 section and a KS-400B6 section, both permanently 0/N
 * matched, because those two machines' real work is a single unrelated C35
 * part. Reported live on CN 414303 (A41-xxxxx, unrelated to INNER in BALL).
 *
 * Disabled rather than reconciled with a class-aware filter: that would be a
 * frontend change touching every process row on the SDS page, and needs
 * measuring against every part class before shipping — out of scope for a data
 * fix. Trading the one real C35-04036 sheet's 1011 tool list (it still has its
 * 1161 GROOVE GRIND sheet, which is unaffected) against removing permanent
 * clutter from thousands of other 1011 sheets is judged worth it; revert with
 * `--revert` restores both combos verbatim if that call is wrong.
 *
 * Idempotent — re-running with nothing to remove is a no-op.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// Captured live 2026-09-18 — restored verbatim by --revert.
const REMOVE = [
  {
    machine: 'KS-400B1', process: '1011', machine_type_id: 203,
    slots: [{ tool_number: 'T1', tool_drawing_no: '4664-34' }],
  },
  {
    machine: 'KS-400B6', process: '1011', machine_type_id: 433,
    slots: [
      { tool_number: 'T1',  tool_drawing_no: '4664-34' },
      { tool_number: 'T2',  tool_drawing_no: '4931-01' },
      { tool_number: 'T3',  tool_drawing_no: '4931-02' },
      { tool_number: 'T4',  tool_drawing_no: '4931-03' },
      { tool_number: 'T5',  tool_drawing_no: '4931-06' },
      { tool_number: 'T6',  tool_drawing_no: '4931-09' },
      { tool_number: 'T7',  tool_drawing_no: '4931-11' },
      { tool_number: 'T8',  tool_drawing_no: '4931-12' },
      { tool_number: 'T9',  tool_drawing_no: '4931-17' },
      { tool_number: 'T10', tool_drawing_no: '4931-14' },
    ],
  },
];

async function show(label) {
  const { rows } = await engPool.query(
    `SELECT machine_type, process_code, count(*)::int AS slots
       FROM ${TABLE}
      WHERE (machine_type, process_code) IN (('KS-400B1','1011'), ('KS-400B6','1011'))
      GROUP BY 1, 2 ORDER BY 1`
  );
  console.log(`\n${label}`);
  if (!rows.length) console.log('   (neither combo exists)');
  for (const r of rows) console.log(`   ${r.machine_type.padEnd(10)} @${r.process_code}  ${r.slots} slots`);
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  await show(revert ? '-- before revert --' : '-- before --');
  if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      for (const r of REMOVE) {
        // Re-insert only when the combo is empty, so a partial revert is safe to re-run.
        const { rows } = await client.query(
          `SELECT count(*)::int AS n FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2`,
          [r.machine, r.process]);
        if (rows[0].n > 0) continue;
        for (const s of r.slots) {
          await client.query(
            `INSERT INTO ${TABLE} (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [s.tool_number, r.process, r.machine, s.tool_drawing_no, r.machine_type_id]);
        }
        console.log(`   restored ${r.slots.length} - ${r.machine} @${r.process}`);
      }
      await client.query('COMMIT');
      await show('-- after revert --');
      await recordRevert({ file: __filename });
      return;
    }

    let removed = 0;
    for (const r of REMOVE) {
      const res = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2`, [r.machine, r.process]);
      removed += res.rowCount;
      console.log(`   removed ${String(res.rowCount).padStart(2)} - ${r.machine} @${r.process}`);
    }

    await client.query('COMMIT');
    console.log(`\nremoved ${removed} rows`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  await show('-- after --');
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260918_sds_machine_tool_disable_ks400b1_b6_process1011.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
