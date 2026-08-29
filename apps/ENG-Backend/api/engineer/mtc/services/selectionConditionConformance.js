'use strict';

/**
 * Selection-condition conformance — does every tooling the index workbook puts in
 * Tooling Select scope actually have selection logic wired in the live config?
 * ------------------------------------------------------------------------------
 * The sibling of `templateBConformance.js`. That one asks "is the tooling CONFIGURED
 * for the sheet"; this one asks "can the tooling be SELECTED" — i.e. does the family
 * have a `tooling_formula` + `tooling_search_rule` (a dimensional rule), or a
 * `tooling_partno_map` (a per-C/N pin), or nothing at all.
 *
 * SOURCE OF TRUTH — `doc/20260202_Tooling_Excel_List.xlsm`, vendored 2026-08-28.
 *   Single sheet. One row per per-machine tooling-list workbook. Columns:
 *     A リスト Excelファイル名   the workbook that holds the 加工対象物寸法記入欄 calc block
 *     B 工程(Process)            Japanese process family label (研磨(GRIND) …), NOT a 4-digit code
 *     C マシン(Machine)          machine label, the workbook's own spelling
 *     D 詳細(Detail)             free text
 *     E 図番(DWG/NO.)            drawing family prefix — 4021, 4857, Q-, X-52 …
 *     F/G/H 分類コード           sub-codes
 *     K 治具選定                 "1" ⇒ this row is in Tooling Select scope   ← the population
 *
 * RESOLVE A ROW TO A MACHINE THROUGH THE DWG FAMILY, never column C. Same rule the
 * TEMPLATE_B pass uses: `machine_type_code` = the family's digits minus the leading one
 * (4021 → 021 → KS-B80). Column C carries spellings that are not in any registry
 * (`BBS KINMEI`, `MAZAK`, `SUPER FINISH`) and would resolve nothing.
 *
 * "NOT SELECTABLE" IS NOT ALWAYS A DEFECT. Three homes decide whether a tooling can be
 * picked at all, and some families legitimately live in none of them:
 *   - a catalogue tool (recess bite Q-51, keyway cutter X-52) is chosen from a vendor
 *     catalogue, not designed per part — it has no calc block to encode;
 *   - a family whose machine was never onboarded to Tooling Select (super-finish,
 *     the KINMEI width-mill holder) is out of scope, not misconfigured;
 *   - a workbook that says so itself — `20240912_TOOLING LIST_KS-400B6` is filed as
 *     `（計算式追加予定_山本）`, "formula to be added".
 * Each such row carries a `reason`; `kpi.unexplained` counts the rows that do not, and
 * that number is meant to stay 0 — a blank reason means the page is hiding a decision.
 *
 * Cost: one workbook parse (1 sheet, ~150 rows) plus ~6 queries. Cached in memory and
 * persisted to `sds_coverage_cache` under id `selection_condition_conformance` by the
 * route, exactly like the TEMPLATE_B page.
 */

const path = require('path');
const XLSX = require('xlsx');
const { engPool } = require('../../../../instance/eng_db');

const WORKBOOK = path.join(__dirname, '../doc/20260202_Tooling_Excel_List.xlsm');

// ── workbook ────────────────────────────────────────────────────────────────
let _rowCache = null;

const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

// Reasons a family is out of scope by design rather than by omission. Keyed by the
// drawing family as the workbook writes it (column E, optionally + first sub-code).
// Seeded from api/engineer/mtc/doc/tooling_select_audit_findings.md and the workbook's own filenames.
const KNOWN = {
  'Q-':    { na: true,  reason: 'มีดกลึงร่อง (recess bite) เลือกจากแคตตาล็อกผู้ผลิต ไม่ได้ออกแบบต่อชิ้นงาน — ไม่มี calc block ให้ encode' },
  'X-52':  { na: true,  reason: 'คัตเตอร์เซาะร่องลิ่ม (keyway cutter) เลือกจากแคตตาล็อก ไม่ได้ออกแบบต่อชิ้นงาน' },
  '4007':  { reason: 'BODY COLLET (MAZAK QTN200) — เครื่องกลึงหัว ยังไม่ได้ onboard เข้า Tooling Select' },
  '4009':  { reason: 'BBS KINMEI width-mill holder — ยังไม่ได้ onboard เข้า Tooling Select (มีแต่ฝั่ง SDS)' },
  '4029':  { reason: 'ROLLER PIN (KS-450C) — เครื่อง centreless ยังไม่ได้ onboard เข้า Tooling Select' },
  '4516':  { reason: 'HYDRA GRIP (width mill) — ยังไม่ได้ onboard เข้า Tooling Select' },
  '4691':  { reason: 'SUPER SPHERE FINISH (球面超仕上機) — เครื่องยังไม่ได้ onboard เข้า Tooling Select · หมายเหตุ: 4691 บางเลขแบบใช้เป็น COLLET ของ KS-H70 ด้วย (audit M-3)' },
  '4863':  { reason: 'SUGINO tap jig — เครื่องแมชชีนนิ่ง ยังไม่ได้ onboard เข้า Tooling Select' },
  '4800-66': { reason: 'TFE BONDING (フランジスリーブ接着治具) — ยังไม่ได้ onboard เข้า Tooling Select' },
};

