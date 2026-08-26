'use strict';

/**
 * KS-400B5 — tighten the OD work-size limit from φ40 to φ35.
 * ------------------------------------------------------------------------------
 * The stored bound says, in its own description, that φ40 "is a local limit and
 * deliberately exceeds that standard", the standard being RE33037 D whose scope is
 * KS-400B1–B4 and which does not cover B5 at all.
 *
 * That is true as far as it goes, but B5 is not undocumented: **TEMPLATE_B states
 * `OD ≦ φ35 MAX` in column C of both sheets that carry this machine** (BALL(3) and
 * BALL(5)). The φ40 was set without reference to the workbook's own figure.
 *
 * The factory plan agrees with the workbook, not with φ40. All 18 specced C/Ns whose
 * plan fits a KS-400B5 jig (4906-xx at process 1041) sit between **12.93 and 31.76**:
 *
 *     smallest  350688  3ABYT4V-601-T    OD 12.93
 *     largest   350548  3ZRBFB12XD-BA-T  OD 31.76
 *
 *     over φ35 (the workbook's bound): 0
 *     over φ40 (the stored bound):     0
 *
 * So tightening to φ35 removes NOTHING the shop actually runs — there is no false
 * negative to trade against — while withdrawing the machine from the **737 spec rows
 * that sit in 35 < OD ≤ 40**, none of which the plan has ever put on it.
 *
 * CONTRAST WITH 20260821d_ (KS-B22G ID), WHICH WENT THE OTHER WAY
 *
 * That one widened a bound because it was excluding 22 parts the plan demonstrably
 * runs; the trade was ~900 newly-eligible rows for 22 correct ones, and it needed the
 * owner's decision because "can this machine physically do it" is an engineering
 * question. This one is the easy direction: the bound is loose, the workbook and the
 * plan agree on the tighter figure, and nothing measurable is lost.
 *
 * Idempotent; `--revert` restores φ40 and the previous description.
 */

const { engPool } = require('../../../../instance/eng_db');

const MACHINE = 'KS-400B5';
const OLD_MAX = '40';
const NEW_MAX = '35';

const NEW_DESC =
  'OD ≤ φ35 — TEMPLATE_B column C on BALL(3) and BALL(5): "KS-400B5 (OD≦φ35MAX)". ' +
  'No RE33xxx standard covers KS-400B5 (RE33037 D scope is B1–B4), so the workbook is ' +
  'the authority here. Confirmed against the plan: all 18 specced C/Ns whose plan fits ' +
  'a 4906-xx jig run OD 12.93–31.76, none above 35, so the tighter bound loses nothing ' +
  'while withdrawing the machine from 737 spec rows in 35 < OD ≤ 40 that it has never ' +
  'been planned for. Was φ40, set as a local limit without reference to TEMPLATE_B. ' +
  'Measured 2026-08-21.';

const OLD_DESC =
  'No design standard covers KS-400B5 — RE33037 D scope is KS-400B1–B4. ' +
  'OD ≤ 40 is a local limit and deliberately exceeds that standard.';

const revert = process.argv.includes('--revert');

async function main() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT l.id, l.min_value, l.max_value
         FROM tooling_machine_limit l
         JOIN tooling_machine m ON m.id = l.machine_id
        WHERE m.machine_name = $1 AND l.input_var = 'OD'`, [MACHINE]);

    if (!rows.length) throw new Error(`no OD limit row for ${MACHINE}`);
    if (rows.length > 1) throw new Error(`${rows.length} OD limit rows for ${MACHINE} — resolve by hand`);

    const row = rows[0];
    const cur = String(Number(row.max_value));
    const want = revert ? OLD_MAX : NEW_MAX;

    console.log(`${MACHINE} OD limit max is currently ${cur}` +
                (row.min_value === null ? ' (no min)' : ` (min ${Number(row.min_value)})`));

    if (cur === String(Number(want))) {
      console.log(`already ${want} — nothing to do`);
      await client.query('COMMIT');
      return;
    }

    await client.query(
      `UPDATE tooling_machine_limit
          SET max_value = $1, max_inclusive = true, description = $2
        WHERE id = $3`,
      [want, revert ? OLD_DESC : NEW_DESC, row.id]);

    await client.query('COMMIT');
    console.log(`${revert ? 'reverted' : 'tightened'}: OD max ${cur} → ${want}`);
    if (!revert) {
      console.log(`undo with:  node api/engineer/mtc/db_migrations/20260821e_ks400b5_tighten_od_limit.js --revert`);
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
