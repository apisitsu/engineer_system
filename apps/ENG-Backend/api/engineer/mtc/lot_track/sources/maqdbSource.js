'use strict';

/**
 * Lot Status Tracker — maqdb source.
 *
 * Builds the roadmap for one production lot from three `lpb` tables:
 *
 *   lpb.pc_lot          — lot header (key: lot_no + control_no)
 *   lpb.pc_lot_process  — the PLANNED route: one row per step, ordered by `seq`
 *   lpb.pc_production    — the ACTUAL progress: one row per completed run of a step
 *                          (a step can have several — partial runs across days)
 *
 * Step names are enriched from `lpb.eng_process` (code -> JP / EN).
 *
 * "Current step" logic: a step is DONE when it has any pc_production row. The
 * highest planned `seq` that is done is the last completed step; the CURRENT step is
 * the lowest planned `seq` greater than that. Everything after is PENDING.
 *
 * All temporal columns are cast to text in SQL (`to_char`) so no timezone shift can
 * happen on the way out — `comp_date` is a bare DATE and `update_time` a bare
 * TIMESTAMP in this schema.
 */

const { maqPool } = require('../../../../../instance/maq_db');
const { resolveMachines } = require('../machineResolver');
const { SYNC_NOTE } = require('../lotTrackConstants');

const name = 'maqdb';
const isRealtime = false;

