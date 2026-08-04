'use strict';

// ── MTC → Project Board (Kanban) auto-intake ─────────────────────────────────
//
// A reusable, NON-HTTP helper that lets MTC workflows push a job onto the shared
// Kanban board as a card, and MOVE that card between lists as the job advances —
// without duplicating the req/res-coupled Card.CreateCard controller.
//
// Design principles:
//   • DECOUPLED from the kanban schema: we INSERT into the existing kb_* tables
//     (kb_card / kb_card_membership / kb_card_subscription / kb_action) using the
//     exact same columns Card.CreateCard writes, but own our OWN config + link
//     tables (mtc_board_config, mtc_board_card_link) so no kanban migration is
//     needed and their core tables are untouched.
//   • CONFIG-DRIVEN: which board/list a source drops into is stored in
//     mtc_board_config (per source_type), set by an admin — nothing hardcoded.
//     If a source is not configured or disabled, syncCard() is a silent no-op.
//   • IDEMPOTENT: mtc_board_card_link maps (source_type, source_ref) → card_id, so
//     one job maps to exactly one card. A stage change MOVES the existing card
//     instead of creating a duplicate; retries are safe.
//   • FAIL-OPEN: every path is wrapped so a board-sync failure NEVER breaks the
//     MTC workflow that called it (same discipline as searchService post-processors).
//     Errors are logged and swallowed; syncCard resolves to { ok:false, reason }.

const { engPool } = require('../../../../instance/eng_db');

const POSITION_STEP = 65536; // matches kanban_board/kanban_card append spacing

let _ready = null;
function ensureTables() {
  if (!_ready) {
    // Multi-statement DDL runs via the simple-query protocol (no params).
    _ready = engPool.query(`
      CREATE TABLE IF NOT EXISTS mtc_board_config (
        source_type     TEXT PRIMARY KEY,          -- 'tool_request' | 'sds_approval' | …
        board_id        INTEGER,                   -- target kb_board.id
        default_list_id INTEGER,                   -- fallback list for new cards
        stage_list_map  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { stageKey: listId }
        system_u_code   TEXT,                      -- creator_u_code (owner) for auto cards
        default_priority TEXT NOT NULL DEFAULT 'medium',
        enabled         BOOLEAN NOT NULL DEFAULT false,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mtc_board_card_link (
        source_type TEXT NOT NULL,
        source_ref  TEXT NOT NULL,
        card_id     INTEGER NOT NULL,
        board_id    INTEGER,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (source_type, source_ref)
      );
    `).catch((e) => { _ready = null; throw e; });
  }
  return _ready;
}

async function getConfig(sourceType) {
  await ensureTables();
  const r = await engPool.query(
    `SELECT * FROM mtc_board_config WHERE source_type = $1`, [sourceType]
  );
  return r.rows[0] || null;
}

// Upsert config (for a future admin UI). Returns the stored row.
async function setConfig(sourceType, patch = {}) {
  await ensureTables();
  const r = await engPool.query(
    `INSERT INTO mtc_board_config
       (source_type, board_id, default_list_id, stage_list_map, system_u_code, default_priority, enabled, updated_at)
     VALUES ($1,$2,$3,COALESCE($4,'{}'::jsonb),$5,COALESCE($6,'medium'),COALESCE($7,false),NOW())
     ON CONFLICT (source_type) DO UPDATE SET
       board_id        = COALESCE(EXCLUDED.board_id, mtc_board_config.board_id),
       default_list_id = COALESCE(EXCLUDED.default_list_id, mtc_board_config.default_list_id),
       stage_list_map  = COALESCE($4, mtc_board_config.stage_list_map),
       system_u_code   = COALESCE(EXCLUDED.system_u_code, mtc_board_config.system_u_code),
       default_priority= COALESCE($6, mtc_board_config.default_priority),
       enabled         = COALESCE($7, mtc_board_config.enabled),
       updated_at      = NOW()
     RETURNING *`,
    [
      sourceType,
      patch.board_id ?? null,
      patch.default_list_id ?? null,
      patch.stage_list_map != null ? JSON.stringify(patch.stage_list_map) : null,
      patch.system_u_code ?? null,
      patch.default_priority ?? null,
      patch.enabled ?? null,
    ]
  );
  return r.rows[0];
}

// Resolve the target list for a stage: explicit stage map wins, else default list.
function resolveListId(config, stageKey) {
  const map = config.stage_list_map || {};
  if (stageKey != null && map[stageKey] != null) return Number(map[stageKey]);
  return config.default_list_id != null ? Number(config.default_list_id) : null;
}

