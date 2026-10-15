'use strict';

/**
 * Re-seeds the Grinding Condition label scaffolding for PB Ring's 3
 * Centerless machines (HIGRIND1D, OC18BR150, OC20BR200) at the CORRECT
 * row numbers, copied read-only from their real counterparts' own
 * sds_parameter rows (HI-GRIND-1-D, OC-18BR-150, OC-20BR-200).
 *
 * User request (2026-10-15): "ใช้ parameter config ของ centerless ด้วยเลยได้ไหม?"
 * (use Centerless's own parameter config too?) — found why the admin UI
 * showed no usable fields after the Centerless grid-template swap two
 * commits ago: that swap only checked the T01-T20/header addresses
 * (confirmed shared via sds_excel_mapping), never the free-text condition
 * area's row numbers — and those are NOT shared. Confirmed live against
 * all 4 real Centerless-using machines (including OC-16A, not a PB Ring
 * machine, as a structural cross-check): the condition area runs rows
 * 30-55 (not 16-58 like "Standard"), with an entire section — "MACHINE
 * SETUP CONDITION" (OUTER DIAMETER OF WORKPIECE / SHIM / DISTANCE OF
 * BLADE AND GW / BLADE / RW ANGLE, rows 30-35) — that the Phase 5 xlsx
 * import never captured at all, because it only ever scanned rows 16-58.
 * The GW/RW spec area (gw_row_53-58) is unaffected — identical on both
 * layouts.
 *
 * Safe to replace outright: checked live before writing this — every
 * existing row_* key for these 3 machines in pbring_sds_parameter is
 * still `updated_by = 'import:pbring-sds-template-v3.4.2-labels'` (70/42/
 * 42 rows respectively), i.e. the original import's label scaffolding
 * with zero real admin-typed values on top. Nothing written by a person
 * is touched.
 *
 * Copies LABELS ONLY, never real data: a key whose paired `{key}_type`
 * equals 'value' is a real measured number on the real machine (e.g. real
 * OC-20BR-200's row_31_H = "Ø50 - 54", the actual diameter IT grinds) —
 * copying that would print one machine's production dimensions as if
 * they belonged to whatever PB Ring part is on the sheet. The `_type`
 * flag itself IS copied (so the cell still renders in the value style
 * once a PB Ring admin types a real number into it), just not its
 * current string value. is_header flags and the GW section's own labels
 * (gw_row_53-58, AN column only, same as before) are copied as-is.
 *
 * Idempotent (delete-then-copy, same end state on re-run); `--revert`
 * removes the relabeled rows. The old 16-58 rows are not restored by
 * revert — the migration deletes them going forward (they describe
 * Standard's layout, not Centerless's, and were never real data either).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const RELABEL_SOURCE = 'import:centerless-relabel-20261015';

// pbring machine_type_name -> its real-world counterpart in sds_parameter
const MACHINE_MAP = {
  HIGRIND1D: 'HI-GRIND-1-D',
  OC18BR150: 'OC-18BR-150',
  OC20BR200: 'OC-20BR-200',
};

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    for (const pbMachine of Object.keys(MACHINE_MAP)) {
      const { rowCount } = await engPool.query(
        `DELETE FROM pbring_sds_parameter
          WHERE cn IS NULL AND process_code IS NULL AND machine_type_name = $1 AND updated_by = $2`,
        [pbMachine, RELABEL_SOURCE]
      );
      console.log(`reverted: ${pbMachine} - ${rowCount} relabeled row(s) removed`);
    }
    await recordRevert({ file: __filename });
    return;
  }

  for (const [pbMachine, realMachine] of Object.entries(MACHINE_MAP)) {
    const client = await engPool.connect();
    try {
      await client.query('BEGIN');

      const { rowCount: deleted } = await client.query(
        `DELETE FROM pbring_sds_parameter
          WHERE cn IS NULL AND process_code IS NULL AND machine_type_name = $1
            AND updated_by = 'import:pbring-sds-template-v3.4.2-labels'`,
        [pbMachine]
      );

      const { rows: realRows } = await client.query(
        `SELECT param_key, param_value FROM sds_parameter
          WHERE cn IS NULL AND process_code IS NULL AND machine_type_name = $1
            AND (param_key LIKE 'row_%' OR param_key LIKE 'gw_row_%')`,
        [realMachine]
      );
      const byKey = new Map(realRows.map((r) => [r.param_key, r.param_value]));

      let inserted = 0;
      for (const { param_key: key, param_value: value } of realRows) {
        const typeKey = `${key}_type`;
        const isValueCell = byKey.get(typeKey) === 'value';
        const valueToCopy = isValueCell ? null : value; // skip the real machine's own measured number
        if (valueToCopy == null || valueToCopy === '') continue; // nothing to seed for this key
        await client.query(
          `INSERT INTO pbring_sds_parameter (cn, machine_type_name, param_key, param_value, process_code, updated_by)
           VALUES (NULL, $1, $2, $3, NULL, $4)
           ON CONFLICT (COALESCE(cn, '__machine_config__'), machine_type_name, param_key, COALESCE(process_code, '__all__'))
           DO UPDATE SET param_value = EXCLUDED.param_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
          [pbMachine, key, valueToCopy, RELABEL_SOURCE]
        );
        inserted++;
      }

      await client.query('COMMIT');
      console.log(`${pbMachine} <- ${realMachine}: deleted ${deleted} old (16-58) row(s), seeded ${inserted} label/unit/header row(s) at the real Centerless row numbers`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261015b_pbring_centerless_relabel.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