const seqNum = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const daysBetween = (a, b) => {
  if (!a || !b) return null;
  const d = (new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000;
  return Number.isFinite(d) ? Math.round(d) : null;
};

/**
 * @param {string} lotNo
 * @param {{ controlNo?: string }} [opts]
 * @returns {Promise<object>} one of:
 *   { found:false }
 *   { found:true, ambiguous:true, candidates:[{lotNo,controlNo,partsNo,...}] }
 *   { found:true, ambiguous:false, source, isRealtime, dataAsOf, syncNote, header, steps, summary }
 */
async function fetchLot(lotNo, opts = {}) {
  const lot = String(lotNo || '').trim();
  if (!lot) return { found: false };
  const controlNo = opts.controlNo ? String(opts.controlNo).trim() : null;

  // 1 — resolve the lot (lot_no alone is not unique; key is lot_no + control_no)
  const params = [lot];
  let ctrlFilter = '';
  if (controlNo) { params.push(controlNo); ctrlFilter = 'AND l.control_no = $2'; }
  const { rows: lots } = await maqPool.query(
    `SELECT l.lot_no, l.control_no, l.parts_no, l.qc_cd, l.gnk, l.plant,
            l.req_qty, l.fp_qty, l.comp_qty, l.first_wc, l.charge_person,
            l.remark1, l.remark2,
            to_char(l.entry_date,     'YYYY-MM-DD') AS entry_date,
            to_char(l.m_put_date,     'YYYY-MM-DD') AS m_put_date,
            to_char(l.comp_plan_date, 'YYYY-MM-DD') AS comp_plan_date,
            to_char(l.fp_comp_date,   'YYYY-MM-DD') AS fp_comp_date,
            to_char(l.comp_date,      'YYYY-MM-DD') AS comp_date,
            to_char(l.update_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS update_time
       FROM lpb.pc_lot l
      WHERE UPPER(TRIM(l.lot_no)) = UPPER($1) ${ctrlFilter}
      ORDER BY l.update_time DESC NULLS LAST`,
    params,
  );
  if (!lots.length) return { found: false };
  if (lots.length > 1 && !controlNo) {
    return {
      found: true,
      ambiguous: true,
      candidates: lots.map((r) => ({
        lotNo: r.lot_no,
        controlNo: r.control_no,
        partsNo: r.parts_no,
        gnk: r.gnk,
        reqQty: num(r.req_qty),
        entryDate: r.entry_date,
        remark: (r.remark1 || '').trim() || null,
        updateTime: r.update_time,
      })),
    };
  }
  const H = lots[0];

  // 2, 3 & 4 — planned route, actual production, and the GLOBAL sync clock, in parallel
  const [{ rows: route }, { rows: prod }, { rows: syncRows }] = await Promise.all([
    maqPool.query(
      `SELECT seq, process, proc_name
         FROM lpb.pc_lot_process
        WHERE lot_no = $1 AND control_no = $2`,
      [H.lot_no, H.control_no],
    ),
    maqPool.query(
      // `cycle_time` is SECONDS per piece, `set_time` SECONDS of setup (verified live:
      // SWAGE 8s/pc + 1200s, SPH-BRG-TURN 80s/pc + 3000s). `operation_time` is NOT a
      // duration — it equals `good_qty` on ~88% of rows — so it is not read here.
      `SELECT seq, process, proc_name, wc, machine, operator,
              good_qty, bad_qty, cycle_time, set_time, cycle_qty,
              next_wc,
              to_char(comp_date, 'YYYY-MM-DD') AS comp_date,
              to_char(update_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS update_time
         FROM lpb.pc_production
        WHERE lot_no = $1 AND control_no = $2`,
      [H.lot_no, H.control_no],
    ),
    // When the maqdb mirror itself was last refreshed from the shop floor — the
    // newest write anywhere in pc_production (~3×/day). Distinct from a lot's own
    // last-move time: a lot parked in a queue legitimately has an old per-lot stamp
    // while the feed is current. ~0.2 s, whole-table max.
    maqPool.query(`SELECT to_char(max(update_time), 'YYYY-MM-DD"T"HH24:MI:SS') AS sync_at FROM lpb.pc_production`),
  ]);
  const syncAsOf = syncRows[0]?.sync_at || null;

  // 4 — step names
  const codes = [...new Set([...route, ...prod].map((r) => String(r.process || '').trim()).filter(Boolean))];
  const nameByCode = new Map();
  if (codes.length) {
    const { rows } = await maqPool.query(
      `SELECT process_code, process_name, process_eng FROM lpb.eng_process WHERE process_code = ANY($1)`,
      [codes],
    );
    for (const r of rows) nameByCode.set(String(r.process_code).trim(), { jp: r.process_name, en: r.process_eng });
  }

  // aggregate production rows per seq (a step can run over several days / machines)
  const prodBySeq = new Map();
  for (const r of prod) {
    const k = String(r.seq ?? '').trim();
    if (!prodBySeq.has(k)) {
      prodBySeq.set(k, {
        seq: k, process: String(r.process || '').trim(),
        firstComp: null, lastComp: null, lastUpdate: null,
        goodQty: 0, badQty: 0, runSeconds: 0,
        machines: new Set(), wcs: new Set(), operators: new Set(),
        lastMachine: null, lastWc: null, lastOperator: null, nextWc: null,
        cycleSec: null, setupSec: null, _lastKey: '',
      });
    }
    const a = prodBySeq.get(k);
    a.goodQty += num(r.good_qty);
    a.badQty += num(r.bad_qty);
    // standard machine time for this run = cycle × pieces + setup (all seconds)
    a.runSeconds += num(r.cycle_time) * num(r.good_qty) + num(r.set_time);
    if (r.comp_date) {
      if (!a.firstComp || r.comp_date < a.firstComp) a.firstComp = r.comp_date;
      if (!a.lastComp || r.comp_date > a.lastComp) a.lastComp = r.comp_date;
    }
    if (r.machine) a.machines.add(String(r.machine).trim());
    if (r.wc) a.wcs.add(String(r.wc).trim());
    if (r.operator) a.operators.add(String(r.operator).trim());
    // "last" attributes = the row with the greatest (comp_date, update_time)
    const key = `${r.comp_date || ''}|${r.update_time || ''}`;
    if (key >= a._lastKey) {
      a._lastKey = key;
      a.lastMachine = r.machine ? String(r.machine).trim() : a.lastMachine;
      a.lastWc = r.wc ? String(r.wc).trim() : a.lastWc;
      a.lastOperator = r.operator ? String(r.operator).trim() : a.lastOperator;
      a.nextWc = r.next_wc ? String(r.next_wc).trim() : a.nextWc;
      if (r.cycle_time != null) a.cycleSec = num(r.cycle_time);
      if (r.set_time != null) a.setupSec = num(r.set_time);
    }
    if (r.update_time && (!a.lastUpdate || r.update_time > a.lastUpdate)) a.lastUpdate = r.update_time;
  }

  // resolve machine labels
  const allMachineCodes = [];
  for (const a of prodBySeq.values()) allMachineCodes.push(...a.machines);
  const machineMap = await resolveMachines(allMachineCodes);
  const labelOf = (code) => (code ? (machineMap.get(code)?.label || code) : null);

  // planned route, ordered; de-dup identical (seq,process) rows the plan sometimes carries
  const seenRoute = new Set();
  const plannedSteps = route
    .map((r) => ({ seq: String(r.seq ?? '').trim(), process: String(r.process || '').trim(), procName: (r.proc_name || '').trim() }))
    .filter((r) => {
      const k = `${r.seq}|${r.process}`;
      if (seenRoute.has(k)) return false;
      seenRoute.add(k);
      return true;
    })
    .sort((a, b) => seqNum(a.seq) - seqNum(b.seq));

  // fold in any produced step the plan somehow lacks (rare, but keep it visible)
  for (const a of prodBySeq.values()) {
    if (!plannedSteps.some((p) => p.seq === a.seq)) {
      plannedSteps.push({ seq: a.seq, process: a.process, procName: '', _offPlan: true });
    }
  }
  plannedSteps.sort((a, b) => seqNum(a.seq) - seqNum(b.seq));

  const maxDoneSeq = [...prodBySeq.values()].reduce((m, a) => Math.max(m, seqNum(a.seq)), 0);
  const nextSeq = plannedSteps
    .map((p) => seqNum(p.seq))
    .filter((n) => n > maxDoneSeq && n !== Number.MAX_SAFE_INTEGER)
    .sort((a, b) => a - b)[0];

  let prevLastComp = H.entry_date || null;
  const steps = plannedSteps.map((p, i) => {
    const a = prodBySeq.get(p.seq);
    const isDone = !!a;
    const n = seqNum(p.seq);
    const status = isDone ? 'done' : (n === nextSeq ? 'current' : 'pending');
    const nm = nameByCode.get(p.process) || {};
    const machineCodes = a ? [...a.machines] : [];
    // Inferred window for this process: the source has no per-step start date, so
    // "start" = when the previous step finished (the lot left it and entered this
    // one's queue); for the first step it is the lot entry date.
    const startDate = isDone ? prevLastComp : null;
    const dwellDays = isDone ? daysBetween(prevLastComp, a.lastComp) : null;
    if (isDone && a.lastComp) prevLastComp = a.lastComp;

    return {
      order: i + 1,
      seq: p.seq,
      processCode: p.process,
      nameEn: p.procName || nm.en || p.process,
      nameJp: nm.jp || null,
      status,
      offPlan: !!p._offPlan,
      machineCode: a ? a.lastMachine : null,
      machineLabel: a ? labelOf(a.lastMachine) : null,
      machineCodes,
      machineLabels: machineCodes.map(labelOf),
      wc: a ? a.lastWc : null,
      nextWc: a ? (a.nextWc || null) : null,
      operator: a ? a.lastOperator : null,
      operators: a ? [...a.operators] : [],
      goodQty: a ? a.goodQty : null,
      badQty: a ? a.badQty : null,
      cycleSec: a ? a.cycleSec : null,
      setupSec: a ? a.setupSec : null,
      runMinutes: a ? Math.round(a.runSeconds / 60) : null,
      firstCompDate: a ? a.firstComp : null,
      compDate: a ? a.lastComp : null,
      startDate,   // inferred — previous step's completion (lot entry date for step 1)
      dwellDays,
    };
  });

  const doneSteps = steps.filter((s) => s.status === 'done');
  const currentStep = steps.find((s) => s.status === 'current') || null;
  const totalSteps = steps.length;
  const firstComp = doneSteps.map((s) => s.firstCompDate).filter(Boolean).sort()[0] || null;
  const lastComp = doneSteps.map((s) => s.compDate).filter(Boolean).sort().slice(-1)[0] || null;

  // `dataAsOf` is THIS LOT's last movement — newest pc_production write for the lot,
  // or the lot header's own update_time if it has no production rows yet. A lot
  // sitting in a queue has an old value here even though the feed (`syncAsOf`) is
  // current. The two are shown separately so "stale" is not misread as a broken sync.
  const lotUpdatedAt = [...prodBySeq.values()].map((a) => a.lastUpdate).filter(Boolean).sort().slice(-1)[0]
    || H.update_time || null;

  return {
    found: true,
    ambiguous: false,
    source: name,
    isRealtime,
    dataAsOf: lotUpdatedAt,   // kept for compatibility — same as lotUpdatedAt
    lotUpdatedAt,
    syncAsOf,
    syncNote: SYNC_NOTE,
    header: {
      lotNo: H.lot_no,
      controlNo: H.control_no,
      partsNo: H.parts_no,
      gnk: H.gnk,
      plant: H.plant,
      qcCd: (H.qc_cd || '').trim() || null,
      reqQty: num(H.req_qty),
      fpQty: num(H.fp_qty),
      compQty: num(H.comp_qty),
      firstWc: (H.first_wc || '').trim() || null,
      chargePerson: (H.charge_person || '').trim() || null,
      remark: [H.remark1, H.remark2].map((x) => (x || '').trim()).filter(Boolean).join(' · ') || null,
      entryDate: H.entry_date,
      mPutDate: H.m_put_date,
      compPlanDate: H.comp_plan_date,
      fpCompDate: H.fp_comp_date,
      compDate: H.comp_date,
      lotUpdateTime: H.update_time,
      isCancelled: ['CANCEL', 'CLOSE'].includes((H.remark1 || '').trim().toUpperCase()),
    },
    steps,
    summary: {
      totalSteps,
      doneSteps: doneSteps.length,
      remainingSteps: totalSteps - doneSteps.length,
      hasCurrent: !!currentStep,
      currentOrder: currentStep ? currentStep.order : null,
      currentStepName: currentStep ? currentStep.nameEn : null,
      currentMachine: null, // a step becomes "current" before it is produced — machine unknown
      lastDoneStepName: doneSteps.length ? doneSteps[doneSteps.length - 1].nameEn : null,
      lastMachine: doneSteps.length ? doneSteps[doneSteps.length - 1].machineLabel : null,
      pctComplete: totalSteps ? Math.round((doneSteps.length / totalSteps) * 100) : 0,
      totalRunMinutes: doneSteps.reduce((m, s) => m + (s.runMinutes || 0), 0),
      firstProducedDate: firstComp,
      lastProducedDate: lastComp,
      elapsedDays: daysBetween(firstComp, lastComp),
    },
  };
}

module.exports = { name, isRealtime, fetchLot };
