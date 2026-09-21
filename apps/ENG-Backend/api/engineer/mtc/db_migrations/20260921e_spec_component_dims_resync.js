'use strict';

/**
 * Re-sync the SPH / ball / race component dimensions the first sync skipped.
 * ------------------------------------------------------------------------------
 * `20260815f_spec_component_dims.js` (and `20260815j_` for the Y-ball shoulder) turned an
 * lpb control number into a spec CN with `substring(...) || ltrim(suffix, '0')`, which drops
 * EVERY leading zero: A41-00082 -> '4182'. The spec table keys the same part as '410082'
 * (class + the last four digits), so every control number whose suffix is below 1000 never
 * matched and was skipped without a word. cnFormat.toSpecCn documents exactly this trap.
 *
 * Measured 2026-09-21: 3,624 of the 8,789 SPH-class spec rows (41-44, 48, 49) had no ball
 * width; 3,611 of them (99.6 %) are the suffix < 1000 shape, all 3,624 exist in lpb.eng_sph,
 * and 3,619 reach an eng_sph_design row that carries a ball width (951 designs). Everything
 * the 組切削 / release tooling computes from ball and race dimensions - X-100, XD-8, J-WAVE,
 * TP-SW-03 SET STICK - returned 0 or nothing for these parts.
 *
 * WHAT THIS DOES
 *   Same sources as the originals (eng_sph -> eng_sph_design; eng_bom -> eng_race /
 *   eng_ball.shoulder_dia), but the spec CN is converted with cnFormat.toControlNo on the
 *   spec side instead of an SQL string trick. Only SPH-class rows with no ball width are
 *   considered, and only NULL/0 columns are filled - a value already present is never
 *   overwritten.
 *
 * SAFETY
 *   The pre-change component columns of every touched row are kept in
 *   `tooling_spec_process_bak_20260921e` (first state wins on a re-run); `--revert`
 *   restores them and drops the table. `--dry-run` reports and writes nothing.
 *   Clears `tselect_cn_cache` and the SDS coverage cache, both derived from these rows.
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const cnFormat = require('../utils/cnFormat');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--dry');
const BAK = 'tooling_spec_process_bak_20260921e';
const COLS = ['sph_od', 'sph_width', 'ball_dia', 'ball_width', 'ball_bore', 'race_od', 'race_width', 'ball_shoulder_dia'];
const CHUNK = 2000;

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    if (revert) {
      const has = (await client.query(`SELECT to_regclass($1) t`, [BAK])).rows[0].t;
      if (!has) { console.log(`no ${BAK} - nothing to revert`); return; }
      await client.query('BEGIN');
      const r = await client.query(
        `UPDATE tooling_spec_process t SET ${COLS.map(c => `${c} = b.${c}`).join(', ')}
           FROM ${BAK} b WHERE t.cn = b.cn`);
      await client.query(`DROP TABLE ${BAK}`);
      await client.query('COMMIT');
      console.log(`restored ${r.rowCount} spec rows from ${BAK}`);
      await clearCaches();
      await recordRevert({ file: __filename });
      return;
    }

    // ── target rows: SPH class, no ball width ──
    const target = (await client.query(
      `SELECT cn, ${COLS.join(', ')} FROM tooling_spec_process
        WHERE cn ~ '^(41|42|43|44|48|49)[0-9]{4}$' AND NOT (COALESCE(ball_width, 0) > 0)`)).rows;
    const ctl = new Map(target.map(r => [r.cn, cnFormat.toControlNo(r.cn)]).filter(x => x[1]));
    console.log(`\ntarget rows (SPH, no ball width): ${target.length}   convertible to a control no: ${ctl.size}`);

    const sph = (await maqPool.query(
      `SELECT control_no, sph_design_no FROM lpb.eng_sph WHERE control_no = ANY($1)`, [[...ctl.values()]])).rows;
    const sphByCtl = new Map(sph.map(r => [r.control_no, r]));
    const designs = new Map((await maqPool.query(
      `SELECT sph_design_cn, sph_od, sph_width, ball_sph_dia, ball_width, dall_id
         FROM lpb.eng_sph_design WHERE sph_design_cn = ANY($1)`,
      [[...new Set(sph.map(r => r.sph_design_no).filter(Boolean))]])).rows.map(d => [d.sph_design_cn, d]));
    const bom = (await maqPool.query(
      `SELECT parent_cn, child_cn FROM lpb.eng_bom WHERE parent_cn = ANY($1)`, [sph.map(r => r.control_no)])).rows;
    const kids = new Map();
    for (const b of bom) (kids.get(b.parent_cn) || kids.set(b.parent_cn, []).get(b.parent_cn)).push(b.child_cn);
    const kidIds = [...new Set(bom.map(b => b.child_cn))];
    const races = new Map((await maqPool.query(
      `SELECT control_no, od, width FROM lpb.eng_race WHERE control_no = ANY($1)`, [kidIds])).rows.map(r => [r.control_no, r]));
    const balls = new Map((await maqPool.query(
      `SELECT control_no, shoulder_dia FROM lpb.eng_ball WHERE control_no = ANY($1) AND shoulder_dia > 0`, [kidIds]))
      .rows.map(r => [r.control_no, r]));
    console.log(`eng_sph ${sph.length} - designs ${designs.size} - bom children ${kidIds.length} - races ${races.size} - Y-balls ${balls.size}`);

    // ── build updates: fill only what is missing ──
    const updates = [];
    const filled = Object.fromEntries(COLS.map(c => [c, 0]));
    for (const row of target) {
      const s = sphByCtl.get(ctl.get(row.cn));
      if (!s) continue;
      const d = designs.get(s.sph_design_no);
      const kid = kids.get(s.control_no) || [];
      const race = kid.map(k => races.get(k)).find(Boolean);
      const ball = kid.map(k => balls.get(k)).find(Boolean);
      const found = {
        sph_od: num(d?.sph_od), sph_width: num(d?.sph_width), ball_dia: num(d?.ball_sph_dia),
        ball_width: num(d?.ball_width), ball_bore: num(d?.dall_id),
        race_od: num(race?.od), race_width: num(race?.width), ball_shoulder_dia: num(ball?.shoulder_dia),
      };
      const next = COLS.map(c => (num(row[c]) === null ? found[c] : null));   // null = leave as is
      if (next.every(v => v === null)) continue;
      COLS.forEach((c, i) => { if (next[i] !== null) filled[c]++; });
      updates.push([row.cn, ...next]);
    }
    console.log(`rows to update: ${updates.length}`);
    console.log('columns newly filled:', JSON.stringify(filled));
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS ${BAK} AS SELECT cn, ${COLS.join(', ')} FROM tooling_spec_process WHERE false`);
    if ((await client.query(`SELECT count(*)::int n FROM ${BAK}`)).rows[0].n === 0) {
      await client.query(
        `INSERT INTO ${BAK} SELECT cn, ${COLS.join(', ')} FROM tooling_spec_process WHERE cn = ANY($1)`,
        [updates.map(u => u[0])]);
    }
    let written = 0;
    for (const part of chunks(updates, CHUNK)) {
      const w = COLS.length + 1;
      const ph = part.map((_, ri) => `($${ri * w + 1}::text,${COLS.map((__, ci) => `$${ri * w + ci + 2}::numeric`).join(',')})`).join(',');
      const r = await client.query(
        `UPDATE tooling_spec_process t
            SET ${COLS.map(c => `${c} = COALESCE(NULLIF(t.${c}, 0), v.${c})`).join(', ')}
           FROM (VALUES ${ph}) AS v(cn, ${COLS.join(', ')})
          WHERE t.cn = v.cn`, part.flat());
      written += r.rowCount;
    }
    await client.query('COMMIT');
    console.log(`\nupdated ${written} spec rows (backup: ${BAK})`);
    await clearCaches();
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260921e_spec_component_dims_resync.js --revert');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function clearCaches() {
  for (const q of [`DELETE FROM tselect_cn_cache`, `DELETE FROM sds_coverage_cache WHERE id = 'coverage'`]) {
    try { await engPool.query(q); } catch (e) { console.warn('cache not cleared:', e.message); }
  }
  console.log('caches cleared (tselect_cn_cache, sds coverage)');
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => { console.error(e); await engPool.end().catch(() => {}); await maqPool.end().catch(() => {}); process.exit(1); });
