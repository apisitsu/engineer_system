'use strict';

/**
 * PB Ring tooling — read queries.
 *
 * The whole dataset (~2,000 tooling rows, a few thousand SDS condition/param
 * rows) is small enough that, exactly like the standalone prototype it ports,
 * the HW → Process code → Machine cascade and the status-card counts are
 * computed in JS over an in-memory array rather than pushed into SQL — the SQL
 * side only narrows by `part_group` when one is picked, to keep the row count
 * fetched on each request small for everything downstream.
 *
 * `process_code` can hold more than one code for a row (e.g. "1021 & 1022"),
 * exactly as in the prototype, so matching splits on non-digit characters
 * rather than doing a plain equality check.
 */

const { engPool } = require('../../../instance/eng_db');
const { maqPool } = require('../../../instance/maq_db');
const { toItemNo } = require('../mtc/utils/cnFormat');
const { TABLES, STATUS, RING_TYPES, RECEIVED_BUT_INCOMPLETE, COST_ALERT, NO_PO, NO_TOOL_CODE, WAITING, WAITING_STATUSES, machineKey } = require('./pbringConstants');
const { PbringError } = require('./pbringCostService');
const { listPending } = require('./pbringCostDetectService');

const pcsOf = (r) => String(r.process_code || '').split(/[^0-9]+/).filter(Boolean);
const hasPc = (r, pc) => !pc || pcsOf(r).includes(pc);
const isUnused = (r) => String(r.tool_code || '').trim().toUpperCase() === 'UNUSED';
const uniq = (a) => [...new Set(a)].sort();

/** Which of PO / unit price / receive date are missing — UNUSED rows never count as missing. */
function missing(r) {
  if (isUnused(r)) return { po: false, price: false, date: false };
  return {
    po: !String(r.po_no || '').trim(),
    price: !(Number(r.unit_price) > 0),
    date: !String(r.receive_date || '').trim(),
  };
}

/** No tool_code entered at all yet — UNUSED is a real value, not a blank. */
function noToolCode(r) {
  return !isUnused(r) && !String(r.tool_code || '').trim();
}

/** Shared by `search()`'s row filter and `getFilters()`'s cross-card counts. */
function matchesStatus(r, status) {
  if (status === RECEIVED_BUT_INCOMPLETE) {
    const m = missing(r);
    return r.status === 'Received' && (m.po || m.price || m.date);
  }
  if (status === NO_PO) return missing(r).po;
  if (status === NO_TOOL_CODE) return noToolCode(r);
  if (status === WAITING) return WAITING_STATUSES.includes(r.status);
  return (r.status || 'Unknown') === status;
}

async function fetchAllTooling() {
  const { rows } = await engPool.query(`SELECT * FROM ${TABLES.TOOLING} ORDER BY id`);
  return rows;
}

/**
 * Cascading filter options + status-card counts, given the filters already
 * picked. Each group's own counts ignore its own filter (so you can see what
 * else is available under it) but respect every other active filter — same
 * rule as the prototype's `hit()`/`renderCards()`.
 */
