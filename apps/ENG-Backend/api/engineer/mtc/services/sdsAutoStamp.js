'use strict';

/**
 * sdsAutoStamp.js — Auto Stamp engine.
 *
 * Runs off the back of every SDS coverage build
 * (sdsV2ReportController.kickCoverageBuild), immediately before the NO_STAMP
 * backlog intake. For each sheet whose ONLY gap is the signature —
 * `pending_reason === 'NO_STAMP'` and not a limit anomaly — it writes the missing
 * prepared / checked / approved rows to `sds_approval` using the responsible
 * person configured per role, tags them `source = 'auto'`, and moves the sheet's
 * board card the same way a live sign would.
 *
 * ONE global toggle gates the whole thing: `sds_auto_stamp_config.enabled`
 * (default false). With it off, `runAutoStamp` is a no-op.
 *
 * Design mirrors services/sdsBacklogIntake.js on purpose:
 *   • same `needsAttention` input (the coverage report's array)
 *   • same fail-open discipline — it NEVER throws; a failure here must not break
 *     the coverage report or block the backlog intake that runs after it
 *   • same MAX_*_PER_RUN guardrail — a run larger than the cap means the report
 *     changed shape, not that 300 sheets suddenly need signing → abort
 *
 * It is essentially a programmatic `POST /api/sds/v2/approval/backfill`: the write
 * primitives (`signUpsert` / `resolveSdsRev` / `getSheet` / `roleRec`) come from
 * sdsApprovalController so the row layout, rev resolution and sequential-order
 * semantics stay in exactly one place.
 */

const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');
const kanbanIntake = require('./kanbanIntake');
const { boardRef } = require('../utils/sdsBoardRef');
const { selectNoStampRows } = require('./sdsBacklogIntake');
const approval = require('../controllers/sdsApprovalController');

const SDS_SOURCE = 'sds_approval';
const ROLE_ORDER = ['prepared', 'checked', 'approved'];

// A run this large means the coverage report changed shape (or the scope config
// widened), not that this many sheets genuinely need auto-signing. Refuse rather
// than mass-stamp a shared table. Overridable per-install via
// sds_auto_stamp_config.max_per_run.
const MAX_SHEETS_PER_RUN = 200;

// ── Config table (single row, id = 1) ───────────────────────────────────────────
// CREATE IF NOT EXISTS lazily so a host that never ran the 20260904 migration
// still works — the migration only makes the row explicit + records itself.
let _cfgReady = null;
function ensureConfigTable() {
  if (!_cfgReady) {
    _cfgReady = engPool.query(`
      CREATE TABLE IF NOT EXISTS sds_auto_stamp_config (
        id             INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        enabled        BOOLEAN NOT NULL DEFAULT false,
        prepared_em_id TEXT, prepared_name TEXT,
        checked_em_id  TEXT, checked_name  TEXT,
        approved_em_id TEXT, approved_name TEXT,
        max_per_run    INT NOT NULL DEFAULT 200,
        updated_by     TEXT,
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      )`).catch((e) => { _cfgReady = null; throw e; });
  }
  return _cfgReady;
}

/**
 * Raw config row → { enabled, max_per_run, explicit:{role:{em_id,name}|null},
 * updated_by, updated_at }. `explicit` is the per-role OVERRIDE only — a role left
 * blank here falls back to the existing sds_approval_role_config (see resolveConfig).
 */
async function getConfig() {
  await ensureConfigTable();
  const { rows } = await engPool.query('SELECT * FROM sds_auto_stamp_config WHERE id = 1');
  const r = rows[0] || {};
  const signer = (emId, name) =>
    emId ? { em_id: String(emId), name: (name && String(name)) || String(emId) } : null;
  return {
    enabled: !!r.enabled,
    max_per_run: Number(r.max_per_run) > 0 ? Math.floor(Number(r.max_per_run)) : MAX_SHEETS_PER_RUN,
    explicit: {
      prepared: signer(r.prepared_em_id, r.prepared_name),
      checked: signer(r.checked_em_id, r.checked_name),
      approved: signer(r.approved_em_id, r.approved_name),
    },
    updated_by: r.updated_by || null,
    updated_at: r.updated_at || null,
  };
}

