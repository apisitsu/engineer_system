/**
 * Migration: convert per-part dimension cells in sds_parameter from literal numbers
 * to {{dim.*}} tokens.
 *
 * ── Why ────────────────────────────────────────────────────────────────────────
 * A grid cell holding a part dimension (WORK OUT DIA, WORK WIDTH, WORK BORE ...) was
 * stored as a literal number on the MACHINE-DEFAULT row (cn IS NULL). A machine default
 * applies to every part that machine grinds, so one part's dimensions were printing on
 * every other part's setup sheet. A survey of live data (2026-07-19) found 732 cells
 * flagged `_type='value'` (per-part, rendered red) but only 76 carrying any per-CN value —
 * ~90% were printing another part's numbers, and the defaults are real-looking values
 * (12.700, 19.050, 22.220), not obvious placeholders.
 *
 * `{{dim.OD}}` / `{{dim.ID}}` / `{{dim.W}}` / `{{dim.SD}}` resolve per CN at render time
 * from the part's own factory row (see utils/partDimAlias.js + applyDataToGrid). `|3`
 * pins 3 decimals, matching the existing sheet convention (35 → "35.000").
 *
 * ── Scope: only cells whose meaning is confirmed ───────────────────────────────
 * Deliberately NOT converted (documented so the next run doesn't "finish the job"):
 *   · KN-312A  row_41_H "SHAFT DIA"      — arbor dimension from T-Select, NOT a part dim
 *                                          (verified: differs from in_dia by +2.3…+10.0mm)
 *   · KS-B80   row_24_H "#20 WORK SIZE"  — ambiguous (OD or W?); machine has 0 CN
 *   · KS-B22RD row_23_H "#21 WORK SIZE"    overrides, so there is no ground truth to
 *                                          confirm against. Needs an SME call.
 *   · OC-16A / OC-18BR-150 / OC-20BR-200 "(A) OUTER DIAMETER OF WORKPIECE" — stores a
 *                                          RANGE ("Ø50 - 54"), not a scalar. User: keep.
 *   · KS-500RD row_47_H "CYLINDRICAL DIAMETER" — default is "-" (already blank/N-A).
 *
 * ── Existing per-CN overrides ──────────────────────────────────────────────────
 * A CN override outranks the machine default, so leaving one in place would keep that CN
 * on its hand-typed value and defeat the token. They are deleted ONLY where the factory
 * value actually resolves. Where the factory row is missing (e.g. C39-04043 has no
 * lpb.eng_ball row) the hand-typed value is the only source there is, so it is KEPT —
 * deleting it would turn a correct number into a blank.
 *
 * Idempotent: re-running is a no-op (cells already holding a token are skipped).
 * Dry run:  node api/engineer/mtc/db_migrations/20260719_sds_param_dim_tokens.js --dry
 * Apply:    node api/engineer/mtc/db_migrations/20260719_sds_param_dim_tokens.js
 */
const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { searchByCn } = require('../services/sdsV2SearchService');
const { pool: rodpcPool } = require('../../../../instance/instance');
const { resolvePartDims, SPHERICAL_DESIGN } = require('../utils/partDimAlias');

// machine_type_name → param_key → token. Label kept for the audit log only.
const CONVERSIONS = [
  { machine: 'KN-312A',  key: 'row_38_H', token: '{{dim.W|3}}',  label: 'WORK WIDTH' },
  { machine: 'KN-312A',  key: 'row_39_H', token: '{{dim.OD|3}}', label: 'WORK OUT DIA' },
  { machine: 'KS-500RD', key: 'row_45_H', token: '{{dim.W|3}}',  label: 'WORK WIDTH' },
  // KS-500RD "SPHERICAL DIAMETER" → dim.OD, NOT the formula-engine SD. Two different
  // quantities share the abbreviation "SD"; picking the wrong one is a 9mm error:
  //   · MTC formula-engine SD = derived sqrt(OD² − W²)  → 36.727 for C32-00139
  //   · sheet "SPHERICAL DIAMETER" = the ball's own sphere dia, stored in ball_dia
  // Ground truth: C32-00139's hand-typed 46.038 equals ball_dia (= dim.OD) exactly.
  // Confirmed by the user 2026-07-19 before enabling.
  { machine: 'KS-500RD', key: 'row_46_H', token: '{{dim.OD|3}}', label: 'SPHERICAL DIAMETER' },
  { machine: 'KS-H70',   key: 'row_56_H', token: '{{dim.ID|3}}', label: 'WORK BORE' },
  { machine: 'KS-H70',   key: 'row_57_H', token: '{{dim.W|3}}',  label: 'WORK WIDTH' },
  // KS-B80 "#20 WORK SIZE" = the dimension being ground. The jaw clamps the workpiece OD
  // (see project_ksb22g_ksb80_formula), so the machine grinds the BORE → ID. The machine
  // has no CN overrides, so this was inferred rather than measured; the part population
  // backs it up: across 282 parts tooled on KS-B80 (factory proc 1061, 4021- tools) the
  // frozen default 19.050 matches 50 parts' in_dia and ZERO parts' ball_dia — and 19.050
  // sits mid-range for ID (p25 18 / median 20) but below the entire OD range (p25 30.9).
  { machine: 'KS-B80',   key: 'row_24_H', token: '{{dim.ID|3}}', label: '#20 WORK SIZE' },
];