async function getFilters({ hw, pc, mc, status, ring }) {
  const all = await fetchAllTooling();

  const hwOptions = uniq(all.map((r) => r.part_group).filter(Boolean));
  const base = hw ? all.filter((r) => r.part_group === hw) : all;

  const pcOptions = uniq(base.flatMap(pcsOf));
  const pcNameOf = {};
  base.forEach((r) => pcsOf(r).forEach((code) => { if (!pcNameOf[code]) pcNameOf[code] = r.process_name; }));

  const mcBase = base.filter((r) => hasPc(r, pc));
  const mcOptions = uniq(mcBase.map((r) => r.mc_type).filter(Boolean));

  // Scoped only by HW/Process/Machine, ignoring BOTH status and ring — the
  // stable "everything" denominator for Total and the two Ring cards, so
  // Outer/Inner Ring always shows its true total and never reacts to a status
  // card picked below it (Received/Waiting/etc. still react to Ring, just not
  // the other way around — see Row 2's own `cardBase('status')` below).
  const hwPcMcBase = all.filter((r) =>
    (!hw || r.part_group === hw) && hasPc(r, pc) && (!mc || r.mc_type === mc));

  // Status-card counts respect ring (an OTHER active filter) but ignore
  // status itself — same "every group but this one" rule as the prototype's
  // `renderCards()`.
  const cardBase = (skip) => all.filter((r) =>
    (!hw || r.part_group === hw) && hasPc(r, pc) && (!mc || r.mc_type === mc)
    && (skip === 'status' || !status || matchesStatus(r, status))
    && (skip === 'ring' || !ring || r.part_name === ring));

  const statusCounts = {};
  cardBase('status').forEach((r) => {
    const s = r.status || 'Unknown';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
    const m = missing(r);
    if (s === 'Received' && (m.po || m.price || m.date)) {
      statusCounts[RECEIVED_BUT_INCOMPLETE] = (statusCounts[RECEIVED_BUT_INCOMPLETE] || 0) + 1;
    }
    // Unlike RECEIVED_BUT_INCOMPLETE, counted across every status, not just
    // Received — this is the full candidate pool detectMissingCost() scans.
    if (m.po) statusCounts[NO_PO] = (statusCounts[NO_PO] || 0) + 1;
    if (noToolCode(r)) statusCounts[NO_TOOL_CODE] = (statusCounts[NO_TOOL_CODE] || 0) + 1;
  });
  const statusCards = STATUS
    .flatMap((s) => (s === 'Received' ? [s, RECEIVED_BUT_INCOMPLETE] : [s]))
    .map((s) => ({
      value: s,
      label: s === RECEIVED_BUT_INCOMPLETE ? 'Incomplete Cost Info' : s,
      count: statusCounts[s] || 0,
    }))
    .filter((c) => c.count > 0 || c.value === RECEIVED_BUT_INCOMPLETE);
  if (statusCounts[NO_TOOL_CODE] > 0) {
    statusCards.push({ value: NO_TOOL_CODE, label: 'No Tool Code', count: statusCounts[NO_TOOL_CODE] });
  }
  if (statusCounts[NO_PO] > 0) {
    statusCards.push({ value: NO_PO, label: 'No PO', count: statusCounts[NO_PO] });
  }

  const ringCounts = {};
  hwPcMcBase.forEach((r) => {
    if (r.part_name) ringCounts[r.part_name] = (ringCounts[r.part_name] || 0) + 1;
  });
  const ringCards = RING_TYPES
    .map((v) => ({ value: v, label: v === 'Outer ring' ? 'Outer Ring' : 'Inner Ring', count: ringCounts[v] || 0 }))
    .filter((c) => c.count > 0);

  // One alert-style card for maqdb-detected cost updates awaiting approval
  // (`pbring_cost_pending`, status='pending') — hidden entirely when there's
  // nothing to show, same as the ring cards' zero-count filter above.
  const pending = await listPending('pending');
  const pendingIds = new Set(pending.map((p) => p.tooling_id));
  const alertCount = hwPcMcBase.filter((r) => pendingIds.has(r.id)).length;
  const costAlertCard = alertCount > 0 ? { value: COST_ALERT, label: 'Cost Update Found', count: alertCount } : null;

  return {
    hw: hwOptions.map((v) => ({ value: v, label: v })),
    processCode: pcOptions.map((v) => ({ value: v, label: `${v} — ${pcNameOf[v] || ''}` })),
    machine: mcOptions.map((v) => ({ value: v, label: v })),
    // Total row count under the current HW/Process/Machine filters only —
    // ignores status AND ring, same scope as the Ring cards above.
    totalCount: hwPcMcBase.length,
    statusCards,
    ringCards,
    costAlertCard,
  };
}

