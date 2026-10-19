'use strict';

/**
 * PB Ring grid rendering — turns the live SDS "Standard" grid_json into a
 * printable HTML page, independent of the live SDS pipeline.
 *
 * `buildGridPdfHtml` is duplicated from `sdsV2HeadlessController.js:1281+`
 * with the image-collision/IMAGE_EXTENTS machinery stripped — PB Ring has no
 * tooling-image table/feature. Kept otherwise as-is: it's generic grid->HTML
 * geometry (merges/borders/fills/text-spill), not SDS business logic.
 *
 * The Phase 5 pipeline this file originally carried (`pbring_grid_template`,
 * `pbring_excel_mapping`, the `{{param}}`-literal-cell import from xlsx, and
 * the full template CRUD/editor it fed) was retired 2026-10-14 — Phase 6
 * (below, `loadStandardGridLive`/`buildStandardGridForMachine`) replaced it
 * for every machine back on 2026-10-07, and both tables had been genuinely
 * read by nothing since. Dropped by migration
 * `20261014_pbring_drop_grid_template_phase5.js`; `--revert` recreates them
 * empty (the Phase 5 data itself was only ever an import artifact, not
 * anything an admin had edited — see that migration's header).
 */

const { engPool } = require('../../../instance/eng_db');
const { maqPool } = require('../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../instance/instance');
const sdsV2SearchService = require('../mtc/services/sdsV2SearchService');

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Resolves (cn, machine_type_name, process_code) into:
 *   paramMap: { [param_key]: value } from pbring_sds_param.params (JSONB)
 *   conditionByToolNumber: { [tool_number]: pbring_sds_condition row }
 * No pbring_tooling join — verified live that none of the 373 placeholders
 * across the 18 imported templates are cost/PO/qty-shaped.
 */
async function buildPbRingValueMap(cn, machineTypeName, processCode) {
  const { rows: paramRows } = await engPool.query(
    `SELECT cn, pn, process_code, process_name, machine, ct, rev, params
       FROM pbring_sds_param WHERE cn = $1 AND process_code = $2 AND mc_key = $3 LIMIT 1`,
    [cn, processCode, machineTypeName]
  );
  const paramRow = paramRows[0];
  // Header fields (Machine/PN/CN/Process/...) live as their own row columns
  // on pbring_sds_param, not inside params JSONB — only the grinding-condition
  // values (Top_GW_Speed, DressTimeR, ...) are in there. Verified live: a row
  // with a populated `params` blob had `{{CN}}`/`{{PN}}` render blank until
  // these were merged in.
  const paramMap = paramRow ? { ...paramRow.params } : {};
  if (paramRow) {
    paramMap.CN = paramRow.cn;
    paramMap.Process_Code = paramRow.process_code;
    paramMap.Process = paramRow.process_name;
    paramMap.Machine = paramRow.machine;
  }

  // PART NO / REV / MAT'TYPE / CYCLE TIME (2026-10-11): pulled live from the
  // same factory tables the real SDS uses — lpb.eng_item, eng_cad_rev_data,
  // eng_bom+eng_mcode, eng_process_info, via the same searchByCn the live SDS
  // PDF calls — rather than pbring_sds_param's own pn/ct/rev columns. PB
  // Ring's CN is a real factory CN (CLAUDE.md "why strict separation
  // matters"), so the lookup applies unchanged. `rev`/`ct` on
  // pbring_sds_param were a one-time xlsx import that never carried a value
  // for any of the 28 PB Ring machines (verified live: 0 of ~2,900 rows) —
  // `pn` did import and stays as a last-resort fallback for a CN the factory
  // lookup itself can't find. Fails open: a factory-lookup error must never
  // block rendering the rest of the sheet.
  let factory = null;
  try {
    factory = await sdsV2SearchService.searchByCn(cn, maqPool, rodpcPool, engPool);
  } catch (err) {
    console.warn(`[pbring] factory header lookup failed for cn=${cn}: ${err.message}`);
  }
  let factoryCt = null;
  if (factory && Array.isArray(factory.process_info)) {
    const fp = processCode
      ? factory.process_info.find((r) => String(r.process_code) === String(processCode)) || factory.process_info[0]
      : factory.process_info[0];
    if (fp) {
      const forThisMachine = fp.actual_ct_by_machine?.[machineTypeName];
      factoryCt = forThisMachine ? forThisMachine.ct : (fp.actual_ct ?? fp.ct ?? null);
    }
  }
  paramMap.PN = (factory && factory.parts_no) || paramRow?.pn || '';
  paramMap.REV = (factory && factory.dwg_rev) || 'NC';
  paramMap.Revision = paramMap.REV;
  paramMap.Material = factory ? (factory.sheet_material ?? factory.material?.material ?? '') : '';
  paramMap.CT = factoryCt != null ? String(factoryCt) : (paramRow?.ct ?? '');
  // Setup Data Sheet's OWN revision (cell AH4 on the Standard template — distinct
  // from the part drawing's REV above). pbring_sds_param.rev is the only place PB
  // Ring ever recorded it; check that old data first, and start at 'NC' when it
  // was never set (true for every row today, same default the live SDS approval
  // flow uses for its own sds_rev).
  paramMap.SdsRev = paramRow?.rev || 'NC';
  // Every PB Ring part is this one fixed category, unlike live SDS where
  // CATEGORY is derived per part class (Ball/Race/Body/... Parts) — it is
  // not a per-CN factory value to look up. Still overridable like every
  // other auto-filled field (applyHeaderOverridesToGrid / Turning's manual
  // field run after this and win on a non-blank admin value).
  paramMap.Category = 'PB Ring Parts';

  const { rows: condRows } = await engPool.query(
    `SELECT * FROM pbring_sds_condition WHERE cn = $1 AND process_code = $2 AND mc_key = $3`,
    [cn, processCode, machineTypeName]
  );
  const conditionByToolNumber = {};
  for (const row of condRows) conditionByToolNumber[row.tool_number] = row;

  await applyMachineToolWhitelistOverride(conditionByToolNumber, cn, machineTypeName, processCode);

  return { paramMap, conditionByToolNumber };
}

/**
 * `pbring_machine_tool` whitelist override (user decision, 2026-10-19).
 *
 * `pbring_sds_condition` was a one-time 2026-10-02 import from a separate,
 * now-unmaintained SDS source file — unlike `pbring_tooling` (the Tooling
 * List this session actively syncs), nothing keeps it current, and the two
 * can disagree per CN (confirmed live: HIGRIND1D's BLADE). Mirrors how the
 * real SDS system separates "which family belongs in this T-slot"
 * (`sds_machine_tool`, keyed by machine+process only) from "what the
 * factory's live plan says for this CN" — `pbring_machine_tool` plays the
 * first role, `pbring_tooling` the second.
 *
 * For every numbered T-slot THIS CN already has a condition row for, look up
 * the whitelist's family for (machine, process, tool_number); if
 * `pbring_tooling` has a row for this exact CN whose own family (same
 * `toolingFamily()` rule the whitelist was seeded with) matches, that row's
 * tool_code_base/maker REPLACE the condition table's tooling_no/maker.
 * Every other field on the row (vc/f/ap/nose_r/insert_info/…, needed by
 * Turning and not present on `pbring_tooling` at all) is untouched.
 *
 * Fails open at every step: no whitelist rows, no Tooling List rows, or no
 * family match for this CN all leave the condition table's own value exactly
 * as it was — this only ever overrides when it has somewhere better to get
 * the value from, never blanks a slot.
 */
async function applyMachineToolWhitelistOverride(conditionByToolNumber, cn, machineTypeName, processCode) {
  const numberedSlots = Object.keys(conditionByToolNumber).filter((k) => /^T\d+$/.test(k));
  if (!numberedSlots.length) return;

  const { rows: whitelist } = await engPool.query(
    `SELECT tool_number, family FROM pbring_machine_tool
      WHERE machine_type_name = $1 AND process_code = $2 AND tool_number = ANY($3)`,
    [machineTypeName, processCode, numberedSlots]
  );
  if (!whitelist.length) return;

  const { rows: toolingRows } = await engPool.query(
    `SELECT id, tool_code_base, maker, rank FROM pbring_tooling WHERE mc_key = $1 AND cn = $2 AND tool_code_base IS NOT NULL`,
    [machineTypeName, cn]
  );
  if (!toolingRows.length) return;

  const byFamily = new Map();
  for (const r of toolingRows) {
    const fam = toolingFamily(r.tool_code_base);
    if (!fam) continue;
    if (!byFamily.has(fam)) byFamily.set(fam, []);
    byFamily.get(fam).push(r);
  }

  for (const { tool_number, family } of whitelist) {
    const candidates = byFamily.get(family);
    if (!candidates || !candidates.length) continue;
    const existing = conditionByToolNumber[tool_number];
    let best;
    if (candidates.length === 1) {
      best = candidates[0];
    } else {
      // A family covering several real items (e.g. G371-02 = PUSHER + COLLAR
      // (FRONT) + COLLAR (BACK) — the same ambiguity the tooling-image match
      // was widened to handle earlier this session) is NOT safe to resolve
      // by rank/id alone: that picked one winner and silently overwrote
      // every other same-family slot with it (reported live, 2026-10-19 —
      // T2/T3/T4 all became "PUSHER"). Only override here when one candidate's
      // own tool_code_base exactly matches what the condition table already
      // had for this slot — pins the refresh to the SAME physical item
      // instead of guessing among several different ones. No exact match
      // means genuinely ambiguous: skip, keep the condition table's value.
      best = existing && existing.tooling_no
        ? candidates.find((c) => c.tool_code_base === existing.tooling_no)
        : undefined;
      if (!best) continue;
    }
    conditionByToolNumber[tool_number] = {
      ...existing,
      tool_number,
      tooling_no: best.tool_code_base,
      maker: best.maker || existing.maker,
    };
  }
}