const TOKEN_DIM = { '{{dim.W|3}}': 'W', '{{dim.OD|3}}': 'OD', '{{dim.ID|3}}': 'ID', '{{dim.SD|3}}': 'SD' };

/** Does the token resolve for this CN? Mirrors buildValueMap's spherical enrichment. */
async function resolvesFor(cn, dimKey) {
  try {
    const sd = await searchByCn(cn, maqPool, rodpcPool);
    let dim = sd.dimension;
    if (!dim) return null;
    if (String(sd.part_type).toUpperCase() === 'SPHERICAL' && dim[SPHERICAL_DESIGN.joinFrom]) {
      const dr = await maqPool.query(
        `SELECT * FROM ${SPHERICAL_DESIGN.table} WHERE ${SPHERICAL_DESIGN.joinTo} = $1 LIMIT 1`,
        [dim[SPHERICAL_DESIGN.joinFrom]]
      );
      if (dr.rows[0]) dim = { ...dim, ...dr.rows[0] };
    }
    const v = resolvePartDims(sd.part_type, dim)[dimKey];
    return v != null ? Number(v).toFixed(3) : null;
  } catch (_) {
    return null;   // treat a lookup failure as "does not resolve" → keep the override
  }
}

async function migrate({ dry }) {
  const client = await engPool.connect();
  const audit = { defaults: [], deleted: [], kept: [], skipped: [] };
  try {
    await client.query('BEGIN');

    for (const { machine, key, token, label } of CONVERSIONS) {
      // 1) Machine default → token.
      const cur = await client.query(
        `SELECT param_value FROM sds_parameter
         WHERE machine_type_name = $1 AND cn IS NULL AND param_key = $2`, [machine, key]);
      if (!cur.rows.length) { audit.skipped.push(`${machine} ${key} — no machine-default row`); continue; }
      const old = cur.rows[0].param_value;
      if (String(old).includes('{{')) { audit.skipped.push(`${machine} ${key} — already a token`); continue; }

      await client.query(
        `UPDATE sds_parameter SET param_value = $3
         WHERE machine_type_name = $1 AND cn IS NULL AND param_key = $2`, [machine, key, token]);
      audit.defaults.push(`${machine.padEnd(9)} ${key.padEnd(9)} ${String(old).padEnd(9)} -> ${token}   (${label})`);

      // 2) Per-CN overrides on the same key: drop the ones the token can serve.
      const ovs = await client.query(
        `SELECT cn, param_value FROM sds_parameter
         WHERE machine_type_name = $1 AND param_key = $2 AND cn IS NOT NULL ORDER BY cn`,
        [machine, key]);
      for (const o of ovs.rows) {
        const resolved = await resolvesFor(o.cn, TOKEN_DIM[token]);
        if (resolved == null) {
          audit.kept.push(`${machine} ${key} cn=${o.cn} typed=${o.param_value} — factory dim unavailable, override KEPT`);
          continue;
        }
        const same = Number(resolved) === Number(o.param_value);
        await client.query(
          `DELETE FROM sds_parameter WHERE machine_type_name = $1 AND param_key = $2 AND cn = $3`,
          [machine, key, o.cn]);
        audit.deleted.push(
          `${machine} ${key} cn=${o.cn} typed=${String(o.param_value).padEnd(8)} token->${resolved}`
          + (same ? '  (identical)' : '  *** VALUE CHANGES ***'));
      }
    }

    const w = (t, arr) => {
      console.log(`\n── ${t} (${arr.length})`);
      arr.forEach(l => console.log('   ' + l));
    };
    w('machine defaults converted', audit.defaults);
    w('per-CN overrides deleted (token now serves them)', audit.deleted);
    w('per-CN overrides KEPT (token would render blank)', audit.kept);
    w('skipped', audit.skipped);

    if (dry) {
      await client.query('ROLLBACK');
      console.log('\n[DRY RUN] rolled back — no changes written.');
    } else {
      await client.query('COMMIT');
      console.log('\n[APPLIED] committed.');
      console.log('NOTE: flush the SDS cache (or wait out the 10-min TTL) before checking a PDF.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate({ dry: process.argv.includes('--dry') })
    .then(() => Promise.all([engPool.end(), maqPool.end(), rodpcPool.end()]))
    .then(() => process.exit(0))
    .catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
}

module.exports = { migrate, CONVERSIONS };