/** Section 1/2/3 of the original prototype's search view. */
async function search({ hw, pc, mc, status, ring, alert }) {
  // The alert card (maqdb-detected cost updates), a status card, and a ring
  // card are each deliberately not scoped to HW/Process/Machine the way the
  // rest of this page is — any of them is meant to work as "show me this set"
  // on its own. The guard used to only exempt the alert card, so clicking
  // Received/UNUSED/Waiting/a ring card with no HW/Process/Machine picked
  // updated that card's own count (via getFilters) but left the table hidden.
  if (!hw && !pc && !mc && !status && !ring && alert !== COST_ALERT) return { empty: true };

  const all = await fetchAllTooling();
  const cnOf = (r) => String(r.cn || '').split(/\s*\/\s*/).filter(Boolean);
  const hwRows = hw ? all.filter((r) => r.part_group === hw) : all;
  const cnSet = hw ? new Set(hwRows.flatMap(cnOf)) : null;

  let tooling = hwRows.filter((r) => (!mc || r.mc_type === mc) && hasPc(r, pc));
  let note = hw
    ? (cnSet.size ? `HW ${hw} — CN found: ${[...cnSet].join(', ')}` : `HW ${hw} — no CN/Setup Data Sheet found yet (Part No. not in Setup)`)
    : (alert === COST_ALERT && !pc && !mc ? 'All items with a detected cost update, across every HW'
      : (!pc && !mc && (status || ring) ? '' : 'Searched by Machine / Process code (no CN)'));

  if (status) tooling = tooling.filter((r) => matchesStatus(r, status));
  if (ring) tooling = tooling.filter((r) => r.part_name === ring);

  // Every row gets its pending detection attached (if any) regardless of the
  // alert filter, so the badge/approve action shows up in normal browsing
  // too — the filter just narrows the list down to rows that have one.
  const pending = await listPending('pending');
  const pendingByToolingId = new Map(pending.map((p) => [p.tooling_id, p]));
  if (alert === COST_ALERT) tooling = tooling.filter((r) => pendingByToolingId.has(r.id));

  const paramRows = await engPool.query(
    `SELECT * FROM ${TABLES.SDS_PARAM}
      WHERE ($1::text[] IS NULL OR cn = ANY($1))
        AND ($2::text IS NULL OR process_code = $2)
        AND ($3::text IS NULL OR mc_key = $3)
      ORDER BY cn, process_code LIMIT 200`,
    [cnSet ? [...cnSet] : null, pc || null, mc ? machineKey(mc) : null]
  );

  const condRows = await engPool.query(
    `SELECT * FROM ${TABLES.SDS_CONDITION}
      WHERE ($1::text[] IS NULL OR cn = ANY($1))
        AND ($2::text IS NULL OR process_code = $2)
        AND ($3::text IS NULL OR mc_key = $3)
      ORDER BY cn, process_code LIMIT 500`,
    [cnSet ? [...cnSet] : null, pc || null, mc ? machineKey(mc) : null]
  );

  const totalPrice = tooling.reduce((a, r) => a + (Number(r.total_price) || 0), 0);
  const received = tooling.filter((r) => r.status === 'Received').length;
  // No slice here any more: a HW-scoped search was always small enough that
  // 500 was a generous ceiling, but status/ring-only searches (now reachable
  // with no HW/Process/Machine picked — see the guard above) can legitimately
  // return over 1,000 rows. `autoFillMissingCn` is a bulk fetch + bulk UPDATE,
  // so the full set is cheap; the frontend's own virtualized table is what
  // keeps rendering that many rows fast, not a server-side page size.
  const filled = await autoFillMissingCn(tooling);
  const toolingPage = filled.map((r) => {
    const p = pendingByToolingId.get(r.id);
    return p ? {
      ...r,
      detected: { id: p.id, po_no: p.detected_po_no, price: p.detected_price, qty: p.detected_qty, receive_date: p.detected_receive_date },
    } : r;
  });

  return {
    empty: false,
    note,
    kpi: {
      sdsParamCount: paramRows.rowCount,
      sdsConditionCount: condRows.rowCount,
      toolingCount: tooling.length,
      received,
      totalPrice,
    },
    tooling: toolingPage,
    conditions: condRows.rows,
    params: paramRows.rows,
  };
}

