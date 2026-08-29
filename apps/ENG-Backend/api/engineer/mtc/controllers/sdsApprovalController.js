'use strict';

/**
 * sdsApprovalController.js — SDS Prepared / Checked / Approved sign records.
 *
 * Mounted at /api/sds/v2/approval. Granularity = ONE ROW PER SHEET, keyed by
 * (cn, machine_type_name, process_code, sds_rev). Each role lives in its own set of
 * columns on that single row (prepared_* / checked_* / approved_*) — like the old
 * approval sheet had Prepared/Checked/Approved side by side — so a fully-signed SDS
 * is one row, not three. sds_rev is the SDS document revision (resolved server-side
 * from sds_parameter param_key 'sds_rev'), NOT the part drawing rev — so the renderer
 * and the sign endpoints always agree on the rev without the client sending it.
 *
 * Identity (em_id / name / dept) + timestamp are captured from the JWT / server when
 * the signer presses Sign. The PDF seal is generated from these columns (see
 * utils/stampSeal + sdsV2HeadlessController).
 *
 * Design:
 *  - role permission is CONFIGURABLE via sds_approval_role_config (by department /
 *    role / feature_perm / em_id / any). Admins (dept|role 'AD') may always sign.
 *  - LIVE sign (POST /) enforces order prepared→checked→approved and stamps now().
 *  - BACKFILL (POST /backfill, isAdmin) bypasses order and takes a custom signer +
 *    signed_at, for recording historical approvals. Tagged <role>_source='backfill'.
 *  - REVOKE (DELETE /?cn=&machine_type_name=&process_code=&role=) clears that one
 *    role's columns (admin, or the signer clearing their own). When the last role on
 *    a sheet is cleared the now-empty row is deleted.
 *
 * NOTE (wide vs long): this layout keeps no per-signature history — re-signing or
 * revoking overwrites/clears the role's columns in place. That is the intended
 * trade-off for a compact one-row-per-sheet table.
 */

const express = require('express');
const { engPool } = require('../../../../instance/eng_db');
const { isAdmin } = require('../../../../middleware/mtcAuth');
const { TABLES } = require('../mtcConstants');
const { buildSealSvg, buildSealDataUri, toSealName } = require('../utils/stampSeal');
// Auto-intake: mirror each SDS approval sheet onto the shared Kanban board, moving
// the card as it advances prepared→checked→approved. Fail-open (never blocks sign).
const kanbanIntake = require('../services/kanbanIntake');
const { boardRef, groupMembers } = require('../utils/sdsBoardRef');
const SDS_SOURCE = 'sds_approval';

// Deep link to the Setup Data Sheet screen with the sheet already opened at the
// sign panel. Absolute when FRONTEND_BASE_URL is set; otherwise relative, which
// still resolves correctly because the board and the SDS page share an origin.
const SDS_PAGE_PATH = '/eng/mtc_eng/sds-v2';
const signPageUrl = (cn, machine_type_name, process_code) => {
  const base = (process.env.FRONTEND_BASE_URL || '').replace(/\/+$/, '');
  const qs = new URLSearchParams({ cn, machine: machine_type_name, process: process_code });
  return `${base}${SDS_PAGE_PATH}?${qs}`;
};

const router = express.Router();

const T = TABLES.SDS_APPROVAL;
const TC = TABLES.SDS_APPROVAL_ROLE_CONFIG;
const ROLE_ORDER = ['prepared', 'checked', 'approved'];

// ── User attribute helpers (mirror middleware/mtcAuth) ───────────────────────
const deptOf = (x) => (x && (x.department || x.u_department)) || '';
const roleOf = (x) => (x && (x.role || x.u_role)) || '';
const isAdminUser = (x) => deptOf(x) === 'AD' || roleOf(x) === 'AD';
const revKey = (v) => (v == null ? '' : String(v).trim());

// Per-role column names. `role` is always validated against ROLE_ORDER before this
// is used, so the interpolated names are a fixed whitelist (no user input in SQL).
const roleCols = (role) => ({
  em_id:  `${role}_em_id`,
  name:   `${role}_name`,
  dept:   `${role}_dept`,
  at:     `${role}_at`,
  source: `${role}_source`,
});

