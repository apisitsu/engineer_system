'use strict';

/**
 * 20260815o_close_two_open_questions.js
 *
 * Changes no behaviour. Two questions were left open in the config's own `description`
 * fields, waiting on evidence that now exists; this writes the answers where the next
 * reader will find them, so neither gets re-opened from scratch.
 *
 * ── 1. KS-B22G's width bound: the standard is behind practice ───────────────
 * `20260814_conform_…` tightened W to RE33042 A §7's `W >= 14`, which removed KS-B22G
 * from 6,145 parts; the floor asked for `W >= 5` back and the description recorded the
 * question as "either the standard is behind practice or those parts were never run
 * here". The factory plan answers it. KS-B22G's shelf carries two tooling families,
 * 4027-01 and 4027-02; 453 C/Ns have one of them in `lpb.eng_r_pi_tool`, and of the 161
 * that also carry a finished width in the spec table:
 *
 *     W >= 14      64
 *     5 <= W < 14  97      ← 60 %, the narrowest at 5.97 (3MHT5V-603)
 *     W < 5         0
 *
 * Sixty per cent of the work the shop plans on this machine is narrower than its own
 * standard allows, and nothing at all is narrower than 5. `W >= 5` is not a concession
 * pending review — it is the measured floor of what the machine actually runs, and
 * RE33042 A §7 is what needs revising. The bound is unchanged; only the description is.
 *
 * ── 2. X-100 ARBOR B stays rank-only, now for a measured reason ─────────────
 * `20260815i_` shipped B rank-only after a 4-of-4 sample fell to 1-of-5 as a filter, with
 * the fourth simultaneous filter blamed. That was before `TB` was corrected (it was
 * computing off the race blank rather than the assembled SPH race), so the question was
 * worth re-asking against a proper answer key rather than a six-CN sample.
 *
 * Re-run over 249 planned arbors from `lpb.eng_r_pi_tool`, B now reproduces the arbor the
 * shop actually plans — `planned dim_b - computed B` has median 0.00, 58 % within 0.1 and
 * 93 % within 1.0. The formula is sound. Flipping it to a +/-1.0 filter was measured
 * directly and still loses:
 *
 *     B rank-only    72 % to top-2   (174 exact, 38 no-match)
 *     B as a filter  69 % to top-2   (163 exact, 47 no-match)
 *
 * Nine more parts get no arbor at all and eleven fewer are matched exactly. Three
 * simultaneous filters remains the ceiling on a 123-row shelf, and the corrected TB did
 * not change that — it only means B is now a good ranking signal rather than a noisy one.
 *
 * Idempotent. Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815o_close_two_open_questions.js --dry
 *   node api/engineer/mtc/db_migrations/20260815o_close_two_open_questions.js
 */

const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');

const KSB22G_W_DESC =
  'W >= 5 — the measured floor of what this machine actually runs, not a concession. ' +
  'RE33042 A §7 says W >= 14, but of the 161 specced C/Ns whose factory plan uses KS-B22G ' +
  'tooling (4027-01 / 4027-02 in lpb.eng_r_pi_tool), 97 are between 5 and 14 and none is ' +
  'below 5 — the narrowest is 5.97 (3MHT5V-603). Enforcing the standard removed the ' +
  'machine from 6,145 parts, 60% of its own planned work. The standard is behind practice; ' +
  'RE33042 A §7 is what needs revising. Measured 2026-08-15. ID/OD bounds stay at the standard.';

const X100_B_DESC_SUFFIX =
  ' | Rank-only, re-confirmed 2026-08-15 against 249 planned arbors from lpb.eng_r_pi_tool ' +
  'after TB was corrected to the assembled SPH race width: planned dim_b - computed B has ' +
  'median 0.00, 58% within 0.1, 93% within 1.0, so the formula is sound. Flipping B to a ' +
  '+/-1.0 filter was measured and loses — 69% to top-2 against 72% rank-only, with 47 ' +
  'no-matches against 38. Three simultaneous filters is still the ceiling on a 123-row shelf.';

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    log.push('── KS-B22G W limit ──');
    const w = await client.query(
      `UPDATE tooling_machine_limit l SET description = $1
         FROM tooling_machine m
        WHERE m.id = l.machine_id AND m.machine_name = 'KS-B22G' AND l.input_var = 'W'
          AND l.description IS DISTINCT FROM $1
      RETURNING l.min_value, l.max_value`, [KSB22G_W_DESC]);
    log.push(w.rowCount
      ? `   description updated (bound left at min=${w.rows[0].min_value}, max=${w.rows[0].max_value ?? 'none'})`
      : '   already recorded');

    log.push('\n── X-100 ARBOR B ──');
    const cur = (await client.query(
      `SELECT f.id, f.description, sr.tol_plus, sr.tol_minus, sr.is_match_dim
         FROM tooling_formula f
         JOIN tooling_machine m ON m.id = f.machine_id
         LEFT JOIN tooling_search_rule sr
                ON sr.machine_id = f.machine_id AND sr.tooling_name = f.tooling_name
               AND sr.output_key = f.output_key
        WHERE m.machine_name = 'X-100' AND f.tooling_name = 'ARBOR' AND f.output_key = 'B'`)).rows[0];
    if (!cur) throw new Error('X-100 ARBOR B not found — run 20260815i_ first');

    // The claim in the description is only true while the rule really is rank-only.
    if (cur.tol_plus !== null || cur.tol_minus !== null || cur.is_match_dim !== false) {
      throw new Error(
        `X-100 ARBOR B is not rank-only (tol_plus=${cur.tol_plus}, tol_minus=${cur.tol_minus}, ` +
        `is_match_dim=${cur.is_match_dim}) — fix the rule before recording that it is`);
    }
    if (cur.description?.includes('re-confirmed 2026-08-15')) {
      log.push('   already recorded');
    } else {
      await client.query(
        `UPDATE tooling_formula SET description = $1 WHERE id = $2`,
        [(cur.description || '') + X100_B_DESC_SUFFIX, cur.id]);
      log.push('   description updated; rule verified still rank-only');
    }

    if (DRY) { await client.query('ROLLBACK'); log.push('\n*** DRY RUN — ROLLED BACK. ***'); }
    else { await client.query('COMMIT'); log.push('\n*** COMMITTED. ***'); }
    console.log(log.join('\n'));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED — rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
}

run();
