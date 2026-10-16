'use strict';

/**
 * Record-for-new-model form — data access.
 * Lot lookup reads maqdb (schema lpb), the same source as the Lot Status Tracker;
 * everything the engineer types lives in eng_system (engPool).
 */
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { TABLES: T, STATUSES } = require('./recordFormConstants');
const cnFormat = require('../../mtc/utils/cnFormat');

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
/** 'YYYY-MM-DD' → itself; blank → null (no date); anything else is a client error. */
function cleanDate(v) {
  const s = clean(v);
  if (s == null) return null;
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
    && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  if (!ok) throw bad('Established date must be a real date (YYYY-MM-DD)');
  return s;
}
const clean = v => (v == null ? null : String(v).trim() || null);

// ---------------------------------------------------------------- lot lookup

/** Lots/CNs matching the typed text. Exact on lot_no or control_no, newest first. */
async function searchLots(q) {
  const key = clean(q)?.toUpperCase();
  if (!key) throw bad('Enter a Lot No. or C/N');
  const { rows } = await maqPool.query(
    `SELECT lot_no, control_no, parts_no, req_qty, remark1, entry_date
       FROM lpb.pc_lot
      WHERE UPPER(TRIM(lot_no)) = $1 OR UPPER(TRIM(control_no)) = $1
      ORDER BY entry_date DESC NULLS LAST
      LIMIT 50`,
    [key]
  );
  // A new-model lot is often planned before it reaches maqdb's lpb.pc_lot (which syncs a few
  // times a day, and only after release) — but the MRP plan already holds it, with its route.
  // Lots found in both are listed once, from pc_lot.
  const seen = new Set(rows.map(r => `${r.lot_no}|${r.control_no}`));
  try {
    const mrp = await rodpcPool.query(
      `SELECT mrp_mono AS lot_no, mrp_itemno AS control_no, MAX(mrp_spec) AS parts_no,
              MAX(mrp_reqqty) AS req_qty, MAX(mrp_plan) AS entry_date
         FROM pc_mrp
        WHERE mrp_mono IS NOT NULL AND (UPPER(TRIM(mrp_mono)) = $1 OR UPPER(TRIM(mrp_itemno)) = $1)
        GROUP BY mrp_mono, mrp_itemno
        ORDER BY MAX(mrp_plan) DESC NULLS LAST
        LIMIT 50`, [key]);
    for (const r of mrp.rows) if (!seen.has(`${r.lot_no}|${r.control_no}`)) rows.push({ ...r, remark1: 'MRP', source: 'mrp' });
  } catch (e) { console.warn(`[record-form] MRP lot search failed: ${e.message}`); }
  return rows;
}

/** One lot's header + planned route. */
async function getLot(lotNo, controlNo) {
  const lot = clean(lotNo), cn = clean(controlNo);
  if (!lot || !cn) throw bad('Both lot_no and control_no are required');
  const head = await maqPool.query(
    `SELECT lot_no, control_no, parts_no, req_qty, remark1
       FROM lpb.pc_lot WHERE lot_no = $1 AND control_no = $2 LIMIT 1`,
    [lot, cn]
  );
  if (!head.rows[0]) return getLotFromMrp(lot, cn);
  const steps = await maqPool.query(
    `SELECT lp.seq::int AS step_no, lp.process AS process_code,
            COALESCE(NULLIF(TRIM(e.process_eng), ''), lp.proc_name) AS process_name
       FROM lpb.pc_lot_process lp
       LEFT JOIN lpb.eng_process e ON e.process_code = lp.process
      WHERE lp.lot_no = $1 AND lp.control_no = $2
      ORDER BY lp.seq::int`,
    [lot, cn]
  );
  return { ...head.rows[0], ...(await itemInfo(cn)), steps: steps.rows };
}

