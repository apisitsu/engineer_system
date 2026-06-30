'use strict';
/**
 * Public SDS PDF link — resolve factory floor codes SGM-02 / SGM-03 to GS-64PFII.
 *
 * Symptom (reported):
 *   GET /api/public/sds/pdf?cn=290794&machine=SGM-02&process_code=1101&key=...
 *   → {"error":"Unknown machine: SGM-02"}
 *
 * Root cause: the public resolver (sdsPublicController.resolveMachineTypeName) maps a
 * floor machine_code via, in priority order, sds_machine_code (override SSOT) →
 * rodpc.m_setup_datasheet → raw value. For SGM-02/03:
 *   - sds_machine_code has NO row (only SGM-04 → PSG-64 exists).
 *   - m_setup_datasheet maps SGM-02/03 → 'GS-64PF', but that machine was renamed to
 *     'GS-64PFII' (sds_machine_type_code id 298 / code 762, the lone active GS-64* row;
 *     'GS-64PF' no longer exists). sdsMachineByAny('GS-64PF') therefore matches nothing
 *     ('GS-64PF' ILIKE/normalized != 'GS-64PFII'), so resolution returns null.
 * → the floor code can't reach its SDS machine. Same stale-factory-table class as
 *   VSG-02 (→ HAMAI 5B) and SGM-04 (→ PSG-64): the curated override is the right fix.
 *
 * Fix: upsert SGM-02 and SGM-03 → 'GS-64PFII' (machine_type_code 762) into the override
 * table. Because the override is checked FIRST, this wins over the stale m_setup_datasheet
 * 'GS-64PF' name and the public link renders the GS-64PFII Setup Data Sheet.
 *
 * (m_setup_datasheet is the asset team's table — we don't write to it; the local override
 * is the project's mechanism for correcting its stale floor-code → machine_name rows.)
 *
 * Idempotent: ON CONFLICT (machine_code) updates the mapping to the canonical value.
 *
 * Run: node db_migrations/20260630_add_sgm0203_gs64pfii_override.js
 */
const { engPool } = require('../instance/eng_db');

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // Guard: only proceed while GS-64PFII is the active target (catches a future rename
    // so this migration can't silently seed a dead name).
    const tgt = await client.query(
      `SELECT machine_type_name FROM sds_machine_type_code
        WHERE machine_type_code = '762' AND is_active AND machine_type_name = 'GS-64PFII' LIMIT 1`
    );
    if (!tgt.rowCount) {
      await client.query('ROLLBACK');
      console.log("  skip: active 'GS-64PFII' (code 762) not found — verify the SDS machine name before seeding the override.");
      return;
    }

    const rows = [
      ['SGM-02', 'GS-64PFII', '762'],
      ['SGM-03', 'GS-64PFII', '762'],
    ];
    const r = await client.query(
      `INSERT INTO sds_machine_code (machine_code, machine_name, machine_type_code, remark)
       VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)
       ON CONFLICT (machine_code) DO UPDATE
         SET machine_name = EXCLUDED.machine_name,
             machine_type_code = EXCLUDED.machine_type_code,
             remark = EXCLUDED.remark,
             updated_at = NOW()
       RETURNING machine_code, machine_name, machine_type_code`,
      [
        rows[0][0], rows[0][1], rows[0][2], 'm_setup_datasheet has stale GS-64PF (renamed to GS-64PFII 2026-06-13); override → 762',
        rows[1][0], rows[1][1], rows[1][2], 'm_setup_datasheet has stale GS-64PF (renamed to GS-64PFII 2026-06-13); override → 762',
      ]
    );
    await client.query('COMMIT');

    console.log('  upserted SGM-02 / SGM-03 → GS-64PFII override:');
    console.table(r.rows);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
})();