async function _nextPosition(client, listId) {
  const r = await client.query(
    `SELECT COALESCE(MAX(position),0)+$2 AS pos FROM kb_card WHERE list_id = $1`,
    [listId, POSITION_STEP]
  );
  return r.rows[0].pos;
}

// Insert a brand-new card mirroring Card.CreateCard's writes (card + owner
// membership + self-subscription + created action). Returns the card row.
async function _insertCard(client, { boardId, listId, creatorUCode, name, description, dueDate, priority }) {
  const position = await _nextPosition(client, listId);
  const { rows: [card] } = await client.query(
    `INSERT INTO kb_card
       (board_id, list_id, creator_u_code, card_type, position, name, description,
        due_date, is_private, list_changed_at, estimated_hours, priority, parent_id)
     VALUES ($1,$2,$3,'task',$4,$5,$6,$7,false,NOW(),0,$8,NULL)
     RETURNING *`,
    [boardId, listId, creatorUCode, position, name, description || null, dueDate || null, priority || 'medium']
  );
  await client.query(
    `INSERT INTO kb_card_membership (card_id, u_code, role) VALUES ($1,$2,'owner')
       ON CONFLICT DO NOTHING`,
    [card.id, creatorUCode]
  );
  await client.query(
    `INSERT INTO kb_card_subscription (card_id, u_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [card.id, creatorUCode]
  );
  await client.query(
    `INSERT INTO kb_action (card_id, board_id, u_code, action_type, action_data)
     VALUES ($1,$2,$3,'card_created',$4)`,
    [card.id, boardId, creatorUCode, JSON.stringify({ name, list_id: listId, auto_source: true })]
  );
  return card;
}

/**
 * Attach a deep link back to the source screen, so someone looking at the card can
 * jump straight to the page where the work is actually done.
 *
 * A link attachment rather than a line in the description: the description renders
 * as plain text (clicking it opens the editor), so a URL there is neither clickable
 * nor safe from being edited away. Attachments render as real anchors.
 *
 * Idempotent on (card_id, file_path) — this also runs on every move so a card
 * created before the link existed picks one up on its next stage change.
 */
async function _upsertLink(client, cardId, uCode, link) {
  if (!link || !link.url) return;
  const existing = await client.query(
    `SELECT id FROM kb_attachment WHERE card_id = $1 AND file_path = $2 AND attachment_type = 'link'`,
    [cardId, link.url]
  );
  if (existing.rows.length) return;
  await client.query(
    `INSERT INTO kb_attachment
       (card_id, creator_u_code, file_name, file_path, file_size, is_image, attachment_type, link_data)
     VALUES ($1,$2,$3,$4,0,false,'link',$5)`,
    [cardId, uCode, link.name || link.url, link.url, JSON.stringify({ url: link.url, name: link.name || link.url })]
  );
}

// Move an existing linked card to a new list (append to bottom) + log the move.
// No-op (returns the row) when the card is already on the target list.
async function _moveCard(client, cardId, targetListId, uCode) {
  const { rows: [card] } = await client.query(`SELECT * FROM kb_card WHERE id = $1`, [cardId]);
  if (!card) return { card: null, moved: false };
  if (Number(card.list_id) === Number(targetListId)) return { card, moved: false };

  const position = await _nextPosition(client, targetListId);
  const { rows: [updated] } = await client.query(
    `UPDATE kb_card SET list_id = $1, position = $2, list_changed_at = NOW(), updated_at = NOW()
      WHERE id = $3 RETURNING *`,
    [targetListId, position, cardId]
  );
  await client.query(
    `INSERT INTO kb_action (card_id, board_id, u_code, action_type, action_data)
     VALUES ($1,$2,$3,'card_moved',$4)`,
    [cardId, card.board_id, uCode, JSON.stringify({ from_list_id: card.list_id, to_list_id: targetListId, auto_source: true })]
  );
  return { card: updated, moved: true, fromListId: card.list_id };
}

/**
 * Create-or-move the board card for one MTC job. FAIL-OPEN — never throws.
 *
 * @param {object}  args
 * @param {object}  [args.io]          Socket.io instance (req.app.get('io')) for realtime; optional.
 * @param {string}  args.sourceType    e.g. 'tool_request' | 'sds_approval'
 * @param {string}  args.sourceRef     unique id of the job within its source (e.g. request id)
 * @param {string}  args.name          card title (used on create; updated on move)
 * @param {string}  [args.description]
 * @param {string|Date} [args.dueDate]
 * @param {string}  [args.priority]    'low'|'medium'|'high' (falls back to config default)
 * @param {string}  [args.stageKey]    key into config.stage_list_map (the workflow stage)
 * @param {{url:string,name?:string}} [args.link]  deep link back to the source screen,
 *                                     added as a link attachment (idempotent, also on move)
 * @param {boolean} [args.createOnly]  seed a card if the job has none, but never move an
 *                                     existing one. For backlog feeds (a report listing
 *                                     outstanding work) whose "stage" is only the starting
 *                                     point — without it, re-running the report would drag
 *                                     already-progressed cards back to the first list.
 * @returns {Promise<{ok:boolean, action?:'created'|'moved'|'noop', cardId?:number, reason?:string}>}
 */
async function syncCard(args) {
  const { io, sourceType, sourceRef } = args;
  try {
    if (!sourceType || sourceRef == null) return { ok: false, reason: 'missing_source' };
    const config = await getConfig(sourceType);
    if (!config || !config.enabled) return { ok: false, reason: 'disabled' };

    const listId = resolveListId(config, args.stageKey);
    if (!listId) return { ok: false, reason: 'no_target_list' };
    const boardId = config.board_id ?? null;
    const uCode = config.system_u_code || 'SYSTEM';
    const priority = args.priority || config.default_priority || 'medium';
    const ref = String(sourceRef);

    await ensureTables();
    const linkRes = await engPool.query(
      `SELECT card_id FROM mtc_board_card_link WHERE source_type = $1 AND source_ref = $2`,
      [sourceType, ref]
    );

    const client = await engPool.connect();
    try {
      await client.query('BEGIN');
      let result;
      if (linkRes.rows.length) {
        const cardId = linkRes.rows[0].card_id;
        // createOnly: the job already has a card, and where it sits now is the
        // board's business, not the feed's. Still refresh the link attachment.
        if (args.createOnly) {
          await _upsertLink(client, cardId, uCode, args.link);
          await client.query('COMMIT');
          return { ok: true, action: 'noop', cardId };
        }
        // Existing card → move to the stage's list (idempotent no-op if already there).
        const mv = await _moveCard(client, cardId, listId, uCode);
        if (!mv.card) {
          // Link points at a deleted card → drop the stale link, fall through to recreate.
          await client.query(`DELETE FROM mtc_board_card_link WHERE source_type=$1 AND source_ref=$2`, [sourceType, ref]);
          const card = await _insertCard(client, { boardId, listId, creatorUCode: uCode, name: args.name, description: args.description, dueDate: args.dueDate, priority });
          await _upsertLink(client, card.id, uCode, args.link);
          await client.query(
            `INSERT INTO mtc_board_card_link (source_type, source_ref, card_id, board_id) VALUES ($1,$2,$3,$4)`,
            [sourceType, ref, card.id, boardId]
          );
          result = { ok: true, action: 'created', cardId: card.id, _emit: { type: 'create', card, listId } };
        } else {
          await _upsertLink(client, cardId, uCode, args.link);
          result = {
            ok: true, action: mv.moved ? 'moved' : 'noop', cardId,
            _emit: mv.moved ? { type: 'move', card: mv.card, listId, fromListId: mv.fromListId } : null,
          };
        }
      } else {
        // No card yet → create and link.
        const card = await _insertCard(client, { boardId, listId, creatorUCode: uCode, name: args.name, description: args.description, dueDate: args.dueDate, priority });
        await _upsertLink(client, card.id, uCode, args.link);
        await client.query(
          `INSERT INTO mtc_board_card_link (source_type, source_ref, card_id, board_id) VALUES ($1,$2,$3,$4)
             ON CONFLICT (source_type, source_ref) DO NOTHING`,
          [sourceType, ref, card.id, boardId]
        );
        result = { ok: true, action: 'created', cardId: card.id, _emit: { type: 'create', card, listId } };
      }
      await client.query('COMMIT');

      // Best-effort realtime broadcast (outside the txn; guarded).
      try {
        if (io && boardId && result._emit) {
          const e = result._emit;
          if (e.type === 'create') {
            io.to(`board:${boardId}`).emit('cardCreate', { item: e.card, listId: Number(e.listId), actorUCode: uCode });
          } else if (e.type === 'move') {
            io.to(`board:${boardId}`).emit('cardUpdate', {
              item: { id: e.card.id, list_id: e.card.list_id, position: e.card.position },
              fromListId: e.fromListId, actorUCode: uCode,
            });
          }
        }
      } catch (_) { /* realtime is a nicety, never fatal */ }

      delete result._emit;
      return result;
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn(`[kanbanIntake] syncCard skipped (${sourceType}/${sourceRef}): ${err.message}`);
    return { ok: false, reason: 'error', error: err.message };
  }
}

module.exports = { syncCard, getConfig, setConfig, resolveListId, ensureTables };
