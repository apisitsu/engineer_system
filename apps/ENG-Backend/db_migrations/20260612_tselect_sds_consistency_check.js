'use strict';

/**
 * READ-ONLY consistency check: do Tooling Select and SDS view CN / Process / Machine
 * the same way? Run anytime: `node db_migrations/20260612_tselect_sds_consistency_check.js`
 *
 * Background — the two systems store the same part in different shapes:
 *   - Tooling Select  : tooling_spec_process.cn      = 6-digit  ("250235")
 *   - SDS / factory   : control_no / sds_parameter.cn = Cxx-0YYYY ("C25-00235")
 * All cross-system hops normalize through utils/cnFormat.js (SSOT). This script
 * confirms the *data* still obeys that contract (a leaked Cxx into the 6-digit
 * spec key, or a 6-digit into the SDS key, silently breaks a join).
 *
 * Machine axis: T-Select returns tooling_machine.machine_group/name; SDS matches it
 * against sds_machine_type_code.machine_type_name/machine_group (string match, no FK).
 * Process axis: factory process_code → direction map must agree between
 * tselectFallback.PROCESS_CODE_DIRECTION and specController ID/OD_GRIND_PROCESS_CODES.
 *
 * Exit code 0 = all clean; 1 = at least one inconsistency found (greppable output).
 */

const { engPool } = require('../instance/eng_db');

async function main() {
  let problems = 0;
  const table = (label, rows) => { console.log(`\n=== ${label} ===`); console.table(rows); };

  // [A] every enabled T-Select machine must resolve to an SDS name or group
  const a = await engPool.query(`
    SELECT tm.machine_name, tm.machine_group
    FROM tooling_machine tm
    WHERE tm.enabled = true
      AND NOT EXISTS (
        SELECT 1 FROM sds_machine_type_code s
        WHERE s.machine_type_name = tm.machine_name
           OR s.machine_group     = COALESCE(tm.machine_group, tm.machine_name)
           OR s.machine_type_name = COALESCE(tm.machine_group, ''))
    ORDER BY tm.machine_name`);
  table('[A] T-Select machines with NO matching SDS name/group (should be empty)', a.rows);
  problems += a.rows.length;

  // [B] for the same machine_name, T-Select group label must equal SDS group label
  const b = await engPool.query(`
    SELECT tm.machine_name AS ts_name, tm.machine_group AS ts_group,
           s.machine_type_name AS sds_name, s.machine_group AS sds_group
    FROM tooling_machine tm
    JOIN sds_machine_type_code s ON s.machine_type_name = tm.machine_name
    WHERE tm.enabled = true
      AND COALESCE(tm.machine_group,'') <> COALESCE(s.machine_group,'')
    ORDER BY tm.machine_name`);
  table('[B] group-label mismatch TS vs SDS (should be empty)', b.rows);
  problems += b.rows.length;

  // [C] T-Select spec CN must be 100% 6-digit (no Cxx / -X leak)
  const c = await engPool.query(`
    SELECT count(*) FILTER (WHERE cn !~ '^[0-9]{6}$') AS non_6digit, count(*) AS total
    FROM tooling_spec_process`);
  table('[C] tooling_spec_process.cn non-6-digit leaks (non_6digit should be 0)', c.rows);
  problems += Number(c.rows[0].non_6digit);

  // [D] spec.process must be canonical only (else isIDtoOD/isODtoID silently 0)
  const d = await engPool.query(`
    SELECT count(*) AS bad_process
    FROM tooling_spec_process
    WHERE process IS NOT NULL
      AND process NOT IN ('OD->ID','ID->OD','OD Only','ID Only')`);
  table('[D] non-canonical spec.process (bad_process should be 0)', d.rows);
  problems += Number(d.rows[0].bad_process);

  // [E] SDS per-CN params must be Cxx-form (PDF looks up WHERE cn = Cxx). A 6-digit
  //     row here would never match. (cn IS NULL = machine-config row, fine.)
  const e = await engPool.query(`
    SELECT count(*) AS sixdigit_cn_rows
    FROM sds_parameter
    WHERE cn IS NOT NULL AND cn ~ '^[0-9]{6}$'`);
  table('[E] sds_parameter 6-digit cn rows (sixdigit_cn_rows should be 0)', e.rows);
  problems += Number(e.rows[0].sixdigit_cn_rows);

  // [F] FK link health — every enabled T-Select machine should resolve to an SDS
  //     master via the surrogate FK (added 20260612_tooling_machine_sds_fk.js).
  //     A NULL here = the machine_name no longer matches any active SDS master.
  const f = await engPool.query(`
    SELECT machine_name, machine_group
    FROM tooling_machine
    WHERE enabled = true AND sds_machine_type_id IS NULL
    ORDER BY machine_name`).catch(() => ({ rows: [] })); // column absent if FK migration not yet run
  if (f.rows.length) { table('[F] enabled machines with NULL sds_machine_type_id FK (should be empty)', f.rows); problems += f.rows.length; }

  console.log(`\n${problems === 0 ? '✅ ALL CLEAN' : `❌ ${problems} inconsistency row(s) found`} — CN / Process / Machine parity check`);
  await engPool.end();
  process.exit(problems === 0 ? 0 : 1);
}

main().catch(err => { console.error('check failed:', err.message); process.exit(2); });