/** Duplicated from sdsV2HeadlessController.js:1281+, image machinery stripped. */
function buildGridPdfHtml(grid) {
  const rows = Math.max(1, parseInt(grid.rows, 10) || 56);
  const cols = Math.max(1, parseInt(grid.cols, 10) || 48);
  const borders = grid.borders || {};
  const fills = grid.fills || {};
  const cells = grid.cells || {};
  const merges = Array.isArray(grid.merges) ? grid.merges : [];

  const fit = (arr, n, d) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) && Number(arr[i]) > 0 ? Number(arr[i]) : d));
  const colW = fit(grid.colW, cols, 30);
  const rowH = fit(grid.rowH, rows, 22);
  const sumW = colW.reduce((a, b) => a + b, 0) || 1;
  const sumH = rowH.reduce((a, b) => a + b, 0) || 1;
  // A4 landscape (297x210mm) minus the 5mm @page margin on every side.
  const PAGE_W_MM = 287;
  const PAGE_H_MM = 200;
  // Scale to whichever dimension is tighter, not width alone — a template
  // taller than what the width-derived scale leaves room for (Turning_PB:
  // 64 rows, vs the ~59-row templates this was tuned against) silently
  // spilled onto a second page with width-only scaling, since nothing ever
  // shrank it to fit the page's height. table width below tracks the
  // actual scaled width so a height-constrained render doesn't get
  // stretched back out to the full page width.
  const scale = Math.min(PAGE_W_MM / sumW, PAGE_H_MM / sumH);
  const tableWMm = sumW * scale;

  const covered = new Set();
  const spanAt = {};
  for (const m of merges) {
    const r1 = +m.r1, c1 = +m.c1, r2 = +m.r2, c2 = +m.c2;
    if ([r1, c1, r2, c2].some((n) => Number.isNaN(n))) continue;
    spanAt[`${r1},${c1}`] = { rs: r2 - r1 + 1, cs: c2 - c1 + 1, r2, c2 };
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { if (r === r1 && c === c1) continue; covered.add(`${r},${c}`); }
  }

  const edge = (e) => (e ? `${e.w}px ${e.s} ${e.c}` : 'none');
  const cellBorders = (r, c, span) => {
    const b0 = borders[`${r},${c}`] || {};
    if (!span) return b0;
    return {
      t: b0.t,
      l: b0.l,
      r: (borders[`${r},${span.c2}`] || {}).r,
      b: (borders[`${span.r2},${c}`] || {}).b,
    };
  };

  const colgroup = colW.map((w) => `<col style="width:${(w * scale).toFixed(3)}mm">`).join('');

  const baseOf = (r, c) => (covered.has(`${r},${c}`)
    ? (Object.keys(spanAt).find((k) => {
        const s = spanAt[k]; const [br, bc] = k.split(',').map(Number);
        return r >= br && r <= s.r2 && c >= bc && c <= s.c2;
      }) || `${r},${c}`)
    : `${r},${c}`);
  const hasInk = (r, c) => {
    if (c < 0 || c >= cols) return true;
    const d = cells[baseOf(r, c)];
    return !!(d && (d.img || (d.v != null && String(d.v).trim() !== '')));
  };
  const wMm = (c) => (colW[c] || 0) * scale;
  const spillWidthMm = (r, c, span, align) => {
    const c1 = c;
    const c2 = span ? span.c2 : c;
    let avail = 0;
    for (let i = c1; i <= c2; i++) avail += wMm(i);
    if (align !== 'right') for (let i = c2 + 1; i < cols && !hasInk(r, i); i++) avail += wMm(i);
    if (align !== 'left') for (let i = c1 - 1; i >= 0 && !hasInk(r, i); i--) avail += wMm(i);
    return avail;
  };

  let body = '';
  for (let r = 0; r < rows; r++) {
    body += `<tr style="height:${(rowH[r] * scale).toFixed(3)}mm">`;
    for (let c = 0; c < cols; c++) {
      if (covered.has(`${r},${c}`)) continue;
      const span = spanAt[`${r},${c}`];
      const b = cellBorders(r, c, span);
      const fill = fills[`${r},${c}`];
      const cd = cells[`${r},${c}`];
      const f = cd && cd.f, a = cd && cd.a;
      const st = [
        `border-top:${edge(b.t)}`,
        `border-right:${edge(b.r)}`,
        `border-bottom:${edge(b.b)}`,
        `border-left:${edge(b.l)}`,
        fill ? `background:${fill}` : '',
        f && f.name ? `font-family:'${f.name}',Arial,sans-serif` : '',
        `font-size:${(((f && f.size) || 10) * 1.3333 * scale).toFixed(3)}mm`,
        f && f.bold ? 'font-weight:bold' : '',
        f && f.italic ? 'font-style:italic' : '',
        f && f.color ? `color:${f.color}` : '',
        `text-align:${(a && a.h) || 'left'}`,
        `vertical-align:${(a && a.v) || 'middle'}`,
        a && a.wrap ? 'white-space:normal' : 'white-space:nowrap',
        a && a.wrap ? 'overflow:hidden' : 'overflow:visible',
      ].filter(Boolean).join(';');
      const sp = span ? `${span.cs > 1 ? ` colspan="${span.cs}"` : ''}${span.rs > 1 ? ` rowspan="${span.rs}"` : ''}` : '';

      let content;
      if (cd && cd.img) {
        const rs = span ? span.rs : 1;
        let cellHmm = 0;
        for (let i = r; i < r + rs; i++) cellHmm += (rowH[i] || 0) * scale;
        const imgPct = ((cd.imgScale || 1) * 100).toFixed(1);
        content = `<div style="height:${cellHmm.toFixed(3)}mm;width:100%;overflow:hidden;`
          + `display:flex;align-items:center;justify-content:center;">`
          + `<img src="${cd.img}" style="max-width:${imgPct}%;max-height:${imgPct}%;object-fit:contain;display:block;"></div>`;
      } else {
        content = escHtml(cd && cd.v);
        if (content && !(a && a.wrap)) {
          const mm = spillWidthMm(r, c, span, (a && a.h) || 'left');
          content = `<span style="display:inline-block;max-width:${mm.toFixed(3)}mm;`
            + `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle;">${content}</span>`;
        }
      }
      body += `<td${sp} style="${st}">${content}</td>`;
    }
    body += '</tr>';
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 5mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    table { width: ${tableWMm.toFixed(3)}mm; border-collapse: collapse; table-layout: fixed; }
    td { padding: 0 0.4mm; line-height: 1.05; }
  </style></head><body>
    <table><colgroup>${colgroup}</colgroup><tbody>${body}</tbody></table>
  </body></html>`;
}

/**
 * Lightweight existence check for SdsV2Page.jsx's merged process-row flow
 * (2026-10-11 redesign — folded into the normal process list/PDF picker
 * instead of a separate "PB Ring PDF" button). Returns one entry per
 * (machine, process_code) combo, carrying `machine` (the real display name,
 * e.g. "KVD-300CRII") and `process_name` so the frontend can render a PB
 * Ring combo indistinguishably from a real process_info/machine-picker row
 * without a second round trip — not just which machines have data, since a
 * machine alone is not enough to render (the route also requires
 * process_code).
 */
async function hasDataForCn(cn) {
  const { rows: paramRows } = await engPool.query(
    `SELECT DISTINCT mc_key, process_code, machine, process_name FROM pbring_sds_param WHERE cn = $1`,
    [cn]
  );
  const { rows: condRows } = await engPool.query(
    `SELECT DISTINCT mc_key, process_code, machine FROM pbring_sds_condition WHERE cn = $1`,
    [cn]
  );
  const comboByKey = new Map();
  for (const r of [...paramRows, ...condRows]) {
    const key = `${r.mc_key}||${r.process_code}`;
    const existing = comboByKey.get(key) || {};
    // pbring_sds_condition has no process_name column, so a combo seen only
    // there keeps whatever the param-row pass already set (or null) rather
    // than being overwritten blank.
    comboByKey.set(key, {
      machine_type_name: r.mc_key,
      process_code: r.process_code,
      machine: r.machine || existing.machine || null,
      process_name: existing.process_name || r.process_name || null,
    });
  }
  const combos = [...comboByKey.values()];
  if (!combos.length) return { exists: false, machines: [] };

  // has_template used to mean "has a grid_template_id assigned" (Phase 5);
  // every machine renders through the live Standard layout unconditionally
  // now (Phase 6), so any active, registered machine can render — the field
  // is kept (SdsV2Page.jsx still carries it in its combo state) but is now
  // simply "is this machine active and known", same test as the registry
  // query itself.
  const mcKeys = [...new Set(combos.map((c) => c.machine_type_name))];
  const { rows: mtRows } = await engPool.query(
    `SELECT machine_type_name FROM pbring_machine_type WHERE machine_type_name = ANY($1) AND is_active`,
    [mcKeys]
  );
  const activeNames = new Set(mtRows.map((r) => r.machine_type_name));

  const machines = combos
    .filter((c) => activeNames.has(c.machine_type_name))
    .map((c) => ({
      machine_type_name: c.machine_type_name,
      process_code: c.process_code,
      machine: c.machine,
      process_name: c.process_name,
      has_template: true,
    }));

  return { exists: machines.length > 0, machines };
}

/** GET: active machine types (used by the Approval Roles / Auto Stamp / Parameter Config tabs' machine picker). */
async function listMachineTypes() {
  const { rows } = await engPool.query(
    `SELECT id, machine_type_name, source_sheet_name, is_active
       FROM pbring_machine_type
      WHERE is_active
      ORDER BY machine_type_name`
  );
  return rows;
}

/**
 * Phase 6: reuse the live SDS "Standard" grid layout instead of the Phase 5
 * imported-xlsx templates (user feedback: the 18 imported layouts render
 * "เพี้ยน" — inconsistent formatting, one per author/date — and the real
 * system doesn't use literal {{param}} cells at all). See the "Phase 6"
 * section of the plan file for the full reasoning and the CN-collision risk
 * this design avoids.
 *
 * `loadStandardGridLive` is READ-ONLY against `sds_grid_template` — a plain
 * `SELECT ... WHERE id = 1`, no JOIN to `sds_machine_type_code`, no CN
 * involved anywhere in the query. This can never touch real production
 * part/tooling data; it only ever reads the shared layout definition.
 */
const SDS_STANDARD_TEMPLATE_ID = 1; // sds_grid_template.id, is_default=true, confirmed live 2026-10-07

async function loadStandardGridLive() {
  const { rows } = await engPool.query(`SELECT grid_json FROM sds_grid_template WHERE id = $1`, [SDS_STANDARD_TEMPLATE_ID]);
  if (!rows.length) return null;
  return JSON.parse(rows[0].grid_json);
}

// Four PB Ring machines are centerless grinders that use the real
// "Centerless" layout, not "Standard" — user request (2026-10-14/15).
// HIGRIND1D/OC18BR150/OC20BR200 confirmed live against
// sds_machine_type_code.grid_template_id (their exact real-world
// counterparts HI-GRIND-1-D/OC-18BR-150/OC-20BR-200 are all assigned id 4).
// OMIYA has no such real registry match (its pbring_sds_param/condition
// are empty, and its own import source_sheet_name is 'cgm_omiya' — a
// machine CODE prefix, not a name in sds_machine_type_code) — added on the
// user's own domain confirmation that OMIYA is the same centerless-grinder
// equipment family as the other three regardless of which specific
// machine code it shows up under. Still READ-ONLY, same safety argument as
// loadStandardGridLive — a different id, same plain SELECT, no CN, no
// JOIN. Safe to swap freely: the T01-T20/header cell ADDRESSES
// applyToolSlotsToGrid/applyHeaderToGrid use come from sds_excel_mapping
// WHERE machine_type_name IS NULL — shared across every real machine
// regardless of which grid_template they're assigned, Centerless-using
// real machines included — so this is a drop-in layout swap, not a second
// rendering pipeline.
const SDS_CENTERLESS_TEMPLATE_ID = 4; // sds_grid_template.id, name='Centerless', confirmed live 2026-10-14
const CENTERLESS_MACHINE_NAMES = new Set(['HIGRIND1D', 'OC18BR150', 'OC20BR200', 'OMIYA']);

async function loadCenterlessGridLive() {
  const { rows } = await engPool.query(`SELECT grid_json FROM sds_grid_template WHERE id = $1`, [SDS_CENTERLESS_TEMPLATE_ID]);
  if (!rows.length) return null;
  return JSON.parse(rows[0].grid_json);
}

/**
 * The real T01-T20 "Tooling No:"/"Maker:" value-cell addresses, read live
 * from `sds_excel_mapping` (machine_type_name IS NULL — shared across every
 * grinding machine, confirmed live: all 40 rows present, M/S/Y/AE/AK columns
 * stepping every 5 slots, rows 24/25 -> 34/35 -> 44/45 -> 54/55). Read-only,
 * no CN involved — same safety argument as `loadStandardGridLive`.
 */
async function loadToolSlotAddressesLive() {
  const { rows } = await engPool.query(
    `SELECT cell_address, param_key FROM sds_excel_mapping
      WHERE machine_type_name IS NULL AND (param_key LIKE 'tool_dwg_no_T%' OR param_key LIKE 'maker_T%' OR param_key LIKE 'tool_name_T%')`
  );
  const addr = {};
  const FIELD = { tool_dwg_no: 'dwgNo', maker: 'maker', tool_name: 'name' };
  for (const r of rows) {
    const m = /^(tool_dwg_no|maker|tool_name)_T(\d+)$/.exec(r.param_key);
    if (!m) continue;
    const slot = `T${m[2].padStart(2, '0')}`;
    addr[slot] = addr[slot] || {};
    addr[slot][FIELD[m[1]]] = r.cell_address;
  }
  return addr; // { T01: { dwgNo: 'M24', maker: 'M25', name: 'L16' }, ... T20 }
}

/**
 * Header field addresses (Machine/Part No/C-N/Process/Rev/CT), read live from
 * the same shared `sds_excel_mapping` rows — confirmed live: B3/M3/M4/Z3/AC3/
 * T3/B4. Read-only, no CN involved — same safety argument as the other two
 * live-read helpers above.
 */
// paramMap's own keys are capitalized (CN/PN/Machine/Process_Code/Process/CT/REV)
// — buildPbRingValueMap merges them in matching the original xlsx's {{}}
// placeholder spelling, not sds_excel_mapping's lowercase param_key naming.
const HEADER_FIELD_TO_PARAM_KEY = {
  machine_type_name: 'Machine', parts_no: 'PN', cn: 'CN',
  process_code: 'Process_Code', process_name: 'Process', dwg_rev: 'REV', ct: 'CT',
  material: 'Material', sds_rev: 'SdsRev', category: 'Category',
};
async function loadHeaderAddressesLive() {
  const { rows } = await engPool.query(
    `SELECT cell_address, param_key FROM sds_excel_mapping
      WHERE machine_type_name IS NULL AND param_key = ANY($1)`,
    [Object.keys(HEADER_FIELD_TO_PARAM_KEY)]
  );
  const addr = {};
  for (const r of rows) addr[r.param_key] = r.cell_address;
  return addr; // { machine_type_name: 'B3', parts_no: 'M3', ... }
}

function applyHeaderToGrid(grid, headerAddresses, paramMap) {
  for (const [sdsField, pbKey] of Object.entries(HEADER_FIELD_TO_PARAM_KEY)) {
    const cellAddr = headerAddresses[sdsField];
    const value = paramMap[pbKey];
    if (!cellAddr || value == null || value === '') continue;
    const key = addrToRC(cellAddr);
    const existing = grid.cells[key] || {};
    // Merge onto the Standard template's own designed alignment instead of
    // replacing it outright — AH4 (Setup Data Sheet Rev) is authored centered
    // (`a:{h:'center'}`) in the live grid_json, same as the real SDS renderer's
    // own setCell (sdsV2HeadlessController.js) preserves `ex.a`. Overwriting
    // unconditionally printed "NC" left-aligned under a centered header.
    grid.cells[key] = {
      v: String(value),
      f: { name: 'Calibri', size: 10, bold: false, italic: false, ...(existing.f || {}), color: '#c00000' },
      a: { h: null, v: 'middle', wrap: false, ...(existing.a || {}) },
    };
  }
}

// Named (non-numbered) PB Ring tool_number values that DO belong in a T-slot
// (fixtures/jigs), in the fixed order they fill the slots AFTER every
// numbered T{n} tool for that CN. Deliberately does NOT include the
// grinding/dressing-wheel names below — those are condition-list data, not
// tools; see pbring_sds_param_config's source='condition' rows and
// 20261010c/d for why. If a future machine's pbring_sds_condition carries a
// genuinely different named fixture, add it here, not to the GW/DW set.
//
// The original set (F_DW/Upper_GW/Lower_GW/R_DW) only covers KVD300/KVD350's
// naming — every OTHER grinding machine's own Grinding/Rubber Wheel rows use
// plain GW/RW (and TSG300W/TSG300ZNC use Left_GW/Right_GW), none of which
// were excluded, so `orderToolNumbers` fell through to its `rest` branch and
// filled them into the next open numbered T-slots as if they were ordinary
// fixtures — reported live (2026-10-15): HIGRIND1D/294065/1011 printed
// "GRINDING WHEEL"/"RUBBER WHEEL" at T06/T07, which should be empty. Surveyed
// live across every pbring_sds_condition row: the full non-numeric set in use
// is exactly GW, RW, Left_GW, Right_GW, F_DW, Upper_GW, Lower_GW, R_DW —
// affecting 16 machines (HIGRIND1D, GS64PF, KS350R2, KS400B1, KS400B5,
// KS400B6, KS500RF, KSB22, KSB80, KSH150, KSH22, KSR22S2, KSR80D, OC16A,
// OC18BR150, OC20BR200, PSG64DX, TSG300W, TSG300ZNC — every one of them, not
// just HIGRIND1D).
const NAMED_TOOL_ORDER = [];
const CONDITION_SOURCED_TOOL_NUMBERS = new Set([
  'F_DW', 'Upper_GW', 'Lower_GW', 'R_DW', 'GW', 'RW', 'Left_GW', 'Right_GW',
]);

function orderToolNumbers(keys) {
  const usable = keys.filter((k) => !CONDITION_SOURCED_TOOL_NUMBERS.has(k));
  const numbered = usable.filter((k) => /^T\d+$/.test(k)).sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
  const named = NAMED_TOOL_ORDER.filter((k) => usable.includes(k));
  const rest = usable.filter((k) => !numbered.includes(k) && !named.includes(k));
  return [...numbered, ...named, ...rest];
}

/** Writes each (tool_number -> condition row) into its assigned T01-T20 slot's real cell addresses. */
/**
 * Grinding machines have no UI to type pbring_sds_condition.tool_detail
 * directly (Tool Condition is turning-only, by user decision 2026-10-10),
 * so the tool NAME printed in tool_name_T0N comes from
 * pbring_tooling.tooling_item instead — the same "Item" column the
 * Tooling PB Ring monitor page's own search table already shows. Join key
 * is tool_code_base (confirmed live 2026-10-11: '4036-02-0001' -> 'GUIDE
 * PLATE', '4036-01-0001' -> 'CARRIER' for KVD300/294065 — tool_code_base is
 * tool_code with its "(Rev.NC)" suffix already stripped, and matches
 * pbring_sds_condition.tooling_no exactly for a T1-T20 fixture). Bulk
 * fetch, not per-row (db-patterns.md); `DISTINCT ON` picks the earliest row
 * when more than one pbring_tooling entry happens to share a
 * tool_code_base for this CN.
 *
 * The GW/RW rows break the "matches exactly" case (reported live,
 * 2026-10-14): their `tooling_no` carries a trailing spec string the
 * condition table's own data always had — `"GC180K7V82S  455x150x228.6"` —
 * while `tool_code_base` for the very same wheel is just `"GC180K7V82S"`
 * (confirmed: `pbring_tooling` has a GRINDING WHEEL row keyed exactly that
 * way). An exact-string match therefore silently drops the name for every
 * GW/RW slot while T1-T20 fixtures (no spec suffix) kept working — so this
 * went unnoticed until someone looked at a wheel slot specifically.
 * `leadingToken` matches on the code only (text up to the first run of
 * whitespace), which is a no-op for the T1-T20 case (no whitespace in
 * those codes at all) and fixes the GW/RW case.
 */
function leadingToken(s) {
  return String(s || '').trim().split(/\s+/)[0] || '';
}

/**
 * Centerless-group fallback (2026-10-15): OC20BR200/OC18BR150/OMIYA
 * routinely have ZERO `pbring_tooling` rows of their own (confirmed live —
 * OC20BR200 294065/1012 printed T02-T04 with no name at all, "PUSHER"/
 * "COLLAR (FRONT)"/"COLLAR (BACK)" existing only under HIGRIND1D for the
 * identical tool_code_base + cn), because these 4 mc_keys are, by the
 * user's own floor confirmation (2026-10-15, see CENTERLESS_MACHINE_NAMES),
 * the SAME physical centerless-grinder equipment under different floor
 * codes — someone names a fixture once, under whichever code they happened
 * to be editing, not once per code. `cn` stays fixed (still the same
 * physical part); only `mc_key` widens, and only across the group a machine
 * actually belongs to — a non-Centerless machine's lookup is unchanged. A
 * row under the CALLER's own mc_key still wins over a borrowed one.
 */
async function getToolingItemNames(mcKey, cn, toolCodes) {
  if (!toolCodes.length) return {};
  const tokens = [...new Set(toolCodes.map(leadingToken).filter(Boolean))];
  if (!tokens.length) return {};
  const mcKeys = CENTERLESS_MACHINE_NAMES.has(mcKey) ? [...CENTERLESS_MACHINE_NAMES] : [mcKey];
  const { rows } = await engPool.query(
    `SELECT DISTINCT ON (tool_code_base) tool_code_base, tooling_item
       FROM pbring_tooling
      WHERE mc_key = ANY($1) AND cn = $2 AND tool_code_base = ANY($3)
      ORDER BY tool_code_base, (mc_key = $4) DESC, id`,
    [mcKeys, cn, tokens, mcKey]
  );
  return Object.fromEntries(rows.map((r) => [r.tool_code_base, r.tooling_item]));
}

function applyToolSlotsToGrid(grid, conditionByToolNumber, toolAddresses, itemNameByToolCode = {}) {
  const ordered = orderToolNumbers(Object.keys(conditionByToolNumber));
  ordered.forEach((toolNumber, i) => {
    const slot = `T${String(i + 1).padStart(2, '0')}`;
    const addr = toolAddresses[slot];
    if (!addr) return; // ran out of T01-T20 slots — more than 20 tools is not representable here
    const row = conditionByToolNumber[toolNumber];
    const colorCell = (cellAddr, text) => {
      if (!text) return;
      const key = addrToRC(cellAddr);
      grid.cells[key] = { v: String(text), f: { name: 'Calibri', size: 10, bold: false, italic: false, color: '#c00000' }, a: { h: null, v: 'middle', wrap: false } };
    };
    colorCell(addr.dwgNo, row.tooling_no);
    colorCell(addr.maker, row.maker);
    // tool_detail wins if someone ever does type it directly (e.g. a
    // future turning-style edit path); otherwise fall back to the Tooling
    // PB Ring list's own Item name for this tool_code — matched on the
    // leading token only (see getToolingItemNames), so a GW/RW tooling_no
    // carrying a trailing spec string still finds its name.
    colorCell(addr.name, row.tool_detail || (row.tooling_no && itemNameByToolCode[leadingToken(row.tooling_no)]));
  });
}

function colLetterToNum(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function addrToRC(addr) {
  const m = /^([A-Z]+)(\d+)$/.exec(addr);
  return `${parseInt(m[2], 10) - 1},${colLetterToNum(m[1]) - 1}`;
}

/**
 * Manual-entry GRIND/DRESS CONDITION list + Grinding Wheel Config — exact
 * replica of the real SDS "Excel Parameter Config"/"Excel Grinding Wheel
 * Config" admin tabs (`MachineConfigTab` in SdsV2AdminPage.jsx): every cell
 * is hand-typed by an admin, no auto-resolution from `pbring_sds_param`/
 * `pbring_sds_condition`. Same row/column numbering as the real "Standard"
 * template's own A:I condition area (rows 16-58) and AN:AV GW area (rows
 * 53-58), since PB Ring's grinding machines render through that same live
 * template — so a PB Ring admin sees literally the same row numbers as a
 * real SDS admin would on this machine's sheet.
 *
 * Storage: `pbring_sds_parameter`, keyed exactly like `sds_parameter`
 * (`row_N_COL`, `row_N_is_header`, `row_N_COL_type`, `gw_row_N_COL`, ...).
 * `cn IS NULL` = machine default; `cn` set = CN override, optionally scoped
 * to one `process_code` (NULL process_code on an override = applies to every
 * process of that CN). Precedence at render time: CN+process > CN (process-
 * agnostic) > machine default — identical to the real system.
 */
const PBRING_ROW_RANGE = Array.from({ length: 43 }, (_, i) => i + 16); // rows 16-58
const PBRING_COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const PBRING_GW_ROW_RANGE = [53, 54, 55, 56, 57, 58];
const PBRING_GW_COL_LETTERS = ['AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV'];

/** GET admin: machine-default rows (cn=null) or a CN-override's rows (cn set, optionally process_code-scoped). */
async function getManualParams(machineTypeName, cn, processCode) {
  if (!cn) {
    const { rows } = await engPool.query(
      `SELECT id, machine_type_name, param_key, param_value, updated_by, updated_at
         FROM pbring_sds_parameter
        WHERE cn IS NULL AND machine_type_name = $1 AND process_code IS NULL
        ORDER BY param_key`,
      [machineTypeName]
    );
    return rows;
  }
  const pc = processCode || null;
  const { rows } = await engPool.query(
    `SELECT id, cn, machine_type_name, param_key, param_value, process_code, updated_by, updated_at
       FROM pbring_sds_parameter
      WHERE cn = $1 AND machine_type_name = $2 AND process_code IS NOT DISTINCT FROM $3
      ORDER BY param_key`,
    [cn, machineTypeName, pc]
  );
  return rows;
}

/**
 * PUT admin: bulk upsert + delete-by-omission, mirroring the real
 * `/parameters/bulk` semantics. `params` is `[{ param_key, param_value }]`;
 * a key with an empty/omitted value and an existing row id is deleted
 * instead of written as an empty string, so clearing a cell removes the
 * override rather than freezing a blank.
 *
 * Bulk SQL only (one DELETE + chunked multi-row INSERT), not a per-row
 * loop — the machine-default grid alone is 43 rows x 9 cols x 2
 * (value + type) + headers + the GW section, ~930 params in one save.
 * Measured live, 2026-10-12: the old per-row `await` loop (931 sequential
 * round trips in one transaction) took 60s+ and never finished — the
 * frontend's 10s default timeout turned every full-grid Save into "Save
 * failed" on an otherwise healthy backend, same failure shape as the
 * Coverage Report's split_part scan. Chunk size matches db-patterns.md's
 * convention (2000 rows x 6 cols = 12000 params, under pg's 65535 limit);
 * today's payloads are one chunk, but a chunk size caps this against any
 * future config size.
 */
async function saveManualParams(machineTypeName, cn, processCode, params, empno) {
  const cnVal = cn || null;
  const pcVal = cnVal ? (processCode || null) : null; // machine-default rows stay process-agnostic
  const list = Array.isArray(params) ? params : [];

  const toDelete = [];
  const toUpsert = [];
  for (const { param_key, param_value, delete: del } of list) {
    if (!param_key || !String(param_key).trim()) continue;
    const key = String(param_key).trim();
    if (del || param_value == null || param_value === '') toDelete.push(key);
    else toUpsert.push({ key, value: String(param_value) });
  }

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (toDelete.length) {
      await client.query(
        `DELETE FROM pbring_sds_parameter
          WHERE machine_type_name = $1 AND param_key = ANY($2)
            AND COALESCE(cn,'') = COALESCE($3,'') AND COALESCE(process_code,'') = COALESCE($4,'')`,
        [machineTypeName, toDelete, cnVal, pcVal]
      );
    }

    const saved = [];
    const CHUNK = 2000;
    for (let i = 0; i < toUpsert.length; i += CHUNK) {
      const chunk = toUpsert.slice(i, i + CHUNK);
      const COLS = 6;
      const placeholders = chunk.map((_, ri) =>
        `(${Array.from({ length: COLS }, (__, ci) => `$${ri * COLS + ci + 1}`).join(',')})`
      ).join(',');
      const values = chunk.flatMap(({ key, value }) =>
        [cnVal, machineTypeName, key, value, pcVal, empno || null]
      );
      const r = await client.query(
        `INSERT INTO pbring_sds_parameter (cn, machine_type_name, param_key, param_value, process_code, updated_by)
         VALUES ${placeholders}
         ON CONFLICT (COALESCE(cn, '__machine_config__'), machine_type_name, param_key, COALESCE(process_code, '__all__'))
         DO UPDATE SET param_value = EXCLUDED.param_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
         RETURNING id, param_key, param_value`,
        values
      );
      saved.push(...r.rows);
    }

    await client.query('COMMIT');
    return saved;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Render-time resolve: merges machine-default + CN-override (process-scoped
 * beats process-agnostic beats machine-default) into one flat
 * { param_key: param_value } map, for `applyManualParamsToGrid` below.
 */
async function resolveManualParamMap(machineTypeName, cn, processCode) {
  const map = {};
  const { rows: defaults } = await engPool.query(
    `SELECT param_key, param_value FROM pbring_sds_parameter
      WHERE cn IS NULL AND machine_type_name = $1 AND process_code IS NULL`,
    [machineTypeName]
  );
  for (const r of defaults) map[r.param_key] = r.param_value;

  if (cn) {
    const { rows: overrides } = await engPool.query(
      `SELECT param_key, param_value, process_code FROM pbring_sds_parameter
        WHERE cn = $1 AND machine_type_name = $2 AND process_code IS NULL`,
      [cn, machineTypeName]
    );
    for (const r of overrides) map[r.param_key] = r.param_value;

    if (processCode) {
      const { rows: scoped } = await engPool.query(
        `SELECT param_key, param_value FROM pbring_sds_parameter
          WHERE cn = $1 AND machine_type_name = $2 AND process_code = $3`,
        [cn, machineTypeName, processCode]
      );
      for (const r of scoped) map[r.param_key] = r.param_value;
    }
  }
  return map;
}

function colLetterToIndex0(letters) {
  return colLetterToNum(letters) - 1;
}

/**
 * Writes the resolved param map into the grid's A:I condition area and
 * AN:AV GW area, by row/col — same cell styling as the real sheet (red
 * value text). Header rows get the same treatment the real
 * `sdsV2HeadlessController.js`'s `addHeaderRow` gives `row_N_is_header`:
 * a grey-filled band MERGED across the whole section with the row's own
 * label centered and bold, overriding whatever individual cells that row
 * would otherwise have carried — a header row reads as one banner, not
 * nine separate cells one of which happens to be bold. Matters because a
 * plain per-cell `bold` flag (the first cut of this function) is easy to
 * mistake for doing nothing: most header rows only ever populate column A,
 * so nothing else in the row carries content for the bold to be visible
 * against, and there is no fill at all without this.
 */
const PBRING_HDR_BG = '#e0e0e0';

function applyManualParamsToGrid(grid, paramMap) {
  const writeRegion = (rowRange, colLetters, prefix) => {
    for (const r of rowRange) {
      for (const c of colLetters) {
        const key = `${prefix}_${r}_${c}`;
        const value = paramMap[key];
        if (value == null || value === '') continue;
        const isValueType = paramMap[`${key}_type`] === 'value';
        grid.cells[`${r - 1},${colLetterToIndex0(c)}`] = {
          v: String(value),
          f: { name: 'Calibri', size: 9, bold: false, italic: false, color: isValueType ? '#c00000' : '#000000' },
          a: { h: null, v: 'middle', wrap: false },
        };
      }
    }
  };
  writeRegion(PBRING_ROW_RANGE, PBRING_COL_LETTERS, 'row');
  writeRegion(PBRING_GW_ROW_RANGE, PBRING_GW_COL_LETTERS, 'gw_row');

  const addHeaderRow = (rowNum, c1, c2, label) => {
    const r = rowNum - 1;
    const k = `${r},${c1}`;
    grid.fills = grid.fills || {};
    grid.fills[k] = PBRING_HDR_BG;
    grid.cells[k] = {
      v: label || '',
      f: { name: 'Calibri', size: 9, bold: true, italic: false, color: '#000000' },
      a: { h: 'center', v: 'middle', wrap: false },
    };
    for (let c = c1 + 1; c <= c2; c++) delete grid.cells[`${r},${c}`];
    grid.merges = grid.merges || [];
    if (!grid.merges.some((m) => m.r1 === r && m.c1 === c1)) {
      grid.merges.push({ r1: r, c1, r2: r, c2 });
    }
  };
  for (const r of PBRING_ROW_RANGE) {
    if (paramMap[`row_${r}_is_header`] === '1') addHeaderRow(r, 0, 8, paramMap[`row_${r}_A`]);
  }
  for (const r of PBRING_GW_ROW_RANGE) {
    if (paramMap[`gw_row_${r}_is_header`] === '1') {
      addHeaderRow(r, colLetterToIndex0('AN'), colLetterToIndex0('AV'), paramMap[`gw_row_${r}_AN`]);
    }
  }
  return grid;
}

/**
 * Full Phase-6 render: live Standard layout + T01-T20 tool values (existing
 * mechanism, reused) + the new GRIND/DRESS CONDITION list. Does not touch
 * `pbring_grid_template`/`pbring_excel_mapping`/`classifyParam` at all — this
 * is a parallel path to the Phase 5 `loadGridForMachine`/`applyValuesToGrid`,
 * not a replacement yet (the live `/grid/pdf` route still uses Phase 5 until
 * this is reviewed and cut over machine by machine).
 */
/**
 * Header single-cell override fields — exact replica of the real SDS
 * `HEADER_CELL_FIELDS` (MachineConfigTab): hand-typed, machine-default or
 * CN-override, stored as flat `pbring_sds_parameter` keys (no row_/gw_row_
 * prefix) so `resolveManualParamMap` already resolves them with the usual
 * CN+process > CN > machine-default precedence — no separate resolver
 * needed. `program_no`/`program_name`/`category` have no PB Ring auto
 * source and render blank until typed; `ct` already auto-fills from
 * `pbring_sds_param` via `applyHeaderToGrid` — a manual value here
 * overrides that, same as the real system's "an entered value overrides
 * the auto factory value" rule, which is why this must run AFTER
 * `applyHeaderToGrid` in `buildStandardGridForMachine`.
 *
 * Cell addresses confirmed live (shared, machine_type_name IS NULL, same
 * `sds_excel_mapping` rows the real admin's hardcoded Z4/Z5/B4/B5 refer to
 * — PB Ring renders through the identical "Standard" grid_json, so these
 * are the same physical cells): category=B5, ct=B4, program_name=Z5,
 * program_no=Z4.
 */
const PBRING_HEADER_OVERRIDE_FIELDS = [
  { key: 'program_no', label: 'Program No', cell: 'Z4' },
  { key: 'program_name', label: 'Program Name', cell: 'Z5' },
  { key: 'ct', label: 'Cycle Time (CT)', cell: 'B4' },
  { key: 'category', label: 'Category', cell: 'B5' },
];

async function loadHeaderOverrideAddressesLive() {
  const { rows } = await engPool.query(
    `SELECT cell_address, param_key FROM sds_excel_mapping
      WHERE machine_type_name IS NULL AND param_key = ANY($1)`,
    [PBRING_HEADER_OVERRIDE_FIELDS.map((f) => f.key)]
  );
  const addr = {};
  for (const r of rows) addr[r.param_key] = r.cell_address;
  return addr;
}

function applyHeaderOverridesToGrid(grid, headerAddresses, manualParamMap) {
  for (const f of PBRING_HEADER_OVERRIDE_FIELDS) {
    const cellAddr = headerAddresses[f.key];
    const value = manualParamMap[f.key];
    if (!cellAddr || value == null || value === '') continue;
    grid.cells[addrToRC(cellAddr)] = {
      v: String(value),
      f: { name: 'Calibri', size: 10, bold: false, italic: false, color: '#c00000' },
      a: { h: null, v: 'middle', wrap: false },
    };
  }
}

// Grinding Area section title, AN15 — a pre-styled (16pt bold centered) merge
// in the real "Standard"/"Centerless" grid_json that the Standard template
// leaves with no `v` at all; never written by any PB Ring code path before
// this, which is why it rendered blank. The real SDS controller
// (sdsV2HeadlessController.js ~line 1042) computes it dynamically per CN —
// NOT from sds_machine_type_code.grinding_area_label despite what that
// column's sds_excel_mapping row says (that comment is stale; the code is
// the real behavior) — by taking the leading word of the process name off
// "… GRIND" (e.g. process "OD GRIND" -> "OD GRINDING AREA"); 424 of 450
// real machines have no such word and fall through to plain "GRINDING
// AREA". Mirrored here against paramMap.Process so a PB Ring CN on an "OD
// GRIND"/"FACE GRIND"-style process gets the same label a real machine
// would, rather than a hardcoded per-machine string.
const GRINDING_AREA_LABEL_CELL = 'AN15';

function applyGrindingAreaLabelToGrid(grid, paramMap, manualLabel) {
  const grindMatch = String(paramMap.Process || '').match(/^(.*?)\s*grind/i);
  const autoLabel = grindMatch ? `${grindMatch[1].trim().toUpperCase()} GRINDING AREA` : 'GRINDING AREA';
  const value = (manualLabel && String(manualLabel).trim()) || autoLabel;
  const key = addrToRC(GRINDING_AREA_LABEL_CELL);
  grid.cells[key] = { ...(grid.cells[key] || {}), v: value };
}

/**
 * Tooling + Grinding Area photos — same visual boxes as the real SDS sheet
 * (T01-T20 photo boxes, the Grinding Area picture), own tables
 * (`pbring_tooling_image`/`pbring_grinding_image`), simple exact-match keys
 * by explicit user decision (2026-10-08): tooling images key on
 * (machine_type_name, tooling_no) directly — no DWG-family prefix matching;
 * grinding-area images key on the exact (machine_type_name, cn,
 * process_code) triplet — no CN/family/class fallback. Coordinates are
 * duplicated from `sdsV2HeadlessController.js`'s `IMAGE_EXTENTS` (not
 * imported — same no-coupling rule as everywhere else in this file): PB
 * Ring renders through the literal same "Standard" grid_json, so these are
 * the same physical boxes on the same sheet.
 */
const PBRING_IMAGE_EXTENTS = {
  tool_image_T01: { tl: 'K18', br: 'P23' }, tool_image_T02: { tl: 'Q18', br: 'V23' },
  tool_image_T03: { tl: 'W18', br: 'AB23' }, tool_image_T04: { tl: 'AC18', br: 'AH23' },
  tool_image_T05: { tl: 'AI18', br: 'AN23' }, tool_image_T06: { tl: 'K28', br: 'P33' },
  tool_image_T07: { tl: 'Q28', br: 'V33' }, tool_image_T08: { tl: 'W28', br: 'AB33' },
  tool_image_T09: { tl: 'AC28', br: 'AH33' }, tool_image_T10: { tl: 'AI28', br: 'AN33' },
  tool_image_T11: { tl: 'K38', br: 'P43' }, tool_image_T12: { tl: 'Q38', br: 'V43' },
  tool_image_T13: { tl: 'W38', br: 'AB43' }, tool_image_T14: { tl: 'AC38', br: 'AH43' },
  tool_image_T15: { tl: 'AI38', br: 'AN43' }, tool_image_T16: { tl: 'K48', br: 'P53' },
  tool_image_T17: { tl: 'Q48', br: 'V53' }, tool_image_T18: { tl: 'W48', br: 'AB53' },
  tool_image_T19: { tl: 'AC48', br: 'AH53' }, tool_image_T20: { tl: 'AI48', br: 'AN53' },
  grinding_layout_image: { tl: 'AO26', br: 'AU45' },
  // Turning_PB's "TURNING CUTTING LAYOUT" box (title at AK14). Reuses the
  // exact same pbring_grinding_image table/upload mechanism as the Standard
  // template's Grinding Area — same role (one layout photo per machine+cn+
  // process_code), same admin UI, just a different box on a different
  // template. No separate table needed: machine_type_name already keeps a
  // turning machine's photos distinct from any grinding machine's.
  turning_layout_image: { tl: 'AL27', br: 'AR50' },
  // Turning_PB's per-tool cutting-tool photo boxes — one pre-formatted empty
  // merge per slot, confirmed live in sds_grid_template id=9's own grid_json
  // (not guessed): each of the 3 column-blocks (H:K / T:W / AF:AI) has a
  // merge at rows 18:25, 30:37, 42:49, 54:61 — exactly the gap column
  // between each slot's AP/Nose R row and the next slot's Tool Detail row
  // (see turningPbSlotAddresses' rowBase=15+12*slotInBlock). Slot->box
  // mapping follows the same block/slotInBlock split as turningPbSlotAddresses:
  // block0 (H)=T01-T04, block1 (T)=T05-T08, block2 (AF)=T09-T12. Reuses
  // pbring_tooling_image (same table/upload UI as the Standard template's
  // T01-T20 photos) keyed by (machine_type_name, family, tool_name) —
  // nothing new needed there, just new extents + a placement loop.
  turning_tool_image_T01: { tl: 'H18', br: 'K25' }, turning_tool_image_T02: { tl: 'H30', br: 'K37' },
  turning_tool_image_T03: { tl: 'H42', br: 'K49' }, turning_tool_image_T04: { tl: 'H54', br: 'K61' },
  turning_tool_image_T05: { tl: 'T18', br: 'W25' }, turning_tool_image_T06: { tl: 'T30', br: 'W37' },
  turning_tool_image_T07: { tl: 'T42', br: 'W49' }, turning_tool_image_T08: { tl: 'T54', br: 'W61' },
  turning_tool_image_T09: { tl: 'AF18', br: 'AI25' }, turning_tool_image_T10: { tl: 'AF30', br: 'AI37' },
  turning_tool_image_T11: { tl: 'AF42', br: 'AI49' }, turning_tool_image_T12: { tl: 'AF54', br: 'AI61' },
};

const toDataUri = (row) => (row ? `data:${row.mime_type || 'image/jpeg'};base64,${row.image_data.toString('base64')}` : null);

/**
 * DWG-family extraction — same rule as the real `sds_tooling_image`'s own
 * grouping (`split_part(tool_dwg_no,'-',1) || '-' || split_part(tool_dwg_no,'-',2)`):
 * first two dash-segments, e.g. "4036-02-0001" -> "4036-02". A tooling_no
 * with fewer than 2 dash-segments (a plain name, no DWG number) has no
 * meaningful family — falls back to the trimmed value itself, so one photo
 * still covers every row that shares that exact name.
 */
function toolingFamily(toolingNo) {
  const s = String(toolingNo || '').trim();
  const parts = s.split('-');
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : s;
}

/**
 * Family for a pbring_sds_condition row, covering the common Turning case
 * `toolingFamily` alone can't: many Turning rows carry no `tooling_no` at
 * all (no DWG number) and are identified only by `tool_detail`'s plain-text
 * operation description — e.g. "CUT OFF", "OD FINISH", "FACING FINISH"
 * (confirmed live, 2026-10-15: QUICKTURN200500U/294065/0081's T2/T3/T5/T12
 * all have tooling_no NULL). A row like that falls out of every
 * tooling_no-keyed query (getToolingFamilyOptions' dropdown, the tool-image
 * placement loop) and can never get a photo. Grinding rows always carry a
 * real DWG tooling_no in practice, so this only changes behavior for rows
 * that previously had no usable family at all.
 */
function toolingConditionFamily(row) {
  if (row && row.tooling_no && row.tooling_no.trim()) return toolingFamily(row.tooling_no);
  return row && row.tool_detail && row.tool_detail.trim() ? row.tool_detail.trim() : null;
}

/**
 * Dropdown source for the Tooling Images upload UI — every DWG family (or
 * plain name) this machine has actually used, from `pbring_sds_condition`
 * history, most-used first, with a few real tooling_no examples per family
 * so the admin can tell which drawings a family covers before uploading.
 *
 * Also breaks each family down into its distinct resolved tool NAMES (via
 * `pbring_tooling.tooling_item`, leading-token matched the same way
 * `getToolingItemNames` does) — a family covering more than one physical
 * item (confirmed live, 2026-10-14/15: HIGRIND1D's "G371-02" = PUSHER +
 * COLLAR (FRONT) + COLLAR (BACK); KSB22's "37281-05" alone covers four)
 * needs the admin to pick WHICH one before uploading, now that
 * pbring_tooling_image is keyed by (family, tool_name) rather than family
 * alone. `tools: []` means the family never resolved a name in
 * pbring_tooling for any CN — the upload still works, just as the
 * family-wide ('') entry, same as every image uploaded before this change.
 */
async function getToolingFamilyOptions(machineTypeName) {
  const { rows } = await engPool.query(
    `SELECT tool_number, tooling_no, tool_detail, count(*)::int AS n FROM pbring_sds_condition
      WHERE mc_key = $1 AND (
        (tooling_no IS NOT NULL AND trim(tooling_no) <> '') OR
        (tool_detail IS NOT NULL AND trim(tool_detail) <> '')
      )
      GROUP BY tool_number, tooling_no, tool_detail ORDER BY n DESC`,
    [machineTypeName]
  );
  // Natural sort for tool_number labels (T2 before T12) — plain string sort
  // would put "T12" before "T2".
  const toolNumSort = (a, b) => {
    const na = parseInt(String(a).replace(/\D/g, ''), 10);
    const nb = parseInt(String(b).replace(/\D/g, ''), 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) return String(a).localeCompare(String(b));
    return na - nb;
  };
  const byFamily = new Map();
  for (const r of rows) {
    const fam = toolingConditionFamily(r);
    if (!fam) continue;
    if (!byFamily.has(fam)) byFamily.set(fam, { family: fam, count: 0, examples: [], toolNumbers: new Set() });
    const g = byFamily.get(fam);
    g.count += r.n;
    const no = r.tooling_no && r.tooling_no.trim();
    if (no && g.examples.length < 5 && !g.examples.includes(no)) g.examples.push(no);
    if (r.tool_number) g.toolNumbers.add(r.tool_number);
  }

  // Same Centerless-group fallback as getToolingItemNames — OC20BR200/
  // OC18BR150/OMIYA routinely have zero pbring_tooling rows of their own,
  // so without this the "Tool" disambiguation dropdown silently came back
  // empty (`tools: []`) for a family that genuinely covers more than one
  // physical item, even though the render-time name lookup already
  // resolved it via the same group (reported live, 2026-10-15: OC20BR200's
  // G371-02 showed no "3 tools" / no Tool picker, despite printing PUSHER/
  // COLLAR (FRONT)/COLLAR (BACK) correctly on the PDF by then).
  const tokens = [...new Set(rows.map((r) => r.tooling_no && leadingToken(r.tooling_no)).filter(Boolean))];
  const nameMcKeys = CENTERLESS_MACHINE_NAMES.has(machineTypeName) ? [...CENTERLESS_MACHINE_NAMES] : [machineTypeName];
  const nameRows = tokens.length
    ? (await engPool.query(
        `SELECT tool_code_base, tooling_item, count(*)::int AS n FROM pbring_tooling
          WHERE mc_key = ANY($1) AND tool_code_base = ANY($2)
          GROUP BY tool_code_base, tooling_item`,
        [nameMcKeys, tokens]
      )).rows
    : [];
  // A tool_code_base can resolve to more than one name across different CNs
  // (data entry drift) — most-used name per code wins, same "shop's own
  // usage decides" principle sds-pipeline.md's pickFamilyName uses.
  const nameByCode = new Map();
  for (const r of nameRows) {
    const prev = nameByCode.get(r.tool_code_base);
    if (!prev || r.n > prev.n) nameByCode.set(r.tool_code_base, { name: r.tooling_item, n: r.n });
  }
  const namesByFamily = new Map();
  for (const r of rows) {
    if (!r.tooling_no) continue; // tool_detail-only families have no DWG code to resolve a pbring_tooling name from
    const token = leadingToken(r.tooling_no);
    const resolved = nameByCode.get(token);
    if (!resolved || !resolved.name) continue;
    const fam = toolingFamily(r.tooling_no.trim());
    if (!namesByFamily.has(fam)) namesByFamily.set(fam, new Set());
    namesByFamily.get(fam).add(resolved.name);
  }

  return [...byFamily.values()]
    .map((g) => ({
      ...g,
      tools: [...(namesByFamily.get(g.family) || [])].sort(),
      toolNumbers: [...g.toolNumbers].sort(toolNumSort),
    }))
    .sort((a, b) => b.count - a.count);
}

async function listToolingImages(machineTypeName) {
  const { rows } = await engPool.query(
    `SELECT ti.id, ti.machine_type_name, ti.family, ti.tool_name, ti.mime_type, ti.file_name,
            ti.description, ti.created_by, ti.updated_by, ti.created_at, ti.updated_at,
            COALESCE(
              (SELECT json_agg(json_build_object('process_code', s.process_code, 'tool_number', s.tool_number) ORDER BY s.process_code, s.tool_number)
                 FROM pbring_tooling_image_slot s WHERE s.image_id = ti.id),
              '[]'
            ) AS slots
       FROM pbring_tooling_image ti
      WHERE ti.machine_type_name = $1
      ORDER BY ti.family, ti.tool_name`,
    [machineTypeName]
  );
  return rows;
}

/**
 * Dropdown source for the Images tab's slot-tagging picker — every
 * (process_code, tool_number) pair this GRINDING machine actually has in
 * `pbring_sds_condition` history, with a usage count.
 *
 * Returns [] for the 2 Turning machines (user caught this live, 2026-10-19,
 * on QTSMART200M): unlike grinding, where `pbring_machine_tool` proves a
 * numbered T-slot resolves to the SAME DWG family for every CN at a given
 * (machine, process_code) — confirmed live via that table's coverage report
 * — Turning's T-slots are a plain POSITION on the sheet with no such
 * guarantee. Checked live: QTSMART200M/0081's T3 is "OD FINISH" for CN
 * 294065/294067 but "FACING & OD FINISH" for CN 394137/394143 — a photo
 * tagged to (QTSMART200M, 0081, T3) would print the wrong tool for half
 * those CNs. Turning's existing family/tool_detail exact-match (see
 * buildTurningGridForMachine) is already the correct exact match for
 * Turning — it keys on the actual operation text, not its position — so
 * Turning never needed this feature in the first place.
 *
 * Excludes CONDITION_SOURCED_TOOL_NUMBERS (GW/RW/F_DW/Upper_GW/Lower_GW/
 * R_DW/Left_GW/Right_GW) — those rows are GRIND/DRESS CONDITION text data,
 * not a tooling fixture, and `orderToolNumbers` filters them out of the
 * T01-T20 image-box positions entirely (see its header), so a photo tagged
 * to one of them would never be looked up at render time. Offering them
 * here would silently do nothing.
 */
async function getToolingSlotOptions(machineTypeName) {
  if (TURNING_MACHINE_NAMES.includes(machineTypeName)) return [];
  const { rows } = await engPool.query(
    `SELECT process_code, tool_number, count(*)::int AS n
       FROM pbring_sds_condition
      WHERE mc_key = $1 AND tool_number IS NOT NULL AND trim(tool_number) <> ''
        AND tool_number <> ALL($2::text[])
      GROUP BY process_code, tool_number
      ORDER BY process_code, tool_number`,
    [machineTypeName, [...CONDITION_SOURCED_TOOL_NUMBERS]]
  );
  return rows;
}

/**
 * Replaces the full set of exact-slot tags on one image. Rejects (no partial
 * apply) if any requested slot is already claimed by a DIFFERENT image on
 * this machine — a slot can only point at one photo, so re-tagging it here
 * must be an explicit choice (untag the old image first), not a silent steal.
 */
async function setImageSlots(imageId, machineTypeName, slots) {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const owns = await client.query(`SELECT 1 FROM pbring_tooling_image WHERE id = $1 AND machine_type_name = $2`, [imageId, machineTypeName]);
    if (!owns.rows.length) throw new Error('Image not found for this machine');

    if (slots.length) {
      const { rows: conflicts } = await client.query(
        `SELECT process_code, tool_number FROM pbring_tooling_image_slot
          WHERE machine_type_name = $1 AND image_id <> $2
            AND (process_code, tool_number) IN (SELECT * FROM unnest($3::text[], $4::text[]))`,
        [machineTypeName, imageId, slots.map((s) => s.process_code), slots.map((s) => s.tool_number)]
      );
      if (conflicts.length) {
        throw new Error(`Slot already tagged on another image: ${conflicts.map((c) => `${c.process_code}/${c.tool_number}`).join(', ')}`);
      }
    }

    await client.query(`DELETE FROM pbring_tooling_image_slot WHERE image_id = $1`, [imageId]);
    for (const s of slots) {
      await client.query(
        `INSERT INTO pbring_tooling_image_slot (image_id, machine_type_name, process_code, tool_number) VALUES ($1, $2, $3, $4)`,
        [imageId, machineTypeName, s.process_code, s.tool_number]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// `toolName` disambiguates within a family that covers more than one
// physical item (e.g. HIGRIND1D's "G371-02" = PUSHER + COLLAR (FRONT) +
// COLLAR (BACK) — see migration 20261015_ for the live example that forced
// this). '' (the default) means "whole family, no specific tool" — the
// pre-2026-10-15 behaviour, still how every image uploaded before this
// change is stored and still what a render falls back to when no
// tool-specific entry exists (see the render-time lookup in
// buildStandardGridForMachine).
async function upsertToolingImage(machineTypeName, toolingNoOrFamily, toolName, file, description, empno) {
  const family = toolingFamily(toolingNoOrFamily);
  const mime = file.mimetype || 'image/jpeg';
  const { rows } = await engPool.query(
    `INSERT INTO pbring_tooling_image (machine_type_name, family, tool_name, image_data, mime_type, file_name, description, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     ON CONFLICT (machine_type_name, family, tool_name) DO UPDATE SET
       image_data = EXCLUDED.image_data, mime_type = EXCLUDED.mime_type, file_name = EXCLUDED.file_name,
       description = EXCLUDED.description, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING id, machine_type_name, family, tool_name, mime_type, file_name, description, updated_at`,
    [machineTypeName, family, toolName || '', file.data, mime, file.name, description || null, empno || null]
  );
  return rows[0];
}

async function getToolingImageBinary(machineTypeName, toolingNoOrFamily, toolName) {
  const family = toolingFamily(toolingNoOrFamily);
  const { rows } = await engPool.query(
    `SELECT image_data, mime_type, file_name FROM pbring_tooling_image
      WHERE machine_type_name = $1 AND family = $2 AND tool_name = $3`,
    [machineTypeName, family, toolName || '']
  );
  return rows[0] || null;
}

async function deleteToolingImage(machineTypeName, toolingNoOrFamily, toolName) {
  const family = toolingFamily(toolingNoOrFamily);
  const { rowCount } = await engPool.query(
    `DELETE FROM pbring_tooling_image WHERE machine_type_name = $1 AND family = $2 AND tool_name = $3`,
    [machineTypeName, family, toolName || '']
  );
  return rowCount > 0;
}

async function listGrindingImages(machineTypeName) {
  const { rows } = await engPool.query(
    `SELECT id, machine_type_name, cn, process_code, mime_type, file_name, description, created_by, updated_by, created_at, updated_at
       FROM pbring_grinding_image WHERE machine_type_name = $1 ORDER BY cn, process_code`,
    [machineTypeName]
  );
  return rows;
}

async function upsertGrindingImage(machineTypeName, cn, processCode, file, description, empno) {
  const mime = file.mimetype || 'image/jpeg';
  const { rows } = await engPool.query(
    `INSERT INTO pbring_grinding_image (machine_type_name, cn, process_code, image_data, mime_type, file_name, description, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     ON CONFLICT (machine_type_name, cn, process_code) DO UPDATE SET
       image_data = EXCLUDED.image_data, mime_type = EXCLUDED.mime_type, file_name = EXCLUDED.file_name,
       description = EXCLUDED.description, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING id, machine_type_name, cn, process_code, mime_type, file_name, description, updated_at`,
    [machineTypeName, cn, processCode, file.data, mime, file.name, description || null, empno || null]
  );
  return rows[0];
}

async function getGrindingImageBinary(machineTypeName, cn, processCode) {
  const { rows } = await engPool.query(
    `SELECT image_data, mime_type, file_name FROM pbring_grinding_image
      WHERE machine_type_name = $1 AND cn = $2 AND process_code = $3`,
    [machineTypeName, cn, processCode]
  );
  return rows[0] || null;
}

async function deleteGrindingImage(machineTypeName, cn, processCode) {
  const { rowCount } = await engPool.query(
    `DELETE FROM pbring_grinding_image WHERE machine_type_name = $1 AND cn = $2 AND process_code = $3`,
    [machineTypeName, cn, processCode]
  );
  return rowCount > 0;
}

/**
 * Places an image at a fixed extent's top-left cell, merging the range to
 * fill it — skips placement if any text was already written inside that
 * box (defensive; the Standard template's photo boxes and text addresses
 * don't overlap by design, but this mirrors the real system's own guard
 * cheaply). Mutates `grid.cells`/`grid.merges` in place.
 */
function placeImageAtExtent(grid, extentKey, dataUri, scale = 1) {
  if (!dataUri) return;
  const ext = PBRING_IMAGE_EXTENTS[extentKey];
  if (!ext) return;
  const tlRC = addrToRC(ext.tl), brRC = addrToRC(ext.br);
  const [tlR, tlC] = tlRC.split(',').map(Number);
  const [brR, brC] = brRC.split(',').map(Number);

  for (let r = tlR; r <= brR; r++) {
    for (let c = tlC; c <= brC; c++) {
      const existing = grid.cells[`${r},${c}`];
      if (existing && existing.v != null && String(existing.v).trim() !== '') return; // occupied — skip
    }
  }

  const key = `${tlR},${tlC}`;
  grid.cells[key] = { ...(grid.cells[key] || {}), img: dataUri, imgScale: scale };
  grid.merges = grid.merges || [];
  if (!grid.merges.some((m) => m.r1 === tlR && m.c1 === tlC)) {
    grid.merges.push({ r1: tlR, c1: tlC, r2: brR, c2: brC });
  }
}

async function buildStandardGridForMachine(cn, machineTypeName, processCode) {
  const grid = CENTERLESS_MACHINE_NAMES.has(machineTypeName)
    ? await loadCenterlessGridLive()
    : await loadStandardGridLive();
  if (!grid) return null;

  const { paramMap, conditionByToolNumber } = await buildPbRingValueMap(cn, machineTypeName, processCode);

  const headerAddresses = await loadHeaderAddressesLive();
  applyHeaderToGrid(grid, headerAddresses, paramMap);

  const toolAddresses = await loadToolSlotAddressesLive();
  const toolCodes = [...new Set(Object.values(conditionByToolNumber).map((r) => r.tooling_no).filter(Boolean))];
  const itemNameByToolCode = await getToolingItemNames(machineTypeName, cn, toolCodes);
  applyToolSlotsToGrid(grid, conditionByToolNumber, toolAddresses, itemNameByToolCode);

  const manualParamMap = await resolveManualParamMap(machineTypeName, cn, processCode);
  applyManualParamsToGrid(grid, manualParamMap);

  const headerOverrideAddresses = await loadHeaderOverrideAddressesLive();
  applyHeaderOverridesToGrid(grid, headerOverrideAddresses, manualParamMap);

  applyGrindingAreaLabelToGrid(grid, paramMap, manualParamMap.grinding_area_label);

  // Images last — placeImageAtExtent checks for text collisions against
  // everything already written, and tool images need the final ordering
  // (same as the text slots) to land in the right box. Matched by DWG
  // family (toolingFamily) AND the slot's own resolved name (same
  // itemNameByToolCode map the T0N name label uses) — a family-only match
  // was wrong whenever a family covers more than one physical item (see
  // migration 20261015_'s header for the live case). A row with no
  // specific-name image falls back to the family-wide ('') entry, which is
  // what every image uploaded before that migration still is.
  //
  // KSB80-style "NNN.N.NNN-YYY" codes (772.5.000-157 etc.) break both of
  // those rules at once — confirmed live with the user, 2026-10-19: the
  // trailing "-YYY" is a per-CN revision/batch of the SAME physical fixture,
  // so toolingFamily()'s "first two dash segments" (correct for G371-02-0002
  // style 3-segment codes, which drop a real instance suffix) keeps the
  // whole string here and never groups revisions together at all — 294065's
  // own T1-T4 (…-157/…-157/…-157/…-005) never matched images uploaded
  // against a different CN's revision of the same part (…-075/…-075/…-075/
  // …-097), despite the tooling_item NAME agreeing exactly. A second,
  // independent gap: T12's image is tagged "ADAPTER DRIVER" against
  // pbring_tooling's own "DRIVER" — exact family match, name mismatch.
  //
  // Both are solved the same way: when the primary (family, name) key misses,
  // fall back to "the only image under this family" (name ignored) — safe
  // specifically because it's ONLY used when exactly one candidate exists;
  // a family that covers several real items (G371-02 = PUSHER + COLLAR
  // (FRONT) + COLLAR (BACK), the case the name-key was added for) still has
  // 3 candidates and still requires the name to disambiguate, unchanged. The
  // revision case additionally needs a BROADER family key (last dash-segment
  // dropped) to even find the candidate, since the two sides' exact family
  // strings never agree — applied with the same one-candidate safety rule.
  // No family filter on the query: per-machine image counts are small
  // (tens), and the broader-family fallback needs every row regardless of
  // which exact family string it was tagged under.
  const dropLastSegment = (s) => { const i = s.lastIndexOf('-'); return i > 0 ? s.slice(0, i) : null; };
  // Same Centerless-group widening as getToolingItemNames above, applied to
  // images too (user decision, 2026-10-19): BLADE's family is shared
  // equipment across the group (4521-01, 4911-01, …) but a photo is only
  // ever uploaded once, under whichever specific machine happened to be
  // selected at the time — confirmed live, the one BLADE photo on file sits
  // under OC20BR200's family "4911-01" alone. Without this, rendering
  // HIGRIND1D or OC18BR150 could never find it even though the family
  // matches exactly, because the query was scoped to the current machine.
  const imageMcKeys = CENTERLESS_MACHINE_NAMES.has(machineTypeName) ? [...CENTERLESS_MACHINE_NAMES] : [machineTypeName];
  // Exact-slot tags (pbring_tooling_image_slot, 2026-10-19) — an admin can
  // tag a photo with the precise (machine, process_code, tool_number) it
  // belongs to, bypassing every family-matching heuristic below entirely.
  // Checked FIRST, by the row's own tool_number key (not the rendering
  // position `slot` computed further down) — purely additive, so an
  // untagged image still resolves exactly as it did before this change.
  const slotImageRows = await engPool.query(
    `SELECT s.tool_number, ti.family, ti.tool_name, ti.image_data, ti.mime_type
       FROM pbring_tooling_image_slot s
       JOIN pbring_tooling_image ti ON ti.id = s.image_id
      WHERE s.machine_type_name = ANY($1) AND s.process_code = $2`,
    [imageMcKeys, processCode]
  );
  const imgByExactSlot = new Map(slotImageRows.rows.map((r) => [r.tool_number, r]));
  const toolingImageRows = await engPool.query(
    `SELECT family, tool_name, image_data, mime_type FROM pbring_tooling_image WHERE machine_type_name = ANY($1)`,
    [imageMcKeys]
  );
  const imgByFamilyAndName = new Map();
  const imgByFamily = new Map();
  const imgByBroaderFamily = new Map();
  for (const r of toolingImageRows.rows) {
    imgByFamilyAndName.set(`${r.family}||${r.tool_name}`, r);
    if (!imgByFamily.has(r.family)) imgByFamily.set(r.family, []);
    imgByFamily.get(r.family).push(r);
    const broader = dropLastSegment(r.family);
    if (broader) {
      if (!imgByBroaderFamily.has(broader)) imgByBroaderFamily.set(broader, []);
      imgByBroaderFamily.get(broader).push(r);
    }
  }
  const resolveToolImage = (family, resolvedName) => {
    const exact = imgByFamilyAndName.get(`${family}||${resolvedName}`) || imgByFamilyAndName.get(`${family}||`);
    if (exact) return exact;
    const exactRows = imgByFamily.get(family) || [];
    if (exactRows.length === 1) return exactRows[0];
    const broader = dropLastSegment(family);
    if (broader) {
      const broaderExact = imgByFamilyAndName.get(`${broader}||${resolvedName}`) || imgByFamilyAndName.get(`${broader}||`);
      if (broaderExact) return broaderExact;
      const broaderRows = imgByBroaderFamily.get(broader) || [];
      if (broaderRows.length === 1) return broaderRows[0];
    }
    return null;
  };
  const ordered = orderToolNumbers(Object.keys(conditionByToolNumber));
  ordered.forEach((toolNumber, i) => {
    const row = conditionByToolNumber[toolNumber];
    let img = imgByExactSlot.get(toolNumber);
    if (!img) {
      if (!row.tooling_no) return;
      const family = toolingFamily(row.tooling_no);
      const resolvedName = row.tool_detail || itemNameByToolCode[leadingToken(row.tooling_no)] || '';
      img = resolveToolImage(family, resolvedName);
    }
    if (!img) return;
    const slot = `T${String(i + 1).padStart(2, '0')}`;
    placeImageAtExtent(grid, `tool_image_${slot}`, toDataUri(img));
  });

  const grindingImg = await getGrindingImageBinary(machineTypeName, cn, processCode);
  placeImageAtExtent(grid, 'grinding_layout_image', toDataUri(grindingImg));

  return grid;
}

/**
 * Turning support — same Phase 6 principle (live SDS layout, no copy, no
 * write) applied to PB Ring's 2 turning machines (QTSMART200M,
 * QUICKTURN200500U), closing out the last machine with no live-layout
 * coverage so the old Phase 5 mechanism (and the "Grid Templates (PDF)" admin
 * tab that manages it) can be retired.
 *
 * The real "Turning" template (sds_grid_template id=8) is structurally
 * different from Standard: every field (Vc/f/ap/Nose R/Insert/Holder/
 * Overhang/H.Width/Rotation/Hand/Usage) is a STATIC baked-in label in the
 * grid itself (confirmed live — unlike Standard's free-form condition list,
 * which has none), arranged as 8 cutting-tool slots (2 per row-block x 4
 * blocks). There is no free-form numbered condition list on this template at
 * all, so Turning needs no param_config-style table — every value maps
 * directly to a fixed field.
 *
 * Cell addresses are NOT stored as shared (machine_type_name IS NULL) rows
 * the way Standard's are — every real machine using this template has its
 * own, redundant copy in `sds_excel_mapping`. Read X-100's (a real,
 * unrelated SDS machine, confirmed live to use grid_template_id=8) as the
 * reference: the grid itself is identical for every machine assigned to it,
 * so the cell positions are the same regardless of whose mapping row answers
 * the query. Read-only — same safety argument as the Standard helpers above.
 */
// Turning_PB (sds_grid_template id=9, name='Turning_PB') — superseded the
// live SDS "Turning" template (id=8) by user decision (2026-10-10): no real
// SDS machine is assigned to this one (it was built specifically for PB
// Ring and lives only in sds_grid_template, still read-only/never-written
// like everything else in this file), so there is no `sds_excel_mapping`
// row to borrow addresses from the way X-100's did for the old template.
// Addresses below are derived from the reference workbook the user built it
// from (`C:\...\Desktop\Turning_PB.xlsx`, sheet `bfd_qsm150ms` — it still
// carries its original `{{param}}` placeholders; the sheet matching the
// live machine names, `bfd_qt200_500u`, had already had them cleared).
// Verified: extracting all 216 `{{}}` placeholders from that sheet and
// generating addresses with `turningPbSlotAddresses()` below reproduces
// every one of them exactly — this is not a guess at the pattern, it's
// confirmed against the full field list.
//
// Structural change from the old "Turning": 12 tool slots (not 8), laid
// out as 3 column-blocks of 4 slots each (slots 1-4, 5-8, 9-12), each slot
// spanning 12 rows starting at row 15/27/39/51 within its block. No
// dedicated "Tool Name"/drawing-number cell exists on this layout (only
// Tool_Detail) — pbring_sds_condition.tooling_no has nowhere to print here
// and is intentionally left out, rather than invented a cell for it.
const SDS_TURNING_PB_TEMPLATE_ID = 9;
const TURNING_MACHINE_NAMES = ['QTSMART200M', 'QUICKTURN200500U'];
const TURNING_PB_MAX_SLOTS = 12;

async function loadTurningGridLive() {
  const { rows } = await engPool.query(`SELECT grid_json FROM sds_grid_template WHERE id = $1`, [SDS_TURNING_PB_TEMPLATE_ID]);
  if (!rows.length) return null;
  return JSON.parse(rows[0].grid_json);
}

// AH3 (SETUP DATA SHEET REV. value) and AA5 (MAT'L TYPE value) were missed
// when this dict was first built — confirmed live by dumping grid_json id=9's
// row 3/5 cells: AD3/M5/Y5 are the static labels ("SETUP DATA SHEET REV. :",
// "MAT'L SIZE : ", "MAT'L TYPE : ") and AH3/O5/AA5 are their pre-styled
// (color #ff0000) blank value boxes, same convention as every other field
// here. The real "Turning" template's own O5 equivalent has no factory
// source (its sds_excel_mapping seed says so explicitly) — but PB Ring's
// own one-time xlsx import DID capture a per-CN value for it: it lives in
// pbring_sds_param.params as 'Material_size' (verified live, e.g. CN
// 294065/QTSMART200M/0081 -> "Ø 57.15"), just never wired to a cell before.
// paramMap already carries it verbatim (buildPbRingValueMap spreads
// paramRow.params in) — no extra resolution needed, unlike every other
// factory-sourced field above.
const TURNING_PB_HEADER_ADDR = {
  machine_type_name: 'C3', parts_no: 'O3', dwg_rev: 'U3', ct: 'C4', cn: 'O4',
  sds_rev: 'AH3', material: 'AA5', material_size: 'O5', category: 'C5',
};
// process_code_name is a combined field (code + name, like the old
// template), built from two paramMap keys — not a 1:1 lookup, so it's
// applied separately in applyTurningHeaderToGrid rather than living in the
// dict above.
const TURNING_PB_PROCESS_ADDR = 'AA3';

// Manual-override fields, same mechanism and storage (pbring_sds_parameter,
// flat keys) as PBRING_HEADER_OVERRIDE_FIELDS already uses for the Standard
// template — this layout added Category/Program No/Program Name/Mat'l Size
// cells the old "Turning" never had. Program No/Program Rev have no
// auto-source and render blank until an admin types a value; Category and
// Mat'l Size DO auto-fill now (applyTurningHeaderToGrid, run first) — these
// entries just let an admin override that default per machine or per CN,
// applied after and winning on any non-blank value, same precedence as
// Standard's CT override.
const TURNING_PB_HEADER_OVERRIDE_FIELDS = [
  { key: 'program_no', label: 'Program No', cell: 'AA4' },
  { key: 'program_name', label: 'Program Rev', cell: 'AH4' },
  { key: 'category', label: 'Category', cell: 'C5' },
  { key: 'material_size', label: "Mat'l Size", cell: 'O5' },
];

function applyTurningHeaderToGrid(grid, paramMap) {
  for (const [sdsField, pbKey] of Object.entries({
    machine_type_name: 'Machine', parts_no: 'PN', dwg_rev: 'REV', ct: 'CT', cn: 'CN',
    sds_rev: 'SdsRev', material: 'Material', material_size: 'Material_size', category: 'Category',
  })) {
    const cellAddr = TURNING_PB_HEADER_ADDR[sdsField];
    const value = paramMap[pbKey];
    if (!cellAddr || value == null || value === '') continue;
    const key = addrToRC(cellAddr);
    const existing = grid.cells[key] || {};
    // Merge onto the template's own designed alignment (AH3 is authored
    // right-aligned) instead of replacing it — see the Standard template's
    // applyHeaderToGrid fix for the same bug (AH4 losing its center align).
    grid.cells[key] = {
      v: String(value),
      f: { name: 'Calibri', size: 10, bold: false, italic: false, ...(existing.f || {}), color: '#c00000' },
      a: { h: null, v: 'middle', wrap: false, ...(existing.a || {}) },
    };
  }
  const code = paramMap.Process_Code, name = paramMap.Process;
  if (code || name) {
    grid.cells[addrToRC(TURNING_PB_PROCESS_ADDR)] = {
      v: [code, name].filter(Boolean).join(' '),
      f: { name: 'Calibri', size: 10, bold: false, italic: false, color: '#c00000' },
      a: { h: null, v: 'middle', wrap: false },
    };
  }
}

function applyTurningHeaderOverridesToGrid(grid, manualParamMap) {
  for (const f of TURNING_PB_HEADER_OVERRIDE_FIELDS) {
    const value = manualParamMap[f.key];
    if (value == null || value === '') continue;
    grid.cells[addrToRC(f.cell)] = {
      v: String(value),
      f: { name: 'Calibri', size: 10, bold: false, italic: false, color: '#c00000' },
      a: { h: null, v: 'middle', wrap: false },
    };
  }
}

// PB Ring pbring_sds_condition column -> slot-address field key (see
// turningPbSlotAddresses). No `tooling_no` entry — see the file-header note
// above on why this layout has no cell for it.
const TURNING_PB_FIELD_MAP = {
  vc: 'VC', f: 'F', ap: 'AP', nose_r: 'Nose_R',
  insert_info: 'Insert_Info', maker: 'Insert_Maker',
  holder_info: 'Holder_Info', holder_maker: 'Holder_Maker',
  overhang: 'Overhang', rotation: 'Rotation', hand: 'Hand', h_width: 'H_Width',
  usaged: 'Usage', tool_detail: 'Tool_Detail',
};

// Column letters per 4-slot block — block 0 = slots 1-4, block 1 = slots
// 5-8, block 2 = slots 9-12. `info` is the shared column for
// Insert_Info/Insert_Maker/Holder_Info/Holder_Maker/Overhang/H_Width/
// Rotation/Hand (and doubles as Tool_Detail's column).
const TURNING_PB_BLOCK_COLS = [
  { detail: 'C', usage: 'J', vc: 'B', f: 'D', ap: 'F', noseR: 'J', info: 'C' },
  { detail: 'O', usage: 'V', vc: 'N', f: 'P', ap: 'R', noseR: 'V', info: 'O' },
  { detail: 'AA', usage: 'AH', vc: 'Z', f: 'AB', ap: 'AD', noseR: 'AH', info: 'AA' },
];

/** Cell addresses for one slot (1-12) — see the derivation note above the Turning_PB constants. */
function turningPbSlotAddresses(slot) {
  const slotInBlock = (slot - 1) % 4;
  const block = Math.floor((slot - 1) / 4);
  const rowBase = 15 + 12 * slotInBlock;
  const cols = TURNING_PB_BLOCK_COLS[block];
  return {
    Tool_Detail: `${cols.detail}${rowBase}`,
    Usage: `${cols.usage}${rowBase}`,
    VC: `${cols.vc}${rowBase + 1}`,
    F: `${cols.f}${rowBase + 1}`,
    AP: `${cols.ap}${rowBase + 1}`,
    Nose_R: `${cols.noseR}${rowBase + 1}`,
    Insert_Info: `${cols.info}${rowBase + 3}`,
    Insert_Maker: `${cols.info}${rowBase + 4}`,
    Holder_Info: `${cols.info}${rowBase + 5}`,
    Holder_Maker: `${cols.info}${rowBase + 6}`,
    Overhang: `${cols.info}${rowBase + 7}`,
    H_Width: `${cols.info}${rowBase + 8}`,
    Rotation: `${cols.info}${rowBase + 9}`,
    Hand: `${cols.info}${rowBase + 10}`,
  };
}

/**
 * Each physical box ("T01".."T12", printed on the template itself) gets the
 * row whose OWN tool_number is that exact slot — a direct lookup, not a
 * sorted/compacted array index. The data's tool_number values are not
 * guaranteed sequential or gap-free (confirmed live: a real CN's rows were
 * T2, T3, T4, T5, T8, T12 — no T1, T6, T7, T9-T11 at all), so indexing by
 * sorted position previously squeezed T8/T12 into the boxes printed "T05"/
 * "T06" — wrong data under a box whose own label said otherwise. A box with
 * no matching tool_number is left blank, which is the correct "nothing
 * planned for this slot", not a slot to be filled by whatever came next.
 */
function applyTurningToolSlotsToGrid(grid, conditionByToolNumber) {
  for (let slot = 1; slot <= TURNING_PB_MAX_SLOTS; slot++) {
    const row = conditionByToolNumber[`T${slot}`];
    if (!row) continue;
    const addr = turningPbSlotAddresses(slot);
    for (const [pbField, addrKey] of Object.entries(TURNING_PB_FIELD_MAP)) {
      const cellAddr = addr[addrKey];
      const value = row[pbField];
      if (!cellAddr || value == null || value === '') continue;
      grid.cells[addrToRC(cellAddr)] = {
        v: String(value),
        f: { name: 'Calibri', size: 9, bold: false, italic: false, color: '#c00000' },
        a: { h: null, v: 'middle', wrap: false },
      };
    }
  }
}

/** Full Turning_PB render: live layout + header (+ manual overrides) + up to 12 tool slots. No {{}}, no copy, no write to any sds_* table. */
async function buildTurningGridForMachine(cn, machineTypeName, processCode) {
  const grid = await loadTurningGridLive();
  if (!grid) return null;

  const { paramMap, conditionByToolNumber } = await buildPbRingValueMap(cn, machineTypeName, processCode);
  applyTurningHeaderToGrid(grid, paramMap);
  applyTurningToolSlotsToGrid(grid, conditionByToolNumber);

  const manualParamMap = await resolveManualParamMap(machineTypeName, cn, processCode);
  applyTurningHeaderOverridesToGrid(grid, manualParamMap);

  const layoutImg = await getGrindingImageBinary(machineTypeName, cn, processCode);
  placeImageAtExtent(grid, 'turning_layout_image', toDataUri(layoutImg));

  // Per-tool cutting-tool photos — same pbring_tooling_image table/match
  // rule as the Standard template's T01-T20 (family + resolved name, family-
  // wide '' fallback), but placed by DIRECT tool_number lookup like
  // applyTurningToolSlotsToGrid above, not by sorted position — a slot with
  // no matching T{n} row is left blank rather than absorbing the next row.
  // Family comes from toolingConditionFamily, not toolingFamily directly:
  // most Turning rows have no DWG tooling_no at all (confirmed live,
  // QUICKTURN200500U/294065/0081's T2/T3/T5/T12 — only identified by
  // tool_detail's plain-text operation name, e.g. "CUT OFF") and need
  // tool_detail itself as the family, or they'd never match any upload.
  //
  // A leading-word fallback (user decision, 2026-10-19): "U-DRILL Ø 34.0"
  // never matches an uploaded "U-DRILL Ø 48.0" exactly — Turning families
  // are free-text, not DWG codes, so there is no dash-suffix to drop the way
  // the Standard template's resolveToolImage does. When the exact family
  // misses, fall back to "every uploaded image whose family starts with the
  // same first word" — used ONLY when that set has exactly one member, same
  // single-candidate safety rule as the Standard template. This is
  // deliberately NOT a blanket "ignore the rest of the family" rule: e.g.
  // "FACING & OD FINISH" (T03) shares the word "FACING" with both "FACING &
  // OD ROUGH" and "FACING FINISH" uploads, so that case has two candidates
  // and correctly stays unmatched rather than guessing between ROUGH/FINISH.
  const firstWord = (s) => String(s || '').trim().split(/\s+/)[0] || '';
  const toolCodes = [...new Set(Object.values(conditionByToolNumber).map((r) => r.tooling_no).filter(Boolean))];
  const itemNameByToolCode = await getToolingItemNames(machineTypeName, cn, toolCodes);
  // No exact-slot (pbring_tooling_image_slot) lookup here, unlike the
  // Standard template above — deliberately. Turning's T-slot is a plain
  // POSITION on the sheet with no guarantee it holds the same operation
  // across CNs (confirmed live, 2026-10-19: QTSMART200M/0081's T3 is "OD
  // FINISH" for some CNs, "FACING & OD FINISH" for others), unlike
  // grinding's numbered slots, which `pbring_machine_tool` proves ARE
  // stable per (machine, process_code). getToolingSlotOptions returns []
  // for Turning machines for the same reason — the exact-match below,
  // keyed on the actual resolved family/tool_detail TEXT rather than
  // position, is already the correct exact match for Turning.
  const toolingImageRows = await engPool.query(
    `SELECT family, tool_name, image_data, mime_type FROM pbring_tooling_image WHERE machine_type_name = $1`,
    [machineTypeName]
  );
  const imgByFamilyAndName = new Map();
  const imgByFirstWord = new Map();
  for (const r of toolingImageRows.rows) {
    imgByFamilyAndName.set(`${r.family}||${r.tool_name}`, r);
    const w = firstWord(r.family);
    if (w) {
      if (!imgByFirstWord.has(w)) imgByFirstWord.set(w, []);
      imgByFirstWord.get(w).push(r);
    }
  }
  for (let slot = 1; slot <= TURNING_PB_MAX_SLOTS; slot++) {
    const row = conditionByToolNumber[`T${slot}`];
    if (!row) continue;
    const family = toolingConditionFamily(row);
    if (!family) continue;
    // No tooling_no means family already IS the tool_detail description —
    // nothing left to disambiguate within it, so go straight to the
    // family-wide ('') entry instead of inventing a "resolved name" from a
    // DWG code that doesn't exist for this row.
    const resolvedName = row.tooling_no ? (row.tool_detail || itemNameByToolCode[leadingToken(row.tooling_no)] || '') : '';
    let img = imgByFamilyAndName.get(`${family}||${resolvedName}`) || imgByFamilyAndName.get(`${family}||`);
    if (!img) {
      const candidates = imgByFirstWord.get(firstWord(family)) || [];
      if (candidates.length === 1) img = candidates[0];
    }
    if (!img) continue;
    placeImageAtExtent(grid, `turning_tool_image_T${String(slot).padStart(2, '0')}`, toDataUri(img));
  }

  return grid;
}

// ── PB Ring sheet approval (Prepared/Checked/Approved) ──────────────────────
// Own table (pbring_sds_approval, migration 20261015_), own permission gate
// (isPbringAdmin, in pbringRoutes.js) — never the real sds_approval /
// sds_approval_role_config. See the migration header for why: several PB
// Ring machine codes share their real display name with an already-
// registered SDS machine, and signing into the shared table under that name
// would write into the same row a real engineer's production approval
// lives in. Wide, one-row-per-sheet shape mirrors sds_approval, minus
// sds_rev-keying, dept/source columns, backfill and Kanban board intake —
// out of scope for the first version (user decision 2026-10-11: the
// 3-step SEQUENCE, not the full configurable role-matrix). The role-matrix
// itself landed 2026-10-12 — see pbringUserCanSign/pbringApprovalRoleConfig
// below — once the user asked to reuse the real ApprovalRoleConfig.jsx UI.
const PBRING_APPROVAL_ROLE_ORDER = ['prepared', 'checked', 'approved'];

async function getPbRingApproval(cn, machineTypeName, processCode) {
  const { rows } = await engPool.query(
    `SELECT * FROM pbring_sds_approval WHERE cn = $1 AND machine_type_name = $2 AND process_code = $3`,
    [cn, machineTypeName, processCode]
  );
  return rows[0] || null;
}

// ── Who may sign each role — pbring_approval_role_config (2026-10-12) ───────
// Mirrors sdsApprovalController.js's getRoleConfig/userCanSign exactly
// (same match_type vocabulary: any/department/role/feature_perm/em_id), own
// table — never sds_approval_role_config, same separation reason as
// pbring_sds_approval vs sds_approval. "Admin" here is pbring's own
// definition (AD dept/role, OR the pbring_admin/all_mtc permission —
// matches hasFeature('pbring_admin'), the route guard this replaces at the
// handler level for POST/DELETE /grid/approval) rather than the real
// system's AD-only override, since that is what "pbring admin" has always
// meant everywhere else in this domain (isPbringAdmin in pbringRoutes.js,
// PbRingMonitorPage.jsx's own isPbringAdmin check).
async function getPbRingRoleConfig() {
  const { rows } = await engPool.query(
    `SELECT id, role, match_type, match_value, enabled, note FROM pbring_approval_role_config ORDER BY role, id`
  );
  return rows;
}

function isPbringAdminUser(user) {
  const dept = (user && (user.department || user.u_department)) || '';
  const role = (user && (user.role || user.u_role)) || '';
  const perms = Array.isArray(user?.perms) ? user.perms : [];
  return dept === 'AD' || role === 'AD' || perms.includes('pbring_admin') || perms.includes('all_mtc');
}

function pbringUserCanSign(user, role, cfgRows) {
  if (isPbringAdminUser(user)) return true;
  const rows = (cfgRows || []).filter((r) => r.role === role && r.enabled);
  if (!rows.length) return false; // no rule + not admin -> deny, same as today's isPbringAdmin-only gate
  const dept = (user && (user.department || user.u_department)) || '';
  const roleOf = (user && (user.role || user.u_role)) || '';
  const perms = Array.isArray(user?.perms) ? user.perms : [];
  return rows.some((r) => {
    switch (r.match_type) {
      case 'any':          return true;
      case 'department':   return r.match_value === dept;
      case 'role':         return r.match_value === roleOf;
      case 'feature_perm': return perms.includes(r.match_value);
      case 'em_id':        return String(r.match_value) === String(user?.empno);
      default:              return false;
    }
  });
}

function pbRingRoleRec(row, role) {
  if (!row) return null;
  const emId = row[`${role}_em_id`];
  if (!emId) return null;
  return { em_id: emId, signer_name: row[`${role}_name`] || '', signed_at: row[`${role}_at`] || null };
}

// role is validated against PBRING_APPROVAL_ROLE_ORDER before use, so the
// interpolated column names are a fixed whitelist (no user input in SQL) —
// same pattern as sdsApprovalController.js's roleCols.
function pbRingRoleCols(role) {
  return { em_id: `${role}_em_id`, name: `${role}_name`, at: `${role}_at`, source: `${role}_source` };
}

/**
 * Sign one role. `source` distinguishes 'live' (someone pressed Sign) from
 * 'auto' (pbringAutoStamp.js, the configured responsible person) — same
 * governance reason the real system's sds_approval keeps it: the seal
 * carries a real person's name even when they did not press Sign.
 * Previous role must already be signed (sequential, same for both sources
 * — auto-stamp's own caller already walks the roles in order and stops at
 * the first unconfigured one, but this check is what actually enforces it).
 */
async function signPbRingApproval(cn, machineTypeName, processCode, role, empno, signerName, source = 'live') {
  if (!PBRING_APPROVAL_ROLE_ORDER.includes(role)) {
    throw new Error(`role must be one of ${PBRING_APPROVAL_ROLE_ORDER.join(', ')}`);
  }
  const idx = PBRING_APPROVAL_ROLE_ORDER.indexOf(role);
  if (idx > 0) {
    const existing = await getPbRingApproval(cn, machineTypeName, processCode);
    const prev = PBRING_APPROVAL_ROLE_ORDER[idx - 1];
    if (!pbRingRoleRec(existing, prev)) {
      const err = new Error(`'${prev}' must be signed before '${role}'`);
      err.status = 409;
      throw err;
    }
  }
  const c = pbRingRoleCols(role);
  const { rows } = await engPool.query(
    `INSERT INTO pbring_sds_approval (cn, machine_type_name, process_code, ${c.em_id}, ${c.name}, ${c.at}, ${c.source})
     VALUES ($1,$2,$3,$4,$5, now(), $6)
     ON CONFLICT (cn, machine_type_name, process_code)
     DO UPDATE SET ${c.em_id} = EXCLUDED.${c.em_id}, ${c.name} = EXCLUDED.${c.name}, ${c.at} = now(), ${c.source} = EXCLUDED.${c.source}, updated_at = now()
     RETURNING *`,
    [cn, machineTypeName, processCode, empno, signerName, source]
  );
  return rows[0];
}

/** Revoke one role's signature. Deletes the row once every role is unsigned. */
async function revokePbRingApproval(cn, machineTypeName, processCode, role) {
  if (!PBRING_APPROVAL_ROLE_ORDER.includes(role)) {
    throw new Error(`role must be one of ${PBRING_APPROVAL_ROLE_ORDER.join(', ')}`);
  }
  const c = pbRingRoleCols(role);
  const { rows } = await engPool.query(
    `UPDATE pbring_sds_approval SET ${c.em_id} = NULL, ${c.name} = NULL, ${c.at} = NULL, ${c.source} = NULL, updated_at = now()
      WHERE cn = $1 AND machine_type_name = $2 AND process_code = $3
      RETURNING *`,
    [cn, machineTypeName, processCode]
  );
  const row = rows[0];
  if (!row) return null;
  if (PBRING_APPROVAL_ROLE_ORDER.every((r) => !row[`${r}_em_id`])) {
    await engPool.query(`DELETE FROM pbring_sds_approval WHERE id = $1`, [row.id]);
  }
  return row;
}

// ── Auto Stamp config (single row, id=1) — read by pbringAutoStamp.js ───────
// No role-config fallback (unlike the real sds_auto_stamp_config, which
// falls back to sds_approval_role_config) — the explicit em_id per role is
// the only source. pbring_approval_role_config (added 2026-10-12, above)
// gates who may SIGN; auto-stamp deliberately stays a separate, simpler
// explicit-only picker (see AutoStampSection.jsx's hasRoleConfig={false}
// usage for PB Ring) rather than resolving through it.
async function getPbRingAutoStampConfig() {
  const { rows } = await engPool.query(`SELECT * FROM pbring_auto_stamp_config WHERE id = 1`);
  const r = rows[0] || {};
  return {
    enabled: !!r.enabled,
    max_per_run: Number(r.max_per_run) > 0 ? Math.floor(Number(r.max_per_run)) : 200,
    prepared: r.prepared_em_id ? { em_id: r.prepared_em_id, name: r.prepared_name || r.prepared_em_id } : null,
    checked: r.checked_em_id ? { em_id: r.checked_em_id, name: r.checked_name || r.checked_em_id } : null,
    approved: r.approved_em_id ? { em_id: r.approved_em_id, name: r.approved_name || r.approved_em_id } : null,
    updated_by: r.updated_by || null,
    updated_at: r.updated_at || null,
  };
}

// Partial update — every field COALESCEs onto the existing row, so a PUT
// that only sends e.g. {max_per_run} leaves the configured signers alone.
// (Omitted → JS undefined → the pg driver sends SQL NULL → COALESCE keeps
// the existing value. To actually CLEAR a signer, send an empty string —
// COALESCE('', existing) = '', which getPbRingAutoStampConfig then reads
// back as "no signer configured" the same as NULL.)
async function savePbRingAutoStampConfig(patch, updatedBy) {
  const { enabled, max_per_run, prepared_em_id, prepared_name, checked_em_id, checked_name, approved_em_id, approved_name } = patch;
  const { rows } = await engPool.query(
    `UPDATE pbring_auto_stamp_config SET
       enabled = COALESCE($1, enabled),
       max_per_run = COALESCE($2, max_per_run),
       prepared_em_id = COALESCE($3, prepared_em_id), prepared_name = COALESCE($4, prepared_name),
       checked_em_id = COALESCE($5, checked_em_id), checked_name = COALESCE($6, checked_name),
       approved_em_id = COALESCE($7, approved_em_id), approved_name = COALESCE($8, approved_name),
       updated_by = $9, updated_at = now()
     WHERE id = 1
     RETURNING *`,
    [enabled, max_per_run, prepared_em_id, prepared_name, checked_em_id, checked_name, approved_em_id, approved_name, updatedBy || null]
  );
  return rows[0];
}

// Moves/creates the shared Kanban card for a PB Ring sheet's approval —
// reuses kanbanIntake.syncCard, the SAME generic mechanism the real
// sds_approval uses, but under its OWN sourceType ('pbring_sds_approval')
// so cards never mix with real production approval cards and, per
// kanbanIntake's own design, silently no-ops until an admin configures a
// board/list for this sourceType (mtc_board_config — no new admin UI
// needed, the existing generic board-config endpoint already handles any
// sourceType). Fail-open — a board-sync failure must never break a sign.
async function syncPbRingApprovalBoardCard({ io, cn, machineTypeName, processCode, role, signerName }) {
  try {
    const kanbanIntake = require('../mtc/services/kanbanIntake');
    await kanbanIntake.syncCard({
      io,
      sourceType: 'pbring_sds_approval',
      sourceRef: `${cn}||${machineTypeName}||${processCode}`,
      stageKey: role,
      name: `PB Ring SDS ${cn} · ${machineTypeName} · ${processCode}`,
      description: `Signed ${role} by ${signerName}`,
      link: {
        url: `/eng/mtc_eng/sds-v2?cn=${encodeURIComponent(cn)}&machine=${encodeURIComponent(machineTypeName)}&process=${encodeURIComponent(processCode)}`,
        name: `Open SDS ${cn} — sign`,
      },
    });
  } catch (e) {
    console.warn('[pbring] board card sync failed:', e.message);
  }
}

// ── pbring_approval_role_config CRUD — mirrors sdsApprovalController.js's
// role-config routes exactly, against PB Ring's own table.
async function addPbringRoleConfig({ role, match_type, match_value, note }) {
  const { rows } = await engPool.query(
    `INSERT INTO pbring_approval_role_config (role, match_type, match_value, note) VALUES ($1,$2,$3,$4) RETURNING *`,
    [role, match_type, match_type === 'any' ? null : match_value, note || null]
  );
  return rows[0];
}
async function updatePbringRoleConfig(id, { enabled, note }) {
  const { rows } = await engPool.query(
    `UPDATE pbring_approval_role_config SET
       enabled = COALESCE($1, enabled),
       note    = COALESCE($2, note)
     WHERE id = $3 RETURNING *`,
    [typeof enabled === 'boolean' ? enabled : null, note ?? null, id]
  );
  return rows[0] || null;
}
async function deletePbringRoleConfig(id) {
  await engPool.query(`DELETE FROM pbring_approval_role_config WHERE id = $1`, [id]);
}

// ── Machine Tool whitelist admin (pbring_machine_tool) ──────────────────────
// Backs applyMachineToolWhitelistOverride above. Plain CRUD + a coverage
// report so an admin can see WHICH CNs actually get the Tooling List
// override for a given (machine, process, T-slot) vs which silently keep
// the SDS-source value (no pbring_tooling row for that CN/family) — the
// fail-open path has no other visibility, by design (see that function's
// header), so this is where it becomes inspectable rather than silent.

async function listMachineTool(machineTypeName) {
  const { rows } = await engPool.query(
    `SELECT * FROM pbring_machine_tool WHERE machine_type_name = $1 ORDER BY process_code, tool_number`,
    [machineTypeName]
  );
  return rows;
}

async function upsertMachineTool({ id, machine_type_name, process_code, tool_number, family, empno }) {
  if (id) {
    const { rows } = await engPool.query(
      `UPDATE pbring_machine_tool SET family = $1, updated_by = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [family, empno || null, id]
    );
    return rows[0];
  }
  const { rows } = await engPool.query(
    `INSERT INTO pbring_machine_tool (machine_type_name, process_code, tool_number, family, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (machine_type_name, process_code, tool_number) DO UPDATE SET
       family = EXCLUDED.family, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING *`,
    [machine_type_name, process_code, tool_number, family, empno || null]
  );
  return rows[0];
}

