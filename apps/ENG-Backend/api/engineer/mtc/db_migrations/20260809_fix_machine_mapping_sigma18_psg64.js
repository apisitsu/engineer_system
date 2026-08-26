'use strict';

/**
 * Record two confirmed floor-machine → SDS machine mappings (user decision, 2026-08-09).
 *
 * Both were left open by 20260809_seed_m_setup_datasheet_grinding_codes.js because a
 * name mismatch cannot be resolved by copying data — it needs someone who knows the
 * machines. Answers received:
 *
 *   CGM-11  m_machine.m_model 'SIGMA 18-IA' — SAME machine as catalog 'Sigma-18-I'.
 *           The existing sds_machine_code override said 'SIGMA-18', which matches
 *           nothing: sdsMachineByAny's hyphen/space-insensitive fallback compares
 *           'SIGMA18' against 'SIGMA18I' → no row, so /api/public/sds/pdf answered
 *           400 "Unknown machine". Corrected to the exact catalog name.
 *
 *   SGM-04  m_machine / m_setup_datasheet say 'PSG-64DX'; the override says 'PSG-64'.
 *           CONFIRMED: the SDS machine is 'PSG-64' (the one carrying 188 sds_parameter
 *           rows). The override is therefore correct and stays — this migration only
 *           writes the `remark` so the mapping is no longer an undocumented override.
 *           'PSG-64DX' is left untouched in the factory tables: it is the real model
 *           name of the physical asset, and the override wins at resolve time anyway.
 *
 * Also seeds the CGM-11 row in rodpc.m_setup_datasheet. It is not needed for the PDF
 * (the override is checked first) but GET /api/public/sds/machines enumerates ONLY
 * m_setup_datasheet, so without it CGM-11 is invisible to the calling team's
 * pre-flight check even though the PDF works.
 *
 * NOTE: `Sigma-18-I` has 0 rows in sds_parameter, so CGM-11 now RESOLVES but renders
 * a blank sheet until its Excel Parameter Config is created in SdsV2AdminPage — the
 * same state as the KN-113A / PAX2 machines from the previous migration.
 *
 * Idempotent: every statement is guarded, safe to re-run.
 *
 * Rollback:
 *   UPDATE sds_machine_code SET machine_name='SIGMA-18', machine_type_code=NULL, remark=NULL
 *    WHERE machine_code='CGM-11';
 *   UPDATE sds_machine_code SET remark=NULL WHERE machine_code='SGM-04';
 *   DELETE FROM rodpc.m_setup_datasheet WHERE machine_code='CGM-11' AND rev='NC' AND sheet_name='';
 *
 * 2026-08-09
 */

require('dotenv').config();
const { engPool } = require('../../../../instance/eng_db');
const { pool: rodpcPool } = require('../../../../instance/instance');

const CGM11_NAME = 'Sigma-18-I';
const CGM11_REMARK =
  "m_machine m_model = 'SIGMA 18-IA'; confirmed same machine as catalog 'Sigma-18-I' (2026-08-09)";
const SGM04_REMARK =
  "m_machine m_model = 'PSG-64DX'; confirmed the SDS machine is 'PSG-64' (2026-08-09)";

async function run() {
  const done = [];
  const skipped = [];

  // ── engPool: the override table ────────────────────────────────────────────
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // Guard on the catalog: never point an override at a machine_type_name that
    // does not exist — that is exactly the failure being fixed here.
    const cat = await client.query(
      `SELECT machine_type_code FROM sds_machine_type_code
        WHERE machine_type_name = $1 AND is_active LIMIT 1`, [CGM11_NAME]);
    if (!cat.rows.length) {
      throw new Error(`sds_machine_type_code has no active '${CGM11_NAME}' — aborting`);
    }
    const cgm11Code = cat.rows[0].machine_type_code;

    const u1 = await client.query(
      `UPDATE sds_machine_code
          SET machine_name = $1, machine_type_code = $2, remark = $3, updated_at = NOW()
        WHERE machine_code = 'CGM-11' AND machine_name IS DISTINCT FROM $1
        RETURNING machine_code`, [CGM11_NAME, cgm11Code, CGM11_REMARK]);
    (u1.rowCount ? done : skipped).push(`sds_machine_code CGM-11 → ${CGM11_NAME} (${cgm11Code})`);

    // SGM-04: documentation only. Scoped to machine_name='PSG-64' so this never
    // stamps a remark onto a row someone has since repointed elsewhere.
    const u2 = await client.query(
      `UPDATE sds_machine_code SET remark = $1, updated_at = NOW()
        WHERE machine_code = 'SGM-04' AND machine_name = 'PSG-64'
          AND remark IS DISTINCT FROM $1
        RETURNING machine_code`, [SGM04_REMARK]);
    (u2.rowCount ? done : skipped).push('sds_machine_code SGM-04 remark');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // ── rodpcPool: the factory base map (separate DB → separate transaction) ────
  const exists = await rodpcPool.query(
    `SELECT machine_name FROM rodpc.m_setup_datasheet WHERE TRIM(machine_code) = 'CGM-11'`);
  if (exists.rows.length) {
    skipped.push(`m_setup_datasheet CGM-11 (มีอยู่แล้ว → ${exists.rows[0].machine_name})`);
  } else {
    await rodpcPool.query(
      `INSERT INTO rodpc.m_setup_datasheet (machine_code, machine_name, sheet_name, rev)
       VALUES ('CGM-11', $1, '', 'NC')`, [CGM11_NAME]);
    done.push(`m_setup_datasheet CGM-11 → ${CGM11_NAME}`);
  }

  return { done, skipped };
}

if (require.main === module) {
  run()
    .then(({ done, skipped }) => {
      console.log(`เขียน ${done.length} รายการ:`);
      done.forEach((s) => console.log('  +', s));
      if (skipped.length) {
        console.log(`\nข้าม ${skipped.length} รายการ (ตรงอยู่แล้ว):`);
        skipped.forEach((s) => console.log('  -', s));
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('FAILED (rolled back):', err.message);
      process.exit(1);
    });
}

module.exports = { run };
