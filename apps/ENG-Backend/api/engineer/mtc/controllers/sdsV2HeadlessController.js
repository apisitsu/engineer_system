const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const moment = require('moment');
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { pool: rodpcPool } = require('../../../../instance/instance');
const tselectFallback = require('../services/tselectFallback');
const noJigRule = require('../services/noJigRule');
const SdsOrchestrator = require('../services/SdsOrchestrator');
const { TABLES } = require('../mtcConstants');
const { toDD, toDwg } = require('../utils/rotaryDwg');
const cnFormat = require('../utils/cnFormat');
const { resolvePartDims, SPHERICAL_DESIGN } = require('../utils/partDimAlias');
const { cnMatchKeys } = require('../utils/grindingPrefix');
const { getApprovalSeals } = require('./sdsApprovalController');
const sdsPrintLog = require('../services/sdsPrintLog');

// Approval-stamp param keys → role. The seal image comes from the sds_approval
// sign records (see getApprovalSeals), keyed per CN by (cn, machine_type, process_code, sds_rev).
const STAMP_PARAM_KEYS = { stamp_prepared: 'prepared', stamp_checked: 'checked', stamp_approved: 'approved' };

const router = express.Router();

const TEMPLATE_PATH = path.join(__dirname, '../templates/html/sds_template.html');
const OUTPUT_DIR    = path.resolve('./output/sds-pdf');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function safeUnlink(p) { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} }

// A tooling image whose tool_dwg_no equals NAME_IMG_KEY(family, name) is matched by TOOL
// NAME instead of DWG number — one image shared by every slot of that fixture across all
// dwg variants (the MSB BASE/COLLET/COLLET ARBOR/COLLAR jigs, whose full dwgs differ per
// bore-ID band: 4547-01-{band}-{comp}). Upper-cased + whitespace-collapsed so
// 'Collet  Arbor' and 'COLLET ARBOR' key the same. The frontend builds the same key.
//
// THE FAMILY IS PART OF THE KEY, AND THAT IS THE WHOLE POINT.
// "Wrong band" means a different suffix of ONE family, so the family is the scope the
// mechanism was always meant to have. Keyed on the bare name it matched any tool called
// COLLET anywhere: the MSB picture printed on KL-20's 4030-02, XD-8's 4858-22, KS-H70's
// 4691-19, KN-312A, J-WAVE, LNC45/C200 and 40 more config families — reported from the
// floor on 2026-08-26 as "KL-20 T02 shows a COLLET image nobody configured". Only the
// 4547-01 families were ever intended.
//
// Legacy bare `NAME:<TOOL>` rows no longer match anything; `20260826e_` renames the five
// that exist onto their real family.
const NAME_IMG_KEY = (family, name) =>
  `NAME:${String(family || '').trim()}:` + String(name || '').toUpperCase().replace(/\s+/g, ' ').trim();

// Cache the HTML template in memory — it never changes at runtime, so reading it
// from disk on every render was pure per-request I/O.
let _templateHtml = null;
function getTemplateHtml() {
  if (_templateHtml == null) _templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return _templateHtml;
}

// Fetch CN search data through the cached orchestrator (sds:{CN}, 10-min TTL)
// instead of a fresh factory-DB round-trip on every PDF render.
async function getSearchData(cn) {
  const data = await SdsOrchestrator.search(cn, maqPool, rodpcPool);
  if (!data || data.error || data.success === false) {
    throw new Error(data?.error || 'CN search failed');
  }
  return data;
}

// ── CSS Config Cache (5-min TTL) ────────────────────────────────────────────

const DEFAULT_CSS_CONFIG = {
  'font-size-base': '5.3pt', 'font-size-title': '7pt',
  'font-size-section': '9pt', 'font-size-badge': '4.5pt',
  'height-row-normal': '3.65mm', 'height-row-sep': '0.84mm', 'height-row-img': '21.9mm',
  'width-params-panel': '26.13%', 'width-tooling-panel': '54.60%', 'width-grinding-panel': '19.27%',
  'color-border-outer': '#000000', 'color-border-inner': '#aaaaaa',
  'color-badge-bg': '#1a3a8c', 'color-value-red': '#cc0000',
  'color-header-bg': '#e0e0e0', 'color-sep-bg': '#f0f0f0',
};

let _cssCache = null;
let _cssCacheAt = 0;
const CSS_CACHE_TTL = 5 * 60 * 1000;

async function loadCssConfig(overrides = null) {
  // Use provided overrides (live preview) — skip DB entirely
  if (overrides && typeof overrides === 'object' && Object.keys(overrides).length) {
    return { ...DEFAULT_CSS_CONFIG, ...overrides };
  }
  // Return cached copy if still fresh
  if (_cssCache && Date.now() - _cssCacheAt < CSS_CACHE_TTL) return _cssCache;
  try {
    const r = await engPool.query(
      `SELECT config_key, config_value FROM sds_template_css_config`
    );
    const stored = Object.fromEntries(r.rows.map(row => [row.config_key, row.config_value]));
    _cssCache = { ...DEFAULT_CSS_CONFIG, ...stored };
    _cssCacheAt = Date.now();
    return _cssCache;
  } catch (_) {
    return DEFAULT_CSS_CONFIG;
  }
}

function buildCssVarsBlock(config) {
  const lines = Object.entries(config)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');
  return `:root {\n${lines}\n}`;
}

// Canonical MSB surface-grind fixture TYPE from a (factory or whitelist) tool name.
// A bore-band stores the SAME fixture (BASE/COLLET/COLLET ARBOR/COLLAR/SPACER) at
// DIFFERENT DWG positions — e.g. band 0031 puts COLLET/ARBOR/COLLAR at -07/-08/-09
// while the whitelist lists them at -02/-03/-04 — so neither the DWG suffix nor the
// position is a reliable slot key; the fixture NAME is. Returns null for names that
// aren't one of these fixtures, so the name-match tier stays inert for non-MSB
// machines (their whitelist names don't canonicalize → empty slotByFixture map).
function canonFixtureName(name) {
  const n = String(name || '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (!n) return null;
  // "BASE ASSY" (組立図 = the assembly drawing) is NOT a physical slot fixture — it must
  // be excluded BEFORE the BASE substring check below, or it canonicalizes to BASE and
  // collides with the real BASE slot: the factory plan often lists the -99 ASSY alongside
  // the BASE fixture, so the ASSY steals BASE's T-slot and cascades every following
  // fixture out of the configured tool-no order (e.g. CN 290794 → T1 ASSY, T2 BASE, …).
  // Returning null drops it from slotting (the T-Select ASSY tooling was already removed
  // for the same reason — see 20260622_remove_gs64pfii_assy_tooling.js).
  if (n.includes('ASSY') || n.includes('組立')) return null;
  if (n.includes('ARBOR')) return 'COLLET_ARBOR';          // check BEFORE COLLET (substring)
  if (n.includes('COLLAR')) return 'COLLAR';
  if (n.includes('COLLET') || n.includes('コレット')) return 'COLLET';
  if (n.includes('BASE') || n.includes('ベース')) return 'BASE';
  if (n.includes('SPACER') || n.includes('スペーサ')) return 'SPACER';
  return null;
}

// First two dash-segments of a DWG no (the tool family / machine-type key), e.g.
// 4547-01-0031-07 → 4547-01. Falls back to the raw value when it has < 2 segments.
function dwgPrefixOf(no) {
  const p = String(no || '').split('-');
  return p.length >= 2 ? `${p[0]}-${p[1]}` : (no || '');
}

// Name for a Machine-Tool-Config slot the part has NO tool for: the sheet still lists the
// fixture, so it needs the family's name out of `lpb.eng_tooling`. A DWG family holds
// SEVERAL drawings with DIFFERENT names, so something has to choose between them.
//
// THE SHOP'S OWN USAGE CHOOSES: among the family's ASCII names, the one the factory plan
// names most often. `planned` maps a full DWG no to how many `lpb.eng_r_pi_tool` rows use it.
//
// Two rules this replaced, both measured against the plan across all 266 whitelist families:
//   • "first ASCII name the DB returns" — the original. It is arbitrary (no ORDER BY) and
//     agrees with the plan on 46%. It printed `WORK STOPPER BASE` for XD-8's 4858-11, a
//     drawing the plan has NEVER used, over `WORK STOPPER` which it uses 224 times; and
//     `PALLET` for MD-V9910WA's 4918-01 (16 rows) over `UNIVERSAL PALLET ASSY` (132), which
//     put the same word on two different slots of one sheet. Both reported from the floor.
//   • `ORDER BY tool_dwg_no` — 35%, WORSE. Sorting is not evidence.
//
// ASCII IS A HARD GATE, NOT A TIE-BREAK. The sheet is printed in English, and letting the
// plan count win outright trades `COLLET` for `コレット` and `COLLAR` for `球研アーバー用カラー`
// wherever a family's Japanese drawings are the busier ones. Only ASCII names compete; if the
// family has none the plan uses, the first-ASCII answer stands.
//
// `planned` empty (the count query failed, or maqdb is down) ⇒ first-ASCII, unchanged.
const MIN_PLANNED = 10;
// "Reads as English", tested by SCRIPT rather than by byte range. A name is English when it
// has Latin letters and no kana / CJK / Thai — symbols inside an English name (Φ, ～, ×, °)
// do not make it Japanese. A plain ASCII test disqualified `LOADER CHUCK(Φ12～Φ30)` (planned
// 381 times on X-100's 4857-06) and printed `LOADER JAW BASE` instead, a drawing the plan has
// never used. Measured across all 305 whitelist families: exactly 2 change, both onto a name
// the plan uses far more (4857-06 0→381, 4858-12 1→164), none the other way.
const READS_AS_ENGLISH = (s) =>
  /[A-Za-z]/.test(s) && !/[぀-ヿ㐀-䶿一-鿿฀-๿]/.test(s);
function pickFamilyName(list, planned = {}) {
  const isAscii = READS_AS_ENGLISH;
  const add = (m, k, n) => m.set(k, (m.get(k) || 0) + n);
  const best = (m) => {
    let name = null, top = 0;
    for (const [k, n] of m) if (n > top) { name = k; top = n; }
    return name;
  };
  let first = null, anyAscii = false;
  const ascii = new Map(), all = new Map();
  for (const r of list) {
    if (!r || !r.tool_name) continue;
    const n = planned[r.tool_dwg_no] || 0;
    if (!first || (!isAscii(first) && isAscii(r.tool_name))) first = r.tool_name;
    add(all, r.tool_name, n);
    if (isAscii(r.tool_name)) { anyAscii = true; add(ascii, r.tool_name, n); }
  }
  if (!first) return '';
  // An ASCII name the plan uses wins outright. An ASCII name it does not use still beats
  // any Japanese one — that is the gate. Only a family with NO ASCII name at all falls
  // through to the plan's pick among the Japanese ones, which is what keeps a retired
  // 使用禁止 drawing off the sheet when every name in the family is Japanese (4586-04).
  const pool = anyAscii ? ascii : all;
  const winner = best(pool);
  if (!winner) return first;
  // EVIDENCE FLOOR. Replacing the incumbent on ONE plan row is not evidence, it is noise —
  // it flipped `V RAIL BASE`→`NUT` and `ID GRIND JIG`→`ID GRIND YATOI (CAM LOCK)` on a
  // single row each. Switch only when the winner is genuinely used (>= MIN_PLANNED) or the
  // incumbent is a drawing the plan has NEVER used, which is the 4858-11 WORK STOPPER BASE
  // case this started from: there any real usage beats none.
  const incumbent = pool.get(first) || 0;
  if ((pool.get(winner) || 0) >= MIN_PLANNED || incumbent === 0) return winner;
  return first;
}

// AN ALTERNATIVE THAT WAS NOT CHOSEN MUST NOT BE LISTED.
// Two config slots can hold MUTUALLY EXCLUSIVE families for ONE fixture: KL-20 grips with
// COLLET 4030-01 OR 4030-02 and never both; MD-V9910WA marks on PALLET 4918-01 OR 4918-02.
// The name-only fill printed every configured family, so the option this part does NOT use
// appeared as a named row with no drawing and sent the operator looking for a fixture that
// is nowhere on the sheet. Reported from the floor twice.
//
// WHICH SLOTS ARE ALTERNATIVES IS MEASURED, NOT GUESSED — and the first two rules tried
// were both wrong. "Same fixture name" looked obvious and over-fired: KS-400B1 has a second
// PLUG(A)/PLUG(B) pair whose families 4664-06 and 4664-21 the plan puts on the SAME C/N
// 15 times out of 15, so they are complements that happen to share a name. What separates
// them is whether the factory plan ever puts the two families on ONE C/N at this process:
//
//     KL-20      4030-01 + 4030-02   720 / 655 C/N,   5 together   1%   alternatives
//     MD-V9910WA 4918-01 + 4918-02   145 / 138 C/N,   0 together   0%   alternatives
//     GI-20N     4652-10 + 4652-12    84 /  57 C/N,  21 together  37%   unclear -> keep
//     KS-400B1   4664-06 + 4664-21    15 /  15 C/N,  15 together 100%   complements
//     XD-8       every 4858 pair                              85-100%   complements
//
// The population is bimodal — of 984 judged pairs, 690 sit at >=80% and 72 at 0% — so the
// threshold lands in an empty gap (1% to 85%) rather than on a slope.
//
// FAILS TOWARD SHOWING. Too little evidence (either family under MIN_ALT_CNS C/Ns at this
// process, or the query failed) means the pair is NOT treated as alternatives and the name
// still prints. Hiding a complement loses a fixture the setup needs; showing an unused
// alternative is only noise.
//
// Only a slot with NO Tool No is ever dropped, so nothing carrying data is removed, and a
// machine that genuinely mounts both has them filled from the plan and is untouched.
const ALT_MAX_TOGETHER_PCT = 5;   // observed gap is 1% -> 85%
const MIN_ALT_CNS = 5;            // below this the plan has not said anything yet

// solo: family -> C/Ns planning it at this process. together: "famA|famB" (sorted) -> C/Ns
// planning BOTH. Returns the set of pairs that behave as alternatives.
function alternativeFamilies(solo, together) {
  const alt = new Set();
  const fams = Object.keys(solo);
  for (let i = 0; i < fams.length; i++) {
    for (let j = i + 1; j < fams.length; j++) {
      const [a, b] = [fams[i], fams[j]].sort();
      // SAME DRAWING SERIES, or "never planned together" catches unrelated fixtures.
      // A fixture's alternatives are variants of it and share the 4-digit series by
      // construction (4030-01/-02, 4918-01/-02). Without this, GI-20N's CLAMP PLATE
      // 4652-12 and its ROTARY DRESSER 4800-42 co-occur 0 times — they serve different
      // jobs — and every sheet carrying the dresser dropped the clamp plate's name.
      if (a.split('-')[0] !== b.split('-')[0]) continue;
      const lo = Math.min(solo[a], solo[b]);
      if (lo < MIN_ALT_CNS) continue;
      const both = together[`${a}|${b}`] || 0;
      if ((100 * both) / lo <= ALT_MAX_TOGETHER_PCT) alt.add(`${a}|${b}`);
    }
  }
  return alt;
}

// AN ALTERNATIVE GROUP OCCUPIES ONE SLOT — THE FIRST THE CONFIG RESERVES FOR IT.
// `altPairs` says which families are mutually exclusive (see alternativeFamilies), and
// `famBySlot` says which family the WHITELIST reserves each slot for. A part uses exactly
// one member of a group, so the sheet should carry exactly one row for it: clearing the
// others but leaving their slot numbers empty prints the chosen pallet at T02 with a hole
// at T01, which reads as missing data. Reported on MD-V9910WA @3491, where 4918-01 and
// 4918-02 are alternatives and only the second was selected.
//
//   • exactly one member carries a Tool No  -> it MOVES to the group's earliest slot
//   • no member carries one                 -> the earliest keeps its name, rest cleared
//   • more than one carries one             -> LEFT ALONE. The plan overrules the
//     statistic: if the shop fitted both, both belong, each at its own slot.
//
// GROUP MEMBERSHIP COMES FROM `famBySlot`, NOT FROM WHAT LANDED IN THE SLOT. A slot filled
// by the factory plan or by a T-Select ` *` suggestion still belongs to the family the
// config reserved it for — deriving the group from the payload missed exactly the case this
// was reported for, where the chosen pallet was a T-Select fill and so looked like it had
// no group at all.
function dropUnchosenAlternatives(slotData, altPairs, famBySlot = []) {
  if (!altPairs || !altPairs.size) return slotData;

  // connected components over altPairs, across the slots the whitelist reserves
  const idx = famBySlot.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
  const groupOf = new Map();
  let next = 0;
  for (const i of idx) for (const j of idx) {
    if (i >= j) continue;
    const [a, b] = [famBySlot[i], famBySlot[j]].sort();
    if (a === b || !altPairs.has(a + '|' + b)) continue;
    const gi = groupOf.get(i), gj = groupOf.get(j);
    if (gi === undefined && gj === undefined) { groupOf.set(i, next); groupOf.set(j, next); next++; }
    else if (gi === undefined) groupOf.set(i, gj);
    else if (gj === undefined) groupOf.set(j, gi);
    else if (gi !== gj) for (const [k, g] of groupOf) if (g === gj) groupOf.set(k, gi);
  }
  if (!groupOf.size) return slotData;

  const groups = new Map();
  for (const [i, g] of groupOf) { if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); }
  for (const slots of groups.values()) {
    slots.sort((a, b) => a - b);
    const filled = slots.filter((i) => slotData[i] && slotData[i].tool_dwg_no);
    if (filled.length > 1) continue;                        // the shop fitted both — leave them
    const keep = filled.length ? slotData[filled[0]] : slotData[slots[0]];
    if (!keep) continue;                                    // nothing to show at all
    for (const i of slots) slotData[i] = null;
    slotData[slots[0]] = keep;
  }
  return slotData;
}