async function deleteMachineTool(id) {
  await engPool.query(`DELETE FROM pbring_machine_tool WHERE id = $1`, [id]);
}

/**
 * Per whitelist row for this machine: how many CNs have a condition row for
 * that (process_code, tool_number) at all (`cn_total`), and of those, how
 * many have a pbring_tooling row for the SAME CN whose own family matches
 * (`cn_hit`) — `cn_total - cn_hit` is exactly the silent fail-open count.
 * Computed in JS, not SQL, so the family rule is the one true
 * `toolingFamily()` everywhere else uses — no second implementation to drift.
 */
async function getMachineToolCoverage(machineTypeName) {
  const whitelist = await listMachineTool(machineTypeName);
  if (!whitelist.length) return [];

  const processCodes = [...new Set(whitelist.map((w) => w.process_code))];
  const { rows: condRows } = await engPool.query(
    `SELECT cn, process_code, tool_number FROM pbring_sds_condition
      WHERE mc_key = $1 AND process_code = ANY($2) AND tool_number ~ '^T[0-9]+$'`,
    [machineTypeName, processCodes]
  );
  const { rows: toolingRows } = await engPool.query(
    `SELECT cn, tool_code_base FROM pbring_tooling WHERE mc_key = $1 AND tool_code_base IS NOT NULL`,
    [machineTypeName]
  );

  const cnSetByFamily = new Map();
  for (const r of toolingRows) {
    const fam = toolingFamily(r.tool_code_base);
    if (!fam) continue;
    if (!cnSetByFamily.has(fam)) cnSetByFamily.set(fam, new Set());
    cnSetByFamily.get(fam).add(r.cn);
  }

  const cnSetBySlot = new Map();
  for (const r of condRows) {
    const key = `${r.process_code}\u0001${r.tool_number}`;
    if (!cnSetBySlot.has(key)) cnSetBySlot.set(key, new Set());
    cnSetBySlot.get(key).add(r.cn);
  }

  return whitelist.map((w) => {
    const cns = cnSetBySlot.get(`${w.process_code}\u0001${w.tool_number}`) || new Set();
    const familyCns = cnSetByFamily.get(w.family) || new Set();
    let hit = 0;
    for (const cn of cns) if (familyCns.has(cn)) hit++;
    return { ...w, cn_total: cns.size, cn_hit: hit, cn_miss: cns.size - hit };
  });
}