// Advisory that shows on ANY state (not only gaps) — a caveat about a row that
// nominally has a rule.
const NOTES = {
  '4931': 'workbook ชื่อ「（計算式追加予定_山本）」 — KS-400B6 溝研 ไม่มี calc block; สูตร 8 ตัวเป็น port จาก KS-400B1 ยังไม่ validate (STOCKER CHUTE วัดได้ 17% top-2) · ดู api/engineer/mtc/doc/tooling_calc_blocks/4931.md',
  '4907': 'สูตร LOADER ทั้ง 4 เป็น sentinel (-999) โดยตั้งใจ — 4907 รันด้วย tooling_partno_map (parts_no) ครอบคลุม 100% ของ C/N ที่แผนใช้ (59/59, 57/57, 164/164, 162/162) · ไม่ใช่ข้อบกพร่อง · ดู api/engineer/mtc/doc/tooling_calc_blocks/4907.md',
};

// Index "machine" label (col C) → registry machine_name, for the few rows the
// family-code rule cannot resolve on its own.
const LABEL_ALIAS = {
  'ROLLING': 'THREAD ROLL',
};

function readWorkbook() {
  if (_rowCache) return _rowCache;
  const wb = XLSX.readFile(WORKBOOK);
  const sh = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sh, { header: 1, raw: false, defval: '' });
  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (clean(r[10]) !== '1') continue;                // K 治具選定 — scope flag
    const family = clean(r[4]);
    if (!family) continue;
    const subs = [r[5], r[6], r[7]].map(clean).filter(Boolean);
    rows.push({
      file:    clean(r[0]),
      process: clean(r[1]),
      machine: clean(r[2]),
      detail:  clean(r[3]),
      family,
      subs,
    });
  }
  _rowCache = rows;
  return rows;
}

// ── build ───────────────────────────────────────────────────────────────────

// family "4021" → sds machine_type_code "021"; non-numeric ("Q-", "X-52") → null
function familyCode(family) {
  const digits = String(family).replace(/[^0-9]/g, '');
  if (digits.length < 3) return null;
  return digits.slice(1, 4).padStart(3, '0');
}

