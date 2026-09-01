'use strict';

/**
 * Centreless OD-grind: give HI-GRIND-1-D / OC-18BR-150 / OC-20BR-200 the SAME SDS
 * Config + Excel Template as OC-16A (keeping each machine's own identity), plus the
 * 1021 face-grind whitelist gap on the three surface grinders.
 * ============================================================================
 * These four are the same class of centreless OD grinder and engineering treats
 * their SDS config as identical. OC-16A's own template rows already carry
 * `created_by='copy:OC-18BR-150'` — this "copy config across the centreless family"
 * step has been done before, in the other direction. This migration does NOT remap
 * any floor code: production still reports as HI-GRIND-1-D / OC-18BR-150 /
 * OC-20BR-200; only their config CONTENT is made to match OC-16A.
 *
 * PART A — sds_machine_tool: replace each machine's whitelist for the centreless OD
 *   processes (0401 / 1011 / 1012 / 3491) with a copy of OC-16A's
 *   (4560-18/21/11/04/10, T1–T5). Verified against lpb.eng_r_pi_tool: no part plans
 *   4911-01 or G371-02 at 1011/1012 (OC-18BR-150's current rows are dead), so the
 *   replace suppresses nothing on a rendered PDF. HI-GRIND-1-D's 1041 rows
 *   (4519-03/04) are a different process and are left untouched.
 *   Effect: ~82 NO_TOOL rows clear (the CGM parts that already carry a 4560-xx tool
 *   in their plan: 58 OC-18BR-150/OC-20BR-200 + 24 HI-GRIND-1-D).
 *
 * PART B — sds_parameter: HI-GRIND-1-D has NO Excel template. Copy OC-16A's 211
 *   machine-default (cn IS NULL) rows to it. OC-18BR-150 and OC-20BR-200 already
 *   hold a byte-identical 211-row template — skipped.
 *
 * PART C — sds_machine_tool: GS-64PFII / PSG-64 / MSG-410 run face grind (1021) on
 *   parts whose plan lists 4556-01 (+ 4866-10 / 4866-14) but only have a 1101/1102
 *   whitelist, so the report reads NO_TOOL. Add a 1021 whitelist with all three
 *   families so creating the combo's first row does not suppress a planned tool.
 *   Effect: 7 NO_TOOL rows (3 CNs: C24-00522, C25-00936, C29-00725).
 *
 * NOT touched (separate follow-ups): unmapped floor codes IDG-13/15, SPG-19/20,
 *   HSG-01, KS-H22, KS-B80PB (~40 rows); SPG-13 vs KS-400B6/4828 (1 row); and the
 *   ~78 CGM rows whose process plan logs NO 1011/1012 tool at all — a factory-plan
 *   data-entry gap for the planning team, not an SDS config issue.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260831f_sds_centreless_merge_oc16a.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260831f_sds_centreless_merge_oc16a.js
 *   node api/engineer/mtc/db_migrations/20260831f_sds_centreless_merge_oc16a.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const TAG = '[centreless-cfg-oc16a]';
const MT_BACKUP = 'sds_machine_tool_bak_20260831f';
const SRC = 'OC-16A';
const SRC_ID = 99;
const OD_PROCESSES = ['0401', '1011', '1012', '3491'];         // centreless OD-grind processes
const TARGETS = [['OC-18BR-150', 11], ['OC-20BR-200', 414], ['HI-GRIND-1-D', 46]];
const TPL_MARK = 'copy:OC-16A(20260831f)';

// Part C
const SURF = [['GS-64PFII', 298], ['PSG-64', 86], ['MSG-410', 449]];
const FAM_1021 = [['T1', '4556-01'], ['T2', '4866-10'], ['T3', '4866-14']];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      // ── Part A revert ──
      const targetNames = TARGETS.map(t => t[0]);
      await client.query(
        `DELETE FROM sds_machine_tool WHERE machine_type = ANY($1) AND process_code = ANY($2)`,
        [targetNames, OD_PROCESSES]
      );
      const hasBak = (await client.query(`SELECT to_regclass($1) t`, [MT_BACKUP])).rows[0].t;
      if (hasBak) {
        const r = await client.query(`INSERT INTO sds_machine_tool SELECT * FROM ${MT_BACKUP}`);
        await client.query(`DROP TABLE ${MT_BACKUP}`);
        console.log(`${TAG} revert A: restored ${r.rowCount} original whitelist row(s) from ${MT_BACKUP}`);
      } else {
        console.log(`${TAG} revert A: no ${MT_BACKUP} — replicated rows removed (targets had none before)`);
      }

      // ── Part B revert ──
      const b = await client.query(
        `DELETE FROM sds_parameter WHERE machine_type_name = 'HI-GRIND-1-D' AND cn IS NULL AND created_by = $1`,
        [TPL_MARK]
      );
      console.log(`${TAG} revert B: removed ${b.rowCount} HI-GRIND-1-D template row(s)`);

      // ── Part C revert ──
      const c = await client.query(
        `DELETE FROM sds_machine_tool WHERE process_code = '1021' AND machine_type = ANY($1) AND tool_drawing_no = ANY($2)`,
        [SURF.map(s => s[0]), FAM_1021.map(f => f[1])]
      );
      console.log(`${TAG} revert C: removed ${c.rowCount} 1021 row(s)`);

      await client.query(`DELETE FROM sds_coverage_cache WHERE id = 'coverage'`).catch(() => {});
      if (dryRun) { console.log(`${TAG} --dry-run — ROLLBACK`); await client.query('ROLLBACK'); return; }
      await client.query('COMMIT');
      await recordRevert({ file: __filename });
      console.log(`${TAG} reverted.`);
      return;
    }

    // ── Part A — replicate OC-16A's OD-process whitelist onto the 3 machines ──
    const targetNames = TARGETS.map(t => t[0]);
    await client.query(`CREATE TABLE IF NOT EXISTS ${MT_BACKUP} AS SELECT * FROM sds_machine_tool WHERE false`);
    if ((await client.query(`SELECT count(*)::int n FROM ${MT_BACKUP}`)).rows[0].n === 0) {
      const ins = await client.query(
        `INSERT INTO ${MT_BACKUP} SELECT * FROM sds_machine_tool WHERE machine_type = ANY($1) AND process_code = ANY($2)`,
        [targetNames, OD_PROCESSES]
      );
      console.log(`${TAG} A: backed up ${ins.rowCount} existing whitelist row(s) → ${MT_BACKUP}`);
    } else {
      console.log(`${TAG} A: ${MT_BACKUP} exists — idempotent re-run`);
    }

    const del = await client.query(
      `DELETE FROM sds_machine_tool WHERE machine_type = ANY($1) AND process_code = ANY($2)`,
      [targetNames, OD_PROCESSES]
    );
    let addedA = 0;
    for (const [mt, mtId] of TARGETS) {
      const r = await client.query(
        `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
         SELECT tool_number, process_code, $1::varchar, tool_drawing_no, $2::integer
           FROM sds_machine_tool
          WHERE machine_type = $3 AND process_code = ANY($4)`,
        [mt, mtId, SRC, OD_PROCESSES]
      );
      addedA += r.rowCount;
    }
    console.log(`${TAG} A: removed ${del.rowCount} old, inserted ${addedA} OC-16A-matching whitelist row(s) across ${TARGETS.length} machines`);

    // ── Part B — copy OC-16A's Excel template to HI-GRIND-1-D (only if it has none) ──
    const hgHas = (await client.query(
      `SELECT count(*)::int n FROM sds_parameter WHERE machine_type_name = 'HI-GRIND-1-D' AND cn IS NULL`
    )).rows[0].n;
    if (hgHas === 0) {
      const r = await client.query(
        `INSERT INTO sds_parameter (cn, machine_type_name, param_key, param_value, created_by, updated_by, machine_type_id, process_code)
         SELECT NULL, 'HI-GRIND-1-D', param_key, param_value, $1, $1, 46, process_code
           FROM sds_parameter WHERE machine_type_name = $2 AND cn IS NULL`,
        [TPL_MARK, SRC]
      );
      console.log(`${TAG} B: copied ${r.rowCount} OC-16A template row(s) → HI-GRIND-1-D`);
    } else {
      console.log(`${TAG} B: HI-GRIND-1-D already has ${hgHas} template row(s) — skip`);
    }

    // ── Part C — 1021 face-grind whitelist for the three surface grinders ──
    let addedC = 0;
    for (const [mt, mtId] of SURF) {
      for (const [tn, dwg] of FAM_1021) {
        const r = await client.query(
          `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
           SELECT $1::varchar, '1021', $2::varchar, $3::varchar, $4::integer
           WHERE NOT EXISTS (
             SELECT 1 FROM sds_machine_tool WHERE process_code = '1021' AND machine_type = $2::varchar AND tool_drawing_no = $3::varchar
           )`,
          [tn, mt, dwg, mtId]
        );
        addedC += r.rowCount;
      }
    }
    console.log(`${TAG} C: inserted ${addedC} sds_machine_tool 1021 row(s)`);

    await client.query(`DELETE FROM sds_coverage_cache WHERE id = 'coverage'`).catch(() => {});

    if (dryRun) { console.log(`${TAG} --dry-run — ROLLBACK`); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    await recordRun({ file: __filename });
    console.log(`${TAG} done. Rebuild the coverage report to see the new NO_TOOL count.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error(`${TAG} FAILED:`, e.message); process.exit(1); });