/** Summary/dashboard tab. */
async function summary() {
  const all = await fetchAllTooling();
  const totalPrice = all.reduce((a, r) => a + (Number(r.total_price) || 0), 0);
  const received = all.filter((r) => r.status === 'Received');
  const receivedPrice = received.reduce((a, r) => a + (Number(r.total_price) || 0), 0);
  // Replaces the old "Missing Price" KPI, which counted a condition that cut
  // across every status (so it overlapped with Received and didn't sum to
  // totalRows — e.g. 408 of the 922 were themselves Received). `status` is a
  // single field per row, so Received/Waiting/UNUSED/Unknown is a true
  // partition: count and value both add up to the totals above exactly.
  const waitingRows = all.filter((r) => WAITING_STATUSES.includes(r.status));
  const waitingPrice = waitingRows.reduce((a, r) => a + (Number(r.total_price) || 0), 0);

  const byStatus = {};
  all.forEach((r) => {
    const k = r.status || 'Unknown';
    byStatus[k] = byStatus[k] || { n: 0, v: 0, po: 0, price: 0, date: 0, incomplete: 0 };
    byStatus[k].n++;
    byStatus[k].v += Number(r.total_price) || 0;
    const m = missing(r);
    byStatus[k].po += m.po ? 1 : 0;
    byStatus[k].price += m.price ? 1 : 0;
    byStatus[k].date += m.date ? 1 : 0;
    byStatus[k].incomplete += (m.po || m.price || m.date) ? 1 : 0;
  });

  const byMachine = {};
  all.forEach((r) => {
    const k = r.mc_type || '-';
    byMachine[k] = byMachine[k] || { n: 0, v: 0 };
    byMachine[k].n++;
    byMachine[k].v += Number(r.total_price) || 0;
  });

  return {
    totalRows: all.length,
    totalPrice,
    received: { count: received.length, totalPrice: receivedPrice },
    waiting: { count: waitingRows.length, totalPrice: waitingPrice },
    // Default order is by value (highest first), same as byMachine below —
    // not by row count, so the table opens showing where the money is.
    byStatus: Object.entries(byStatus).map(([status, v]) => ({ status, ...v })).sort((a, b) => b.v - a.v),
    byMachine: Object.entries(byMachine).map(([mc_type, v]) => ({ mc_type, ...v })).sort((a, b) => b.v - a.v),
  };
}

/**
 * CN for a Part No., resolved live from `lpb.eng_item` (maqdb) — the same
 * factory-authoritative part↔control-no record the SDS pipeline itself reads,
 * via the shared `cnFormat` converter (control_no "C29-04065" → PB Ring's own
 * 6-digit CN form "294065"). This replaces the standalone prototype's static,
 * Excel-snapshot PN→CN table (`MaqTooling` sheet, re-built only when someone
 * re-ran its `etl.py`): live coverage measured 36/36 (100%) of the distinct
 * Part Nos already in `pbring_tooling`, against 56% for the old snapshot.
 */
async function lookupCnByPartNo(partNo) {
  if (!partNo) return null;
  const { rows } = await maqPool.query(
    'SELECT control_no FROM lpb.eng_item WHERE parts_no = $1 LIMIT 1',
    [partNo]
  );
  return rows.length ? toItemNo(rows[0].control_no) : null;
}

