'use strict';

/**
 * `sds_tooling_image` — put the DWG FAMILY into the NAME-keyed image key.
 * ------------------------------------------------------------------------------
 * A tooling image can be keyed by fixture NAME instead of DWG number, so ONE picture
 * serves every bore-ID band of a fixture whose full drawing changes per band. That is
 * the MSB surface grinders (PSG-64 / GS-64PFII / MSG-410), whose BASE / COLLET /
 * COLLET ARBOR / COLLAR all live under family `4547-01` as `4547-01-{band}-{comp}`.
 *
 * The key was the bare name — `NAME:COLLET` — and the renderer matched it against ANY
 * slot with that tool name. "Every band of this fixture" quietly became "every tool
 * called COLLET in the factory". Reported from the floor on 2026-08-26:
 *
 *     KL-20 T02 (4030-02, no Tool No for this part) printed the MSB COLLET picture.
 *
 * KL-20 is not an MSB grinder and nobody configured an image for it. Measured across
 * the whole config: **46 (machine, family) pairs** could receive one of the five NAME
 * images, and only the `4547-01-*` ones were ever meant to — XD-8 4858-22, KS-H70
 * 4691-19, KN-312A 4828-01/-02, J-WAVE 4879-06, LNC45/C200 4651-12, DTS-IS 4691-07 and
 * ~35 more were all in range. Families that happen to own a DWG-keyed image were
 * shielded by it; the rest printed the wrong fixture.
 *
 *     NAME:COLLET            ->  NAME:4547-01:COLLET
 *     NAME:COLLET ARBOR      ->  NAME:4547-01:COLLET ARBOR
 *     NAME:COLLAR            ->  NAME:4547-01:COLLAR
 *     NAME:BASE              ->  NAME:4547-01:BASE
 *     NAME:WORK FIXED BASE   ->  NAME:4547-01:WORK FIXED BASE
 *
 * WHY 4547-01 FOR ALL FIVE: the MSB whitelist is the only place these names appear as
 * band-varying drawings, and the config rows carrying them are `4547-01-0031-02`
 * (COLLET), `-03` (COLLET ARBOR), `-04` (COLLAR) and `4547-01-0037-01` (BASE) on
 * PSG-64 / GS-64PFII / MSG-410. WORK FIXED BASE is the same jig under the other spelling
 * — its image bytes are byte-identical to NAME:BASE's (19,856 both).
 *
 * A bare `NAME:<TOOL>` row left behind would simply stop matching, which is the fix
 * rather than a loss; renaming keeps the five pictures working where they belong.
 *
 * Idempotent (renames only what still carries the old key); `--revert` puts the bare
 * names back.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_tooling_image';
const FAMILY = '4547-01';
const NAMES = ['COLLET', 'COLLET ARBOR', 'COLLAR', 'BASE', 'WORK FIXED BASE'];

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const oldKey = (n) => `NAME:${n}`;
const newKey = (n) => `NAME:${FAMILY}:${n}`;

async function show(label) {
  const { rows } = await engPool.query(
    `SELECT tool_dwg_no, length(image_data) AS bytes FROM ${TABLE}
      WHERE tool_dwg_no LIKE 'NAME:%' ORDER BY 1`);
  console.log(`\n${label}`);
  if (!rows.length) console.log('   (no NAME-keyed images)');
  for (const r of rows) console.log(`   ${r.tool_dwg_no.padEnd(34)} ${r.bytes} bytes`);
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  await show(revert ? '-- before revert --' : '-- before --');
  if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

  const client = await engPool.connect();
  let moved = 0;
  try {
    await client.query('BEGIN');
    for (const n of NAMES) {
      const from = revert ? newKey(n) : oldKey(n);
      const to = revert ? oldKey(n) : newKey(n);
      // Skip when the destination already exists — re-running must not collide on the PK.
      const { rows } = await client.query(
        `SELECT 1 FROM ${TABLE} WHERE tool_dwg_no = $1`, [to]);
      if (rows.length) continue;
      const res = await client.query(
        `UPDATE ${TABLE} SET tool_dwg_no = $1 WHERE tool_dwg_no = $2`, [to, from]);
      if (res.rowCount) { moved += res.rowCount; console.log(`   ${from}  ->  ${to}`); }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  console.log(`\n${moved} image key(s) re-keyed`);
  await show(revert ? '-- after revert --' : '-- after --');

  if (revert) { await recordRevert({ file: __filename }); return; }
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260826e_sds_tooling_image_name_key_family.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
