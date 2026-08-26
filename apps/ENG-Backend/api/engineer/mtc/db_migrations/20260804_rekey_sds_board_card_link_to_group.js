/**
 * Migration: re-key `mtc_board_card_link` rows for `sds_approval` onto the group label.
 *
 * ── Why ────────────────────────────────────────────────────────────────────────
 * A board card's key is `<cn>||<machine>||<process_code>`. Two producers write it:
 *   · sdsApprovalController, on a live sign — using whichever machine the signer
 *     picked, which for a grouped machine is a specific MEMBER (e.g. TSG-300ZNC);
 *   · sdsBacklogIntake, from the coverage report — using the group's REPRESENTATIVE
 *     (e.g. TSG-300W), because the report deduplicates a group into one requirement.
 *
 * Those disagree, so the same Setup Data Sheet would get two cards: one seeded as a
 * NO_STAMP backlog item and another created when someone signs it. Confirmed against
 * live data before writing this — C32-04055 was already carded as `TSG-300ZNC` while
 * the report offered it as `TSG-300W`.
 *
 * Both sides now route the machine segment through `utils/sdsBoardRef.boardRef`,
 * which normalises to the GROUP LABEL (`TSG-300W/TSG-300ZNC`). Cards linked before
 * that change still carry the old member-named key and would be orphaned — the
 * backlog would create a duplicate beside them. This rewrites them in place.
 *
 * The group label is used rather than the report's representative because the
 * representative is whichever member happens to hold the Excel config; it moves when
 * config moves, and a key that moves orphans cards all over again.
 *
 * ── Safety ─────────────────────────────────────────────────────────────────────
 * Idempotent: a row already on its normalised key is left alone. Only ungrouped-name
 * rows change, and only the key — card_id, board_id and the card itself are untouched.
 * If the normalised key is somehow already taken by a DIFFERENT card, the row is
 * reported and skipped rather than merged, since collapsing two real cards into one
 * is not reversible.
 *
 * Run: node api/engineer/mtc/db_migrations/20260804_rekey_sds_board_card_link_to_group.js [--dry]
 */
'use strict';

require('dotenv').config();
const { engPool } = require('../../../../instance/eng_db');
const { boardRef } = require('../utils/sdsBoardRef');

const SOURCE = 'sds_approval';

async function run({ dry = false } = {}) {
  const { rows } = await engPool.query(
    `SELECT source_ref, card_id FROM mtc_board_card_link WHERE source_type = $1 ORDER BY card_id`,
    [SOURCE]
  );
  console.log(`${rows.length} ${SOURCE} link row(s)`);

  const stats = { unchanged: 0, rekeyed: 0, conflict: 0, malformed: 0 };

  for (const row of rows) {
    const parts = row.source_ref.split('||');
    if (parts.length !== 3) {
      console.warn(`  ! malformed key, skipped: ${row.source_ref}`);
      stats.malformed += 1;
      continue;
    }
    const [cn, machine, processCode] = parts;
    const next = await boardRef(cn, machine, processCode);
    if (next === row.source_ref) {
      stats.unchanged += 1;
      continue;
    }

    const taken = await engPool.query(
      `SELECT card_id FROM mtc_board_card_link WHERE source_type = $1 AND source_ref = $2`,
      [SOURCE, next]
    );
    if (taken.rows.length && String(taken.rows[0].card_id) !== String(row.card_id)) {
      console.warn(`  ! ${row.source_ref} → ${next} already held by card ${taken.rows[0].card_id} (this row is card ${row.card_id}) — skipped, merge by hand`);
      stats.conflict += 1;
      continue;
    }

    console.log(`  ${dry ? '[dry] ' : ''}card ${row.card_id}: ${row.source_ref} → ${next}`);
    if (!dry) {
      await engPool.query(
        `UPDATE mtc_board_card_link SET source_ref = $1 WHERE source_type = $2 AND source_ref = $3`,
        [next, SOURCE, row.source_ref]
      );
    }
    stats.rekeyed += 1;
  }

  console.log(`\ndone: ${JSON.stringify(stats)}${dry ? ' (dry run — nothing written)' : ''}`);
  return stats;
}

if (require.main === module) {
  run({ dry: process.argv.includes('--dry') })
    .then(() => engPool.end())
    .catch((e) => { console.error(e); return engPool.end().then(() => process.exit(1)); });
}

module.exports = { run };