module.exports = {
  buildPbRingValueMap, buildGridPdfHtml, hasDataForCn,
  listMachineTypes,
  loadStandardGridLive, buildStandardGridForMachine,
  loadToolSlotAddressesLive, applyToolSlotsToGrid, getToolingItemNames, loadHeaderAddressesLive, applyHeaderToGrid,
  TURNING_MACHINE_NAMES, buildTurningGridForMachine,
  loadTurningGridLive, applyTurningHeaderToGrid, applyTurningHeaderOverridesToGrid,
  applyTurningToolSlotsToGrid, turningPbSlotAddresses, TURNING_PB_HEADER_OVERRIDE_FIELDS,
  PBRING_ROW_RANGE, PBRING_COL_LETTERS, PBRING_GW_ROW_RANGE, PBRING_GW_COL_LETTERS,
  getManualParams, saveManualParams, resolveManualParamMap, applyManualParamsToGrid,
  PBRING_HEADER_OVERRIDE_FIELDS, loadHeaderOverrideAddressesLive, applyHeaderOverridesToGrid,
  toolingFamily, getToolingFamilyOptions,
  getToolingImageBinary, listToolingImages, upsertToolingImage, deleteToolingImage,
  getToolingSlotOptions, setImageSlots,
  getGrindingImageBinary, listGrindingImages, upsertGrindingImage, deleteGrindingImage,
  PBRING_APPROVAL_ROLE_ORDER, getPbRingApproval, signPbRingApproval, revokePbRingApproval,
  getPbRingAutoStampConfig, savePbRingAutoStampConfig, syncPbRingApprovalBoardCard,
  getPbRingRoleConfig, pbringUserCanSign, isPbringAdminUser,
  addPbringRoleConfig, updatePbringRoleConfig, deletePbringRoleConfig,
  listMachineTool, upsertMachineTool, deleteMachineTool, getMachineToolCoverage,
};