/** Same shape as getLot, from the MRP plan (rodpc.pc_mrp) for lots maqdb does not hold yet. */
async function getLotFromMrp(lot, cn) {
  const { rows } = await rodpcPool.query(
    `SELECT mrp_mono AS lot_no, mrp_itemno AS control_no, mrp_spec AS parts_no, mrp_reqqty AS req_qty,
            mrp_seq::int AS step_no, mrp_process AS process_code, mrp_procname AS process_name
       FROM pc_mrp WHERE mrp_mono = $1 AND mrp_itemno = $2
      ORDER BY mrp_seq::int, mrpid`, [lot, cn]);
  if (!rows[0]) throw bad('Lot not found', 404);
  const { lot_no, control_no, parts_no, req_qty } = rows[0];
  return {
    lot_no, control_no, parts_no, req_qty, remark1: 'MRP', source: 'mrp', ...(await itemInfo(cn)),
    steps: rows.map(r => ({ step_no: r.step_no, process_code: r.process_code, process_name: r.process_name })),
  };
}

/**
 * Drawing rev + process code (SR) for a lot's part (CUSTOMER P/N is deliberately NOT pulled — it is typed). `pc_lot.put_rev` is empty on every lot
 * (0 of 7,250 in 90 days), so the revision comes from `eng_cad_rev_data` exactly as the
 * SDS does (`<control no>_1`, draw_rev_0). The lot's control_no is the 6-digit item no
 * with an optional suffix (`310066-C`); eng_item / eng_cad_rev_data use `C31-00066`.
 * An assembly-style code (`00M627`) matches neither, and the fields are just left blank.
 */
async function itemInfo(lotControlNo) {
  const out = { drawing_rev: '', process_code: '' };
  const control = cnFormat.toControlNo(String(lotControlNo).replace(/-[A-Za-z0-9]*$/, ''));
  if (!control) return out;
  try {
    const [rev, item] = await Promise.all([
      maqPool.query(`SELECT draw_rev_0 FROM lpb.eng_cad_rev_data WHERE drawing_no = $1 LIMIT 1`, [`${control}_1`]),
      // PROCESS CODE on the paper form is the item's SR — its standard-route code (e.g. F2N =
      // 0081 8011 7001 2501 2511 2561 0401 3531 8012 8601 in lpb.eng_process_set).
      maqPool.query(`SELECT sr FROM lpb.v_s_item WHERE control_no = $1 LIMIT 1`, [control]),
    ]);
    out.drawing_rev = clean(rev.rows[0]?.draw_rev_0) || '';
    out.process_code = clean(item.rows[0]?.sr) || '';
  } catch (e) { console.warn(`[record-form] item lookup failed for ${control}: ${e.message}`); }
  return out;
}

// ----------------------------------------------------------------- templates

const listTemplates = async () =>
  (await engPool.query(`SELECT * FROM ${T.TEMPLATE} ORDER BY is_default DESC, name`)).rows;

function checkLayout(l) {
  if (!l || typeof l !== 'object') throw bad('Invalid layout');
  if (!Array.isArray(l.headerFields) || !Array.isArray(l.columns)) throw bad('Layout needs headerFields and columns');
  const rows = Number(l.rowCount);
  if (!Number.isInteger(rows) || rows < 1 || rows > 60) throw bad('rowCount must be between 1 and 60');
  const keys = [...l.headerFields, ...l.columns].map(f => f.key);
  if (keys.some(k => !/^[a-z0-9_]{1,40}$/.test(k || ''))) throw bad('Keys must be a-z, 0-9 or _ (max 40 characters)');
  if (new Set(l.columns.map(c => c.key)).size !== l.columns.length) throw bad('Duplicate column key');
  if (new Set(l.headerFields.map(c => c.key)).size !== l.headerFields.length) throw bad('Duplicate header field key');
  return l;
}