// Tracks which fixtures a sheet has already placed, so a T-Select fallback tool for a
// fixture the factory plan already supplied is suppressed rather than printed beside it as
// a wrong-band ` *` duplicate (factory COLLET 4547-01-0031-07 in T2 → drop T-Select's
// COLLET 4547-01-0017-05).
//
// KEYED BY (canon fixture, DWG FAMILY), NOT BY CANON ALONE. "Wrong band" means a different
// SUFFIX of the same family — 4547-01-0017-05 vs 4547-01-0031-07 — so the family is what
// makes two tools the same fixture. canonFixtureName matches on a SUBSTRING, and substrings
// collide across families that are genuinely DIFFERENT fixtures: X-100's ARBOR (4857-01) and
// ARBOR PIN (4857-02) both canonicalize to COLLET_ARBOR, so keying on canon alone dropped the
// PIN from every X-100 sheet — CN 414303 printed T02 with a blank Tool No and no image.
// Four of the five colliding groups in the live config are the same shape: KL-20
// (4030-01_COLLET / 4030-02_COLLET), J-WAVE (COLLET OP1 4879-04 / OP2 4879-05) and KS-H70
// (COLLET 4691-19 / COLLET (A) 4691-03 / COLLET BODY 4691-18). The family separates all of
// them while leaving the MSB case this was written for untouched — there BASE / COLLET /
// COLLET ARBOR / COLLAR all share family 4547-01 and are told apart by canon, which holds.
//
// FTL-10(I)'s COLLET OP1 / COLLET OP2 are the residual: both are 4501-01, so they are one
// fixture by this key. They are also one slot to the config resolver, which keys on the same
// family — separating them needs config work, not a different dedup key.
function makeFixtureTracker() {
  const seen = new Map();   // canon fixture → Set(DWG family)
  const keyOf = (name, dwgNo) => {
    const canon = canonFixtureName(name);
    const family = dwgPrefixOf(dwgNo);
    return canon && family ? { canon, family } : null;
  };
  return {
    note(name, dwgNo) {
      const k = keyOf(name, dwgNo);
      if (!k) return;
      if (!seen.has(k.canon)) seen.set(k.canon, new Set());
      seen.get(k.canon).add(k.family);
    },
    placed(name, dwgNo) {
      const k = keyOf(name, dwgNo);
      return !!(k && seen.get(k.canon)?.has(k.family));
    },
  };
}

// Build the canonical-fixture → { slot, family } map for the fixture-NAME slot tier.
// `mtRows` = whitelist slots ({ tool_drawing_no, tool_number }); `nameByDwg` maps a
// whitelist DWG → its fixture name (lpb.eng_tooling); `orderMap` maps a whitelist DWG →
// its 1-based T-slot. A canonical fixture is kept ONLY when it maps to exactly ONE slot —
// a fixture that lands in >1 slot is ambiguous and dropped (never guess). Stays EMPTY for
// non-MSB whitelists whose names don't canonicalize → the name tier is inert there.
function buildSlotByFixture(mtRows, nameByDwg, orderMap) {
  const slotByFixture = new Map();   // canon fixture → { slot, family }
  const canonCount = {};
  for (const r of mtRows) {
    const canon = canonFixtureName(nameByDwg[r.tool_drawing_no]);
    if (!canon) continue;
    canonCount[canon] = (canonCount[canon] || 0) + 1;
    slotByFixture.set(canon, { slot: orderMap[r.tool_drawing_no], family: dwgPrefixOf(r.tool_drawing_no) });
  }
  for (const [c, n] of Object.entries(canonCount)) if (n > 1) slotByFixture.delete(c); // ambiguous → drop
  return slotByFixture;
}

// DWG no (+ optional fixture NAME) → configured T-slot. Three tiers, in order: 1) exact
// DWG in the whitelist, 2) dash-prefix family overlap, 3) fixture NAME (MSB grinders) —
// the name tier fires only when the candidate shares the whitelisted fixture's DWG family,
// so a same-named tool of a DIFFERENT family can't cross over. null = no slot.
function makeConfigSlotResolver({ orderMap, allowedKeys, slotByFixture }) {
  return (dwgNo, toolName) => {
    if (!dwgNo) return null;
    if (orderMap[dwgNo] !== undefined) return orderMap[dwgNo];
    const k = allowedKeys.find(key => dwgNo === key || dwgNo.startsWith(key + '-') || key.startsWith(dwgNo + '-'));
    if (k !== undefined) return orderMap[k];
    const canon = canonFixtureName(toolName);
    if (canon && slotByFixture.has(canon)) {
      const e = slotByFixture.get(canon);
      if (dwgPrefixOf(dwgNo) === e.family) return e.slot;
    }
    return null;
  };
}

// ── Cloned buildValueMap logic for consistency ──────────────────────────────

