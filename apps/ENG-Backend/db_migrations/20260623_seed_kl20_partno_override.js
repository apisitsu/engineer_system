'use strict';
/**
 * KL-20 (TRIM) collet selection — PART-NUMBER OVERRIDE + spec.pn backfill.
 *
 * Problem (audited 2026-06-23 for CN 414314 → factory 4030-01-1002, "not found" in T-Select):
 *   The 4030-01 (OD-chuck) collet grips the part's **trim OD** (the turning/blank diameter,
 *   ~27-29 mm), NOT the finished OD (23 mm) that lives in tooling_spec_process. The trim OD is
 *   absent from our spec, so the dimensional formula can't compute it; for spherical classes
 *   (cnPrefix 41-49) the formula deliberately returns the -999 sentinel (honest no-match). But
 *   class 41/42 (A41/A42 spherical) are in fact the BIGGEST users of 4030-01 (≈590 of 715 parts),
 *   so they all came back empty.
 *
 *   The KL-20 TOOLING LIST workbook selects each collet by **part number** (the 4030-01_COLLET /
 *   4030-02_COLLET sheets list the P/Ns per collet), and the factory process plan confirms the
 *   mapping is **100% deterministic per parts_no** (715 parts_no → 1 collet each, 0 conflicts).
 *   So this is a part-number lookup, exactly like the KS-H70 grinding tooling.
 *
 * Fix (two parts, mirrors the KS-H70 pattern):
 *   1. Backfill `tooling_spec_process.pn` from `lpb.eng_item.parts_no` (control_no→CN) — EVERY
 *      KL-20 spec row currently has pn = NULL, so the parts_no override key is unusable until
 *      filled. Fill-only (never overwrites an existing pn).
 *   2. Seed `tooling_partno_map` for KL-20 `4030-01_COLLET` / `4030-02_COLLET` from the factory
 *      process plan (lpb.eng_r_pi_tool proc 2561/2562), mode per parts_no. The generic override
 *      `searchService._applyPartnoOverrides` then pins the factory collet (incl. the spherical
 *      parts the formula leaves at -999).
 *
 * The dimensional formula is intentionally left as-is: it remains the fallback for parts with no
 * history, and -999 for unknown spherical is still the honest answer (no trim OD to match).
 *
 * Idempotent. Run: node db_migrations/20260623_seed_kl20_partno_override.js
 */

const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');

const MACHINE_NAME = 'KL-20';
const PARTNO_MAP = TABLES.TOOLING_PARTNO_MAP;
const SOURCE = 'eng_r_pi_tool_2561_2562 (factory-actual)';
const PROC = ['2561', '2562'];
// factory DWG family → KL-20 inventory tooling_name
const FAMILY = [
  { f: '4030-01', tool: '4030-01_COLLET' },
  { f: '4030-02', tool: '4030-02_COLLET' },
];

const planToCn = (p) => { p = String(p).trim(); const m = p.match(/^[A-Z](\d{2})-(.+)$/); if (!m) return null; return m[1] + m[2].replace(/^0/, ''); };

async function run() {
  // ── factory process plan: CN→parts_no  and  (family, parts_no)→mode collet ──
  const { rows } = await maqPool.query(
    `SELECT t.process_plan_no AS plan, t.tool_dwg_no, i.parts_no
       FROM lpb.eng_r_pi_tool t
       JOIN lpb.eng_item i ON i.control_no = t.process_plan_no
      WHERE t.process_code = ANY($1) AND i.parts_no IS NOT NULL AND t.tool_dwg_no LIKE '4030-%'`,
    [PROC]);

  const cnToPn = {};
  const tally = {}; for (const { f } of FAMILY) tally[f] = {};
  for (const r of rows) {
    const cn = planToCn(r.plan); const pn = String(r.parts_no).trim(); const dwg = r.tool_dwg_no.trim();
    if (cn) cnToPn[cn] = pn;
    const fam = FAMILY.find(x => dwg.startsWith(x.f + '-'));
    if (fam) (((tally[fam.f][pn] ??= {})[dwg] ??= 0), tally[fam.f][pn][dwg]++);
  }
  const mapRows = [];
  for (const { f, tool } of FAMILY) {
    for (const [pn, counts] of Object.entries(tally[f])) {
      const dwg = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]; // mode
      mapRows.push([MACHINE_NAME, tool, pn, dwg]);
    }
  }
  console.log(`factory rows ${rows.length}; CN→pn ${Object.keys(cnToPn).length}; partno_map ${mapRows.length} ` +
    `(4030-01 ${mapRows.filter(r => r[1] === '4030-01_COLLET').length}, 4030-02 ${mapRows.filter(r => r[1] === '4030-02_COLLET').length})`);

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // ── 1) backfill spec.pn (fill-only) ──
    const kl20Cns = Object.keys(cnToPn);
    const nullRows = await client.query(
      `SELECT cn FROM tooling_spec_process WHERE cn = ANY($1) AND (pn IS NULL OR pn = '')`, [kl20Cns]);
    let pnN = 0;
    for (const { cn } of nullRows.rows) {
      const pn = cnToPn[String(cn).trim()];
      if (!pn) continue;
      const r = await client.query(
        `UPDATE tooling_spec_process SET pn = $2 WHERE cn = $1 AND (pn IS NULL OR pn = '')`, [cn, pn]);
      pnN += r.rowCount;
    }

    // ── 2) seed partno_map (factory-actual; replace this machine's prior rows for these toolings) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${PARTNO_MAP} (
        id SERIAL PRIMARY KEY, machine_name TEXT NOT NULL, tooling_name TEXT NOT NULL,
        parts_no TEXT NOT NULL, tool_dwg_no TEXT NOT NULL,
        is_forbidden BOOLEAN NOT NULL DEFAULT false, note TEXT, source TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (machine_name, tooling_name, parts_no, tool_dwg_no))`);
    await client.query(
      `DELETE FROM ${PARTNO_MAP} WHERE machine_name = $1 AND tooling_name = ANY($2::text[])`,
      [MACHINE_NAME, FAMILY.map(x => x.tool)]);
    let mapN = 0;
    for (const [mn, tn, pn, dwg] of mapRows) {
      const r = await client.query(
        `INSERT INTO ${PARTNO_MAP} (machine_name, tooling_name, parts_no, tool_dwg_no, source)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (machine_name, tooling_name, parts_no, tool_dwg_no) DO NOTHING`,
        [mn, tn, pn, dwg, SOURCE]);
      mapN += r.rowCount;
    }

    await client.query('COMMIT');
    console.log(`✅ KL-20 partno override seeded: backfilled pn for ${pnN} spec rows, ${mapN} partno_map rows`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ seed failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { run };