/**
 * The EFFECTIVE signer per role — what the engine actually stamps as:
 *
 *   1. the explicit `<role>_em_id` in sds_auto_stamp_config, if set (an override,
 *      and the only way to name someone who is not in the permit list); else
 *   2. the SINGLE enabled `match_type = 'em_id'` row in sds_approval_role_config
 *      for that role — "if exactly one person is permitted to sign it, that is who
 *      Auto Stamp signs as". Zero, or more than one, → the role is UNRESOLVED and
 *      the engine stops there (never guesses which permitted person signed).
 *
 * The seal needs a display NAME; role-config only stores an em_id, so it is looked
 * up from m_user_profile. A lookup miss falls back to the em_id string. Fail-open:
 * an unreadable role-config table just means "explicit overrides only".
 *
 * @returns getConfig() + { signers:{role:{em_id,name,from}|null},
 *                          role_config_candidates:{role:[em_id]}, unresolved:[role] }
 */
async function resolveConfig() {
  const cfg = await getConfig();

  const permitByRole = { prepared: [], checked: [], approved: [] };
  try {
    const { rows } = await engPool.query(
      `SELECT role, match_value FROM ${TABLES.SDS_APPROVAL_ROLE_CONFIG}
        WHERE enabled = true AND match_type = 'em_id' AND match_value IS NOT NULL`);
    for (const row of rows) {
      if (permitByRole[row.role]) permitByRole[row.role].push(String(row.match_value));
    }
  } catch (_) { /* table missing / unreadable → explicit overrides only */ }

  const wantNames = new Set();
  const signers = {};
  for (const role of ROLE_ORDER) {
    if (cfg.explicit[role]) { signers[role] = { ...cfg.explicit[role], from: 'explicit' }; continue; }
    const cand = [...new Set(permitByRole[role])];
    if (cand.length === 1) { signers[role] = { em_id: cand[0], name: null, from: 'role_config' }; wantNames.add(cand[0]); }
    else signers[role] = null;
  }

  if (wantNames.size) {
    let nameOf = {};
    try {
      const { rows } = await engPool.query(
        'SELECT u_code, u_name FROM m_user_profile WHERE u_code = ANY($1)', [[...wantNames]]);
      nameOf = Object.fromEntries(rows.map((x) => [String(x.u_code), x.u_name]));
    } catch (_) { /* fall back to the em_id string below */ }
    for (const role of ROLE_ORDER) {
      if (signers[role] && !signers[role].name) signers[role].name = nameOf[signers[role].em_id] || signers[role].em_id;
    }
  }

  return {
    ...cfg,
    signers,
    role_config_candidates: permitByRole,
    unresolved: ROLE_ORDER.filter((role) => !signers[role]),
  };
}

// Whitelisted columns — the keys are interpolated into the UPDATE, so this list is
// the only thing that may reach the SQL string. Values are always parameterised.
const WRITABLE = [
  'enabled',
  'prepared_em_id', 'prepared_name',
  'checked_em_id', 'checked_name',
  'approved_em_id', 'approved_name',
  'max_per_run',
];

/**
 * Patch the single config row. Only keys present in `patch` are touched, so a UI
 * can send just `{ enabled: true }` or just one signer. An empty string / null for
 * a signer field CLEARS it (which is how "remove the responsible person" works).
 */
async function setConfig(patch = {}, updatedBy = null) {
  await ensureConfigTable();
  await engPool.query("INSERT INTO sds_auto_stamp_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING");

  const sets = [];
  const vals = [];
  for (const k of WRITABLE) {
    if (!(k in patch)) continue;
    let v;
    if (k === 'enabled') v = !!patch[k];
    else if (k === 'max_per_run') v = Number(patch[k]) > 0 ? Math.floor(Number(patch[k])) : MAX_SHEETS_PER_RUN;
    else v = (patch[k] === '' || patch[k] == null) ? null : String(patch[k]).trim();
    vals.push(v);
    sets.push(`${k} = $${vals.length}`);
  }
  vals.push(updatedBy || null);
  sets.push(`updated_by = $${vals.length}`);
  sets.push('updated_at = now()');

  await engPool.query(`UPDATE sds_auto_stamp_config SET ${sets.join(', ')} WHERE id = 1`, vals);
  return resolveConfig();
}

// Why a sheet in scope produced no writes — surfaced in the dry-run / manual-run
// summary so an admin can see WHY (missing signer vs already done) without diffing.
function sheetSkipReason(sheet, cfg) {
  for (const role of ROLE_ORDER) {
    if (approval.roleRec(sheet, role)) continue;
    return cfg.signers[role] ? 'nothing_written' : `no_signer:${role}`;
  }
  return 'already_complete';
}

/**
 * Auto-stamp every NO_STAMP sheet in `needsAttention`, if the global toggle is on.
 *
 * @param {object[]} needsAttention  the coverage report's `needsAttention` array
 * @param {object}   [opts]
 * @param {object}   [opts.io]       socket.io instance (realtime board updates)
 * @param {boolean}  [opts.dryRun]   evaluate + report, write nothing
 * @returns {Promise<object>} summary — never rejects
 */