async function buildValueMap(searchData, machine_type_name, process_code, engPool, displayName) {
  // (Identical to Gotenberg/Standard controllers, returns flat map of values + image buffers)
  // For the POC, I'll use the same code as before but return it for HTML consumption.
  
  const PART_CATEGORY = { BALL: 'Ball Parts', RACE: 'Race Parts', BODY: 'Body Parts', SLEEVE: 'Sleeve Parts', SPHERICAL: 'Spherical Parts' };
  const map = {};
  
  const mtcRow2 = await engPool.query(
    `SELECT machine_type_code, tool_code_filter, machine_group FROM ${TABLES.SDS_MACHINE_TYPE_CODE}
     WHERE machine_type_name = $1 AND is_active ORDER BY machine_type_code LIMIT 1`,
    [machine_type_name]
  );
  const mtcRow2Data = mtcRow2.rows[0];
  const machineTypeCode = mtcRow2Data ? (mtcRow2Data.tool_code_filter || mtcRow2Data.machine_type_code) : null;
  // Label printed on the sheet. The caller (PDF picker) decides: a SPLIT group passes the
  // specific machine name (e.g. KS-400B2); a COMBINED group passes the group name (e.g.
  // TSG-300W/TSG-300ZNC). Fallback when no display_name is given: group name, else machine name.
  const machineDisplayName = displayName || mtcRow2Data?.machine_group || machine_type_name;
  // The shared group name is still needed to match T-Select fallback tools, which are
  // keyed by tooling_machine.machine_group (e.g. 'KS-400B1/B2/B7'), not the per-machine name.
  const machineGroup = mtcRow2Data?.machine_group || null;

  const firstProcessInfo = process_code
    ? searchData.process_info.find(r => String(r.process_code) === String(process_code)) || searchData.process_info[0]
    : searchData.process_info[0];

  // Display the CN as the 6-digit item-no (e.g. 320641), not the control-no (C32-00641).
  // `_cn_control` keeps the control-no form for internal lookups (approval seals are
  // keyed by control-no in sds_approval) — it is `_`-prefixed so it never renders in a grid cell.
  map['cn']               = cnFormat.toItemNo(searchData.cn) || searchData.cn || '';
  map['_cn_control']      = searchData.cn || '';
  map['parts_no']         = searchData.parts_no || '';
  map['dwg_rev']          = searchData.dwg_rev || 'NC';
  map['part_type']        = searchData.part_type || '';
  map['category']         = searchData.part_info?.class1_name || PART_CATEGORY[searchData.part_type] || searchData.part_type || '';
  map['material']         = searchData.material?.material || '';
  map['process_code']     = firstProcessInfo?.process_code || '';
  map['process_name']     = firstProcessInfo?.process_eng  || firstProcessInfo?.process_name || '';
  map['ct']               = firstProcessInfo?.ct != null ? String(firstProcessInfo.ct) : '';
  map['machine_type_name'] = machineDisplayName || '';
  map['current_date']     = moment().format('YYYY-MM-DD');

  if (searchData.dimension) {
    let dim = searchData.dimension;
    // Spherical (A4x): sdsV2SearchService selects from lpb.eng_sph, which carries NO
    // dimension columns — they live one table over in eng_sph_design. Merge that row in
    // so `dim.*` resolves for A4x exactly like every other class. Best-effort: a failed
    // lookup leaves the base row untouched and the dims simply resolve to null.
    if (String(searchData.part_type).toUpperCase() === 'SPHERICAL' && dim[SPHERICAL_DESIGN.joinFrom]) {
      try {
        const dr = await maqPool.query(
          `SELECT * FROM ${SPHERICAL_DESIGN.table} WHERE ${SPHERICAL_DESIGN.joinTo} = $1 LIMIT 1`,
          [dim[SPHERICAL_DESIGN.joinFrom]]
        );
        if (dr.rows[0]) dim = { ...dim, ...dr.rows[0] };
      } catch (err) {
        console.warn(`[sds-pdf] spherical design lookup failed for ${searchData.cn}: ${err.message}`);
      }
    }

    // Raw factory columns stay exposed under their own names (existing configs may use them).
    Object.keys(dim).forEach(k => { map[`dimension.${k}`] = dim[k] !== null ? String(dim[k]) : ''; });

    // Canonical part dimensions — the ONLY names a grid cell should reference, since the
    // underlying column differs per part class. Consumed via `{{dim.OD}}` tokens in
    // sds_parameter values (see resolveDimTokens).
    //
    // NOTE: the previous SD calc read dim.od_aft / dim.w_aft / dim.sd — none of which are
    // columns on ANY lpb dimension table — so it always computed 0 and never emitted a
    // value. resolvePartDims derives SD from the real aliased OD/W instead.
    const parts = resolvePartDims(searchData.part_type, dim);
    map['dim.OD'] = parts.OD != null ? String(parts.OD) : '';
    map['dim.ID'] = parts.ID != null ? String(parts.ID) : '';
    map['dim.W']  = parts.W  != null ? String(parts.W)  : '';
    map['dim.SD'] = parts.SD != null ? parts.SD.toFixed(3) : '';
    if (parts.SD != null) map['dimension.sd'] = parts.SD.toFixed(3);
  }

  if (searchData.production) {
    map['model'] = searchData.production.model || '';
    map['customer'] = searchData.production.customer || '';
    map['cust_dwg_no'] = searchData.production.cust_dwg_no || '';
  }

  let tools = searchData.process_plan || [];
  if (process_code) tools = tools.filter(t => String(t.process_code) === String(process_code));

  let mtRows = [];
  if (machine_type_name && process_code) {
    // Machine Tool Config (sds_machine_tool) is per-machine FIRST: each physical grinder
    // owns its ordered T01–Tn fixture whitelist, so a SPLIT group member (e.g. KS-400B2)
    // uses its own list. Only when a machine has NO rows of its own do we fall back to the
    // group-wide list (COMBINED groups / not-yet-split members keep working — the curated
    // list lives once on the representative and siblings reuse it).
    const runToolQuery = (names) => engPool.query(
      `SELECT tool_number, tool_drawing_no FROM ${TABLES.SDS_V2_MACHINE_TOOL}
       WHERE machine_type = ANY($1) AND process_code = $2
       ORDER BY LPAD(SUBSTRING(tool_number FROM 2), 5, '0')`,
      [names, String(process_code)]
    );
    let mtResult = await runToolQuery([machine_type_name]);
    if (mtResult.rows.length === 0 && machineGroup) {
      const toolMachineNames = (await engPool.query(
        `SELECT machine_type_name FROM ${TABLES.SDS_MACHINE_TYPE_CODE}
         WHERE machine_group = $1 AND is_active`,
        [machineGroup]
      )).rows.map(r => r.machine_type_name);
      mtResult = await runToolQuery(toolMachineNames);
    }
    // Dedupe by tool slot (belt-and-braces for the group-fallback path).
    const seenTool = new Set();
    mtRows = mtResult.rows.filter(r => !seenTool.has(r.tool_number) && seenTool.add(r.tool_number));
  }

  const dwgPrefix = dwgPrefixOf;
  const slotData = new Array(20).fill(null);

  // Place a tool honoring its Machine Tool Config slot (1-based T-number) when known
  // AND free. A configSlot that's already taken is a same-family COLLISION (e.g. two
  // distinct factory fixtures, like a CARRIER and a PLATE, sharing one whitelisted DWG
  // family) — the loser is DROPPED, not spilled into an unrelated free slot, or a
  // curated 2-tool whitelist silently renders a 3rd, unconfigured tool on the PDF
  // (found via TSG-300ZNC process 1021 / CN C35-00541, 2026-07-23). Only a genuinely
  // absent configSlot (no whitelist applies to this tool at all) falls through to the
  // first empty slot, which keeps the no-whitelist "legacy" fill unrestricted.
  const placeTool = (configSlot, payload) => {
    if (configSlot && configSlot >= 1 && configSlot <= 20) {
      if (!slotData[configSlot - 1]) { slotData[configSlot - 1] = payload; return true; }
      return false;
    }
    const idx = slotData.findIndex(s => s === null);
    if (idx === -1) return false;
    slotData[idx] = payload; return true;
  };

  // DWG no (+ optional fixture NAME) → configured T-number. Tiers: 1) exact DWG,
  // 2) dash-prefix family, 3) fixture NAME (MSB grinders). null = no slot.
  let configSlotOf = () => null;
  if (mtRows.length > 0) {
    const allowedKeys = mtRows.map(r => r.tool_drawing_no);
    const orderMap = {};
    mtRows.forEach(r => { orderMap[r.tool_drawing_no] = parseInt(r.tool_number.slice(1)); });

    // Resolve each whitelist slot's fixture NAME (from lpb.eng_tooling) so a factory /
    // T-Select tool can be matched to its slot by fixture TYPE — the only key that
    // survives the bore-band DWG shuffle (band 0031 lists COLLET/ARBOR/COLLAR at
    // -07/-08/-09; the whitelist lists them at -02/-03/-04). Best-effort: a name-resolution
    // failure is LOGGED (not silently swallowed) and falls back to DWG-only matching
    // (slotByFixture stays empty → the fixture-NAME tier is inert).
    let slotByFixture = new Map();   // canon fixture → { slot, family }
    try {
      const nameRows = (await maqPool.query(
        `SELECT tool_dwg_no, tool_name FROM ${TABLES.LPB_ENG_TOOLING} WHERE tool_dwg_no = ANY($1)`,
        [allowedKeys]
      )).rows;
      const nameByDwg = {};
      for (const r of nameRows) if (r.tool_name && !nameByDwg[r.tool_dwg_no]) nameByDwg[r.tool_dwg_no] = r.tool_name;
      slotByFixture = buildSlotByFixture(mtRows, nameByDwg, orderMap);
    } catch (err) {
      console.warn(`[sds-pdf] fixture-name resolution failed for [${allowedKeys.join(', ')}] — falling back to DWG-only slotting: ${err.message}`);
    }

    configSlotOf = makeConfigSlotResolver({ orderMap, allowedKeys, slotByFixture });
    // Factory-plan tools that match the whitelist land in their configured T-slot
    // (slot positions are honored, gaps preserved). Sorted by slot so a same-family
    // collision resolves deterministically: the first (lowest T) tool keeps the slot,
    // any other tool matching the same family is dropped by placeTool (see its comment).
    const matched = tools
      .filter(t => configSlotOf(t.tool_dwg_no, t.tool_name) !== null)
      .sort((a, b) => configSlotOf(a.tool_dwg_no, a.tool_name) - configSlotOf(b.tool_dwg_no, b.tool_name));
    for (const t of matched) {
      placeTool(configSlotOf(t.tool_dwg_no, t.tool_name), { tool_name: t.tool_name || '', tool_dwg_no: t.tool_dwg_no || '', fromTs: false });
    }
  } else {
    // No Machine Tool Config → legacy compacted fill (prefix-code filter when available).
    const legacy = machineTypeCode
      ? tools.filter(t => t.tool_dwg_no?.substring(1, 4) === machineTypeCode)
      : tools;
    for (const t of legacy) placeTool(null, { tool_name: t.tool_name || '', tool_dwg_no: t.tool_dwg_no || '', fromTs: false });
  }

  // Did the FACTORY plan / Machine Tool Config place anything? Captured before the
  // Tooling Select fallback fills any slot, so it means "the factory assigned a fixture".
  const hadFactoryTool = slotData.some(Boolean);

  // withSimilarRef so buildValueMap can prefer a dimensionally-similar produced part's
  // tool (similarRef) over the raw dimensional match when filling an empty slot.
  const tsResult = slotData.some(s => s === null) ? await tselectFallback.safeSearch(searchData.cn, { withSimilarRef: true }) : null;

  // ── "No jig required" (surface grind 1101/1102, OD > 40 or W > 38) ──────────
  // The rule itself lives in searchService, which already emits a type:'no_jig'
  // warning for the machine — read it rather than re-deriving, so the PDF and the
  // Tooling Select page can never disagree about the same part. `appliesTo` is
  // re-checked here because the PDF also knows the process_code, which Tooling
  // Select does not; a machine is only offered for 1101/1102, so this is belt and
  // braces rather than a second rule.
  //
  // FACTORY FIRST: if the plan assigned a fixture, that is the answer — the sheet
  // prints it and says nothing about jigs. This only replaces the Tooling Select
  // FALLBACK, which would otherwise rank the nearest small-part fixture and print
  // it with a ' *' as though it were the selection for a part that needs none.
  const noJigRequired = !hadFactoryTool
    && noJigRule.appliesTo({ machineName: machine_type_name, processCode: process_code })
    && (tsResult?.warnings || []).some(
      w => w.type === 'no_jig' && (w.machine === machine_type_name || w.machine === machineGroup)
    );

  if (tsResult && !noJigRequired) {
    const acceptable = new Set([machine_type_name]);
    if (machineGroup) acceptable.add(machineGroup);
    // The PDF is generated for a process_code the part actually has (the user picked
    // a real process row). Tell the fallback so the direction gate is not applied —
    // a multi-grind part (ID grind + spherical/OD grind) has only one stored
    // direction and would otherwise drop a valid machine's T-Select tooling.
    const partHasProcess = (searchData.process_info || []).some(
      r => String(r.process_code) === String(process_code)
    ) || (searchData.process_plan || []).some(
      r => String(r.process_code) === String(process_code)
    );
    // includeSimilar: the Setup Data Sheet should still carry a Tool No when the
    // only available pick is the factory's choice for the most dimensionally-
    // similar part (similar-part fallback). These come through fromTs → ' *'
    // marker (= "supplied by Tooling Select, not the part's factory data").
    // acceptFamilies: this machine's own whitelist, so T-Select tooling filed under
    // ANOTHER machine's name can still reach the slot the config reserves for it.
    // 9901-09 CONCENTRICITY MEASURING PIN is the case: TEMPLATE_B puts it first in
    // every X-100 block, but its family resolves to registry code 901 = `測定用治具全般`,
    // so the machine-name gate dropped it and X-100's T01 printed name-only.
    // The whitelist is what keeps this tight — a foreign result enters only through a
    // family the config already reserves a slot for.
    const acceptFamilies = new Set(mtRows.map(r => dwgPrefix(r.tool_drawing_no)).filter(Boolean));
    const tsTools = tselectFallback.tselectToolsForMachine(tsResult, acceptable, { processCode: process_code, partHasProcess, includeSimilar: true, acceptFamilies });
    // Order the fallback tools by the T-Select machine's tooling DEFINITION order
    // (tooling_formula sort_order, then id) rather than searchService's alphabetical
    // sort. For MSB grinders this yields the assembly order WORK FIXED BASE → COLLET →
    // COLLET ARBOR → COLLAR → ASSY (alphabetical gave ASSY, COLLAR, COLLET, …). The
    // order is data-driven — an engineer reorders slots by editing tooling_formula
    // sort_order. Harmless for config-slotted machines (those land in their T-slot
    // regardless of iteration order; only free-slot spillover follows this order).
    if (tsTools.length > 1) {
      try {
        const ordRes = await engPool.query(
          `SELECT tf.tooling_name, MIN(tf.sort_order) AS so, MIN(tf.id) AS fid
             FROM tooling_formula tf JOIN tooling_machine tm ON tm.id = tf.machine_id
            WHERE tm.machine_name = ANY($1)
            GROUP BY tf.tooling_name ORDER BY so, fid`,
          [[machine_type_name, machineGroup].filter(Boolean)]
        );
        if (ordRes.rows.length) {
          const ord = new Map(ordRes.rows.map((r, i) => [r.tooling_name, i]));
          const rank = (n) => (ord.has(n) ? ord.get(n) : Number.MAX_SAFE_INTEGER);
          tsTools.forEach((t, i) => { t._i = i; });            // keep stable for ties
          tsTools.sort((a, b) => (rank(a.tooling_name) - rank(b.tooling_name)) || (a._i - b._i));
        }
      } catch (_) { /* ordering is best-effort — fall back to the given order */ }
    }
    // Dedup key granularity: some machines (MSB surface grinders PSG-64/GS-64PFII) use ONE
    // DWG family for SEVERAL DISTINCT fixtures — BASE/COLLET/COLLET ARBOR/COLLAR/ASSY are all
    // 4547-01-xxxx. Deduping by the 2-segment family prefix would collapse them into a single
    // tool (only the first ever showed). So for a family that yields >1 distinct fixture here,
    // key dedup on the FULL dwg; single-fixture families keep prefix dedup (still merges the
    // rotary-dresser case where factory 4800-42-0293 and a T-Select 4800-42-xxxx are one tool).
    const famSets = {};
    for (const tt of tsTools) {
      const p = dwgPrefix(tt.tooling_no);
      (famSets[p] = famSets[p] || new Set()).add(toDwg(tt.tooling_no));
    }
    const multiFam = new Set(Object.keys(famSets).filter(p => famSets[p].size > 1));
    const dedupKey = (no) => (multiFam.has(dwgPrefix(no)) ? toDwg(no) : dwgPrefix(no));
    const existingKeys = new Set(slotData.filter(Boolean).map(s => dedupKey(s.tool_dwg_no)).filter(Boolean));
    const { note: noteFixture, placed: fixturePlaced } = makeFixtureTracker();
    slotData.filter(Boolean).forEach(s => noteFixture(s.tool_name, s.tool_dwg_no));
    // The ' *' marker means "supplied by Tooling Select, not in the part's factory data".
    // But a fallback tool is often ALSO listed verbatim in the factory process plan — it only
    // came through the fallback because its DWG isn't in the (static, band-specific) Machine
    // Tool Config whitelist (e.g. MSB jigs: the plan lists 4547-01-0029-xx for this part, but
    // the config whitelists a different bore-ID band). When the plan confirms the exact tool,
    // treat it as a factory tool: drop the ' *' and prefer the factory tool name.
    const planByDwg = new Map();
    for (const t of (searchData.process_plan || [])) {
      const d = toDwg(t.tool_dwg_no);
      if (d && !planByDwg.has(d)) planByDwg.set(d, t);
    }
    for (const tt of tsTools) {
      const key = dedupKey(tt.tooling_no);
      if (key && existingKeys.has(key)) continue;
      // Skip a T-Select tool whose fixture the factory plan already supplied (factory-first):
      // its DWG differs (different bore band) but it's the same fixture → would otherwise add
      // a misleading wrong-band ` *` duplicate beside the real factory tool.
      if (fixturePlaced(tt.tooling_name, tt.tooling_no) && !planByDwg.has(toDwg(tt.tooling_no))) continue;
      const planHit = planByDwg.get(toDwg(tt.tooling_no));
      // A T-Select tool also maps to its Machine Tool Config slot via DWG prefix, so it
      // lands in the SAME T-slot the config reserves for that tool family (not just the
      // next empty slot). Falls back to first free slot when no config slot applies/free.
      const cfgSlot = configSlotOf(tt.tooling_no, tt.tooling_name);
      // When a Machine Tool Config whitelist exists it is authoritative — a T-Select tool
      // outside the whitelist (no configured slot, no fixture-name match) must NOT spill
      // into a free slot reserved for a whitelisted fixture. e.g. KS-H70's T-Select returns
      // LOADER 4907-05/06, which are not in the curated 4691/4907-01/03 list; without this
      // gate they squatted in slots T4/T5 (reserved for 4691-03/4691-10) and displaced the
      // configured fixtures. No whitelist (mtRows empty) → legacy free-fill still applies.
      if (mtRows.length > 0 && cfgSlot === null) continue;
      const placedName = (planHit && planHit.tool_name) || tt.tooling_name || '';
      if (!placeTool(cfgSlot, {
        tool_name: placedName,
        tool_dwg_no: tt.tooling_no,
        fromTs: !planHit,
      })) break;
      if (key) existingKeys.add(key);
      noteFixture(placedName, tt.tooling_no);
    }
  }

  // Machine Tool Config slots with NO factory/T-Select tool for this CN still get the
  // configured fixture's NAME (resolved from lpb.eng_tooling by DWG family) so the SDS
  // always lists every fixture per Machine Tool Config — even when the factory plan
  // carries no Tool No for it. Tool No cell stays blank (no factory no); name shows.
  // Skipped when no jig is required — listing every configured fixture name for a
  // part that needs none is exactly the misleading output this rule exists to stop.
  if (mtRows.length > 0 && !noJigRequired) {
    const emptyCfg = mtRows.filter(r => {
      const slot = parseInt(r.tool_number.slice(1), 10);
      return slot >= 1 && slot <= 20 && !slotData[slot - 1] && r.tool_drawing_no;
    });
    if (emptyCfg.length > 0) {
      // A machine fixture (e.g. ROTARY DRESSER, 4800-42) is shared across grinding
      // processes, so the part often registers it under a DIFFERENT process_code than the
      // one this SDS is generated for — `tools` was filtered to the selected process_code,
      // so that slot fell through here with a blank Tool No. Recover its REAL part-specific
      // Tool No from the part's FULL process plan (every process_code) by DWG family before
      // the name-only fallback, so e.g. KS-400B5/B6 show 4800-42-0293 instead of a blank.
      const planAll = searchData.process_plan || [];
      const planMatchNo = (family) => {
        const hit = planAll.find(t => {
          const d = t.tool_dwg_no;
          return d && (d === family || d.startsWith(`${family}-`) || family.startsWith(`${d}-`));
        });
        return hit || null;
      };

      // Part-number-selected fixtures (e.g. ROTARY DRESSER 4800-42 on KS-400B5/B6) have NO
      // dimensional formula — the engineering TOOLING LIST picks them by the workpiece part
      // number. tooling_partno_map holds that Part No → DWG lookup (seeded from the xlsx). It
      // is the AUTHORITATIVE selection, so it wins over the process-plan fallback. Prefer a
      // non-forbidden (非使用禁止) mapping via the ORDER BY.
      let partNoRows = [];
      if (searchData.parts_no) {
        try {
          partNoRows = (await engPool.query(
            `SELECT tool_dwg_no, tooling_name FROM ${TABLES.TOOLING_PARTNO_MAP}
             WHERE machine_name = $1 AND parts_no = $2
             ORDER BY is_forbidden ASC, tool_dwg_no ASC`,
            [machine_type_name, searchData.parts_no]
          )).rows;
        } catch (_) { /* part-no map is optional — fall back to plan / name-only */ }
      }
      const partNoMatchNo = (family) => partNoRows.find(r => {
        // Stored as DD#### — convert to the full 4800-42 form so it matches the config family.
        const d = toDwg(r.tool_dwg_no);
        return d && (d === family || d.startsWith(`${family}-`) || family.startsWith(`${d}-`));
      }) || null;

      const families = [...new Set(emptyCfg.map(r => r.tool_drawing_no))];
      const nameByFamily = {};
      let altPairs = new Set();
      try {
        const likeArgs = families.map(f => `${f}%`);
        const likeSql = (n) => families.map((_, i) => `tool_dwg_no LIKE $${i + n}`).join(' OR ');
        // How often the shop actually plans each drawing in these families. Used ONLY to
        // rescue the pick below; scoped to the families of the empty slots on this one
        // sheet, so it is ~50 ms and never runs when every slot already has a tool.
        // Co-occurrence needs EVERY family the whitelist reserves, not just the empty ones —
        // the question is whether an empty slot excludes one that IS filled.
        const allFams = [...new Set(mtRows.map((r) => r.tool_drawing_no).filter(Boolean))];
        const allLike = allFams.map((f) => `${f}%`);
        const allSql = (n) => allFams.map((_, i) => `tool_dwg_no LIKE $${i + n}`).join(' OR ');
        const [nr, pr, cr] = await Promise.all([
          maqPool.query(
            `SELECT tool_dwg_no, tool_name FROM ${TABLES.LPB_ENG_TOOLING} WHERE ${likeSql(1)}`, likeArgs),
          maqPool.query(
            `SELECT tool_dwg_no, count(*)::int AS n FROM ${TABLES.LPB_ENG_R_PI_TOOL}
              WHERE ${likeSql(1)} GROUP BY 1`, likeArgs).catch(() => ({ rows: [] })),
          maqPool.query(
            `WITH f AS (
               SELECT process_plan_no,
                      split_part(tool_dwg_no, '-', 1) || '-' || split_part(tool_dwg_no, '-', 2) AS fam
                 FROM ${TABLES.LPB_ENG_R_PI_TOOL}
                WHERE process_code = $1 AND (${allSql(2)})
                GROUP BY 1, 2)
             SELECT a.fam AS fam_a, b.fam AS fam_b, count(*)::int AS n
               FROM f a JOIN f b ON a.process_plan_no = b.process_plan_no AND a.fam < b.fam
              GROUP BY 1, 2
             UNION ALL
             SELECT fam, NULL, count(*)::int FROM f GROUP BY 1`,
            [String(process_code), ...allLike]).catch(() => ({ rows: [] })),
        ]);
        const solo = {}, together = {};
        for (const r of cr.rows) {
          if (r.fam_b === null) solo[r.fam_a] = r.n;
          else together[`${r.fam_a}|${r.fam_b}`] = r.n;
        }
        altPairs = alternativeFamilies(solo, together);
        const planned = Object.fromEntries(pr.rows.map(r => [r.tool_dwg_no, r.n]));
        const byFam = {};
        for (const row of nr.rows) {
          if (!row.tool_name) continue;
          const fam = families.find(f => row.tool_dwg_no === f || row.tool_dwg_no.startsWith(`${f}-`));
          if (fam) (byFam[fam] = byFam[fam] || []).push(row);
        }
        for (const [fam, list] of Object.entries(byFam)) nameByFamily[fam] = pickFamilyName(list, planned);
      } catch (_) { /* name resolution is best-effort — slot still lists the fixture */ }
      for (const r of emptyCfg) {
        const slot = parseInt(r.tool_number.slice(1), 10);
        // Part No map (authoritative) → full process plan (any process_code) → name-only blank.
        const fromMap = partNoMatchNo(r.tool_drawing_no);
        const fromPlan = fromMap ? null : planMatchNo(r.tool_drawing_no);
        const dwg = fromMap ? fromMap.tool_dwg_no : (fromPlan ? fromPlan.tool_dwg_no : '');
        const name = (fromMap && fromMap.tooling_name)
          || (fromPlan && fromPlan.tool_name)
          || nameByFamily[r.tool_drawing_no] || '';
        slotData[slot - 1] = {
          tool_name: name,
          tool_dwg_no: dwg,          // '' only when neither map nor plan has this fixture for the part
          // The whitelist's own family, kept because `dwg` may be '' — a NAME-keyed image
          // still has to know WHICH family this slot is, or it matches by name alone.
          cfg_family: r.tool_drawing_no,
          fromTs: false,
          fromConfig: true,
        };
      }

      // The whitelist family per slot — config, not payload. See the function header.
      const famBySlot = [];
      for (const r of mtRows) {
        const n = parseInt(r.tool_number.slice(1), 10);
        if (n >= 1 && n <= 20 && r.tool_drawing_no) famBySlot[n - 1] = dwgPrefix(r.tool_drawing_no);
      }
      dropUnchosenAlternatives(slotData, altPairs, famBySlot);

    }
  }

  const finalTools = [];
  for (let i = 0; i < 20; i++) {
    const slot = `T${String(i + 1).padStart(2, '0')}`;
    const s = slotData[i];
    // The rotary diamond dresser (4800-42 family) is PRINTED in its DD#### form regardless of
    // source (Part No map already stores DD; a factory-plan 4800-42-XXXX is converted) so the
    // sheet is consistent. toDD is a no-op for every other tool. cleanDwg keeps the full
    // 4800-42 form for the tooling-image lookup.
    const printDwg = s ? toDD(s.tool_dwg_no) : '';
    const cleanDwg = s ? toDwg(s.tool_dwg_no) : null;
    finalTools.push({
      slot,
      name: s ? s.tool_name : '',
      dwg: s ? (s.fromTs ? `${printDwg} *` : printDwg) : '',
      cleanDwg,
      // Scope for the NAME-keyed image: the tool's own DWG family, or the whitelist's
      // when the slot carries no Tool No. Both go through dwgPrefixOf — an MSB whitelist
      // row is the 4-segment `4547-01-0031-02`, and the image is keyed on `4547-01`.
      family: dwgPrefixOf(cleanDwg || (s && s.cfg_family) || '') || null,
    });
  }
  // A part needing no fixture must SAY so. Twenty blank tool rows read as "the data
  // is missing" — the state this sheet is printed to rule out — so the statement goes
  // in the first slot's name cell, where a fixture name would have been, and the Tool
  // No cell stays empty because there is no drawing to quote.
  if (noJigRequired) {
    finalTools[0].name = noJigRule.LABEL;
    console.log(`[sds-pdf] ${noJigRule.LABEL}: cn=${searchData.cn} machine=${machine_type_name} process=${process_code}`);
  }
  map['tooling'] = finalTools;
  map['no_jig_required'] = noJigRequired ? '1' : '';

  // Per-CN override must win over the machine default. `searchData.cn` is control-no
  // form (e.g. C32-00641), but the admin Excel-Config UI may store the override cn in
  // item-no form (e.g. 320641) — so match BOTH forms, else the override silently never
  // matches and the PDF falls back to the machine default. Ordered so cn IS NULL
  // (default) is applied first and the cn-specific override overwrites it last.
  const cnCtrl = searchData.cn;                               // control-no: C32-00641
  const cnItem = cnFormat.toItemNo(searchData.cn) || cnCtrl;  // item-no:    320641
  // Per-process CN overrides: a machine grinding one CN under both 1021 and 1022 needs a
  // different condition grid per process. Machine-default rows stay process-agnostic
  // (process_code IS NULL = applies to every process); a CN override may pin a process_code.
  // Precedence (least → most specific, later rows overwrite earlier in rawParams):
  //   machine default → CN (any process) → CN + this process.
  // cn-specificity is the PRIMARY sort so a per-CN value beats a process-specific one.
  const paramRows = await engPool.query(
    `SELECT param_key, param_value FROM ${TABLES.SDS_PARAMETER}
     WHERE machine_type_name = $3 AND (cn IS NULL OR cn = $1 OR cn = $2)
       AND (process_code IS NULL OR process_code = $4)
     ORDER BY (cn IS NULL) DESC, (process_code IS NULL) DESC`,
    [cnCtrl, cnItem, machine_type_name, process_code || null]
  );
  const rawParams = {};
  paramRows.rows.forEach(r => { rawParams[r.param_key] = r.param_value || ''; });
  map['params'] = rawParams;
  map['sds_rev'] = rawParams['sds_rev'] || 'NC';

  const grindMatch = (map['process_name'] || '').match(/^(.*?)\s*grind/i);
  map['grinding_area_label'] = grindMatch ? `${grindMatch[1].trim().toUpperCase()} GRINDING AREA` : 'GRINDING AREA';

  // Images — only fetch the rows we might match (stored tool_dwg_no can be a
  // prefix of the full dwg, so include every cumulative prefix as a candidate)
  // instead of loading the entire image-BLOB table on every render.
  // A DWG-specific image always wins; a NAME-keyed image
  // (tool_dwg_no = 'NAME:<family>:<TOOL>') is a fallback shared by every band of THAT
  // FAMILY — so MSB fixtures (BASE / COLLET / COLLET ARBOR / COLLAR) need ONE image each,
  // not one per bore-ID band (their full dwgs differ per band: 4547-01-{band}-{comp}).
  // The family is in the key: without it the MSB picture printed on every tool named
  // COLLET on every machine (see NAME_IMG_KEY).
  const dwgNos = slotData.slice(0, 20).map(s => s?.tool_dwg_no).filter(Boolean);
  const slotNames = map.tooling.map(t => t.name).filter(Boolean);
  if (dwgNos.length || slotNames.length) {
    const candidates = new Set();
    for (const d of dwgNos) {
      candidates.add(d);
      const parts = String(d).split('-');
      for (let i = 1; i < parts.length; i++) candidates.add(parts.slice(0, i).join('-'));
    }
    for (const t of map.tooling) {
      if (!t.family) continue;
      // The CONFIG family is a candidate in its own right. A slot the part has no Tool No
      // for still knows which family the whitelist reserved it for, and images are keyed at
      // exactly that level — so `4918-01` should print MD-V9910WA's pallet picture whether or
      // not this particular part plans a 4918-01. Before this the DWG branch was gated on the
      // tool having a Tool No, so a named-but-empty slot could never show a picture.
      candidates.add(t.family);
      if (t.name) candidates.add(NAME_IMG_KEY(t.family, t.name));
    }
    const allImgRows = await engPool.query(
      `SELECT tool_dwg_no, image_data, mime_type FROM ${TABLES.SDS_V2_TOOLING_IMAGE} WHERE tool_dwg_no = ANY($1)`,
      [[...candidates]]
    );
    for (const tool of map.tooling) {
        // 1) DWG-specific image (exact or family-prefix). 2) name-keyed fallback.
        let img = tool.cleanDwg
          ? allImgRows.rows.find(i => tool.cleanDwg === i.tool_dwg_no || tool.cleanDwg.startsWith(i.tool_dwg_no + '-'))
          : (tool.family ? allImgRows.rows.find(i => i.tool_dwg_no === tool.family) : null);
        if (!img && tool.name && tool.family) {
          const nk = NAME_IMG_KEY(tool.family, tool.name);
          img = allImgRows.rows.find(i => i.tool_dwg_no === nk);
        }
        if (img) tool.image = `data:${img.mime_type};base64,${img.image_data.toString('base64')}`;
    }
  }

  // Grinding layout image — three targeting levels, most specific wins:
  //   full control-no ('C39-04137')  >  family prefix ('C39')  >  class prefix ('C3')
  // Within one level a process-specific image beats the process-default. The class level
  // is the fallback that makes a family with no picture of its own still print one, so a
  // single shop drawing covering all of BALL can be uploaded once as 'C3'.
  // Rules live in utils/grindingPrefix so the admin coverage report cannot disagree with
  // what actually renders here.
  const { exact: cnExact, family: cnFamily, keys: cnKeys } = cnMatchKeys(searchData.cn);
  const grindingQ = await engPool.query(
    `SELECT image_data, mime_type FROM ${TABLES.SDS_V2_GRINDING_IMAGE}
     WHERE (cn_prefixes && $1::text[])
       AND ($2::text IS NULL OR process_codes IS NULL OR process_codes = '{}' OR $2::text = ANY(process_codes))
     ORDER BY (CASE WHEN cn_prefixes && $3::text[] THEN 0
                    WHEN cn_prefixes && $4::text[] THEN 1
                    ELSE 2 END) ASC,
              ($2::text IS NOT NULL AND process_codes IS NOT NULL AND process_codes != '{}' AND $2::text = ANY(process_codes)) DESC NULLS LAST
     LIMIT 1`,
    [cnKeys, process_code || null, cnExact, cnFamily ? [cnFamily] : []]
  );
  if (grindingQ.rows[0]) {
    map['grinding_layout_image'] = `data:${grindingQ.rows[0].mime_type};base64,${grindingQ.rows[0].image_data.toString('base64')}`;
  }

  return map;
}