async function saveTemplate(id, { name, layout, is_default }, user) {
  const nm = clean(name);
  if (!nm) throw bad('Template name is required');
  checkLayout(layout);
  const c = await engPool.connect();
  try {
    await c.query('BEGIN');
    if (is_default) await c.query(`UPDATE ${T.TEMPLATE} SET is_default = FALSE`);
    const r = id
      ? await c.query(
          `UPDATE ${T.TEMPLATE} SET name=$2, layout=$3, is_default=$4, updated_by=$5, updated_at=NOW()
            WHERE id=$1 RETURNING *`,
          [id, nm, JSON.stringify(layout), !!is_default, user.empno])
      : await c.query(
          `INSERT INTO ${T.TEMPLATE} (name, layout, is_default, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$4) RETURNING *`,
          [nm, JSON.stringify(layout), !!is_default, user.empno]);
    if (!r.rows[0]) throw bad('Template not found', 404);
    await c.query('COMMIT');
    return r.rows[0];
  } catch (e) {
    await c.query('ROLLBACK');
    if (e.code === '23505') throw bad('Template name already exists', 409);
    throw e;
  } finally { c.release(); }
}

async function deleteTemplate(id) {
  const used = await engPool.query(`SELECT 1 FROM ${T.RECORD} WHERE template_id=$1 LIMIT 1`, [id]);
  if (used.rowCount) throw bad('Template is used by existing records and cannot be deleted', 409);
  const r = await engPool.query(`DELETE FROM ${T.TEMPLATE} WHERE id=$1 AND is_default=FALSE`, [id]);
  if (!r.rowCount) throw bad('Template not found, or it is the default template (cannot be deleted)', 404);
}

// ------------------------------------------------------------------- records

async function listRecords({ q, status, limit = 3000 }) {
  const w = [], p = [];
  if (q) { p.push(`%${String(q).trim()}%`); w.push(`(lot_no ILIKE $${p.length} OR control_no ILIKE $${p.length} OR parts_no ILIKE $${p.length})`); }
  if (status && STATUSES.includes(status)) { p.push(status); w.push(`status = $${p.length}`); }
  p.push(Math.min(Number(limit) || 3000, 5000)); // list rows are header-only; the table pages client-side
  const { rows } = await engPool.query(
    `SELECT id, template_id, lot_no, control_no, parts_no, drawing_rev, status, record_rev,
            to_char(established_date, 'YYYY-MM-DD') AS established_date,
            to_char(revised_date, 'YYYY-MM-DD') AS revised_date, created_by_name, updated_at
       FROM ${T.RECORD} ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
      ORDER BY established_date DESC NULLS LAST, updated_at DESC, id DESC LIMIT $${p.length}`, p);
  return rows;
}

async function getRecord(id) {
  const rec = await engPool.query(
    `SELECT r.*, to_char(r.established_date, 'YYYY-MM-DD') AS established_date,
            to_char(r.revised_date, 'YYYY-MM-DD') AS revised_date, t.layout, t.name AS template_name
       FROM ${T.RECORD} r LEFT JOIN ${T.TEMPLATE} t ON t.id = r.template_id WHERE r.id=$1`, [id]);
  if (!rec.rows[0]) throw bad('Record not found', 404);
  const steps = await engPool.query(
    `SELECT step_no, process_code, process_name, "values" FROM ${T.STEP} WHERE record_id=$1 ORDER BY step_no`, [id]);
  return { ...rec.rows[0], steps: steps.rows };
}