/**
 * Bulk auto-fill for a whole result page: every row with no `cn` whose Part No.
 * resolves in `lpb.eng_item` gets written immediately — no edit, no save, no
 * approval step. This is a deliberate exception to this file's "cn is only
 * ever changed by an explicit PUT" rule, chosen over a review-first flow
 * because, measured against the 36 distinct Part Nos actually in use here,
 * `lpb.eng_item` resolved every one to exactly one control_no (zero
 * ambiguous matches) — see the pbring plan for the tradeoff this accepts.
 * Fails open: a maqdb hiccup here must never break the search response.
 */
async function autoFillMissingCn(rows) {
  const missing = rows.filter((r) => !r.cn && r.part_no);
  if (!missing.length) return rows;
  try {
    const partNos = [...new Set(missing.map((r) => r.part_no))];
    const { rows: found } = await maqPool.query(
      'SELECT parts_no, control_no FROM lpb.eng_item WHERE parts_no = ANY($1)',
      [partNos]
    );
    const cnByPartNo = new Map();
    for (const f of found) {
      if (!cnByPartNo.has(f.parts_no)) cnByPartNo.set(f.parts_no, toItemNo(f.control_no));
    }
    const toWrite = missing
      .filter((r) => cnByPartNo.has(r.part_no))
      .map((r) => [r.id, cnByPartNo.get(r.part_no)]);
    if (!toWrite.length) return rows;

    const values = toWrite.map((_, i) => `($${i * 2 + 1}::bigint, $${i * 2 + 2}::text)`).join(',');
    await engPool.query(
      `UPDATE ${TABLES.TOOLING} AS t SET cn = v.cn, updated_at = now()
         FROM (VALUES ${values}) AS v(id, cn) WHERE t.id = v.id`,
      toWrite.flat()
    );
    const writtenCn = new Map(toWrite);
    return rows.map((r) => (writtenCn.has(r.id) ? { ...r, cn: writtenCn.get(r.id) } : r));
  } catch (err) {
    console.error('[pbring] autoFillMissingCn failed (non-fatal):', err.message);
    return rows;
  }
}

// ---- Add new HW, from history — mirrors the prototype's "เพิ่ม HW ใหม่" tab ----

const mostCommon = (arr) => {
  const counts = {};
  arr.filter((v) => v !== '' && v != null).forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : '';
};

/** Every process code ever seen, with its process name — for the Process-code picker. */
async function getHistoryProcessCodes() {
  const all = await fetchAllTooling();
  const nameOf = {};
  all.forEach((r) => pcsOf(r).forEach((code) => { if (!nameOf[code]) nameOf[code] = r.process_name; }));
  return uniq(all.flatMap(pcsOf)).map((v) => ({ value: v, label: `${v} — ${nameOf[v] || ''}` }));
}

/** Machines ever paired with a given process code — for the cascading Machine picker. */
async function getHistoryMachines(pc) {
  const all = await fetchAllTooling();
  return uniq(all.filter((r) => hasPc(r, pc)).map((r) => r.mc_type).filter(Boolean));
}

/**
 * The template the prototype's `templateFor()` built: every distinct tooling
 * item ever used on this (process, machine) pair (excluding UNUSED rows), the
 * maker/M-C-No. that shows up most often for it, and how many of the Part Nos
 * that used this process+machine also used this exact item — pre-ticked
 * (`use: true`) only when that's ≥50% of them, same threshold as the prototype.
 */
async function getHistoryTemplate(pc, mc) {
  const all = await fetchAllTooling();
  const rows = all.filter((r) =>
    pcsOf(r).includes(pc) && r.mc_type === mc && !isUnused(r) && String(r.tooling_item || '').trim());
  const partNoCount = new Set(rows.map((r) => r.part_no)).size;

  const groups = new Map();
  const order = [];
  rows.forEach((r) => {
    const key = r.tooling_item.trim().toUpperCase();
    if (!groups.has(key)) {
      groups.set(key, { item: r.tooling_item.trim(), parts: new Set(), maker: [], mcNo: [] });
      order.push(key);
    }
    const g = groups.get(key);
    g.parts.add(r.part_no);
    g.maker.push(r.maker);
    g.mcNo.push(r.mc_no);
  });
  const processName = (rows[0] || {}).process_name || '';

  return order
    .map((k) => groups.get(k))
    .sort((a, b) => b.parts.size - a.parts.size)
    .map((g) => ({
      process_code: pc, process_name: processName, mc_type: mc,
      mc_no: mostCommon(g.mcNo), tooling_item: g.item, tool_code: '', maker: mostCommon(g.maker),
      machine_qty: null, order_qty: null,
      use: partNoCount > 0 && g.parts.size / partNoCount >= 0.5,
      hist: `${g.parts.size}/${partNoCount}`,
    }));
}