// ── Browser Detection ───────────────────────────────────────────────────────

function getBrowserPath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── Warm browser singleton ──────────────────────────────────────────────────
// Launch Chrome once and reuse it across requests (a page is opened/closed per
// render). Avoids the ~0.5–1s per-request launch cost; auto-relaunches if it dies.

let _browser = null;
let _browserLaunching = null;

// Chrome buffers the generated PDF to its temp dir (system %TEMP%, which on this
// Windows host lives on C:). When C: fills up, page.pdf() fails mid-stream with
// "Protocol error (IO.read): Read failed". Redirect Chrome's temp to a roomy data
// drive so a full C: no longer breaks PDF generation. Computed once; '' = use the
// OS default (non-Windows, or no data drive available).
let _chromeTmp = null;
function chromeTmpDir() {
  if (_chromeTmp !== null) return _chromeTmp;
  _chromeTmp = '';
  if (process.platform === 'win32') {
    for (const dir of ['D:\\eng-temp', 'E:\\eng-temp']) {
      try { fs.mkdirSync(dir, { recursive: true }); _chromeTmp = dir; break; } catch (_) {}
    }
  }
  return _chromeTmp;
}

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  if (_browserLaunching) return _browserLaunching;
  const executablePath = getBrowserPath();
  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
  if (executablePath) launchOptions.executablePath = executablePath;
  const tmp = chromeTmpDir();
  if (tmp) launchOptions.env = { ...process.env, TEMP: tmp, TMP: tmp };
  _browserLaunching = puppeteer.launch(launchOptions).then((b) => {
    _browser = b;
    _browserLaunching = null;
    b.on('disconnected', () => { _browser = null; });
    return b;
  }).catch((e) => { _browserLaunching = null; throw e; });
  return _browserLaunching;
}

