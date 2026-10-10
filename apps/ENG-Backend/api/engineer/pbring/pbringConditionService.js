'use strict';

/**
 * PB Ring SDS tool-condition data (`pbring_sds_condition`) — direct CRUD for
 * an existing (cn, machine, process)'s T1-T12 rows, plus a "+ New HW"-style
 * history suggestion flow for a CN that doesn't have any yet. By user
 * decision (2026-10-10): both, same principle as pbringService.js's own
 * getHistoryTemplate/createToolingFromHistory (look at every historical row
 * for this machine+process, group by "which item", suggest the group used
 * by >=50% of distinct CNs, let the admin review/tick/confirm) — just
 * grouped by `insert_info` instead of `tooling_item`, since insert_info is
 * this domain's equivalent of "which tool is this" (tooling_no/tool_detail
 * are frequently blank on turning rows; insert_info rarely is).
 *
 * This table also holds the grinding machines' T01-T20 tooling_no/maker
 * rows (`kind='Grinding'`), so every function here takes cn/machine/process
 * generically rather than assuming turning-only — the VC/F/AP/etc fields
 * are simply null for a grinding row and are written as null without
 * complaint.
 */

const { engPool } = require('../../../instance/eng_db');
const { toItemNo } = require('../mtc/utils/cnFormat');
const { PbringError } = require('./pbringCostService');

const normalizeCn = (cn) => (cn ? (toItemNo(cn) || cn) : cn);

// Editable fields beyond the row's identity (cn/process_code/machine/mc_key/tool_number).
const CONDITION_FIELDS = [
  'tooling_no', 'maker', 'tool_detail', 'insert_info', 'holder_info', 'holder_maker',
  'overhang', 'vc', 'f', 'ap', 'nose_r', 'rotation', 'hand', 'usaged', 'h_width',
];

/** Direct CRUD read — every tool_number row for one (cn, machine, process). */
async function getConditionRows(cn, machineTypeName, processCode) {
  const { rows } = await engPool.query(
    `SELECT * FROM pbring_sds_condition WHERE cn = $1 AND mc_key = $2 AND process_code = $3 ORDER BY tool_number`,
    [normalizeCn(cn), machineTypeName, processCode]
  );
  return rows;
}

