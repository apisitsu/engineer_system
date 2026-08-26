'use strict';

/**
 * SDS Machine Tool Config — ROTARY DRESSER 4800-42 as the last slot of each machine.
 * ------------------------------------------------------------------------------
 * The dresser is shared tooling: `sds_machine_type_code` files family `4800` under
 * `その他` — a catch-all bucket, not a machine — so the code↔family rule that assigns
 * every other family to an owner cannot place it. It was left out of `20260821p_` for
 * exactly that reason.
 *
 * **Decision, 2026-08-25: it goes in the LAST slot of each machine that already has a
 * configured list.** That is not a new convention — `KS-400B5 @1041`, `KS-400B6 @1041`
 * and `KS-400B6 @1161` already carry `4800-42` as their final `T10`. This extends the
 * pattern to the other 13 (machine, process) lists whose work actually uses it.
 *
 * WHICH LISTS, AND HOW THEY WERE CHOSEN
 *
 * A machine gets the dresser at a process when the plan puts `4800-42` on C/Ns that
 * **also carry that machine's own tooling families at that same process** — i.e. the
 * dresser and the machine demonstrably meet on the same job. Counting that overlap:
 *
 *     KS-400B1 @1041  28    KN-113A  @1121  57    KS-450C    @1181  22
 *     KS-400B2 @1041  18    IG-15N   @1121  34    Sigma-18-I @1181   7
 *     KS-400B7 @1041  18    GI-20N   @1121  17    T-111B     @1181   3
 *     KN-312B  @1161  39    GI-20N   @1061   6    KN-113A    @1061   5
 *                                                  KS-B100    @1061   5
 *
 * Machines with no configured list are excluded per the decision — the dresser is an
 * addition to a list, not a reason to create one.
 *
 * The slot number comes from the live MAX, so "last" stays true whatever each list looks
 * like when this runs, and a re-run is a no-op. Nothing is renumbered.
 *
 * > The sheet PRINTS this family in its `DD####` form (`utils/rotaryDwg.toDD`) regardless
 * > of how it is stored; storing the `4800-42` prefix here is what the whitelist matches on
 * > and is consistent with the three lists that already carry it.
 *
 * Idempotent; `--revert` removes only the rows it added (never the three pre-existing ones,
 * which are matched and skipped rather than inserted).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const DRESSER = '4800-42';
const MIN_SHARED_CN = 3;

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');
const tNum = (t) => Number(String(t || '').replace(/^T/i, '')) || 0;

// (machine, process) pairs this migration is allowed to touch — recorded explicitly so a
// later plan change cannot silently widen what it does. Verified 2026-08-25.
const TARGETS = [
  ['KS-400B1', '1041'], ['KS-400B2', '1041'], ['KS-400B7', '1041'],
  ['KN-312B', '1161'],
  ['KN-113A', '1121'], ['IG-15N', '1121'], ['GI-20N', '1121'],
  ['KS-450C', '1181'], ['Sigma-18-I', '1181'], ['T-111B', '1181'],
  ['KN-113A', '1061'], ['GI-20N', '1061'], ['KS-B100', '1061'],
];

async function sharedCn(maqPool, machine, process, ownFamilies) {
  const { rows } = await maqPool.query(
    `SELECT count(DISTINCT t.process_plan_no)::int AS n
       FROM lpb.eng_r_pi_tool t
      WHERE t.process_code = $1
        AND substring(t.tool_dwg_no FROM 1 FOR 7) = ANY($2)
        AND t.process_plan_no IN (
              SELECT d.process_plan_no FROM lpb.eng_r_pi_tool d
               WHERE d.process_code = $1 AND d.tool_dwg_no LIKE $3)`,
    [process, ownFamilies, `${DRESSER}%`]);
  return rows[0].n;
}

async function main() {

  if (await guard({ file: __filename, revert })) return;
  const { maqPool } = require('../../../../instance/maq_db');
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      let removed = 0;
      for (const [machine, process] of TARGETS) {
        const r = await client.query(
          `DELETE FROM ${TABLE}
            WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
          [machine, process, DRESSER]);
        if (r.rowCount) console.log(`  − ${machine} @${process}`);
        removed += r.rowCount;
      }
      await client.query('COMMIT');
      console.log(`\nreverted ${removed} row(s)`);
      await recordRevert({ file: __filename });
      return;
    }

    let inserted = 0;
    let skipped = 0;

    for (const [machine, process] of TARGETS) {
      const { rows: existing } = await client.query(
        `SELECT tool_number, tool_drawing_no, machine_type_id FROM ${TABLE}
          WHERE machine_type = $1 AND process_code = $2 FOR UPDATE`, [machine, process]);

      if (!existing.length) {
        console.log(`  ! ${machine} @${process} has no configured list — skipped (the dresser is added to a list, never a reason to create one)`);
        skipped += 1;
        continue;
      }
      if (existing.some((r) => r.tool_drawing_no === DRESSER)) {
        console.log(`  = ${machine} @${process} — มี ${DRESSER} อยู่แล้ว ข้าม`);
        skipped += 1;
        continue;
      }

      const ownFamilies = [...new Set(existing
        .map((r) => r.tool_drawing_no)
        .filter((d) => !d.startsWith('4800-')))];
      const shared = await sharedCn(maqPool, machine, process, ownFamilies);
      if (shared < MIN_SHARED_CN) {
        console.log(`  ! ${machine} @${process} — งานร่วมกับ dresser เหลือ ${shared} C/N (< ${MIN_SHARED_CN}) ข้าม`);
        skipped += 1;
        continue;
      }

      const next = existing.reduce((m, r) => Math.max(m, tNum(r.tool_number)), 0) + 1;
      const slot = `T${next}`;
      console.log(`  + ${machine.padEnd(12)} @${process}  ${slot.padEnd(4)} = ${DRESSER}   (งานร่วม ${shared} C/N · ต่อจาก ${existing.length} ช่องเดิม)`);
      if (!dryRun) {
        await client.query(
          `INSERT INTO ${TABLE} (machine_type, process_code, tool_number, tool_drawing_no, machine_type_id)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (tool_number, process_code, machine_type) DO NOTHING`,
          [machine, process, slot, DRESSER, existing[0].machine_type_id]);
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
    await recordRun({ file: __filename });
    console.log(`undo with:  node api/engineer/mtc/db_migrations/20260825d_sds_rotary_dresser_last_slot.js --revert`);
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