async function writeSteps(c, recordId, steps) {
  await c.query(`DELETE FROM ${T.STEP} WHERE record_id=$1`, [recordId]);
  const list = Array.isArray(steps) ? steps : [];
  if (list.length > 200) throw bad('Too many process steps');
  if (!list.length) return;
  const vals = [], ph = list.map((s, i) => {
    vals.push(recordId, i + 1, clean(s.process_code), clean(s.process_name), JSON.stringify(s.values || {}));
    const b = i * 5;
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`;
  });
  await c.query(`INSERT INTO ${T.STEP} (record_id, step_no, process_code, process_name, "values") VALUES ${ph.join(',')}`, vals);
}

async function createRecord(body, user) {
  const tpl = body.template_id
    ? (await engPool.query(`SELECT id FROM ${T.TEMPLATE} WHERE id=$1`, [body.template_id])).rows[0]
    : (await engPool.query(`SELECT id FROM ${T.TEMPLATE} ORDER BY is_default DESC, id LIMIT 1`)).rows[0];
  if (!tpl) throw bad('Template not found');
  const c = await engPool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query(
      `INSERT INTO ${T.RECORD} (template_id, lot_no, control_no, parts_no, drawing_rev, header, created_by, created_by_name, updated_by, established_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$7, COALESCE($9::date, CURRENT_DATE)) RETURNING id`,
      [tpl.id, clean(body.lot_no), clean(body.control_no), clean(body.parts_no), clean(body.drawing_rev),
       JSON.stringify(body.header || {}), user.empno, user.name, cleanDate(body.established_date)]);
    await writeSteps(c, r.rows[0].id, body.steps);
    await c.query('COMMIT');
    return getRecord(r.rows[0].id);
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

/**
 * Update after the record has been filled in. Once a form has been printed or
 * recorded, any further edit is a revision: record_rev + 1 and revised_date = today
 * (the "RECORD REV." / "REVISED DATE" boxes on the paper form).
 */
async function updateRecord(id, body, user) {
  const c = await engPool.connect();
  try {
    await c.query('BEGIN');
    const cur = (await c.query(`SELECT status FROM ${T.RECORD} WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    if (!cur) throw bad('Record not found', 404);
    const next = cur.status; // status moves only through markPrinted — a stale copy from the client must not reset it
    // `revise: false` = the edit is not a revision of the content (e.g. only the established date
    // was filled in or corrected), so RECORD REV. / REVISED DATE stay as they are.
    const revise = cur.status !== 'draft' && body.revise !== false ? 1 : 0;
    const established = body.established_date === undefined ? undefined : cleanDate(body.established_date);
    await c.query(
      `UPDATE ${T.RECORD} SET lot_no=$2, control_no=$3, parts_no=$4, drawing_rev=$5, header=$6, status=$7,
              record_rev = record_rev + $8::int,
              revised_date = CASE WHEN $8::int = 1 THEN CURRENT_DATE ELSE revised_date END,
              established_date = CASE WHEN $10::boolean THEN $11::date ELSE established_date END,
              updated_by=$9, updated_at=NOW()
        WHERE id=$1`,
      [id, clean(body.lot_no), clean(body.control_no), clean(body.parts_no), clean(body.drawing_rev),
       JSON.stringify(body.header || {}), next, revise, user.empno, established !== undefined, established ?? null]);
    if (body.steps) await writeSteps(c, id, body.steps);
    await c.query('COMMIT');
    return getRecord(id);
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

async function markPrinted(id, user) {
  const r = await engPool.query(
    `UPDATE ${T.RECORD} SET status = CASE WHEN status='draft' THEN 'printed' ELSE status END,
            printed_at=NOW(), updated_by=$2 WHERE id=$1 RETURNING id`, [id, user.empno]);
  if (!r.rowCount) throw bad('Record not found', 404);
  return getRecord(id);
}

async function deleteRecord(id, user, isAdmin) {
  const r = await engPool.query(
    `DELETE FROM ${T.RECORD} WHERE id=$1 AND ($3 OR created_by=$2)`, [id, user.empno, !!isAdmin]);
  if (!r.rowCount) throw bad('Record not found, or you may only delete your own records (Admin can delete any)', 403);
}

module.exports = {
  searchLots, getLot, listTemplates, saveTemplate, deleteTemplate,
  listRecords, getRecord, createRecord, updateRecord, markPrinted, deleteRecord,
};
