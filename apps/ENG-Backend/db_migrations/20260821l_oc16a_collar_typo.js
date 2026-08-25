'use strict';

/**
 * OC-16A — correct the COLLAR drawing typo `4561-11-0061` → `4560-11-0061`.
 * ------------------------------------------------------------------------------
 * `tooling_oc16a` holds the COLLAR shelf as a contiguous run, and exactly one row
 * carries a different family prefix:
 *
 *     4560-11-0060   dim 27.5 / 22   / 12
 *     4561-11-0061   dim 26   / 22   / 20    ← the odd one out
 *     4560-11-0062   dim 11.5 /  9.5 /  6
 *     4560-11-0063   dim 18   / 14   /  8
 *
 * Three things say it is a typo rather than a real drawing:
 *
 *   • The factory plan has **no `4561-11` row at all**, on any process, while it
 *     does plan `4560-11-0060` and `4560-11-0062` — the neighbours on either side.
 *   • `4561` is not an OC-16A family. TEMPLATE_B files it under GI-20N on the
 *     ROLLER BODY sheet (YATOI `4561-05`, NUT `4561-06`). `4560` is OC-16A's, and
 *     the SDS registry agrees — machine_type_code `560` ↔ family `4560`.
 *   • `4560-11-0061` does not exist on the shelf, so the run has a hole exactly
 *     where this row would sit.
 *
 * NO BEHAVIOUR CHANGES TODAY. The plan does not call for `-0061`, so nothing selects
 * it either before or after. This corrects a wrong number sitting in the shelf, so
 * that a family-based join or an SDS sheet cannot pick it up as a `4561` tool.
 *
 * Checked before writing: `4560-11-0061` is absent (no collision), no row in
 * `tooling_partno_map` references `4561-11`, and `tooling_oc16a` is the only
 * inventory table holding a `4561` number at all (1 row — this one).
 *
 * Idempotent; `--revert` puts the typo back.
 */

const { engPool } = require('../instance/eng_db');

const TABLE = 'tooling_oc16a';
const WRONG = '4561-11-0061';
const RIGHT = '4560-11-0061';

const revert = process.argv.includes('--revert');
const from = revert ? RIGHT : WRONG;
const to = revert ? WRONG : RIGHT;

async function main() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const { rows: target } = await client.query(
      `SELECT id, tooling_name, tooling_no, dim_a, dim_b, dim_c
         FROM ${TABLE} WHERE tooling_no = $1 FOR UPDATE`, [from]);

    if (!target.length) {
      const { rows: already } = await client.query(
        `SELECT count(*)::int n FROM ${TABLE} WHERE tooling_no = $1`, [to]);
      console.log(already[0].n
        ? `already "${to}" — nothing to do`
        : `neither "${from}" nor "${to}" found in ${TABLE} — nothing to do`);
      await client.query('COMMIT');
      return;
    }
    if (target.length > 1) throw new Error(`${target.length} rows match "${from}" — resolve by hand`);

    const { rows: clash } = await client.query(
      `SELECT count(*)::int n FROM ${TABLE} WHERE tooling_no = $1`, [to]);
    if (clash[0].n) throw new Error(`"${to}" already exists — would duplicate`);

    const r = target[0];
    console.log(`${TABLE} id=${r.id} · ${r.tooling_name} · dim ${r.dim_a}/${r.dim_b}/${r.dim_c}`);
    console.log(`   ${from} → ${to}`);

    await client.query(`UPDATE ${TABLE} SET tooling_no = $1 WHERE id = $2`, [to, r.id]);

    await client.query('COMMIT');
    console.log(`\n${revert ? 'reverted' : 'corrected'} 1 row`);
    if (!revert) {
      console.log(`undo with:  node db_migrations/20260821l_oc16a_collar_typo.js --revert`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