/**
 * Commit reviewed draft rows as new `pbring_tooling` rows for one HW/Part No.
 * CN is resolved live the same way `autoFillMissingCn` does if the caller
 * didn't supply one. A row already present for this (part_group, part_no,
 * process_code, mc_type, tooling_item) is skipped unless `force` — mirrors the
 * prototype's "ซ้ำกับที่มีอยู่ — เพิ่มต่อไหม?" confirm, as a report instead of
 * a blocking dialog.
 */
async function createToolingFromHistory({ part_group, part_no, part_name, cn, rows, force }, createdBy) {
  if (!part_group || !part_no) throw new PbringError(400, 'HW and Part No. are required');
  const candidates = (rows || []).filter((r) => String(r.tooling_item || '').trim());
  if (!candidates.length) throw new PbringError(400, 'No items to add');

  const resolvedCn = cn || await lookupCnByPartNo(part_no);

  const { rows: existingRows } = await engPool.query(
    `SELECT process_code, mc_type, upper(tooling_item) AS item FROM ${TABLES.TOOLING}
      WHERE part_group = $1 AND part_no = $2`,
    [part_group, part_no]
  );
  const seen = new Set(existingRows.map((r) => `${r.process_code}|${r.mc_type}|${r.item}`));

  const cols = ['part_group', 'cn', 'part_name', 'part_no', 'process_code', 'process_name', 'mc_type',
    'mc_key', 'mc_no', 'tooling_item', 'tool_code', 'tool_code_base', 'maker', 'machine_qty', 'order_qty',
    'status', 'created_by'];
  const values = [];
  const skipped = [];
  for (const r of candidates) {
    const item = String(r.tooling_item).trim();
    const key = `${r.process_code}|${r.mc_type}|${item.toUpperCase()}`;
    if (seen.has(key) && !force) { skipped.push({ ...r, tooling_item: item }); continue; }
    seen.add(key);
    const toolCode = String(r.tool_code || '').trim();
    values.push([
      part_group, resolvedCn || null, part_name || null, part_no, r.process_code, r.process_name || null,
      r.mc_type, machineKey(r.mc_type), r.mc_no || null, item, toolCode || null,
      toolCode.split(' ')[0] || null, r.maker || null, r.machine_qty ?? null, r.order_qty ?? null,
      toolCode.toUpperCase() === 'UNUSED' ? 'UNUSED' : 'Wait Request Quotation', createdBy || null,
    ]);
  }

  let inserted = [];
  if (values.length) {
    const c = cols.length;
    const placeholders = values.map((_, ri) =>
      `(${Array.from({ length: c }, (__, ci) => `$${ri * c + ci + 1}`).join(',')})`).join(',');
    const { rows: ins } = await engPool.query(
      `INSERT INTO ${TABLES.TOOLING} (${cols.join(',')}) VALUES ${placeholders} RETURNING *`,
      values.flat()
    );
    inserted = ins;
  }
  return { cn: resolvedCn, insertedCount: inserted.length, inserted, skippedCount: skipped.length, skipped };
}

module.exports = {
  getFilters, search, summary, lookupCnByPartNo, autoFillMissingCn,
  getHistoryProcessCodes, getHistoryMachines, getHistoryTemplate, createToolingFromHistory,
};