async function build() {
  const wbRows = readWorkbook();

  const [{ rows: codes }, { rows: machines }, { rows: fml }, { rows: rule },
         { rows: lim }, { rows: pin }, { rows: accRows }] = await Promise.all([
    engPool.query(`SELECT machine_type_code, machine_type_name FROM sds_machine_type_code`),
    engPool.query(`SELECT id, machine_name, machine_group, inventory_table, enabled FROM tooling_machine`),
    engPool.query(`SELECT tm.machine_name, f.tooling_name, count(*)::int n
                     FROM tooling_formula f JOIN tooling_machine tm ON tm.id = f.machine_id
                    GROUP BY 1, 2`),
    engPool.query(`SELECT tm.machine_name, r.tooling_name, count(*)::int n
                     FROM tooling_search_rule r JOIN tooling_machine tm ON tm.id = r.machine_id
                    GROUP BY 1, 2`),
    engPool.query(`SELECT tm.machine_name, count(*)::int n
                     FROM tooling_machine_limit l JOIN tooling_machine tm ON tm.id = l.machine_id
                    GROUP BY 1`),
    engPool.query(`SELECT machine_name, count(*)::int n,
                          count(*) FILTER (WHERE cn IS NOT NULL)::int cn_pins
                     FROM tooling_partno_map GROUP BY 1`),
    // accuracy from the last `eval_tooling_accuracy.js --persist-db` run — best-effort
    engPool.query(`SELECT data FROM sds_coverage_cache WHERE id = 'tooling_accuracy' LIMIT 1`)
      .catch(() => ({ rows: [] })),
  ]);

  // (machine label, family 4-digit) → weighted top-1/top-2 across that family's toolings
  const acc = accRows[0] && accRows[0].data ? accRows[0].data : null;
  const accByKey = {};
  if (acc && Array.isArray(acc.toolings)) {
    const agg = {};
    for (const t of acc.toolings) {
      if (!t.family || !t.n) continue;
      const k = `${t.machine}|${String(t.family).slice(0, 4)}`;
      const a = agg[k] || (agg[k] = { n: 0, s1: 0, s2: 0, none: 0 });
      a.n += t.n; a.s1 += (t.top1 || 0) * t.n; a.s2 += (t.top2 || 0) * t.n; a.none += (t.none || 0);
    }
    for (const [k, a] of Object.entries(agg)) {
      accByKey[k] = { top1: +(a.s1 / a.n).toFixed(1), top2: +(a.s2 / a.n).toFixed(1), n: a.n, none: a.none };
    }
  }

  const nameByCode = {};
  for (const c of codes) {
    if (!c.machine_type_name || c.machine_type_name === 'no data') continue;
    const k = String(c.machine_type_code).padStart(3, '0');
    (nameByCode[k] = nameByCode[k] || new Set()).add(c.machine_type_name);
  }

  // machine label (name OR group OR any slash-member of the group) → the tooling_machine row
  const machByName = {};
  for (const m of machines) {
    machByName[m.machine_name] = m;
    if (m.machine_group) {
      machByName[m.machine_group] = m;
      for (const member of m.machine_group.split('/')) machByName[member.trim()] = m;
    }
  }
  const fmlBy  = key(fml);   // "machine|tooling" → n
  const ruleBy = key(rule);
  const limBy  = Object.fromEntries(lim.map((r) => [r.machine_name, r.n]));
  const pinBy  = Object.fromEntries(pin.map((r) => [r.machine_name, r]));

  // inventory family presence + which tooling_names carry that family — one query per
  // distinct inventory table that a scoped row resolves to.
  const invNeed = new Map();   // inventory_table → Set(family)
  const resolved = wbRows.map((w) => {
    const code = familyCode(w.family);
    const regNames = code ? [...(nameByCode[code] || [])] : [];
    const mach = regNames.map((n) => machByName[n]).find(Boolean)
              || machByName[w.machine]
              || machByName[LABEL_ALIAS[w.machine] || ''] || null;
    if (mach && mach.inventory_table) {
      if (!invNeed.has(mach.inventory_table)) invNeed.set(mach.inventory_table, new Set());
      invNeed.get(mach.inventory_table).add(w.family);
    }
    return { w, code, regNames, mach };
  });

  const shelfByKey = {};   // "table|family" → { rows, toolings:Set }
  await Promise.all([...invNeed.entries()].map(async ([table, fams]) => {
    // whitelist: table names come from tooling_machine.inventory_table, never user input
    if (!/^tooling_[a-z0-9_]+$/.test(table)) return;
    let q;
    try {
      q = await engPool.query(
        `SELECT split_part(tooling_no,'-',1)||'-'||split_part(tooling_no,'-',2) AS fam,
                tooling_name, count(*)::int n
           FROM ${table}
          WHERE tooling_no IS NOT NULL
          GROUP BY 1, 2`);
    } catch (e) { return; }
    for (const row of q.rows) {
      const famPrefix = String(row.fam).split('-')[0];
      if (!fams.has(famPrefix)) continue;
      const k = `${table}|${famPrefix}`;
      const e = shelfByKey[k] || (shelfByKey[k] = { rows: 0, toolings: new Set() });
      e.rows += row.n;
      if (row.tooling_name) e.toolings.add(row.tooling_name);
    }
  }));

  const STATES = ['rule', 'lookup', 'limit_only', 'none', 'na'];
  const out = resolved.map(({ w, code, regNames, mach }) => {
    const known = KNOWN[w.family]
      || w.subs.map((s) => KNOWN[`${w.family}-${s}`]).find(Boolean)
      || null;
    const note = NOTES[w.family] || null;
    const base = {
      family: w.family, subs: w.subs, process: w.process, machineLabel: w.machine,
      detail: w.detail, workbook: w.file, code, note,
      machine: mach ? (mach.machine_group || mach.machine_name) : (regNames[0] || null),
      registered: !!mach,
    };

    if (!mach) {
      return { ...base,
        state: known && known.na ? 'na' : 'none',
        reason: known ? known.reason
          : `ยังไม่มีเครื่องใน Tooling Select สำหรับตระกูล ${w.family}${regNames[0] ? ` (registry: ${regNames.join(', ')})` : ''}` };
    }

    const shelf   = shelfByKey[`${mach.inventory_table}|${w.family}`] || { rows: 0, toolings: new Set() };
    const withFml = [...shelf.toolings].filter((t) => fmlBy[`${mach.machine_name}|${t}`]);
    const withRul = [...shelf.toolings].filter((t) => ruleBy[`${mach.machine_name}|${t}`]);
    const pinRow  = pinBy[mach.machine_name] || pinBy[mach.machine_group] || null;
    const limits  = limBy[mach.machine_name] || limBy[mach.machine_group] || 0;

    let state, reason = '';
    if (withFml.length && withRul.length) {
      state = 'rule';
    } else if (pinRow && pinRow.n > 0) {
      state = 'lookup';
      reason = `เลือกด้วย cn-map / partno-map (${pinRow.n} แถว${pinRow.cn_pins ? `, cn-pin ${pinRow.cn_pins}` : ''}) — ไม่มีสูตร โดยตั้งใจ`;
    } else if (known) {
      state = known.na ? 'na' : 'none';
      reason = known.reason;
    } else if (shelf.rows > 0 || limits > 0) {
      state = 'limit_only';
      reason = `มี shelf ${shelf.rows} แถว${limits ? ` และ limit ${limits}` : ''} แต่ยังไม่มี formula+search_rule ของตระกูลนี้ — เลือกไม่ได้`;
    } else {
      state = 'none';
      reason = known ? known.reason : 'เครื่องมีในระบบ แต่ตระกูลนี้ไม่มี shelf / formula / rule / pin เลย';
    }
    if (known && known.na) { state = 'na'; reason = known.reason; }

    // Live top-1/top-2 vs the factory plan for this (machine, family), if an
    // eval_tooling_accuracy.js --persist-db run has populated it.
    const accuracy = accByKey[`${mach.machine_group || mach.machine_name}|${String(w.family).slice(0, 4)}`] || null;

    return {
      ...base, state, reason, accuracy,
      shelfRows: shelf.rows,
      shelfToolings: [...shelf.toolings],
      formulaToolings: withFml,
      ruleToolings: withRul,
      pinRows: pinRow ? pinRow.n : 0,
      limits,
    };
  });

  out.sort((a, b) => STATES.indexOf(a.state) - STATES.indexOf(b.state)
                  || String(a.machine).localeCompare(String(b.machine)));

  const count = (s) => out.filter((r) => r.state === s).length;
  const scoped = out.length;
  const scored = out.filter((r) => r.accuracy && r.accuracy.n);
  const wTop1 = scored.reduce((s, r) => s + r.accuracy.top1 * r.accuracy.n, 0);
  const wTop2 = scored.reduce((s, r) => s + r.accuracy.top2 * r.accuracy.n, 0);
  const wN    = scored.reduce((s, r) => s + r.accuracy.n, 0);
  return {
    generatedAt: new Date().toISOString(),
    accuracy: acc ? {
      savedAt: acc.savedAt, sampleN: acc.sampleN,
      familiesScored: scored.length,
      top1: wN ? +(wTop1 / wN).toFixed(1) : null,
      top2: wN ? +(wTop2 / wN).toFixed(1) : null,
      scoredCns: wN,
    } : null,
    kpi: {
      scoped,
      rule:       count('rule'),
      lookup:     count('lookup'),
      limitOnly:  count('limit_only'),
      none:       count('none'),
      na:         count('na'),
      pctSelectable: scoped ? Math.round((100 * (count('rule') + count('lookup'))) / scoped) : 0,
      unexplained: out.filter((r) => (r.state === 'none' || r.state === 'limit_only') && !r.reason).length,
    },
    rows: out,
  };
}

function key(list) {
  const m = {};
  for (const r of list) m[`${r.machine_name}|${r.tooling_name}`] = r.n;
  return m;
}

module.exports = { build, _readWorkbook: readWorkbook };