// Extract one role's signature from a sheet row → { em_id, signer_name, dept,
// signed_at, source } or null when that role is unsigned.
function roleRec(row, role) {
  if (!row) return null;
  const emId = row[`${role}_em_id`];
  if (!emId) return null;
  return {
    em_id: emId,
    signer_name: row[`${role}_name`] || '',
    dept: row[`${role}_dept`] || null,
    signed_at: row[`${role}_at`] || null,
    source: row[`${role}_source`] || null,
  };
}
const roleMap = (row) => {
  const m = {};
  for (const r of ROLE_ORDER) { const rec = roleRec(row, r); if (rec) m[r] = rec; }
  return m;
};

// ── Lazy schema (CREATE IF NOT EXISTS once) — also called by the migration ───
let _ensured = null;
function ensureApprovalTables() {
  if (_ensured) return _ensured;
  _ensured = (async () => {
    // Drop a legacy long-format sds_approval (one row PER ROLE — it had a 'role'
    // column) so the wide one-row-per-sheet schema below can take its place. Safe:
    // the long format never carried production approvals.
    await engPool.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = '${T}' AND column_name = 'role') THEN
          DROP TABLE IF EXISTS ${T};
        END IF;
      END $$;`);
    await engPool.query(`
      CREATE TABLE IF NOT EXISTS ${T} (
        id                SERIAL PRIMARY KEY,
        cn                TEXT NOT NULL,
        machine_type_name TEXT NOT NULL,
        process_code      TEXT NOT NULL,
        sds_rev           TEXT,
        prepared_em_id    TEXT, prepared_name TEXT, prepared_dept TEXT, prepared_at TIMESTAMPTZ, prepared_source TEXT,
        checked_em_id     TEXT, checked_name  TEXT, checked_dept  TEXT, checked_at  TIMESTAMPTZ, checked_source  TEXT,
        approved_em_id    TEXT, approved_name TEXT, approved_dept TEXT, approved_at TIMESTAMPTZ, approved_source TEXT,
        created_by        TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    // One row per (cn, machine, process, rev).
    await engPool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_${T}_sheet
        ON ${T} (cn, machine_type_name, process_code, COALESCE(sds_rev,''))`);
    await engPool.query(`
      CREATE INDEX IF NOT EXISTS idx_${T}_lookup
        ON ${T} (cn, machine_type_name, process_code)`);
    await engPool.query(`
      CREATE TABLE IF NOT EXISTS ${TC} (
        id          SERIAL PRIMARY KEY,
        role        TEXT NOT NULL CHECK (role IN ('prepared','checked','approved')),
        match_type  TEXT NOT NULL CHECK (match_type IN ('any','department','role','feature_perm','em_id')),
        match_value TEXT,
        enabled     BOOLEAN NOT NULL DEFAULT true,
        note        TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
  })().catch((e) => { _ensured = null; throw e; });
  return _ensured;
}

router.use(async (req, res, next) => {
  try { await ensureApprovalTables(); next(); }
  catch (e) { console.error('sdsApproval ensure tables:', e.message); res.status(500).json({ success: false, error: 'schema init failed' }); }
});

// ── Permission: may this user sign this role? ────────────────────────────────
async function getRoleConfig() {
  const { rows } = await engPool.query(`SELECT id, role, match_type, match_value, enabled, note FROM ${TC} ORDER BY role, id`);
  return rows;
}
function userCanSign(user, role, cfgRows) {
  if (isAdminUser(user)) return true;                 // admin override
  const rows = cfgRows.filter((r) => r.role === role && r.enabled);
  if (rows.length === 0) return false;                // no config + not admin → deny
  const dept = deptOf(user), rl = roleOf(user);
  const perms = Array.isArray(user.perms) ? user.perms : [];
  return rows.some((r) => {
    switch (r.match_type) {
      case 'any':          return true;
      case 'department':   return r.match_value === dept;
      case 'role':         return r.match_value === rl;
      case 'feature_perm': return perms.includes(r.match_value);
      case 'em_id':        return String(r.match_value) === String(user.empno);
      default:             return false;
    }
  });
}

// Resolve the Setup Data Sheet revision for a CN+machine the SAME way the PDF
// renderer does (sds_parameter param_key 'sds_rev', cn-specific row wins over the
// machine-config row, default 'NC') so a signature is always keyed to the rev that
// is printed on the sheet — without the client having to know or send it.
async function resolveSdsRev(cn, machine_type_name) {
  try {
    const { rows } = await engPool.query(
      // sds_rev is per-(cn, machine) — never per-process — so read the process-agnostic
      // row only (process_code IS NULL); a per-process CN override must not shift the rev.
      `SELECT param_value FROM ${TABLES.SDS_PARAMETER}
        WHERE machine_type_name = $2 AND param_key = 'sds_rev'
          AND (cn IS NULL OR cn = $1) AND process_code IS NULL
        ORDER BY (cn IS NULL) DESC`,
      [cn, machine_type_name]
    );
    // cn-specific row is ordered last and wins (mirrors the renderer's overwrite).
    return (rows.length ? rows[rows.length - 1].param_value : '') || 'NC';
  } catch (_) { return 'NC'; }
}

// The single sheet row for (cn, machine, process, rev), or null.
async function getSheet(cn, machine_type_name, process_code, sds_rev) {
  const { rows } = await engPool.query(
    `SELECT * FROM ${T}
      WHERE cn = $1 AND machine_type_name = $2 AND process_code = $3
        AND COALESCE(sds_rev,'') = $4`,
    [cn, machine_type_name, process_code, revKey(sds_rev)]
  );
  return rows[0] || null;
}

// ── GET / — the sheet's signatures keyed by role ─────────────────────────────
router.get('/', async (req, res) => {
  const { cn, machine_type_name, process_code } = req.query;
  if (!cn || !machine_type_name || !process_code) {
    return res.status(400).json({ success: false, error: 'cn, machine_type_name and process_code are required' });
  }
  try {
    const sds_rev = await resolveSdsRev(cn, machine_type_name);
    const row = await getSheet(cn, machine_type_name, process_code, sds_rev);
    res.json({ success: true, approvals: roleMap(row), sds_rev });
  } catch (e) {
    console.error('sdsApproval list:', e.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});


// ── GET /history — paged signing history across every sheet ───────────────────
//
// `GET /` answers "what is signed on THIS sheet" and needs cn + machine + process. This
// answers "what has been signed, by whom, when" across all 4,200+ rows, which is the
// question an auditor asks and the one nothing could answer before.
//
// The table stores one row per (cn, machine, process, sds_rev) with three flat groups of
// columns rather than one row per signature, so filtering "signed by X" or "signed in
// August" has to look across all three. `role` narrows to one stage; `signer` matches an
// em_id or a name in whichever stages are in scope. A row is returned when ANY in-scope
// stage matches — that is what makes "everything Somchai checked in July" work.
//
// `status` is derived, not stored: complete / awaiting_checked / awaiting_approved /
// unsigned, following the same prepared → checked → approved order the POST enforces.
router.get('/history', async (req, res) => {
  const { cn, machine, process: processCode, role, signer, status, from, to } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  const ROLES = ['prepared', 'checked', 'approved'];
  const scope = ROLES.includes(role) ? [role] : ROLES;

  const where = [];
  const params = [];
  const add = (sql, val) => { params.push(val); where.push(sql.replace('$?', `$${params.length}`)); };

  if (cn && cn.trim())                   add('cn ILIKE $?', `%${cn.trim()}%`);
  if (machine && machine.trim())         add('machine_type_name ILIKE $?', `%${machine.trim()}%`);
  if (processCode && processCode.trim()) add('process_code = $?', processCode.trim());

  // A signer or a date window applies to the stages in scope, ORed across them: a sheet
  // qualifies if the person signed ANY of those stages, not all of them.
  if (signer && signer.trim()) {
    params.push(`%${signer.trim()}%`);
    const i = params.length;
    where.push(`(${scope.map((r) => `${r}_em_id ILIKE $${i} OR ${r}_name ILIKE $${i}`).join(' OR ')})`);
  }
  if (from && from.trim()) {
    params.push(from.trim());
    const i = params.length;
    where.push(`(${scope.map((r) => `${r}_at >= $${i}`).join(' OR ')})`);
  }
  if (to && to.trim()) {
    params.push(to.trim());
    const i = params.length;
    where.push(`(${scope.map((r) => `${r}_at < ($${i}::date + 1)`).join(' OR ')})`);
  }
  // Asking for one role at all means "show sheets where that stage is signed".
  if (ROLES.includes(role)) where.push(`${role}_at IS NOT NULL`);

  if (status === 'complete')               where.push('approved_at IS NOT NULL');
  else if (status === 'awaiting_approved') where.push('checked_at IS NOT NULL AND approved_at IS NULL');
  else if (status === 'awaiting_checked')  where.push('prepared_at IS NOT NULL AND checked_at IS NULL');
  else if (status === 'unsigned')          where.push('prepared_at IS NULL');

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Sort by the most recent signature on the row so the newest activity leads, whichever
  // stage produced it. COALESCE alone would take approved even when checked is newer.
  const lastSigned = 'GREATEST(COALESCE(prepared_at, \'-infinity\'), COALESCE(checked_at, \'-infinity\'), COALESCE(approved_at, \'-infinity\'))';

  try {
    const { rows: countRows } = await engPool.query(
      `SELECT count(*)::int AS total FROM ${T} ${clause}`, params);

    const { rows } = await engPool.query(
      `SELECT id, cn, machine_type_name, process_code, sds_rev,
              prepared_em_id, prepared_name, prepared_dept, prepared_at, prepared_source,
              checked_em_id,  checked_name,  checked_dept,  checked_at,  checked_source,
              approved_em_id, approved_name, approved_dept, approved_at, approved_source,
              created_by, created_at, updated_at,
              ${lastSigned} AS last_signed_at,
              CASE WHEN approved_at IS NOT NULL THEN 'complete'
                   WHEN checked_at  IS NOT NULL THEN 'awaiting_approved'
                   WHEN prepared_at IS NOT NULL THEN 'awaiting_checked'
                   ELSE 'unsigned' END AS status
         FROM ${T} ${clause}
        ORDER BY ${lastSigned} DESC NULLS LAST, id DESC
        LIMIT ${limit} OFFSET ${offset}`, params);

    res.json({ success: true, total: countRows[0].total, page, limit, rows });
  } catch (e) {
    console.error('[approval history]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /history/facets — distinct values for the filter dropdowns. */
router.get('/history/facets', async (_req, res) => {
  try {
    const { rows } = await engPool.query(
      `SELECT
         (SELECT array_agg(DISTINCT machine_type_name ORDER BY machine_type_name)
            FROM ${T} WHERE machine_type_name IS NOT NULL) AS machines,
         (SELECT array_agg(DISTINCT process_code ORDER BY process_code)
            FROM ${T} WHERE process_code IS NOT NULL) AS processes`);
    res.json({ success: true, ...rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /state — per-role status + whether the current user may sign next ─────
router.get('/state', async (req, res) => {
  const { cn, machine_type_name, process_code } = req.query;
  if (!cn || !machine_type_name || !process_code) {
    return res.status(400).json({ success: false, error: 'cn, machine_type_name and process_code are required' });
  }
  try {
    const sds_rev = await resolveSdsRev(cn, machine_type_name);
    const [row, cfg] = await Promise.all([
      getSheet(cn, machine_type_name, process_code, sds_rev),
      getRoleConfig(),
    ]);
    const map = roleMap(row);
    const state = ROLE_ORDER.map((role, i) => {
      const rec = map[role] || null;
      const prevSigned = i === 0 || !!map[ROLE_ORDER[i - 1]];
      const permitted = userCanSign(req.user, role, cfg);
      return {
        role,
        signed: !!rec,
        signer_name: rec?.signer_name || null,
        signed_at: rec?.signed_at || null,
        em_id: rec?.em_id || null,
        source: rec?.source || null,
        canSign: permitted && prevSigned,        // live-sign eligibility (order enforced)
        permitted,                                // has the role permission at all
        blockedByOrder: permitted && !prevSigned, // would need the previous role first
      };
    });
    res.json({ success: true, state, isAdmin: isAdminUser(req.user), sds_rev });
  } catch (e) {
    console.error('sdsApproval state:', e.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── GET /board — every SDS sheet on one board, with its sign state ───────────
/**
 * Lets the Project board offer Prepared / Checked / Approved on the card itself,
 * instead of sending the signer to the SDS page to find the sheet again.
 *
 * **Batched on purpose.** The board carries one card per sheet — 40 today, and the
 * backlog feed seeds up to 150 a run — so the obvious `/state` per card is 40+
 * round trips on every board load, each re-reading the role config. This answers
 * the whole board in four queries regardless of card count.
 *
 * The hard part is going *backwards* through `boardRef`, which normalises a machine
 * to its group label (see utils/sdsBoardRef). A group names no single sheet, so:
 *
 *   • one candidate                       → sign inline, the normal case
 *   • several, exactly one already started → that is the sheet; sign inline
 *   • several and none or more than one   → `ambiguous`, no inline signing; the
 *     card falls back to the deep link so the operator picks the machine on the
 *     SDS page, which is the only place that choice can honestly be made
 *
 * Guessing a member instead would write a signature against a sheet that is not
 * the one printed, and nothing downstream would show it was the wrong one.
 */
router.get('/board', async (req, res) => {
  const boardId = Number(req.query.board_id);
  if (!Number.isInteger(boardId)) {
    return res.status(400).json({ success: false, error: 'board_id is required' });
  }
  try {
    const { rows: links } = await engPool.query(
      `SELECT card_id, source_ref FROM mtc_board_card_link
        WHERE source_type = $1 AND board_id = $2`,
      [SDS_SOURCE, boardId]
    );
    if (!links.length) return res.json({ success: true, cards: {} });

    // Parse + expand the group labels. `split('||')` not a regex: a CN never
    // contains the separator and a machine name never does either.
    const parsed = await Promise.all(links.map(async (l) => {
      const [cn, machineSeg, process_code] = String(l.source_ref).split('||');
      return {
        card_id: l.card_id,
        cn: cn || '',
        machineSeg: machineSeg || '',
        process_code: process_code || '',
        candidates: await groupMembers(machineSeg),
      };
    }));
    const usable = parsed.filter((p) => p.cn && p.machineSeg && p.process_code);

    const uniq = (xs) => [...new Set(xs.filter(Boolean))];
    const cns = uniq(usable.map((p) => p.cn));
    const machines = uniq(usable.flatMap((p) => p.candidates));
    const procs = uniq(usable.map((p) => p.process_code));

    const [apprRes, revRes, cfg] = await Promise.all([
      engPool.query(
        `SELECT * FROM ${T}
          WHERE cn = ANY($1) AND machine_type_name = ANY($2) AND process_code = ANY($3)`,
        [cns, machines, procs]
      ),
      // Same precedence as resolveSdsRev, read for the whole board at once: the
      // process-agnostic row only, with a cn-specific value beating the machine default.
      engPool.query(
        `SELECT cn, machine_type_name, param_value FROM ${TABLES.SDS_PARAMETER}
          WHERE param_key = 'sds_rev' AND process_code IS NULL
            AND machine_type_name = ANY($1) AND (cn IS NULL OR cn = ANY($2))`,
        [machines, cns]
      ),
      getRoleConfig(),
    ]);

    const revDefault = new Map();   // machine → rev
    const revByCn = new Map();      // `${cn}||${machine}` → rev
    for (const r of revRes.rows) {
      if (r.cn == null) revDefault.set(r.machine_type_name, r.param_value);
      else revByCn.set(`${r.cn}||${r.machine_type_name}`, r.param_value);
    }
    const revFor = (cn, machine) =>
      revKey(revByCn.get(`${cn}||${machine}`) ?? revDefault.get(machine) ?? '') || 'NC';

    const sheets = new Map();       // `${cn}||${machine}||${pc}||${rev}` → row
    for (const row of apprRes.rows) {
      sheets.set(`${row.cn}||${row.machine_type_name}||${row.process_code}||${revKey(row.sds_rev)}`, row);
    }
    const sheetFor = (cn, machine, pc) =>
      sheets.get(`${cn}||${machine}||${pc}||${revKey(revFor(cn, machine))}`) || null;

    const cards = {};
    for (const p of usable) {
      const started = p.candidates.filter((m) => sheetFor(p.cn, m, p.process_code));
      let machine = null;
      if (p.candidates.length === 1) machine = p.candidates[0];
      else if (started.length === 1) machine = started[0];

      const base = {
        cn: p.cn,
        process_code: p.process_code,
        machine_label: p.machineSeg,
        signUrl: signPageUrl(p.cn, machine || p.machineSeg, p.process_code),
      };

      if (!machine) {
        cards[p.card_id] = {
          ...base,
          machine_type_name: null,
          ambiguous: true,
          candidates: p.candidates,
          sds_rev: null,
          state: [],
        };
        continue;
      }

      const sds_rev = revFor(p.cn, machine);
      const row = sheetFor(p.cn, machine, p.process_code);
      const map = roleMap(row);
      cards[p.card_id] = {
        ...base,
        machine_type_name: machine,
        ambiguous: false,
        candidates: p.candidates,
        sds_rev,
        state: ROLE_ORDER.map((role, i) => {
          const rec = map[role] || null;
          const prevSigned = i === 0 || !!map[ROLE_ORDER[i - 1]];
          const permitted = userCanSign(req.user, role, cfg);
          return {
            role,
            signed: !!rec,
            signer_name: rec?.signer_name || null,
            signed_at: rec?.signed_at || null,
            em_id: rec?.em_id || null,
            source: rec?.source || null,
            canSign: permitted && prevSigned,
            permitted,
            blockedByOrder: permitted && !prevSigned,
          };
        }),
      };
    }

    res.json({ success: true, cards, isAdmin: isAdminUser(req.user) });
  } catch (e) {
    console.error('sdsApproval board:', e.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── POST / — LIVE sign (identity from JWT, now(), order enforced) ────────────
router.post('/', async (req, res) => {
  const { cn, machine_type_name, process_code, role } = req.body || {};
  if (!cn || !machine_type_name || !process_code || !role) {
    return res.status(400).json({ success: false, error: 'cn, machine_type_name, process_code and role are required' });
  }
  if (!ROLE_ORDER.includes(role)) {
    return res.status(400).json({ success: false, error: `role must be one of ${ROLE_ORDER.join(', ')}` });
  }
  const user = req.user || {};
  if (!user.empno) return res.status(401).json({ success: false, error: 'user context missing' });

  try {
    const cfg = await getRoleConfig();
    if (!userCanSign(user, role, cfg)) {
      return res.status(403).json({ success: false, error: `You are not permitted to sign as ${role}` });
    }
    const sds_rev = await resolveSdsRev(cn, machine_type_name);
    // Sequential gating (live only): previous role must already be signed.
    const idx = ROLE_ORDER.indexOf(role);
    if (idx > 0) {
      const row = await getSheet(cn, machine_type_name, process_code, sds_rev);
      const prev = ROLE_ORDER[idx - 1];
      if (!roleRec(row, prev)) {
        return res.status(409).json({ success: false, error: `'${prev}' must be signed before '${role}'` });
      }
    }

    const row = await signUpsert({
      cn, machine_type_name, process_code, role, sds_rev,
      em_id: user.empno, signer_name: user.name || String(user.empno),
      dept: deptOf(user) || null, signed_at: null, source: 'live', created_by: user.empno,
    });

    // --- Move/create the board card for this approval sheet (fail-open) ---
    // stageKey = the role just signed; admin maps prepared/checked/approved → lists.
    // Backfill (historical bulk import) is intentionally NOT hooked to avoid flooding.
    // sourceRef via boardRef so a sheet signed under one group member lands on the
    // same card the coverage report seeded under the group label.
    boardRef(cn, machine_type_name, process_code).then((ref) => kanbanIntake.syncCard({
      io: req.app.get('io'),
      sourceType: SDS_SOURCE,
      sourceRef: ref,
      stageKey: role,
      name: `SDS ${cn} · ${machine_type_name} · ${process_code}`,
      description: `Signed ${role} by ${user.name || user.empno}`,
      // Lets the next signer open the exact sheet from the card instead of
      // re-typing the CN and re-picking machine/process.
      link: { url: signPageUrl(cn, machine_type_name, process_code), name: `Open SDS ${cn} — sign` },
    })).catch((e) => console.warn('[sdsApproval] kanban intake failed:', e.message));

    res.json({ success: true, approval: row });
  } catch (e) {
    console.error('sdsApproval sign:', e.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── POST /backfill — admin records a historical approval (no order, custom date) ─
router.post('/backfill', isAdmin, async (req, res) => {
  const { cn, machine_type_name, process_code, role, em_id, signer_name, dept, signed_at } = req.body || {};
  if (!cn || !machine_type_name || !process_code || !role || !em_id || !signer_name) {
    return res.status(400).json({ success: false, error: 'cn, machine_type_name, process_code, role, em_id, signer_name are required' });
  }
  if (!ROLE_ORDER.includes(role)) {
    return res.status(400).json({ success: false, error: `role must be one of ${ROLE_ORDER.join(', ')}` });
  }
  try {
    const sds_rev = await resolveSdsRev(cn, machine_type_name);
    const row = await signUpsert({
      cn, machine_type_name, process_code, role, sds_rev,
      em_id, signer_name, dept: dept || null,
      signed_at: signed_at || null, source: 'backfill', created_by: req.user?.empno || null,
    });
    res.json({ success: true, approval: row });
  } catch (e) {
    console.error('sdsApproval backfill:', e.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Upsert the sheet row, writing only the signing role's columns (other roles untouched).
async function signUpsert(d) {
  const c = roleCols(d.role); // d.role is validated ∈ ROLE_ORDER by the callers
  const { rows } = await engPool.query(
    `INSERT INTO ${T}
       (cn, machine_type_name, process_code, sds_rev,
        ${c.em_id}, ${c.name}, ${c.dept}, ${c.at}, ${c.source}, created_by)
     VALUES ($1,$2,$3,$4, $5,$6,$7, COALESCE($8::timestamptz, now()), $9, $10)
     ON CONFLICT (cn, machine_type_name, process_code, COALESCE(sds_rev,''))
     DO UPDATE SET
       ${c.em_id}  = EXCLUDED.${c.em_id},
       ${c.name}   = EXCLUDED.${c.name},
       ${c.dept}   = EXCLUDED.${c.dept},
       ${c.at}     = EXCLUDED.${c.at},
       ${c.source} = EXCLUDED.${c.source},
       updated_at  = now()
     RETURNING *`,
    [d.cn, d.machine_type_name, d.process_code, (revKey(d.sds_rev) || null),
     d.em_id, d.signer_name, d.dept, d.signed_at, d.source, d.created_by]
  );
  return rows[0];
}

// ── DELETE /?cn=&machine_type_name=&process_code=&role= — revoke one role ──────
//    (admin, or the signer clearing their own). Clears that role's columns; deletes
//    the row when no role remains signed.
router.delete('/', async (req, res) => {
  const { cn, machine_type_name, process_code, role } = req.query;
  if (!cn || !machine_type_name || !process_code || !role) {
    return res.status(400).json({ success: false, error: 'cn, machine_type_name, process_code and role are required' });
  }
  if (!ROLE_ORDER.includes(role)) {
    return res.status(400).json({ success: false, error: `role must be one of ${ROLE_ORDER.join(', ')}` });
  }
  try {
    const sds_rev = await resolveSdsRev(cn, machine_type_name);
    const row = await getSheet(cn, machine_type_name, process_code, sds_rev);
    const rec = roleRec(row, role);
    if (!rec) return res.json({ success: true, alreadyRevoked: true });
    if (!isAdminUser(req.user) && String(rec.em_id) !== String(req.user?.empno)) {
      return res.status(403).json({ success: false, error: 'You may only revoke your own signature' });
    }
    const c = roleCols(role);
    await engPool.query(
      `UPDATE ${T} SET ${c.em_id} = NULL, ${c.name} = NULL, ${c.dept} = NULL,
                       ${c.at} = NULL, ${c.source} = NULL, updated_at = now()
        WHERE id = $1`, [row.id]
    );
    // Drop the row if every role is now unsigned (keeps the table tight).
    await engPool.query(
      `DELETE FROM ${T} WHERE id = $1
         AND prepared_em_id IS NULL AND checked_em_id IS NULL AND approved_em_id IS NULL`,
      [row.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('sdsApproval revoke:', e.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── Role-config CRUD (configure who may sign each role) — admin only ──────────
router.get('/role-config', async (req, res) => {
  try { res.json({ success: true, config: await getRoleConfig() }); }
  catch (e) { console.error('sdsApproval role-config list:', e.message); res.status(500).json({ success: false, error: 'Internal Server Error' }); }
});

router.post('/role-config', isAdmin, async (req, res) => {
  const { role, match_type, match_value, note } = req.body || {};
  if (!ROLE_ORDER.includes(role)) return res.status(400).json({ success: false, error: `role must be one of ${ROLE_ORDER.join(', ')}` });
  if (!['any', 'department', 'role', 'feature_perm', 'em_id'].includes(match_type)) {
    return res.status(400).json({ success: false, error: 'invalid match_type' });
  }
  if (match_type !== 'any' && !match_value) return res.status(400).json({ success: false, error: 'match_value is required' });
  try {
    const { rows } = await engPool.query(
      `INSERT INTO ${TC} (role, match_type, match_value, note) VALUES ($1,$2,$3,$4) RETURNING *`,
      [role, match_type, match_type === 'any' ? null : match_value, note || null]
    );
    res.json({ success: true, config: rows[0] });
  } catch (e) { console.error('sdsApproval role-config add:', e.message); res.status(500).json({ success: false, error: 'Internal Server Error' }); }
});

router.put('/role-config/:id', isAdmin, async (req, res) => {
  const { enabled, note } = req.body || {};
  try {
    const { rows } = await engPool.query(
      `UPDATE ${TC} SET
         enabled = COALESCE($1, enabled),
         note    = COALESCE($2, note)
       WHERE id = $3 RETURNING *`,
      [typeof enabled === 'boolean' ? enabled : null, note ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, config: rows[0] });
  } catch (e) { console.error('sdsApproval role-config update:', e.message); res.status(500).json({ success: false, error: 'Internal Server Error' }); }
});

router.delete('/role-config/:id', isAdmin, async (req, res) => {
  try {
    await engPool.query(`DELETE FROM ${TC} WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) { console.error('sdsApproval role-config delete:', e.message); res.status(500).json({ success: false, error: 'Internal Server Error' }); }
});

// ── Render helper: seals for a (cn, machine, process, rev) for the SDS PDF ────
//
// Returns { prepared, checked, approved } where each value (when that role is
// signed) is { dataUri, svg, name, date }:
//   - dataUri  → base64 (for grid <img> cells)
//   - svg      → inline markup (for the HTML-template path)
// Hybrid: if the signer has an uploaded stamp image in tt_user_stamps, that image
// is used; otherwise the auto-generated vector seal (name + signed date). Unsigned
// roles (or a rev mismatch — the caller passes the CURRENT rev, so a sheet signed
// against an older rev simply isn't returned) come back null → blank box.
const _mimeOf = (buf) => (buf && buf[0] === 0xFF && buf[1] === 0xD8) ? 'image/jpeg' : 'image/png';
// Seal date format → "01 JAN 2026" (DD MON YYYY, upper-case month).
const _MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const _fmtDate = (d) => {
  try {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return `${String(dt.getDate()).padStart(2, '0')} ${_MON[dt.getMonth()]} ${dt.getFullYear()}`;
  } catch (_) { return ''; }
};

async function getApprovalSeals(cn, machine_type_name, process_code, sds_rev) {
  const out = { prepared: null, checked: null, approved: null };
  if (!cn || !machine_type_name || !process_code) return out;
  try { await ensureApprovalTables(); } catch (_) { return out; }

  let row;
  try { row = await getSheet(cn, machine_type_name, process_code, sds_rev); }
  catch (_) { return out; }
  const recs = ROLE_ORDER.map((r) => [r, roleRec(row, r)]).filter(([, v]) => v);
  if (!recs.length) return out;

  // Hybrid: prefer the signer's uploaded stamp image (tt_user_stamps).
  const emIds = [...new Set(recs.map(([, v]) => v.em_id).filter(Boolean))];
  const imgByEm = {};
  if (emIds.length) {
    try {
      const s = await engPool.query(
        `SELECT em_id, stamp_image FROM tt_user_stamps WHERE em_id = ANY($1) AND stamp_image IS NOT NULL`,
        [emIds]
      );
      for (const r of s.rows) {
        const buf = r.stamp_image;
        if (buf && buf.length) imgByEm[r.em_id] = `data:${_mimeOf(buf)};base64,` + Buffer.from(buf).toString('base64');
      }
    } catch (_) { /* table may not exist — fall back to vector seals */ }
  }

  for (const [role, rec] of recs) {
    const date = _fmtDate(rec.signed_at);
    const sealName = toSealName(rec.signer_name); // "Apisit Suwannakate" → "S.APISIT"
    const img = imgByEm[rec.em_id];
    const dataUri = img || buildSealDataUri({ name: sealName, date, seed: 'stamp_' + role });
    const svg = img
      ? `<img src="${img}" style="display:block;width:100%;height:auto;max-width:100%"/>`
      : buildSealSvg({ name: sealName, date, seed: 'stamp_' + role });
    out[role] = { dataUri, svg, name: sealName, date };
  }
  return out;
}

module.exports = router;
module.exports.ensureApprovalTables = ensureApprovalTables;
module.exports.userCanSign = userCanSign;
module.exports.getApprovalSeals = getApprovalSeals;
module.exports._ROLE_ORDER = ROLE_ORDER;
module.exports.signPageUrl = signPageUrl;
