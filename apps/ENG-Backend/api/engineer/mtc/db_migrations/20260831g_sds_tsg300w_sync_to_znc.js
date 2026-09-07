'use strict';

/**
 * TSG-300W SDS config → made identical to TSG-300ZNC (the group's master).
 * ============================================================================
 * TSG-300W and TSG-300ZNC share machine_group 'TSG-300W/TSG-300ZNC' (board +
 * coverage already treat them as one), but their machine_type_name-level SDS
 * config drifted:
 *   • sds_parameter  : TSG-300ZNC template created 2026-04-20 (original, 64 rows);
 *                      a separate TSG-300W template was added 2026-05-30 (65 rows)
 *                      and edited independently since — 19 keys differ, plus value
 *                      diffs (CBN wheel-spec prefix, Roughness/Roundness, number fmt).
 *   • sds_machine_tool: TSG-300W 6 rows vs TSG-300ZNC 5 rows, different families /
 *                       slot order at 1021 / 1022 / 1031.
 * The real history is all under TSG-300ZNC (688 sds_approval rows + 33 prints vs
 * 15 + 13 for TSG-300W), so TSG-300ZNC is the master.
 *
 * This migration ONLY re-syncs TSG-300W's config to match TSG-300ZNC. It does NOT
 * touch sds_approval (the 15 TSG-300W signatures stay put), the T-Select
 * tooling_machine registry, or any code path — a full consolidation onto one name
 * is a separate, larger change.
 *
 * A. sds_machine_tool — DELETE TSG-300W's 6 rows. The headless renderer already
 *    falls back to the group-wide list (machine_group = ... AND is_active) when a
 *    member has none, so TSG-300W then inherits TSG-300ZNC's whitelist.
 * B. sds_parameter  — DELETE TSG-300W's 65 machine-default (cn IS NULL) rows and
 *    INSERT copies of TSG-300ZNC's 64. The renderer has NO group fallback for
 *    parameters, so TSG-300W must carry its own identical copy.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260831g_sds_tsg300w_sync_to_znc.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260831g_sds_tsg300w_sync_to_znc.js
 *   node api/engineer/mtc/db_migrations/20260831g_sds_tsg300w_sync_to_znc.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const TAG = '[tsg300w-sync-znc]';
const MT_BAK = 'sds_machine_tool_bak_20260831g';
const SP_BAK = 'sds_parameter_bak_20260831g';
const MASTER = 'TSG-300ZNC';
const TARGET = 'TSG-300W';
const TARGET_ID = 95;
const SYNC_MARK = 'sync:TSG-300ZNC(20260831g)';

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      // ── A revert ──
      await client.query(`DELETE FROM sds_machine_tool WHERE machine_type = $1`, [TARGET]);
      if ((await client.query(`SELECT to_regclass($1) t`, [MT_BAK])).rows[0].t) {
        const r = await client.query(`INSERT INTO sds_machine_tool SELECT * FROM ${MT_BAK}`);
        await client.query(`DROP TABLE ${MT_BAK}`);
        console.log(`${TAG} revert A: restored ${r.rowCount} TSG-300W whitelist row(s)`);
      } else {
        console.log(`${TAG} revert A: no ${MT_BAK} — TSG-300W whitelist left empty`);
      }
      // ── B revert ──
      await client.query(`DELETE FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL AND created_by = $2`, [TARGET, SYNC_MARK]);
      if ((await client.query(`SELECT to_regclass($1) t`, [SP_BAK])).rows[0].t) {
        const r = await client.query(`INSERT INTO sds_parameter SELECT * FROM ${SP_BAK}`);
        await client.query(`DROP TABLE ${SP_BAK}`);
        console.log(`${TAG} revert B: restored ${r.rowCount} TSG-300W template row(s)`);
      } else {
        console.log(`${TAG} revert B: no ${SP_BAK} — synced rows removed only`);
      }
      await client.query(`DELETE FROM sds_coverage_cache WHERE id = 'coverage'`).catch(() => {});
      if (dryRun) { console.log(`${TAG} --dry-run — ROLLBACK`); await client.query('ROLLBACK'); return; }
      await client.query('COMMIT');
      await recordRevert({ file: __filename });
      console.log(`${TAG} reverted.`);
      return;
    }

    // ── A — drop TSG-300W's own whitelist (→ inherits TSG-300ZNC via group fallback) ──
    await client.query(`CREATE TABLE IF NOT EXISTS ${MT_BAK} AS SELECT * FROM sds_machine_tool WHERE false`);
    if ((await client.query(`SELECT count(*)::int n FROM ${MT_BAK}`)).rows[0].n === 0) {
      const b = await client.query(`INSERT INTO ${MT_BAK} SELECT * FROM sds_machine_tool WHERE machine_type = $1`, [TARGET]);
      console.log(`${TAG} A: backed up ${b.rowCount} TSG-300W whitelist row(s) → ${MT_BAK}`);
    }
    const dA = await client.query(`DELETE FROM sds_machine_tool WHERE machine_type = $1`, [TARGET]);
    console.log(`${TAG} A: deleted ${dA.rowCount} TSG-300W whitelist row(s) — renderer now falls back to ${MASTER}'s list`);

    // ── B — replace TSG-300W's machine-default template with a copy of TSG-300ZNC's ──
    await client.query(`CREATE TABLE IF NOT EXISTS ${SP_BAK} AS SELECT * FROM sds_parameter WHERE false`);
    if ((await client.query(`SELECT count(*)::int n FROM ${SP_BAK}`)).rows[0].n === 0) {
      const b = await client.query(`INSERT INTO ${SP_BAK} SELECT * FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL`, [TARGET]);
      console.log(`${TAG} B: backed up ${b.rowCount} TSG-300W template row(s) → ${SP_BAK}`);
    }
    const dB = await client.query(`DELETE FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL`, [TARGET]);
    const iB = await client.query(
      `INSERT INTO sds_parameter (cn, machine_type_name, param_key, param_value, created_by, updated_by, machine_type_id, process_code)
       SELECT NULL, $1, param_key, param_value, $2, $2, $3, process_code
         FROM sds_parameter WHERE machine_type_name = $4 AND cn IS NULL`,
      [TARGET, SYNC_MARK, TARGET_ID, MASTER]
    );
    console.log(`${TAG} B: deleted ${dB.rowCount} old TSG-300W template row(s), inserted ${iB.rowCount} copied from ${MASTER}`);

    await client.query(`DELETE FROM sds_coverage_cache WHERE id = 'coverage'`).catch(() => {});

    if (dryRun) { console.log(`${TAG} --dry-run — ROLLBACK`); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    await recordRun({ file: __filename });
    console.log(`${TAG} done. Flush the running backend's sds: cache (or restart) for the SDS page to pick it up.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error(`${TAG} FAILED:`, e.message); process.exit(1); });