// Render an HTML string to a PDF Buffer on a fresh page of the warm browser.
async function renderPdf(html, pdfOpts = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setCacheEnabled(false);
    // 'load' fires once inline/data-URI images decode; the template has no
    // external network resources, so 'networkidle2' just added a ~500ms wait.
    await page.setContent(html, { waitUntil: 'load' });
    const raw = await page.pdf({
      format: 'A4', landscape: true, printBackground: true,
      margin: { top: '2.54mm', bottom: '2.54mm', left: '2.54mm', right: '2.54mm' },
      ...pdfOpts,
    });
    return Buffer.from(raw);
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Blank Template Preview ──────────────────────────────────────────────────
// Renders the HTML template with CSS variables but NO real data.
// Used by Template Config UI to show the template structure (like opening sds_template.xlsx).

function buildBlankToolingHtml() {
  let html = '';
  for (let grp = 0; grp < 4; grp++) {
    let labelRow = '', imgRow = '', dwgRow = '', makerRow = '';
    for (let col = 0; col < 5; col++) {
      const idx = grp * 5 + col;
      const slotId = `T${String(idx + 1).padStart(2, '0')}`;
      const cls = col === 4 ? 'tool-slot tool-slot-wide' : 'tool-slot';
      labelRow  += `<div class="${cls}"><div class="tool-label-inner"><span class="tool-id">${slotId}</span><span class="tool-name-val"></span></div></div>`;
      imgRow    += `<div class="${cls}"><div class="tool-img-cell"></div></div>`;
      dwgRow    += `<div class="${cls}"><div class="tool-dwg-cell"><span class="tool-dwg-no"></span></div></div>`;
      makerRow  += `<div class="${cls}"><div class="tool-maker-cell"></div></div>`;
    }
    html += `<div class="tooling-group">
      <div class="tool-label-row">${labelRow}</div>
      <div class="tool-sep-row"></div>
      <div class="tool-img-row">${imgRow}</div>
      <div class="tool-dwg-row">${dwgRow}</div>
      <div class="tool-maker-row">${makerRow}</div>
    </div>`;
  }
  return html;
}

function buildBlankParamsHtml() {
  const SEP_ROWS = new Set([17, 27, 37, 47]);
  const rows = [];
  for (let r = 16; r <= 55; r++) {
    if (SEP_ROWS.has(r)) {
      rows.push('<tr class="sep-row"><td colspan="9"></td></tr>');
    } else {
      rows.push('<tr><td colspan="9"></td></tr>');
    }
  }
  return rows.join('');
}

/** GET /api/sds/v2-headless/pdf-chrome/blank
 *  Returns the HTML template with CSS variables injected but all data placeholders empty.
 *  Accepts ?cssOverrides=<JSON> for live preview in Template Config UI.
 */
router.get('/pdf-chrome/blank', async (req, res) => {
  const { cssOverrides } = req.query;
  try {
    let parsedCssOverrides = null;
    if (cssOverrides) { try { parsedCssOverrides = JSON.parse(cssOverrides); } catch (_) {} }
    const cssConfig = await loadCssConfig(parsedCssOverrides);

    let html = getTemplateHtml();

    // 1. Inject CSS variables
    html = html.replace('{{css_vars_block}}', buildCssVarsBlock(cssConfig));

    // 2. Inject structural sections BEFORE clearing remaining placeholders
    const ecnRows = Array(5).fill(
      '<tr><td></td><td></td><td></td><td></td><td></td></tr>'
    ).join('');
    html = html.replace('{{ecn_html}}',            ecnRows);
    html = html.replace('{{tooling_html}}',         buildBlankToolingHtml());
    html = html.replace('{{params_html}}',          buildBlankParamsHtml());
    html = html.replace('{{grinding_layout_html}}', '<div class="grinding-no-img">No Image</div>');
    html = html.replace('{{gw_params_html}}',       '');

    // 3. Clear all remaining scalar placeholders
    html = html.replace(/{{[^}]+}}/g, '');

    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Grid Template → PDF ─────────────────────────────────────────────────────
// Renders the Excel-like blank-template grid (cells + borders + fills designed
// in the Template Config "Grid Editor") to a printable PDF. Mirrors the grid
// the user draws in SdsBlankTemplateGrid.jsx.

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildGridPdfHtml(grid) {
  const rows = Math.max(1, parseInt(grid.rows, 10) || 56);
  const cols = Math.max(1, parseInt(grid.cols, 10) || 48);
  const borders = grid.borders || {};
  const fills   = grid.fills   || {};
  const cells   = grid.cells   || {};
  const merges  = Array.isArray(grid.merges) ? grid.merges : [];

  // Per-column widths / per-row heights (px in the editor) → scaled to the page.
  const fit = (arr, n, d) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) && Number(arr[i]) > 0 ? Number(arr[i]) : d));
  const colW = fit(grid.colW, cols, 30);
  const rowH = fit(grid.rowH, rows, 22);
  const sumW = colW.reduce((a, b) => a + b, 0) || 1;
  const PAGE_W_MM = 287;            // A4 landscape printable width (297 − 2×5mm margin)
  const scale = PAGE_W_MM / sumW;   // mm per editor-px (preserves aspect for rows + fonts)

  // Merge lookup: covered cells are skipped; base cell gets row/col span.
  const covered = new Set();
  const spanAt = {};
  for (const m of merges) {
    const r1 = +m.r1, c1 = +m.c1, r2 = +m.r2, c2 = +m.c2;
    if ([r1, c1, r2, c2].some(n => Number.isNaN(n))) continue;
    spanAt[`${r1},${c1}`] = { rs: r2 - r1 + 1, cs: c2 - c1 + 1, r2, c2 };
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { if (r === r1 && c === c1) continue; covered.add(`${r},${c}`); }
  }

  const edge = (e) => (e ? `${e.w}px ${e.s} ${e.c}` : 'none');
  // For a merged cell the visible perimeter borders live on the edge cells.
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

  const colgroup = colW.map(w => `<col style="width:${(w * scale).toFixed(3)}mm">`).join('');

  // Excel lets a long unwrapped value spill across its neighbours — but only while those
  // neighbours are EMPTY; the first occupied cell clips it. The renderer only had the
  // first half of that rule (`overflow:visible` on every non-wrap cell), so a long fixture
  // name ran straight over the next slot's T-badge and its name. Reported from the floor:
  // X-100 T01 `CONCENTRICITY MEASURING PIN(FOR SPH)` printed on top of `T02 ARBOR`.
  //
  // `hasInk` is what "occupied" means, and a merged cell counts through its base cell —
  // a covered cell carries no data of its own but is not free space.
  const baseOf = (r, c) => (covered.has(`${r},${c}`)
    ? (Object.keys(spanAt).find((k) => {
        const s = spanAt[k]; const [br, bc] = k.split(',').map(Number);
        return r >= br && r <= s.r2 && c >= bc && c <= s.c2;
      }) || `${r},${c}`)
    : `${r},${c}`);
  const hasInk = (r, c) => {
    if (c < 0 || c >= cols) return true;              // past the sheet edge — clip
    const d = cells[baseOf(r, c)];
    return !!(d && (d.img || (d.v != null && String(d.v).trim() !== '')));
  };
  // How far the text may run before the first occupied cell stops it, in mm — the cell's
  // own width plus every CONSECUTIVE empty neighbour in the direction its alignment sends
  // it. Bounding this is the whole fix: "the next cell is empty" is not a licence to run
  // the length of the row, which is what `overflow:visible` alone granted.
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
        // Always emit a size — cells with data but no xlsx font default to the
        // SDS base sz=10 (otherwise the browser default ~16px makes them huge).
        `font-size:${(((f && f.size) || 10) * 1.3333 * scale).toFixed(3)}mm`,
        f && f.bold ? 'font-weight:bold' : '',
        f && f.italic ? 'font-style:italic' : '',
        f && f.color ? `color:${f.color}` : '',
        `text-align:${(a && a.h) || 'left'}`,
        `vertical-align:${(a && a.v) || 'middle'}`,
        a && a.wrap ? 'white-space:normal' : 'white-space:nowrap',
        // Kept visible so a bounded spill can still show OUTSIDE the td (Excel behaviour);
        // the inline-block below is what stops it at the first occupied neighbour.
        a && a.wrap ? 'overflow:hidden' : 'overflow:visible',
      ].filter(Boolean).join(';');
      const sp = span ? `${span.cs > 1 ? ` colspan="${span.cs}"` : ''}${span.rs > 1 ? ` rowspan="${span.rs}"` : ''}` : '';
      // Image cells: a bare <img max-height:100%> inside a (row-spanned) td has no definite
      // height to resolve 100% against, so a tall/narrow image stretches the td and grows the
      // whole row. Wrap it in a div whose height is PINNED to the summed height of the spanned
      // rows (with overflow:hidden) so the row height stays fixed and the image just contains
      // itself inside that box.
      let content;
      if (cd && cd.img) {
        const rs = span ? span.rs : 1;
        let cellHmm = 0;
        for (let i = r; i < r + rs; i++) cellHmm += (rowH[i] || 0) * scale;
        content = `<div style="height:${cellHmm.toFixed(3)}mm;width:100%;overflow:hidden;`
          + `display:flex;align-items:center;justify-content:center;">`
          + `<img src="${cd.img}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;"></div>`;
      } else {
        content = escHtml(cd && cd.v);
        // Cap an unwrapped value at the room Excel would give it, and mark the cut with an
        // ellipsis. Without this a long fixture name printed straight over the next slot's
        // T-badge and name (reported: X-100 T01 `CONCENTRICITY MEASURING PIN(FOR SPH)` over
        // `T02 ARBOR`). The td stays overflow:visible so a name that DOES fit the empty
        // neighbours still spills into them exactly as before.
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
    table { width: ${PAGE_W_MM}mm; border-collapse: collapse; table-layout: fixed; }
    td { padding: 0 0.4mm; line-height: 1.05; }
  </style></head><body>
    <table><colgroup>${colgroup}</colgroup><tbody>${body}</tbody></table>
  </body></html>`;
}

// Excel column letters → 0-based index (A→0, I→8, AN→39 … AV→47)
function colLettersToIndex(s) {
  let n = 0;
  for (const ch of String(s).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function cellAddrToRC(addr) {
  const m = String(addr).match(/^([A-Z]+)(\d+)$/);
  return m ? { r: +m[2] - 1, c: colLettersToIndex(m[1]) } : null;
}

// Fixed image anchor ranges in the SDS layout (mirror of the LibreOffice path).
const IMAGE_EXTENTS = {
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
};

/** Inject per-CN data into the designed grid by cell address (pure function).
 *  - mappings: [{ cell_address, param_key }] from sds_excel_mapping (machine wins)
 *  - valueMap: scalar fields + .params (row_N_X / gw_row_N_X) from buildValueMap
 *  Designed cell formatting (font/border/merge) is preserved; only text is set. */
function applyDataToGrid(grid, valueMap, mappings) {
  const cells = { ...(grid.cells || {}) };
  const fills = { ...(grid.fills || {}) };
  const params = valueMap.params || {};
  const HDR_BG = '#e0e0e0';                 // param/GW header-row highlight (matches CSS config default)
  const isTrue = (v) => v === '1' || v === 1 || String(v).toLowerCase() === 'true';
  const findCell = (param_key) => (mappings.find((mp) => mp.param_key === param_key) || {}).cell_address;

  // ── {{dim.*}} token resolution ────────────────────────────────────────────
  // A parameter-grid cell holding a part dimension must follow the PART, not the machine.
  // Storing the number literally makes it a machine-wide constant that prints the same
  // value on every CN's sheet (a wrong-but-plausible number — the worst failure mode for
  // an operator-facing document). Instead the cell stores a token, e.g.
  //     row_39_H = "{{dim.OD}}"      → the part's outer diameter
  //     row_38_H = "{{dim.W|2}}"     → width, fixed to 2 decimals
  // Supported keys: dim.OD, dim.ID, dim.W, dim.SD (resolved per part class in
  // buildValueMap via partDimAlias). Optional `|N` = decimal places.
  //
  // An unresolvable token renders BLANK, never the literal token and never a stale
  // number: on paper a blank is obviously incomplete, whereas a leftover value reads as
  // real. The miss is logged so the config gap is visible server-side.
  const DIM_TOKEN = /\{\{\s*(dim\.(?:OD|ID|W|SD))\s*(?:\|\s*(\d+)\s*)?\}\}/gi;
  const hasDimToken = (v) => typeof v === 'string' && v.includes('{{');
  const resolveDimTokens = (raw, ctxKey) => String(raw).replace(DIM_TOKEN, (_m, key, dp) => {
    const canon = 'dim.' + key.slice(4).toUpperCase();
    const val = valueMap[canon];
    if (val == null || val === '') {
      console.warn(`[sds-pdf] ${canon} unresolved for cn=${valueMap['_cn_control'] || '?'} `
        + `part_type=${valueMap['part_type'] || '?'} cell=${ctxKey} — rendering blank`);
      return '';
    }
    if (dp == null) return String(val);
    const n = Number(val);
    return Number.isFinite(n) ? n.toFixed(Number(dp)) : String(val);
  });
  const setCell = (r, c, v, red) => {
    if (v == null || v === '' || r < 0 || c < 0) return;
    const k = `${r},${c}`;
    const ex = cells[k] || {};
    cells[k] = { ...ex, v: String(v), f: { ...(ex.f || {}), ...(red ? { color: '#ff0000' } : {}) }, a: ex.a || {} };
  };
  // Force a cell empty, keeping its designed formatting. Needed because setCell SKIPS
  // blanks: a grid template imported from the old sds_template.xlsx can carry a leftover
  // number in the cell, so simply not writing would leave that stale value on the sheet —
  // precisely the wrong-but-plausible reading that {{dim.*}} exists to eliminate.
  const clearCell = (r, c) => {
    if (r < 0 || c < 0) return;
    const k = `${r},${c}`;
    if (!cells[k]) return;              // nothing designed there — already blank
    cells[k] = { ...cells[k], v: '' };
  };

  // Images: place each tool/grinding image at its anchor cell, merging the range
  // so it fills the region (idempotent vs. any merge already on that top-left).
  const existingTl = new Set((grid.merges || []).map((m) => `${m.r1},${m.c1}`));
  const newMerges = [];
  const placeImage = (extentKey, dataUri) => {
    if (!dataUri) return;
    const ext = IMAGE_EXTENTS[extentKey];
    if (!ext) return;
    const tl = cellAddrToRC(ext.tl), br = cellAddrToRC(ext.br);
    if (!tl || !br) return;
    const k = `${tl.r},${tl.c}`;
    cells[k] = { ...(cells[k] || {}), img: dataUri };
    if (!existingTl.has(k)) { newMerges.push({ r1: tl.r, c1: tl.c, r2: br.r, c2: br.c }); existingTl.add(k); }
  };

  // Resolve a cell to the top-left ("master") of any merge that covers it. Only the
  // master cell of a merged region renders; a value written to a covered cell is hidden.
  const mergeMaster = (r, c) => {
    const mg = (grid.merges || []).find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2);
    return mg ? { r: mg.r1, c: mg.c1 } : { r, c };
  };

  // 1) Mapped scalar fields (skip image objects). Fields whose mapped cells fall inside
  //    the SAME merged region are routed to the merge master and concatenated in column
  //    order — so e.g. the single PROCESS cell (Z3:AF3) shows "<process_code> <process_name>"
  //    even though process_name maps to AC3, which is hidden under the Z3 merge.
  // Approval seals: place each signed role's seal image at the mapped cell's merge
  // master (the designed stamp box). Source = sds_approval sign records, prefetched
  // into valueMap._approvalSeals (see buildGridHtmlForRequest). Unsigned → blank.
  const approvalSeals = valueMap._approvalSeals || {};
  for (const { cell_address, param_key } of mappings) {
    const role = STAMP_PARAM_KEYS[param_key];
    if (!role) continue;
    const m = String(cell_address).match(/^([A-Z]+)(\d+)$/);
    if (!m) continue;
    const uri = approvalSeals[role]?.dataUri;
    if (!uri) continue;
    const r = +m[2] - 1, c = colLettersToIndex(m[1]);
    const master = mergeMaster(r, c);
    const k = `${master.r},${master.c}`;
    cells[k] = { ...(cells[k] || {}), img: uri };
  }

  const scalarBuckets = new Map(); // "masterR,masterC" -> [{ c, v }]
  const blankedMasters = new Set(); // masters whose only content was an unresolved token
  for (const { cell_address, param_key } of mappings) {
    if (STAMP_PARAM_KEYS[param_key]) continue; // handled as seal images above
    const m = String(cell_address).match(/^([A-Z]+)(\d+)$/);
    if (!m) continue;
    // An explicitly-configured param (machine default OR per-CN override, resolved
    // CN-wins in buildValueMap) takes precedence over the auto-derived factory scalar,
    // so a CN override of a field like `ct` (CYCLE TIME → B4) actually reaches the PDF.
    // Falls back to the factory scalar when no param is set for the key.
    let val = params[param_key];
    if (val == null || val === '') val = valueMap[param_key];
    if (val == null || val === '') continue;
    if (typeof val === 'object') continue; // images handled elsewhere
    // A mapped param may also carry a {{dim.*}} token — resolve before it reaches the cell.
    // An unresolved token blanks the designed cell rather than leaving a stale template value.
    if (hasDimToken(val)) {
      val = resolveDimTokens(val, cell_address);
      if (val === '') {
        const mm = String(cell_address).match(/^([A-Z]+)(\d+)$/);
        if (mm) {
          const master = mergeMaster(+mm[2] - 1, colLettersToIndex(mm[1]));
          blankedMasters.add(`${master.r},${master.c}`);
        }
        continue;
      }
    }
    const r = +m[2] - 1, c = colLettersToIndex(m[1]);
    const master = mergeMaster(r, c);
    const key = `${master.r},${master.c}`;
    if (!scalarBuckets.has(key)) scalarBuckets.set(key, []);
    scalarBuckets.get(key).push({ c, v: String(val) });
  }
  for (const [key, items] of scalarBuckets) {
    const [r, c] = key.split(',').map(Number);
    items.sort((a, b) => a.c - b.c);
    setCell(r, c, items.map((it) => it.v).join(' '));
  }
  // Clear only masters that no other mapped field wrote into (several params can share a
  // merged region — one unresolved token must not wipe a sibling's value).
  for (const key of blankedMasters) {
    if (scalarBuckets.has(key)) continue;
    const [r, c] = key.split(',').map(Number);
    clearCell(r, c);
  }

  // 2) Parameter table (A:I) + GW section (AN:AV) straight from row_N_COL keys.
  //    Values may embed {{dim.*}} tokens, which resolve to the PART's own dimensions —
  //    this is what keeps a per-part cell from printing a machine-wide constant.
  for (const [key, rawVal] of Object.entries(params)) {
    const hadToken = hasDimToken(rawVal);
    const val = hadToken ? resolveDimTokens(rawVal, key) : rawVal;
    // A token that resolved to nothing must BLANK the cell, not fall through to whatever
    // the template designed there.
    const write = (r, c) => {
      if (hadToken && val === '') clearCell(r, c);
      else setCell(r, c, val, params[`${key}_type`] === 'value');
    };
    let mm = key.match(/^row_(\d+)_([A-I])$/);
    if (mm) { write(+mm[1] - 1, colLettersToIndex(mm[2])); continue; }
    mm = key.match(/^gw_row_(\d+)_(A[N-V])$/);
    if (mm) { write(+mm[1] - 1, colLettersToIndex(mm[2])); continue; }
  }

  // 2b) Header rows (row_N_is_header / gw_row_N_is_header) → grey highlight + bold,
  //     merged across the section so it reads like the Excel header band.
  const addHeaderRow = (rowNum, c1, c2, txt) => {
    const r = rowNum - 1;
    const k = `${r},${c1}`;
    fills[k] = HDR_BG;
    const ex = cells[k] || {};
    cells[k] = {
      ...ex,
      v: txt != null && txt !== '' ? String(txt) : (ex.v || ''),
      f: { ...(ex.f || {}), bold: true, color: '#000000' },
      a: { ...(ex.a || {}), h: 'center', v: 'middle' },
    };
    if (!existingTl.has(k)) { newMerges.push({ r1: r, c1, r2: r, c2 }); existingTl.add(k); }
  };
  for (const [key, val] of Object.entries(params)) {
    let hm = key.match(/^row_(\d+)_is_header$/);
    if (hm && isTrue(val)) { addHeaderRow(+hm[1], 0, 8, params[`row_${hm[1]}_A`]); continue; }
    hm = key.match(/^gw_row_(\d+)_is_header$/);
    if (hm && isTrue(val)) { addHeaderRow(+hm[1], colLettersToIndex('AN'), colLettersToIndex('AV'), params[`gw_row_${hm[1]}_AN`]); }
  }

  // 3) Tooling drawing numbers + names — placed at the mapped cells
  //    (sds_excel_mapping keys: tool_dwg_no_T01 / tool_name_T01 …)
  (valueMap.tooling || []).forEach((t) => {
    if (!t) return;
    if (t.dwg) { const rc = cellAddrToRC(findCell(`tool_dwg_no_${t.slot}`)); if (rc) setCell(rc.r, rc.c, t.dwg, true); }
    if (t.name) { const rc = cellAddrToRC(findCell(`tool_name_${t.slot}`)); if (rc) setCell(rc.r, rc.c, t.name); }
  });

  // 4) Tooling + grinding images into their anchor regions
  (valueMap.tooling || []).forEach((t) => { if (t && t.image) placeImage(`tool_image_${t.slot}`, t.image); });
  placeImage('grinding_layout_image', valueMap.grinding_layout_image);

  return { ...grid, cells, fills, merges: [...(grid.merges || []), ...newMerges] };
}

/** GET /api/sds/v2-headless/pdf-chrome/grid
 *  Renders the saved grid layout to PDF.
 *  - Blank/design preview: no params, or ?gridOverride=<JSON> for live edits.
 *  - Production SDS: pass ?cn=&machine_type_name=&process_code= to inject real
 *    per-CN data into the designed grid (Approach B — grid drives the SDS PDF).
 *  ?debug=html returns the raw HTML instead of a PDF.
 */
// Resolve the grid layout for a render: the machine's assigned template
// (sds_machine_type_code.grid_template_id) → the default template → the legacy single
// grid-layout config → null. Robust against a DB where the multi-template migration
// hasn't run yet (falls back to the legacy config on any query error).
async function loadGridForMachine(machine_type_name) {
  const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (_) { return null; } };
  try {
    if (machine_type_name) {
      const m = await engPool.query(
        `SELECT gt.grid_json
           FROM ${TABLES.SDS_MACHINE_TYPE_CODE} mc
           JOIN ${TABLES.SDS_GRID_TEMPLATE} gt ON gt.id = mc.grid_template_id
          WHERE mc.machine_type_name = $1 AND mc.is_active AND mc.grid_template_id IS NOT NULL
          ORDER BY mc.machine_type_code LIMIT 1`,
        [machine_type_name.trim()]
      );
      if (m.rows[0]?.grid_json) return parse(m.rows[0].grid_json);
    }
    const def = await engPool.query(
      `SELECT grid_json FROM ${TABLES.SDS_GRID_TEMPLATE} WHERE is_default LIMIT 1`
    );
    if (def.rows[0]?.grid_json) return parse(def.rows[0].grid_json);
  } catch (_) { /* multi-template not provisioned — fall back to legacy config below */ }
  const legacy = await engPool.query(
    `SELECT config_value FROM sds_template_css_config WHERE config_key = 'grid-layout' LIMIT 1`
  );
  return parse(legacy.rows[0]?.config_value);
}

// Core of the grid SDS PDF: builds the print-ready HTML for a given CN/machine/process
// (or the blank/override design preview). Shared by the authenticated route below and
// the public cross-system link endpoint (sdsPublicController) so both render identically.
// `_meta`, when passed, is an out-param the caller owns: the rendered T01–Tn fixture
// list is copied into it so the print log can snapshot what the sheet actually said
// without re-rendering it against a later configuration. Each request passes its own
// object, so this stays safe under concurrency; callers that don't pass one are
// unaffected.
async function buildGridHtmlForRequest({ gridOverride, cn, machine_type_name, process_code, display_name, template_id, _meta }) {
  let grid = null;
  if (gridOverride) { try { grid = JSON.parse(gridOverride); } catch (_) {} }
  // Editor preview of one specific template (no machine context) — load it by id.
  if (!grid && template_id && !(cn && machine_type_name)) {
    try {
      const t = await engPool.query(
        `SELECT grid_json FROM ${TABLES.SDS_GRID_TEMPLATE} WHERE id = $1`, [template_id]
      );
      if (t.rows[0]?.grid_json) { try { grid = JSON.parse(t.rows[0].grid_json); } catch (_) {} }
    } catch (_) { /* fall through to machine/default resolution */ }
  }
  if (!grid) grid = await loadGridForMachine(machine_type_name);
  if (!grid || typeof grid !== 'object') grid = { rows: 56, cols: 20, borders: {}, fills: {} };

  // Production mode: fill the designed grid with real CN data via cell addresses
  if (cn && machine_type_name) {
    const searchData = await getSearchData(cn.trim());
    const valueMap = await buildValueMap(searchData, machine_type_name.trim(), process_code?.trim() || null, engPool, display_name?.trim() || null);
    const mq = await engPool.query(
      `SELECT cell_address, param_key FROM ${TABLES.SDS_EXCEL_MAPPING}
       WHERE machine_type_name = $1 OR machine_type_name IS NULL
       ORDER BY (machine_type_name IS NULL) DESC`,
      [machine_type_name.trim()]
    );
    const merged = {};
    for (const row of mq.rows) merged[row.cell_address] = row.param_key; // machine-specific (later) wins
    const mappings = Object.entries(merged).map(([cell_address, param_key]) => ({ cell_address, param_key }));
    // Approval seals (Prepared/Checked/Approved) — keyed per CN by
    // (cn, machine, process, sds_rev). sds_rev is the Setup Data Sheet revision
    // (valueMap.sds_rev, from sds_parameter) so a new SDS rev starts unsigned and
    // old seals don't carry over. resolveSdsRev in sdsApprovalController uses the
    // identical source, so the sign endpoints and this renderer always agree.
    valueMap._approvalSeals = await getApprovalSeals(valueMap._cn_control || valueMap.cn, machine_type_name.trim(), process_code?.trim() || null, valueMap.sds_rev);
    grid = applyDataToGrid(grid, valueMap, mappings);
    if (_meta) _meta.tooling = valueMap.tooling || null;
  }

  return buildGridPdfHtml(grid);
}

router.get('/pdf-chrome/grid', async (req, res) => {
  const { gridOverride, debug, cn, machine_type_name, process_code, display_name, template_id, lot } = req.query;
  try {
    const _meta = {};
    const html = await buildGridHtmlForRequest({ gridOverride, cn, machine_type_name, process_code, display_name, template_id, _meta });
    if (debug === 'html') return res.send(html);

    const pdfBuffer = await renderPdf(html, { margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' } });

    // Stream the buffer directly — no temp-file disk round-trip.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pdfBuffer);

    // Evidentiary record, AFTER the response — a print must never wait on, or fail
    // because of, its own audit row. `record()` swallows its own errors. Skipped for
    // the blank/preview renders, which have no CN to be evidence of.
    //
    // `lot` is accepted but NOTHING SENDS IT TODAY: the in-app button has no lot picker,
    // by decision (2026-08-25) — the lot is knowledge the production-planning side has and
    // an operator at the SDS screen does not, so asking here would only invite a typo.
    // These rows therefore carry lot_no = NULL / lot_verified = NULL, which is the correct
    // record of "no lot was stated", not a gap. Only the public deep link supplies one.
    if (cn && machine_type_name) {
      sdsPrintLog.record({
        cn, machineTypeName: machine_type_name, processCode: process_code, lot,
        source: 'app', requestedBy: req.user?.empno, pdfBuffer, tooling: _meta.tooling, req,
      });
    }
  } catch (err) {
    res.status(500).json({ error: `Grid PDF render failed: ${err.message}` });
  }
});

// ── Rendering Endpoint ──────────────────────────────────────────────────────

router.get('/pdf-chrome', async (req, res) => {
  const { cn, machine_type_name, process_code, debug, cssOverrides, display_name } = req.query;
  console.log(`[SDS PDF Chrome] Request: cn=${cn}, machine=${machine_type_name}, process=${process_code}, debug=${debug}`);
  
  if (!cn?.trim() || !machine_type_name?.trim()) return res.status(400).json({ error: 'cn and machine_type_name are required' });

  try {
    console.log('[SDS PDF Chrome] Fetching search data...');
    const searchData = await getSearchData(cn.trim());
    
    console.log('[SDS PDF Chrome] Building value map...');
    const valueMap = await buildValueMap(searchData, machine_type_name.trim(), process_code?.trim() || null, engPool, display_name?.trim() || null);

    // Parse live CSS overrides from query (for template config preview)
    let parsedCssOverrides = null;
    if (cssOverrides) {
      try { parsedCssOverrides = JSON.parse(cssOverrides); } catch (_) {}
    }
    const cssConfig = await loadCssConfig(parsedCssOverrides);
    const cssVarsBlock = buildCssVarsBlock(cssConfig);

    console.log('[SDS PDF Chrome] Loading HTML template...');
    let html = getTemplateHtml();
    html = html.replace('{{css_vars_block}}', cssVarsBlock);

    // ── Scalar fields ──────────────────────────────────────────────────────────
    const esc = v => String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html = html.replace(/{{cn}}/g,                   esc(valueMap.cn));
    html = html.replace(/{{parts_no}}/g,             esc(valueMap.parts_no));
    html = html.replace(/{{dwg_rev}}/g,              esc(valueMap.dwg_rev));
    html = html.replace(/{{material}}/g,             esc(valueMap.material));
    html = html.replace(/{{process_code}}/g,         esc(valueMap.process_code));
    html = html.replace(/{{process_name}}/g,         esc(valueMap.process_name));
    html = html.replace(/{{customer}}/g,             esc(valueMap.customer));
    html = html.replace(/{{model}}/g,                esc(valueMap.model));
    html = html.replace(/{{category}}/g,             esc(valueMap.category));
    html = html.replace(/{{machine_type_name}}/g,    esc(valueMap.machine_type_name));
    html = html.replace(/{{current_date}}/g,         esc(valueMap.current_date));
    html = html.replace(/{{sds_rev}}/g,              esc(valueMap.sds_rev));
    html = html.replace(/{{grinding_area_label}}/g,  esc(valueMap.grinding_area_label));
    html = html.replace(/{{ct}}/g,                   esc((valueMap.params && valueMap.params.ct) || valueMap.ct));

    const p = valueMap.params || {};
    // Approval stamps from the sds_approval sign records (keyed per CN by cn+machine+process+sds_rev).
    const seals = await getApprovalSeals(valueMap._cn_control || valueMap.cn, machine_type_name.trim(), process_code?.trim() || null, valueMap.sds_rev);
    html = html.replace(/{{stamp_prepared}}/g,  seals.prepared?.svg || '');
    html = html.replace(/{{stamp_checked}}/g,   seals.checked?.svg || '');
    html = html.replace(/{{stamp_approved}}/g,  seals.approved?.svg || '');
    html = html.replace(/{{program_no}}/g,      esc(p['program_no'] || ''));
    html = html.replace(/{{program_name}}/g,    esc(p['program_name'] || ''));

    // ── ECN Revision History ───────────────────────────────────────────────────
    let ecnHtml = '';
    for (let i = 1; i <= 5; i++) {
      ecnHtml += `<tr>
        <td>${esc(p[`rev_${i}`])}</td>
        <td>${esc(p[`ecn_no_${i}`])}</td>
        <td>${esc(p[`date_${i}`])}</td>
        <td>${esc(p[`description_${i}`])}</td>
        <td>${esc(p[`remark_${i}`])}</td>
      </tr>`;
    }
    html = html.replace(/{{ecn_html}}/g, ecnHtml);

    // ── Tooling Grid: 4 groups × 5 slots (matches Excel row structure) ─────────
    // Each group: label-row (3.65mm) + sep-row (0.84mm) + img-row (21.9mm)
    //             + dwg-row (3.65mm) + maker-row (3.65mm) = 33.69mm
    const allTools = valueMap.tooling || [];
    let toolingHtml = '';
    for (let grp = 0; grp < 4; grp++) {
      const slotClass = (col) => col === 4 ? 'tool-slot tool-slot-wide' : 'tool-slot';

      // — Label row (T01 label + tool name) —
      let labelRow = '';
      for (let col = 0; col < 5; col++) {
        const idx   = grp * 5 + col;
        const t     = allTools[idx];
        const slotId = `T${String(idx + 1).padStart(2, '0')}`;
        labelRow += `<div class="${slotClass(col)}">
          <div class="tool-label-inner">
            <span class="tool-id">${slotId}</span>
            <span class="tool-name-val">${esc(t?.name || '')}</span>
          </div></div>`;
      }

      // — Image row —
      let imgRow = '';
      for (let col = 0; col < 5; col++) {
        const t = allTools[grp * 5 + col];
        imgRow += `<div class="${slotClass(col)}">
          <div class="tool-img-cell">${t?.image ? `<img src="${t.image}" alt="">` : ''}</div>
        </div>`;
      }

      // — Tooling No row —
      let dwgRow = '';
      for (let col = 0; col < 5; col++) {
        const t = allTools[grp * 5 + col];
        dwgRow += `<div class="${slotClass(col)}">
          <div class="tool-dwg-cell"><span class="tool-dwg-no">${esc(t?.dwg || '')}</span></div>
        </div>`;
      }

      // — Maker row —
      let makerRow = '';
      for (let col = 0; col < 5; col++) {
        const idx    = grp * 5 + col;
        const slotId = `T${String(idx + 1).padStart(2, '0')}`;
        const maker  = esc(p[`maker_${slotId}`] || '');
        makerRow += `<div class="${slotClass(col)}">
          <div class="tool-maker-cell">${maker}</div>
        </div>`;
      }

      toolingHtml += `
        <div class="tooling-group">
          <div class="tool-label-row">${labelRow}</div>
          <div class="tool-sep-row"></div>
          <div class="tool-img-row">${imgRow}</div>
          <div class="tool-dwg-row">${dwgRow}</div>
          <div class="tool-maker-row">${makerRow}</div>
        </div>`;
    }
    html = html.replace(/{{tooling_html}}/g, toolingHtml);

    // ── Param Table (cols A-I, rows 16-55) ────────────────────────────────────
    // Rows 17/27/37/47 are thin separator rows (4.5pt) matching tooling group separators.
    const PARAM_COLS   = ['A','B','C','D','E','F','G','H','I'];
    const SEP_ROWS     = new Set([17, 27, 37, 47]);
    let paramsRows = [];
    for (let r = 16; r <= 55; r++) {
      if (SEP_ROWS.has(r)) {
        paramsRows.push('<tr class="sep-row"><td colspan="9"></td></tr>');
        continue;
      }
      const isHdr   = p[`row_${r}_is_header`] === '1' || p[`row_${r}_is_header`] === 'true';
      const hasData = PARAM_COLS.some(c => p[`row_${r}_${c}`]);
      if (!hasData && !isHdr) continue;
      if (isHdr) {
        paramsRows.push(`<tr class="hdr-row"><td colspan="9">${esc(p[`row_${r}_A`])}</td></tr>`);
      } else {
        let rowHtml = '<tr>';
        PARAM_COLS.forEach(c => {
          const val   = esc(p[`row_${r}_${c}`] || '');
          const isRed = p[`row_${r}_${c}_type`] === 'value';
          rowHtml += `<td class="${isRed ? 'val-red' : ''}">${val}</td>`;
        });
        rowHtml += '</tr>';
        paramsRows.push(rowHtml);
      }
    }
    html = html.replace(/{{params_html}}/g, paramsRows.join(''));

    // ── Grinding Layout Image ──────────────────────────────────────────────────
    const grindingLayoutHtml = valueMap.grinding_layout_image
      ? `<img src="${valueMap.grinding_layout_image}" alt="Grinding Layout">`
      : '<div class="grinding-no-img">No Layout Image</div>';
    html = html.replace(/{{grinding_layout_html}}/g, grindingLayoutHtml);

    // ── GW Section (AN:AV, rows 50-55) ────────────────────────────────────────
    const GW_COLS = ['AN','AO','AP','AQ','AR','AS','AT','AU','AV'];
    let gwRowsHtml = '';
    let hasGw = false;
    for (let r = 50; r <= 55; r++) {
      const isHdr   = p[`gw_row_${r}_is_header`] === '1' || p[`gw_row_${r}_is_header`] === 'true';
      const hasData = GW_COLS.some(c => p[`gw_row_${r}_${c}`]);
      if (!hasData && !isHdr) continue;
      hasGw = true;
      if (isHdr) {
        gwRowsHtml += `<tr class="hdr-row"><td colspan="${GW_COLS.length}">${esc(p[`gw_row_${r}_AN`])}</td></tr>`;
      } else {
        let rowH = '<tr>';
        GW_COLS.forEach(c => {
          const v     = esc(p[`gw_row_${r}_${c}`] || '');
          const isRed = p[`gw_row_${r}_${c}_type`] === 'value';
          rowH += `<td class="${isRed ? 'val-red' : ''}">${v}</td>`;
        });
        rowH += '</tr>';
        gwRowsHtml += rowH;
      }
    }
    const gwParamsHtml = hasGw
      ? `<div class="gw-label">GW SETTING</div><table class="gw-table"><tbody>${gwRowsHtml}</tbody></table>`
      : '';
    html = html.replace(/{{gw_params_html}}/g, gwParamsHtml);

    if (debug === 'html') {
      console.log('[SDS PDF Chrome] Debug mode: Sending HTML');
      return res.send(html);
    }

    console.log('[SDS PDF Chrome] Rendering PDF (warm browser)...');
    const pdfBuffer = await renderPdf(html); // default 2.54mm margins = Excel page setup

    // Validate PDF Header (%PDF-)
    const header = pdfBuffer.slice(0, 5).toString('utf8');
    if (header !== '%PDF-') {
      console.error('[SDS PDF Chrome] Invalid Header:', header);
      throw new Error('Generated buffer is not a valid PDF (Missing %PDF- header)');
    }

    console.log(`[SDS PDF Chrome] Success! Buffer size: ${pdfBuffer.length} bytes`);

    // Stream the buffer directly — no temp-file disk round-trip.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(pdfBuffer);

  } catch (err) {
    console.error('[SDS PDF Chrome] FATAL ERROR:', err);
    res.status(500).json({ error: `Chrome rendering failed: ${err.message}` });
  }
});

// Expose CSS cache flush for admin controller (called after template-config save)
router.flushCssCache = () => { _cssCache = null; _cssCacheAt = 0; };

module.exports = router;
// Reused by sdsPublicController (the cross-system public PDF link endpoint).
module.exports.buildGridHtmlForRequest = buildGridHtmlForRequest;
module.exports.renderPdf = renderPdf;
// Exported for unit testing the fixture-NAME slot-matching tier (the riskiest, highest
// blast-radius logic in this controller). See tests/mtc/sdsFixtureSlot.test.js.
module.exports.canonFixtureName = canonFixtureName;
module.exports.makeFixtureTracker = makeFixtureTracker;
module.exports.pickFamilyName = pickFamilyName;
module.exports.dropUnchosenAlternatives = dropUnchosenAlternatives;
module.exports.alternativeFamilies = alternativeFamilies;
module.exports.buildSlotByFixture = buildSlotByFixture;
module.exports.makeConfigSlotResolver = makeConfigSlotResolver;
// Exported to test {{dim.*}} token resolution — a token that silently fails would put a
// blank (or worse, a stale) dimension on an operator's setup sheet.
// See tests/mtc/sdsDimTokens.test.js.
module.exports.applyDataToGrid = applyDataToGrid;
// Exported to test the Excel spill rule: an unwrapped value may run over EMPTY neighbours
// but must stop at the first occupied one. Unbounded, a long fixture name printed over the
// next slot's T-badge. See tests/mtc/sdsGridOverflow.test.js.
module.exports.buildGridPdfHtml = buildGridPdfHtml;
