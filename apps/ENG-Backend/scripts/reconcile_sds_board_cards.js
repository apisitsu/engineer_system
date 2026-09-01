'use strict';
/**
 * reconcile_sds_board_cards.js — one-off: move each SDS-approval Kanban card to the
 * list that matches its sheet's CURRENT signature stage.
 *
 * WHY: a LIVE sign (POST /api/sds/v2/approval) moves the card; a BACKFILL sign
 * (POST /approval/backfill, or signUpsert from a script) deliberately does NOT touch
 * the board. After a bulk backfill the sheets are signed but their cards sit wherever
 * `syncNoStampBacklog` seeded them (To Do). This walks the existing links and syncs.
 *
 * SCOPE: source_type = 'sds_approval' ONLY (MTC board, id 25). No other board or
 * source is touched.
 *
 * Stage → list (from mtc_board_config.stage_list_map):
 *   approved → Done            checked → Check Approve
 *   prepared → In Progress     (unsigned) → left where it is
 * A card already in the right list is a no-op. Cards in archive/trash are skipped.
 *
 * Modes:
 *   (default)   DRY RUN — prints the transition plan, writes nothing
 *   --commit    execute via kanbanIntake.syncCard; writes scripts/_out/reconcile_sds_board_<ts>.json
 *   --revert [--manifest <path>]
 *               move each card back to its recorded from-list (only if it is still
 *               in the to-list this run put it in)
 *
 *   node scripts/reconcile_sds_board_cards.js
 *   node scripts/reconcile_sds_board_cards.js --commit
 *   node scripts/reconcile_sds_board_cards.js --revert
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');
const kanbanIntake = require('../api/engineer/mtc/services/kanbanIntake');

const SOURCE = 'sds_approval';
const STAGE_ORDER = ['prepared', 'checked', 'approved'];
const OUT_DIR = path.join(__dirname, '_out');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const COMMIT = has('--commit');
const REVERT = has('--revert');

const P = (n) => String(n).padStart(5);

async function loadLinks() {
  const { rows } = await engPool.query(
    `SELECT l.source_ref, l.card_id, c.list_id, kl.name AS list_name, kl.list_type
       FROM mtc_board_card_link l
       JOIN kb_card c   ON c.id = l.card_id
       LEFT JOIN kb_list kl ON kl.id = c.list_id
      WHERE l.source_type = $1`,
    [SOURCE]
  );
  return rows;
}

// best signature stage across every sds_approval row for this (cn, process_code)
async function sheetStage(cn, process_code) {
  const { rows } = await engPool.query(
    `SELECT
        bool_or(prepared_em_id IS NOT NULL) AS has_prepared,
        bool_or(checked_em_id  IS NOT NULL) AS has_checked,
        bool_or(approved_em_id IS NOT NULL) AS has_approved
       FROM sds_approval WHERE cn = $1 AND process_code = $2`,
    [cn, process_code]
  );
  const r = rows[0] || {};
  if (r.has_approved) return 'approved';
  if (r.has_checked)  return 'checked';
  if (r.has_prepared) return 'prepared';
  return null;
}

async function runReconcile() {
  const config = await kanbanIntake.getConfig(SOURCE);
  if (!config || !config.enabled) { console.error('mtc_board_config for sds_approval is missing/disabled — abort.'); process.exit(1); }
  const stageList = config.stage_list_map || {};
  const listName = {};
  {
    const { rows } = await engPool.query(`SELECT id, name FROM kb_list WHERE board_id = $1`, [config.board_id]);
    for (const r of rows) listName[r.id] = r.name;
  }

  const links = await loadLinks();
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  RECONCILE SDS-APPROVAL BOARD CARDS  (source_type=sds_approval) ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`DB           : ${process.env.PG_NEW_HOST}:${process.env.PG_NEW_PORT}/${process.env.PG_NEW_DB}`);
  console.log(`Board        : ${config.board_id}   stage→list ${JSON.stringify(stageList)}`);
  console.log(`Card links   : ${links.length}`);
  console.log(`Mode         : ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}\n`);

  const plan = [];          // { source_ref, card_id, cn, process_code, stage, from, to }
  const skipArchived = [];
  const transitions = new Map();   // "from → to" -> count
  let noopSame = 0, unsignedLeft = 0;

  for (const lk of links) {
    if (lk.list_type === 'archive' || lk.list_type === 'trash') { skipArchived.push(lk); continue; }
    const [cn, , process_code] = String(lk.source_ref).split('||');
    const stage = await sheetStage(cn, process_code);
    if (!stage) { unsignedLeft++; continue; }
    const to = Number(stageList[stage]);
    if (!to) continue;
    if (Number(lk.list_id) === to) { noopSame++; continue; }
    const key = `${listName[lk.list_id] || lk.list_id} → ${listName[to] || to}`;
    transitions.set(key, (transitions.get(key) || 0) + 1);
    plan.push({ source_ref: lk.source_ref, card_id: lk.card_id, cn, process_code, stage, from: Number(lk.list_id), to });
  }

  console.log('── Plan ──────────────────────────────────────────────────────────');
  console.log(`  cards to move            : ${P(plan.length)}`);
  console.log(`  already in correct list  : ${P(noopSame)}`);
  console.log(`  unsigned — left as is    : ${P(unsignedLeft)}`);
  console.log(`  archived/trash — skipped : ${P(skipArchived.length)}`);
  console.log('\n  transitions:');
  for (const [k, n] of [...transitions.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(34)} ${P(n)}`);

  console.log('\n── Sample (first 15) ─────────────────────────────────────────────');
  for (const p of plan.slice(0, 15)) {
    console.log(`  ${p.cn.padEnd(11)} ${p.process_code}  ${p.stage.padEnd(9)}  ${(listName[p.from] || p.from)} → ${listName[p.to] || p.to}`);
  }

  if (!COMMIT) { console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.'); return; }

  let moved = 0, failed = 0;
  const manifestRows = [];
  for (const p of plan) {
    const res = await kanbanIntake.syncCard({
      sourceType: SOURCE, sourceRef: p.source_ref, stageKey: p.stage, createOnly: false,
    });
    if (res && res.ok) {
      moved++;
      manifestRows.push({ source_ref: p.source_ref, card_id: p.card_id, stage: p.stage, from_list: p.from, to_list: p.to, action: res.action });
    } else {
      failed++;
      console.warn(`  ! ${p.cn} ${p.process_code}: ${res && res.reason}`);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mp = path.join(OUT_DIR, `reconcile_sds_board_${stamp}.json`);
  fs.writeFileSync(mp, JSON.stringify({
    created_at: new Date().toISOString(),
    db: `${process.env.PG_NEW_HOST}:${process.env.PG_NEW_PORT}/${process.env.PG_NEW_DB}`,
    board_id: config.board_id, stage_list_map: stageList,
    counts: { moved, failed, noop_same: noopSame, unsigned_left: unsignedLeft, archived_skipped: skipArchived.length },
    moves: manifestRows,
  }, null, 2));

  console.log(`\nCOMMITTED — ${moved} cards moved, ${failed} failed.`);
  console.log(`Manifest → ${path.relative(process.cwd(), mp)}`);
  console.log('Revert with:  node scripts/reconcile_sds_board_cards.js --revert');
}

async function runRevert() {
  let manifestPath = valOf('--manifest');
  if (!manifestPath) {
    const files = fs.existsSync(OUT_DIR)
      ? fs.readdirSync(OUT_DIR).filter(f => f.startsWith('reconcile_sds_board_') && f.endsWith('.json')).sort()
      : [];
    if (!files.length) { console.error('No reconcile_sds_board_*.json in scripts/_out/ — pass --manifest <path>.'); process.exit(1); }
    manifestPath = path.join(OUT_DIR, files[files.length - 1]);
  }
  const man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`\nREVERT from ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`  ${man.moves.length} moves recorded (committed ${man.created_at})`);
  console.log(`  Mode: ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}\n`);

  let back = 0, kept = 0;
  for (const m of man.moves) {
    // Only move it back if it is STILL where this run put it (nobody dragged it since).
    const guard = `WHERE id = $1 AND list_id = $2`;
    if (COMMIT) {
      const res = await engPool.query(
        `UPDATE kb_card
            SET list_id = $3,
                position = COALESCE((SELECT MAX(position) + 65536 FROM kb_card WHERE list_id = $3), 65536),
                updated_at = now()
          ${guard}`,
        [m.card_id, m.to_list, m.from_list]
      );
      back += res.rowCount; kept += (1 - res.rowCount);
    } else {
      const res = await engPool.query(`SELECT 1 FROM kb_card ${guard}`, [m.card_id, m.to_list]);
      back += res.rowCount; kept += (1 - res.rowCount);
    }
  }
  console.log(`  cards ${COMMIT ? 'moved back' : 'movable back'} : ${back}`);
  console.log(`  left as-is (moved since)   : ${kept}`);
  if (!COMMIT) console.log('\nDRY RUN — nothing written. Re-run with --revert --commit to apply.');
}

(async () => {
  try {
    if (REVERT) await runRevert();
    else await runReconcile();
  } finally {
    await engPool.end().catch(() => {});
  }
  process.exit(0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
