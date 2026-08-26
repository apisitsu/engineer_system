'use strict';

/**
 * 20260815f_spec_component_dims.js
 *
 * Adds the **SPH / ball / race component dimensions** to `tooling_spec_process` and syncs
 * them from the factory DB. Three machines are blocked on exactly this one set of inputs:
 *
 *   X-100 ARBOR   B and D need SPH TB, BALL BW and SPH SW — shipped without them
 *   FTL 4501      COLLET/PUSHER OP1+OP2, 487 rows, the most-used tooling of process 2071
 *   J-WAVE 4879   COLLET/GUIDE PIN/WRIST END, ~180 rows
 *
 * ── Where the dimensions live, and how to reach them ─────────────────────────
 * `tooling_spec_process.cn` is numeric (`434061`); every `lpb` table keys on a prefixed
 * form (`A43-04061`). The conversion is exact in the reverse direction, so the join is
 * built on the lpb side rather than by guessing the class letter:
 *
 *     numeric = substring(control_no from 2 for 2) || ltrim(substring(control_no from 5), '0')
 *
 * From there:
 *
 *     lpb.eng_sph (control_no) --sph_design_no--> lpb.eng_sph_design
 *          |                                        sph_od, sph_width,
 *          |                                        ball_sph_dia, ball_width, dall_id
 *          +--lpb.eng_bom (parent_cn -> child_cn)--> lpb.eng_race  (od, width)
 *                                                    lpb.eng_ball  (ball_dia, width, in_dia)
 *
 * ── Verified against the FTL workbook before writing anything ────────────────
 * The FTL DIMENSION sheet lists 22 C/Ns with their design inputs, so each candidate
 * column was scored against it rather than assumed:
 *
 *     BW ボール巾  = eng_sph_design.ball_width   100 % (n=21)  · eng_ball.width  100 % (n=16)
 *     ID          = eng_sph_design.dall_id      100 % (n=21)  · eng_ball.in_dia 100 % (n=16)
 *     BD 球径      = eng_sph_design.ball_sph_dia  86 % (n=21)
 *     RD          = eng_race.od                   88 % (n=16)
 *
 * **TB (とば口径) and SW are NOT resolved** and no column is added for them. TB has no
 * near-name in any of the four tables, and SW did not reproduce against either
 * `sph_width` or `race.width` on this sample. Both are stored-nowhere rather than
 * stored-wrong: X-100 ARBOR B/D and FTL PUSHER stay unshipped until they are found.
 *
 * ── Coverage ─────────────────────────────────────────────────────────────────
 * 5,174 of 16,627 spec rows (31 %) resolve to an `eng_sph` row; ~2,700 of those reach a
 * race and a ball through the BOM. That is the SPH/ball population these tooling families
 * serve — a body or a sleeve has no ball dimensions and correctly stays null.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815f_spec_component_dims.js --dry
 *   node api/engineer/mtc/db_migrations/20260815f_spec_component_dims.js
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');

const DRY = process.argv.includes('--dry');

// The reverse conversion, applied on the lpb side so no class letter has to be guessed.
const KEY = "(substring(control_no from 2 for 2) || ltrim(substring(control_no from 5), '0'))";

const COLUMNS = [
  ['sph_od',     'lpb.eng_sph_design.sph_od'],
  ['sph_width',  'lpb.eng_sph_design.sph_width'],
  ['ball_dia',   'lpb.eng_sph_design.ball_sph_dia — 球径, 86% against the FTL sheet'],
  ['ball_width', 'lpb.eng_sph_design.ball_width — ボール巾, 100%'],
  ['ball_bore',  'lpb.eng_sph_design.dall_id — 100%'],
  ['race_od',    'lpb.eng_race.od via eng_bom — 88%'],
  ['race_width', 'lpb.eng_race.width via eng_bom'],
];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    log.push('── columns ──');
    for (const [c, src] of COLUMNS) {
      await client.query(`ALTER TABLE tooling_spec_process ADD COLUMN IF NOT EXISTS ${c} NUMERIC`);
      // COMMENT ON takes no bind parameters; src is a literal defined above, not user input.
      await client.query(
        `COMMENT ON COLUMN tooling_spec_process.${c} IS '${`Synced from ${src}`.replace(/'/g, "''")}'`);
      log.push(`   ${c.padEnd(11)} ensured`);
    }

    // ── gather from the factory side ─────────────────────────────────────────
    const cns = (await client.query('SELECT cn FROM tooling_spec_process')).rows.map((r) => r.cn);
    const cnSet = new Set(cns);

    const sph = (await maqPool.query(
      `SELECT ${KEY} k, control_no, sph_design_no FROM lpb.eng_sph`)).rows
      .filter((r) => cnSet.has(r.k));
    const byCn = new Map(sph.map((r) => [r.k, r]));
    log.push(`\n── factory lookup ──\n   eng_sph matched ${sph.length} of ${cns.length} spec rows`);

    const designs = (await maqPool.query(
      `SELECT sph_design_cn, sph_od, sph_width, ball_sph_dia, ball_width, dall_id
         FROM lpb.eng_sph_design WHERE sph_design_cn = ANY($1)`,
      [[...new Set(sph.map((r) => r.sph_design_no))]])).rows;
    const byDesign = new Map(designs.map((d) => [d.sph_design_cn, d]));
    log.push(`   eng_sph_design rows: ${designs.length}`);

    const bom = (await maqPool.query(
      `SELECT parent_cn, child_cn FROM lpb.eng_bom WHERE parent_cn = ANY($1)`,
      [sph.map((r) => r.control_no)])).rows;
    const kids = new Map();
    for (const b of bom) {
      if (!kids.has(b.parent_cn)) kids.set(b.parent_cn, []);
      kids.get(b.parent_cn).push(b.child_cn);
    }
    const allKids = [...new Set(bom.map((b) => b.child_cn))];
    const races = new Map((await maqPool.query(
      `SELECT control_no, od, width FROM lpb.eng_race WHERE control_no = ANY($1)`, [allKids]))
      .rows.map((r) => [r.control_no, r]));
    log.push(`   eng_bom children: ${allKids.length} · of which races: ${races.size}`);

    // ── build the update set ─────────────────────────────────────────────────
    const updates = [];
    for (const cn of cns) {
      const s = byCn.get(cn);
      if (!s) continue;
      const d = byDesign.get(s.sph_design_no);
      const race = (kids.get(s.control_no) || []).map((k) => races.get(k)).find(Boolean);
      if (!d && !race) continue;
      const row = [cn,
        num(d?.sph_od), num(d?.sph_width), num(d?.ball_sph_dia),
        num(d?.ball_width), num(d?.dall_id),
        num(race?.od), num(race?.width)];
      if (row.slice(1).every((v) => v === null)) continue;
      updates.push(row);
    }
    log.push(`\n── update ──\n   rows with at least one dimension: ${updates.length}`);

    // Chunked bulk UPDATE ... FROM (VALUES ...) — 8 params x 2000 rows is well under the
    // 65535 limit, and a per-row loop over 5k rows would take minutes.
    const COLS = COLUMNS.map(([c]) => c);
    const CHUNK = 2000;
    let written = 0;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK);
      const width = COLS.length + 1;
      const ph = chunk.map((_, ri) =>
        `($${ri * width + 1}::text,${COLS.map((__, ci) => `$${ri * width + ci + 2}::numeric`).join(',')})`).join(',');
      const r = await client.query(
        `UPDATE tooling_spec_process t
            SET ${COLS.map((c) => `${c} = v.${c}`).join(', ')}
           FROM (VALUES ${ph}) AS v(cn, ${COLS.join(', ')})
          WHERE t.cn = v.cn
        RETURNING 1`, chunk.flat());
      written += r.rowCount;
    }
    log.push(`   updated ${written} spec rows`);

    const filled = (await client.query(
      `SELECT ${COLS.map((c) => `count(*) FILTER (WHERE ${c} > 0)::int ${c}`).join(', ')}
         FROM tooling_spec_process`)).rows[0];
    log.push(`\n── coverage ──\n   ${COLS.map((c) => `${c}=${filled[c]}`).join('  ')}`);

    if (DRY) { await client.query('ROLLBACK'); log.push('\n*** DRY RUN — ROLLED BACK. ***'); }
    else { await client.query('COMMIT'); log.push('\n*** COMMITTED. ***'); }
    console.log(log.join('\n'));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED — rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
    await maqPool.end();
  }
}

run();
