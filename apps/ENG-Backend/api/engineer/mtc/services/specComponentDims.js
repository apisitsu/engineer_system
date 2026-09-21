'use strict';

/**
 * SPH / ball / race component dimensions -> `tooling_spec_process`.
 * ------------------------------------------------------------------------------
 * `syncNewCns` (the 08:00 cron and POST /spec/sync-new) inserts a new C/N with OD/ID/W only.
 * The eight component columns below are what the 組切削 / release tooling is designed against
 * (X-100, XD-8, J-WAVE, TP-SW-03 SET STICK ...), and until now they were filled by a one-off
 * migration, so every SPH C/N added afterwards stayed blank and those toolings returned
 * nothing for it. This runs after every sync and fills them.
 *
 *   lpb.eng_sph --sph_design_no--> lpb.eng_sph_design   sph_od, sph_width, ball_sph_dia,
 *        |                                              ball_width, dall_id
 *        +--lpb.eng_bom (parent -> child)--> lpb.eng_race  (od, width)
 *                                            lpb.eng_ball  (shoulder_dia, Y-balls only)
 *
 * The spec CN is converted with cnFormat.toControlNo. Never strip leading zeros with SQL: the
 * first version did (`ltrim(suffix, '0')`), turned A41-00082 into '4182' instead of '410082' and
 * silently skipped 3,611 C/Ns whose suffix is below 1000.
 *
 * Only SPH-class rows (41-44, 48, 49) with no ball width are considered, and only NULL/0
 * columns are filled - a value already present is never overwritten. Idempotent, and cheap when
 * there is nothing to do (one indexed query). Fail-open by design: callers treat an error as
 * "no update", never as a reason to fail the sync.
 */

const cnFormat = require('../utils/cnFormat');

const COLUMNS = ['sph_od', 'sph_width', 'ball_dia', 'ball_width', 'ball_bore', 'race_od', 'race_width', 'ball_shoulder_dia'];
const SPH_CLASS = /^(41|42|43|44|48|49)[0-9]{4}$/;
const CHUNK = 2000;

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

/**
 * Pure: turn what was found in lpb into UPDATE rows `[cn, ...COLUMNS]` (null = leave as is).
 * @param {Array} target   spec rows { cn, ...COLUMNS }
 * @param {Object} src     { ctlByCn: Map, sphByCtl: Map, designs: Map, kids: Map, races: Map, balls: Map }
 */
function buildComponentUpdates(target, src) {
  const updates = [];
  for (const row of target) {
    const s = src.sphByCtl.get(src.ctlByCn.get(row.cn));
    if (!s) continue;
    const d = src.designs.get(s.sph_design_no);
    const kid = src.kids.get(s.control_no) || [];
    const race = kid.map((k) => src.races.get(k)).find(Boolean);
    const ball = kid.map((k) => src.balls.get(k)).find(Boolean);
    const found = {
      sph_od: num(d && d.sph_od), sph_width: num(d && d.sph_width), ball_dia: num(d && d.ball_sph_dia),
      ball_width: num(d && d.ball_width), ball_bore: num(d && d.dall_id),
      race_od: num(race && race.od), race_width: num(race && race.width),
      ball_shoulder_dia: num(ball && ball.shoulder_dia),
    };
    const next = COLUMNS.map((c) => (num(row[c]) === null ? found[c] : null));
    if (next.every((v) => v === null)) continue;
    updates.push([row.cn, ...next]);
  }
  return updates;
}

/**
 * Fill the component columns for SPH rows that lack them.
 * @param {{engPool, maqPool}} pools
 * @param {string[]} [onlyCns]  restrict to these spec CNs (e.g. the rows a sync just inserted)
 * @returns {Promise<{target:number, updated:number}>}
 */
async function syncComponentDims({ engPool, maqPool }, onlyCns) {
  const params = [];
  let where = `cn ~ '^(41|42|43|44|48|49)[0-9]{4}$' AND NOT (COALESCE(ball_width, 0) > 0)`;
  if (Array.isArray(onlyCns)) {
    const list = onlyCns.filter((c) => SPH_CLASS.test(String(c)));
    if (!list.length) return { target: 0, updated: 0 };
    params.push(list);
    where += ` AND cn = ANY($1)`;
  }
  const target = (await engPool.query(
    `SELECT cn, ${COLUMNS.join(', ')} FROM tooling_spec_process WHERE ${where}`, params)).rows;
  if (!target.length) return { target: 0, updated: 0 };

  const ctlByCn = new Map(target.map((r) => [r.cn, cnFormat.toControlNo(r.cn)]).filter((x) => x[1]));
  const sph = (await maqPool.query(
    `SELECT control_no, sph_design_no FROM lpb.eng_sph WHERE control_no = ANY($1)`, [[...ctlByCn.values()]])).rows;
  if (!sph.length) return { target: target.length, updated: 0 };

  const designs = new Map((await maqPool.query(
    `SELECT sph_design_cn, sph_od, sph_width, ball_sph_dia, ball_width, dall_id
       FROM lpb.eng_sph_design WHERE sph_design_cn = ANY($1)`,
    [[...new Set(sph.map((r) => r.sph_design_no).filter(Boolean))]])).rows.map((d) => [d.sph_design_cn, d]));
  const bom = (await maqPool.query(
    `SELECT parent_cn, child_cn FROM lpb.eng_bom WHERE parent_cn = ANY($1)`, [sph.map((r) => r.control_no)])).rows;
  const kids = new Map();
  for (const b of bom) {
    if (!kids.has(b.parent_cn)) kids.set(b.parent_cn, []);
    kids.get(b.parent_cn).push(b.child_cn);
  }
  const kidIds = [...new Set(bom.map((b) => b.child_cn))];
  const races = new Map((await maqPool.query(
    `SELECT control_no, od, width FROM lpb.eng_race WHERE control_no = ANY($1)`, [kidIds])).rows.map((r) => [r.control_no, r]));
  const balls = new Map((await maqPool.query(
    `SELECT control_no, shoulder_dia FROM lpb.eng_ball WHERE control_no = ANY($1) AND shoulder_dia > 0`, [kidIds]))
    .rows.map((r) => [r.control_no, r]));

  const updates = buildComponentUpdates(target, {
    ctlByCn, sphByCtl: new Map(sph.map((r) => [r.control_no, r])), designs, kids, races, balls,
  });

  let updated = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const part = updates.slice(i, i + CHUNK);
    const w = COLUMNS.length + 1;
    const ph = part.map((_, ri) => `($${ri * w + 1}::text,${COLUMNS.map((__, ci) => `$${ri * w + ci + 2}::numeric`).join(',')})`).join(',');
    const r = await engPool.query(
      `UPDATE tooling_spec_process t
          SET ${COLUMNS.map((c) => `${c} = COALESCE(NULLIF(t.${c}, 0), v.${c})`).join(', ')}
         FROM (VALUES ${ph}) AS v(cn, ${COLUMNS.join(', ')})
        WHERE t.cn = v.cn`, part.flat());
    updated += r.rowCount;
  }
  return { target: target.length, updated };
}

module.exports = { syncComponentDims, buildComponentUpdates, COLUMNS };
