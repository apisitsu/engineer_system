'use strict';

/**
 * `sds_parameter` — pin CN314110's 3 brand-new tools onto KS-B80 @ process 1061, as a
 * PER-CN override — not a `sds_machine_tool` whitelist change.
 * ------------------------------------------------------------------------------
 * CN314110 (C31-04110) is a new-model job: its own factory process plan
 * (`lpb.eng_r_pi_tool`) already specifies three brand-new tools, DWG family 4021-06
 * (`4021-06-0006-01/-02/-03` — HOLDER(CAM LOCK) / NUT(CAM LOCK) / GUIDE PIN), none of
 * which this machine's `sds_machine_tool` whitelist has ever listed (today it only
 * knows 4021-01/4021-02 at both 0351 and 1061, T1/T2).
 *
 * Why NOT add 4021-06 to the whitelist: 6 OTHER C/Ns across unrelated part families
 * (C29-00942/943/944, C69-04082/4088, F00-0M679) also plan this family at 1061 — but
 * the owner asked for THIS C/N's sheet only, without touching any existing one.
 * Whitelisting the family is machine-level config: every other C/N running process
 * 1061 on KS-B80 would gain three new NAMED, Tool-No-less rows (the part's own plan
 * has no 4021-06 tool, so the slot would print blank except for the family name) —
 * see "The guard floor and the alternative floor must be the same number" in
 * .claude/rules/sds-pipeline.md for exactly this failure shape. A per-CN
 * `sds_parameter` override is scoped by `(cn, machine_type_name, param_key,
 * process_code)` and so reaches ONLY C31-04110 @ 1061.
 *
 * Mechanism (verified live, no code change needed): `tool_dwg_no_T0N` / `maker_T0N` /
 * `tool_name_T0N` are ordinary mapped `sds_excel_mapping` param_keys, and
 * `applyDataToGrid`'s scalar-field block (section "1") checks `params[param_key]`
 * (the CN-wins-merged sds_parameter table) BEFORE falling back to the
 * auto-derived `valueMap.tooling` value. Slots T3-T5 are free (unused by the
 * whitelist at 1061), so the un-whitelisted family never populates
 * `valueMap.tooling` for them and nothing overwrites this override afterward.
 *
 * Maker is left blank — not known at seed time; fill in later via the ordinary
 * `PUT /api/sds/v2/admin/parameters` editor (cn=C31-04110, process_code=1061).
 *
 * Idempotent: upserts on the same unique key the admin API uses
 * `(COALESCE(cn,'__machine_config__'), machine_type_name, param_key, COALESCE(process_code,'__all__'))`.
 * `--revert` deletes exactly these 6 rows (does not touch T1/T2 or any other CN).
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20261017_cn314110_ksb80_new_tooling_override.js --dry-run
 *   node api/engineer/mtc/db_migrations/20261017_cn314110_ksb80_new_tooling_override.js
 *   node api/engineer/mtc/db_migrations/20261017_cn314110_ksb80_new_tooling_override.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const CN = 'C31-04110';
const MACHINE = 'KS-B80';
const PROCESS_CODE = '1061';
// sds_excel_mapping param_keys are zero-padded (tool_dwg_no_T03, not _T3) — confirmed
// live against the mapping table. sds_machine_tool.tool_number is unpadded ("T1","T2"),
// a DIFFERENT table's own convention; do not copy that format here.
//
// 2026-10-17: moved from T03-T05 to T01-T03. First shipped at T03-T05 specifically to
// avoid T01/T02, which the KS-B80 whitelist reserves for the OLD family (4021-01/02) —
// but a real render screenshot showed T01/T02 printing completely empty for this CN
// (no family-name fallback), because Tooling Select has no formula/search rule for
// that family at all, so `tselectFallback` never attempts it and `valueMap.tooling`
// never gets an entry for those two slots. Since nothing auto-populates T01/T02 for
// THIS CN, nothing in applyDataToGrid's tooling block (section "3") overwrites this
// override there either — confirmed by re-rendering before/after. No code change
// needed; this is still a pure per-CN data override.
// 2026-10-17: dropped the "ID GRINDING " prefix from lpb.eng_tooling's full name —
// redundant on this sheet (process 1061 IS ID grind) and long enough to run into T02's
// own badge cell, which the Excel-style spill stops at (the next cell is occupied, not
// empty) and so clipped it with an ellipsis instead of spilling further.
const TOOLS = [
  { slot: 'T01', dwg: '4021-06-0006-01', name: 'HOLDER(CAM LOCK)' },
  { slot: 'T02', dwg: '4021-06-0006-02', name: 'NUT(CAM LOCK)' },
  { slot: 'T03', dwg: '4021-06-0006-03', name: 'GUIDE PIN' },
];
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

function rows() {
  const out = [];
  for (const t of TOOLS) {
    out.push({ param_key: `tool_dwg_no_${t.slot}`, param_value: t.dwg });
    out.push({ param_key: `tool_name_${t.slot}`, param_value: t.name });
  }
  return out;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    const data = rows();
    const keys = data.map((r) => r.param_key);

    if (revert) {
      console.log(`[revert] ${CN} @ ${MACHINE}/${PROCESS_CODE}: removing ${keys.length} override row(s)`);
      if (dryRun) { console.log('[revert] --dry-run — no changes written'); return; }
      await client.query('BEGIN');
      const del = await client.query(
        `DELETE FROM sds_parameter WHERE cn = $1 AND machine_type_name = $2 AND process_code = $3 AND param_key = ANY($4)`,
        [CN, MACHINE, PROCESS_CODE, keys]
      );
      await client.query('COMMIT');
      console.log(`[revert] removed ${del.rowCount} row(s)`);
      await recordRevert({ file: __filename });
      return;
    }

    console.log(`[seed] ${CN} @ ${MACHINE}/${PROCESS_CODE}: ${data.length} override row(s)`);
    data.forEach((r) => console.log(`  ${r.param_key} = ${r.param_value}`));
    if (dryRun) { console.log('[seed] --dry-run — no changes written'); return; }

    await client.query('BEGIN');
    for (const r of data) {
      await client.query(
        `INSERT INTO sds_parameter (cn, machine_type_name, param_key, param_value, process_code, updated_by)
         VALUES ($1, $2, $3, $4, $5, 'cn314110-new-tooling')
         ON CONFLICT (COALESCE(cn, '__machine_config__'), machine_type_name, param_key, COALESCE(process_code, '__all__'))
         DO UPDATE SET param_value = EXCLUDED.param_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [CN, MACHINE, r.param_key, r.param_value, PROCESS_CODE]
      );
    }
    await client.query('COMMIT');
    console.log('[seed] done');
    await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[seed] FAILED:', e.message); process.exit(1); });