/** Insert (no id) or update (id given) one row. */
async function upsertConditionRow(data, empno) {
  const cn = normalizeCn(data.cn);
  const toolNumber = String(data.tool_number || '').trim();
  if (!cn || !data.mc_key || !data.process_code || !toolNumber) {
    throw new PbringError(400, 'cn, mc_key, process_code and tool_number are required');
  }

  if (data.id) {
    const sets = CONDITION_FIELDS.map((f, i) => `${f} = $${i + 3}`).join(', ');
    const { rows } = await engPool.query(
      `UPDATE pbring_sds_condition SET tool_number = $2, ${sets}
        WHERE id = $1 RETURNING *`,
      [data.id, toolNumber, ...CONDITION_FIELDS.map((f) => data[f] ?? null)]
    );
    if (!rows[0]) throw new PbringError(404, 'Row not found');
    return rows[0];
  }

  const cols = ['cn', 'pn', 'process_code', 'machine', 'mc_key', 'kind', 'sds_rev', 'tool_number', ...CONDITION_FIELDS];
  const values = [
    cn, data.pn || null, data.process_code,
    data.machine || data.mc_key, data.mc_key, data.kind || 'Turning', data.sds_rev || null, toolNumber,
    ...CONDITION_FIELDS.map((f) => data[f] ?? null),
  ];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await engPool.query(
    `INSERT INTO pbring_sds_condition (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return rows[0];
}

async function deleteConditionRow(id) {
  const { rowCount } = await engPool.query(`DELETE FROM pbring_sds_condition WHERE id = $1`, [id]);
  return rowCount > 0;
}

/** Most-common non-blank value in an array, '' if none. Mirrors pbringService.js's own helper. */
function mostCommon(arr) {
  const counts = {};
  arr.filter((v) => v != null && String(v).trim() !== '').forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : null;
}

/**
 * Every (tool_number, insert_info) combination this machine+process has
 * ever used, across all CNs, most-used first — pre-ticked (`use: true`)
 * only when that combination covers >=50% of the distinct CNs seen for
 * this machine+process, same threshold pbringService.getHistoryTemplate
 * uses. A tool_number can appear more than once here (different inserts
 * used on different CNs) — the admin picks which one(s) fit the new CN,
 * same review-list shape as +New HW rather than auto-merging one answer.
 */
async function getConditionHistoryTemplate(machineTypeName, processCode) {
  const { rows } = await engPool.query(
    `SELECT * FROM pbring_sds_condition WHERE mc_key = $1 AND process_code = $2`,
    [machineTypeName, processCode]
  );
  const cnCount = new Set(rows.map((r) => r.cn)).size;

  const groups = new Map();
  const order = [];
  for (const r of rows) {
    const key = `${r.tool_number}|${String(r.insert_info || '').trim().toUpperCase()}`;
    if (!groups.has(key)) {
      groups.set(key, { tool_number: r.tool_number, rows: [], cns: new Set() });
      order.push(key);
    }
    const g = groups.get(key);
    g.rows.push(r);
    g.cns.add(r.cn);
  }

  return order
    .map((k) => groups.get(k))
    .sort((a, b) => b.cns.size - a.cns.size)
    .map((g) => ({
      tool_number: g.tool_number,
      tooling_no: mostCommon(g.rows.map((r) => r.tooling_no)),
      maker: mostCommon(g.rows.map((r) => r.maker)),
      tool_detail: mostCommon(g.rows.map((r) => r.tool_detail)),
      insert_info: mostCommon(g.rows.map((r) => r.insert_info)),
      holder_info: mostCommon(g.rows.map((r) => r.holder_info)),
      holder_maker: mostCommon(g.rows.map((r) => r.holder_maker)),
      overhang: mostCommon(g.rows.map((r) => r.overhang)),
      vc: mostCommon(g.rows.map((r) => r.vc)),
      f: mostCommon(g.rows.map((r) => r.f)),
      ap: mostCommon(g.rows.map((r) => r.ap)),
      nose_r: mostCommon(g.rows.map((r) => r.nose_r)),
      rotation: mostCommon(g.rows.map((r) => r.rotation)),
      hand: mostCommon(g.rows.map((r) => r.hand)),
      usaged: mostCommon(g.rows.map((r) => r.usaged)),
      h_width: mostCommon(g.rows.map((r) => r.h_width)),
      use: cnCount > 0 && g.cns.size / cnCount >= 0.5,
      hist: `${g.cns.size}/${cnCount}`,
    }));
}

/**
 * Commit reviewed/ticked history-template rows as new pbring_sds_condition
 * rows for one target CN. A tool_number already present for this
 * (cn, machine, process) is skipped unless `force` — same
 * "duplicate, add anyway?" report pbringService.createToolingFromHistory
 * returns rather than blocking.
 */
async function createConditionFromHistory({ cn, machine_type_name: machineTypeName, process_code: processCode, rows, force }, empno) {
  const normCn = normalizeCn(cn);
  if (!normCn || !machineTypeName || !processCode) {
    throw new PbringError(400, 'cn, machine_type_name and process_code are required');
  }
  const candidates = (rows || []).filter((r) => r.use && String(r.tool_number || '').trim());
  if (!candidates.length) throw new PbringError(400, 'No items selected');

  const { rows: existing } = await engPool.query(
    `SELECT tool_number FROM pbring_sds_condition WHERE cn = $1 AND mc_key = $2 AND process_code = $3`,
    [normCn, machineTypeName, processCode]
  );
  const seen = new Set(existing.map((r) => r.tool_number));
  const toInsert = [];
  const skipped = [];
  for (const r of candidates) {
    if (seen.has(r.tool_number) && !force) { skipped.push(r); continue; }
    seen.add(r.tool_number);
    toInsert.push(r);
  }

  let inserted = [];
  if (toInsert.length) {
    const cols = ['cn', 'process_code', 'machine', 'mc_key', 'kind', 'tool_number', ...CONDITION_FIELDS];
    const values = toInsert.flatMap((r) => [
      normCn, processCode, machineTypeName, machineTypeName, 'Turning', r.tool_number,
      ...CONDITION_FIELDS.map((f) => r[f] ?? null),
    ]);
    const c = cols.length;
    const placeholders = toInsert.map((_, ri) => `(${Array.from({ length: c }, (__, ci) => `$${ri * c + ci + 1}`).join(',')})`).join(',');
    const { rows: ins } = await engPool.query(
      `INSERT INTO pbring_sds_condition (${cols.join(',')}) VALUES ${placeholders} RETURNING *`,
      values
    );
    inserted = ins;
  }
  return { cn: normCn, insertedCount: inserted.length, inserted, skippedCount: skipped.length, skipped };
}

module.exports = {
  getConditionRows, upsertConditionRow, deleteConditionRow,
  getConditionHistoryTemplate, createConditionFromHistory,
};