async function runAutoStamp(needsAttention = [], opts = {}) {
  const { io = null, dryRun = false } = opts;
  const summary = {
    ok: true, enabled: false, dryRun,
    candidates: 0, sheetsChanged: 0, rolesWritten: 0,
    stamped: [], skipped: [], errors: [],
  };

  try {
    const cfg = await resolveConfig();
    summary.enabled = cfg.enabled;
    if (!cfg.enabled) return { ...summary, reason: 'disabled' };

    // Exactly the rows the NO_STAMP backlog seeds — tool + Excel config complete,
    // signature the only thing missing, limit anomalies excluded. Shared selector
    // so the two feeds can never disagree on what "signature-only" means.
    const rows = selectNoStampRows(needsAttention);
    summary.candidates = rows.length;
    if (!rows.length) return summary;

    if (rows.length > cfg.max_per_run) {
      console.warn(`[sdsAutoStamp] ${rows.length} candidates exceeds max_per_run (${cfg.max_per_run}) — skipped`);
      return { ...summary, ok: false, reason: 'too_many_candidates' };
    }

    try { await approval.ensureApprovalTables(); } catch (_) { /* fail-open — writes below will surface it per-row */ }

    for (const r of rows) {
      try {
        const sds_rev = await approval.resolveSdsRev(r.cn, r.machine_type_name);
        const sheet = await approval.getSheet(r.cn, r.machine_type_name, r.process_code, sds_rev);

        const wrote = [];
        for (const role of ROLE_ORDER) {
          if (approval.roleRec(sheet, role)) continue;      // already signed (any source) — leave it, keep going
          const person = cfg.signers[role];
          if (!person) break;                               // no responsible person configured → stop here, never skip ahead
          if (!dryRun) {
            await approval.signUpsert({
              cn: r.cn, machine_type_name: r.machine_type_name, process_code: r.process_code,
              role, sds_rev,
              em_id: person.em_id, signer_name: person.name, dept: null,
              signed_at: null,                              // → now()
              source: 'auto', created_by: 'AUTO_STAMP',
            });
          }
          wrote.push(role);
        }

        if (!wrote.length) {
          summary.skipped.push({
            cn: r.cn, machine_type_name: r.machine_type_name, process_code: r.process_code,
            reason: sheetSkipReason(sheet, cfg),
          });
          continue;
        }

        summary.sheetsChanged += 1;
        summary.rolesWritten += wrote.length;
        summary.stamped.push({
          cn: r.cn, machine_type_name: r.machine_type_name, process_code: r.process_code, roles: wrote,
        });

        if (!dryRun) {
          // Move the sheet's card to the list for the last role written (the intake
          // creates it if missing). AWAITED — so a card is in its final list before
          // the NO_STAMP backlog intake that runs after this even looks at it, and so
          // the manual POST /auto-stamp response reflects the board move. Fail-open:
          // a board problem never unwinds the signature already written above.
          const stage = wrote[wrote.length - 1];
          try {
            const ref = await boardRef(r.cn, r.machine_type_name, r.process_code);
            await kanbanIntake.syncCard({
              io,
              sourceType: SDS_SOURCE,
              sourceRef: ref,
              stageKey: stage,
              name: `SDS ${r.cn} · ${r.machine_type_name} · ${r.process_code}`,
              description: `Auto-stamped ${wrote.join(', ')} by the configured signer(s).`,
              link: {
                url: approval.signPageUrl(r.cn, r.machine_type_name, r.process_code),
                name: `Open SDS ${r.cn}`,
              },
            });
          } catch (e) {
            console.warn('[sdsAutoStamp] board sync failed:', e.message);
          }
        }
      } catch (e) {
        summary.errors.push({ cn: r.cn, error: e.message });
      }
    }

    if (!dryRun && summary.sheetsChanged) {
      console.log(`[sdsAutoStamp] stamped ${summary.rolesWritten} role(s) across ${summary.sheetsChanged} sheet(s); ` +
        `${summary.skipped.length} skipped, ${summary.errors.length} error(s)`);
    }
    return summary;
  } catch (err) {
    console.warn('[sdsAutoStamp] run skipped:', err.message);
    return { ...summary, ok: false, reason: 'error', error: err.message };
  }
}

module.exports = {
  runAutoStamp,
  getConfig,
  resolveConfig,
  setConfig,
  ensureConfigTable,
  sheetSkipReason,
  ROLE_ORDER,
  MAX_SHEETS_PER_RUN,
};
