'use strict';

/**
 * KS-B22G — widen the ID work-size limit from φ4.8–16 to φ4.0–19.7.
 * ------------------------------------------------------------------------------
 * The stored bound is RE33042 A §7 対象ワークサイズ, `ID φ4.8–φ16`. The factory plan
 * runs this machine from φ4.00 to φ19.62, so 22 of the 444 specced C/Ns whose plan
 * fits a KS-B22G jaw (4027-01) are excluded from a machine the shop demonstrably
 * uses for them.
 *
 * THIS IS THE SECOND TIME RE33042 A §7 HAS BEEN FOUND BEHIND PRACTICE. The first was
 * `W ≥ 14`, relaxed to `W ≥ 5` on the same kind of evidence (20260815o_). The ID
 * bound is a much smaller effect — 4.7 % of the machine's planned work against 60 %
 * for W — but the same conclusion: the standard is what needs revising.
 *
 * WHY THE EXCLUDED PARTS ARE NOT PLAN ERRORS
 *
 * Scoring the excluded group against the plan the same way as the included one:
 *
 *     passing the current limit    410 C/Ns   rank-1 240 · rank-2 127   top-2 90 %
 *     ID > 16, currently excluded   21 C/Ns   rank-1  17 · rank-2   2   top-2 90 %
 *     ID < 4.8, currently excluded   1 C/N    rank-1   1              top-2 100 %
 *
 * The excluded group behaves exactly like the machine's ordinary work, and all eight
 * jaw drawings it uses are on the shelf with real dimensions:
 *
 *     4027-01-0047 ×10 · -0046 ×3 · -0035 ×2 · -0044 ×2
 *     4027-01-0014 ×1  · -0065 ×1 · -0078 ×1 · -0043 ×1
 *
 * WHAT THE EVIDENCE DOES AND DOES NOT SAY — read before widening further
 *
 * 20 of the 21 parts above the bound are `ID = 19.050` exactly (¾"). The bands in
 * between carry no planned work at all:
 *
 *     16 < ID ≤ 17    102 spec rows    1 planned
 *     17 < ID ≤ 18    143              0
 *     18 < ID ≤ 19     60              0
 *     19 < ID ≤ 19.7  440             20
 *     19.7 < ID ≤ 20  134              0
 *
 * So this does NOT establish that the machine grinds any bore up to 19.7 — it
 * establishes that it grinds a specific standard size. The bound is set at 19.7
 * because `tooling_machine_limit` expresses a range and nothing else, and because a
 * limit is a NECESSARY condition, not a sufficient one: it says what cannot run here,
 * while the tooling search and the shop decide what actually does.
 *
 * The looseness is not new. The existing φ4.8–16 already admits **7,331 spec rows of
 * which only 412 are planned on this machine (5.6 %)**; widening adds ~900 eligible
 * rows to gain 22 correct ones. Leaving the bound where it is, by contrast, is a
 * definite error on 22 parts. If the floor later says the machine cannot take φ17–19
 * at all, the right fix is a tighter rule than a range — not a return to φ16, which
 * loses the ¾" family again.
 *
 * Idempotent; `--revert` restores φ4.8–16 exactly.
 */

const { engPool } = require('../instance/eng_db');

const MACHINE = 'KS-B22G';
const OLD = { min: '4.8', max: '16' };
const NEW = { min: '4.0', max: '19.7' };

const NEW_DESC =
  'ID φ4.0–φ19.7 — measured range of what this machine actually runs, not the standard. ' +
  'RE33042 A §7 says φ4.8–φ16, but of the 444 specced C/Ns whose factory plan fits a ' +
  'KS-B22G jaw (4027-01 in lpb.eng_r_pi_tool), 21 are above φ16 (20 of them at φ19.050 ' +
  'exactly, ¾") and 1 is at φ4.000. The excluded group scores top-2 90% against the plan — ' +
  'identical to the 410 that pass — and every jaw it uses is on the shelf. Bands 17–19 ' +
  'carry no planned work, so this is evidence for the ¾" family, not for a continuous ' +
  'range; the bound is a range only because the table expresses nothing else. ' +
  'Second time RE33042 A §7 has been found behind practice (cf. W>=14 -> W>=5, 20260815o_). ' +
  'Measured 2026-08-21. OD bound stays at the standard.';

const OLD_DESC = 'RE33042 A §7: ID φ4.8–φ16';

const revert = process.argv.includes('--revert');

async function main() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT l.id, l.min_value, l.max_value
         FROM tooling_machine_limit l
         JOIN tooling_machine m ON m.id = l.machine_id
        WHERE m.machine_name = $1 AND l.input_var = 'ID'`, [MACHINE]);

    if (!rows.length) throw new Error(`no ID limit row for ${MACHINE}`);
    if (rows.length > 1) throw new Error(`${rows.length} ID limit rows for ${MACHINE} — resolve by hand`);

    const row = rows[0];
    const cur = { min: String(Number(row.min_value)), max: String(Number(row.max_value)) };
    const want = revert ? OLD : NEW;
    const target = { min: String(Number(want.min)), max: String(Number(want.max)) };

    console.log(`${MACHINE} ID limit is currently ${cur.min}–${cur.max}`);

    if (cur.min === target.min && cur.max === target.max) {
      console.log(`already ${target.min}–${target.max} — nothing to do`);
      await client.query('COMMIT');
      return;
    }

    await client.query(
      `UPDATE tooling_machine_limit
          SET min_value = $1, max_value = $2, min_inclusive = true, max_inclusive = true,
              description = $3
        WHERE id = $4`,
      [want.min, want.max, revert ? OLD_DESC : NEW_DESC, row.id]);

    await client.query('COMMIT');
    console.log(`${revert ? 'reverted' : 'widened'}: ID ${cur.min}–${cur.max} → ${target.min}–${target.max}`);
    if (!revert) {
      console.log(`undo with:  node db_migrations/20260821d_ksb22g_widen_id_limit.js --revert`);
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
