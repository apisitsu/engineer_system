'use strict';

/**
 * Same fix as 20261015b_, extended to OMIYA on the user's own domain
 * confirmation (2026-10-15): "OMIYA ก็คือ OC18BR150, OC20BR200 อยู่ที่ว่า
 * machine code จะเป็นอะไร... ก็คือใช้เทมเพลตเดียวกัน" — OMIYA is the same
 * centerless-grinder equipment family as the other three regardless of
 * which specific floor machine code it shows up under. Confirmed
 * consistent with what's already in the database: OMIYA's own import
 * source_sheet_name is 'cgm_omiya' (a machine-code-shaped prefix, not a
 * name), and it has zero pbring_sds_param/pbring_sds_condition rows of
 * its own to check against sds_machine_type_code the way the other three
 * were — there is nothing in the registry to look OMIYA up by, which is
 * exactly why this needed the user's own floor knowledge rather than a
 * live lookup.
 *
 * Source machine for the copy is OC-20BR-200, same as before — picked
 * arbitrarily, since 20261015b_'s own migration already confirmed all 4
 * real Centerless-using machines (HI-GRIND-1-D, OC-16A, OC-18BR-150,
 * OC-20BR-200) share byte-identical row numbering.
 *
 * Same safety check as 20261015b_: confirmed live before writing this —
 * OMIYA's 42 existing pbring_sds_parameter rows are still 100%
 * 'import:pbring-sds-template-v3.4.2-labels', zero real admin-typed
 * values. Same label-only copy rule (a key whose paired `_type` is
 * 'value' is skipped — that is the real OC-20BR-200's own measured
 * number, never printed as if it were OMIYA's).
 *
 * Idempotent; `--revert` removes the relabeled rows (old rows are not
 * restored — same reasoning as 20261015b_).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const RELABEL_SOURCE = 'import:centerless-relabel-20261015';
const PB_MACHINE = 'OMIYA';
const REAL_MACHINE = 'OC-20BR-200';

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    const { rowCount } = await engPool.query(
      `DELETE FROM pbring_sds_parameter
        WHERE cn IS NULL AND process_code IS NULL AND machine_type_name = $1 AND updated_by = $2`,
      [PB_MACHINE, RELABEL_SOURCE]
    );
    console.log(`reverted: ${PB_MACHINE} - ${rowCount} relabeled row(s) removed`);
    await recordRevert({ file: __filename });
    return;
  }

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount: deleted } = await client.query(
      `DELETE FROM pbring_sds_parameter
        WHERE cn IS NULL AND process_code IS NULL AND machine_type_name = $1
          AND updated_by = 'import:pbring-sds-template-v3.4.2-labels'`,
      [PB_MACHINE]
    );

    const { rows: realRows } = await client.query(
      `SELECT param_key, param_value FROM sds_parameter
        WHERE cn IS NULL AND process_code IS NULL AND machine_type_name = $1
          AND (param_key LIKE 'row_%' OR param_key LIKE 'gw_row_%')`,
      [REAL_MACHINE]
    );
    const byKey = new Map(realRows.map((r) => [r.param_key, r.param_value]));

    let inserted = 0;
    for (const { param_key: key, param_value: value } of realRows) {
      const typeKey = `${key}_type`;
      const isValueCell = byKey.get(typeKey) === 'value';
      const valueToCopy = isValueCell ? null : value;
      if (valueToCopy == null || valueToCopy === '') continue;
      await client.query(
        `INSERT INTO pbring_sds_parameter (cn, machine_type_name, param_key, param_value, process_code, updated_by)
         VALUES (NULL, $1, $2, $3, NULL, $4)
         ON CONFLICT (COALESCE(cn, '__machine_config__'), machine_type_name, param_key, COALESCE(process_code, '__all__'))
         DO UPDATE SET param_value = EXCLUDED.param_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [PB_MACHINE, key, valueToCopy, RELABEL_SOURCE]
      );
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`${PB_MACHINE} <- ${REAL_MACHINE}: deleted ${deleted} old row(s), seeded ${inserted} label/unit/header row(s) at the real Centerless row numbers`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261015c_pbring_omiya_centerless_relabel.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
