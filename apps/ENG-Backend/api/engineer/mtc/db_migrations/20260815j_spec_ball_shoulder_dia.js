'use strict';

/**
 * 20260815j_spec_ball_shoulder_dia.js
 *
 * Syncs **SD1 (ボール肩径 / ball shoulder diameter)** into `tooling_spec_process`, the last
 * component dimension the 組切削 tooling needs. It is the whole selection key of
 * FTL **PUSHER OP1** — `A7 = IF(WORK TYPE = "Y", SD1, SD2)` — and it appears on the
 * 適合表 as the pusher's stated 適用範囲 (`Φ8＜BALL肩径≦Φ13` … ).
 *
 * ── Two shoulder diameters, and only one of them is stored ───────────────────
 * Both the FTL and the XD-8 DIMENSION sheets carry SD1 *and* SD2, in adjacent columns,
 * and exactly one is filled per row:
 *
 *     SD1  ボール肩径 (Yボール)   a drawing value, entered by hand      → this column
 *     SD2  ボール肩径 (通常)      =IF(TYPE="Y","-",ROUND(SQRT(BD^2-BW^2),2))
 *
 * SD2 is pure geometry off `ball_dia` and `ball_width`, which `20260815f_` already synced,
 * so it needs no column and is derived in `buildSpecContext`. Only the Y-ball value has to
 * be fetched, and `lpb.eng_ball.shoulder_dia` is it — 0 on every normal ball, populated on
 * the Y-balls, which is the same split the sheets use.
 *
 * ── Scored before being wired in ─────────────────────────────────────────────
 * Against the two workbooks' own C/N sheets, on the rows that carry an SD1:
 *
 *     XD-8  DIMENSION K   62 % exact (13/21) · 95 % within 0.1
 *     FTL   DIMENSION J   63 % exact  (5/8)  · 75 % within 0.3
 *
 * and the geometric SD2, for comparison, reproduces at 86 % exact / 96 % within 0.1 on
 * XD-8's 382 normal-ball rows. The residual on both is spec revision drift — the sheets
 * accumulated over years — not a wrong column: no other `lpb.eng_ball` column comes near
 * (`in_dia`, `ball_dia`, `width` were each scored and are off by millimetres, not 0.1).
 *
 * ── Route ────────────────────────────────────────────────────────────────────
 * The same lpb-side join `20260815f_` established — the numeric spec CN is reachable from
 * the prefixed lpb key, never the other way round:
 *
 *     lpb.eng_sph --eng_bom(parent_cn -> child_cn)--> lpb.eng_ball.shoulder_dia
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815j_spec_ball_shoulder_dia.js --dry
 *   node api/engineer/mtc/db_migrations/20260815j_spec_ball_shoulder_dia.js
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');

const DRY = process.argv.includes('--dry');

// The reverse conversion, applied on the lpb side so no class letter has to be guessed.
const KEY = "(substring(control_no from 2 for 2) || ltrim(substring(control_no from 5), '0'))";

const COLUMN = 'ball_shoulder_dia';
const SOURCE = 'lpb.eng_ball.shoulder_dia via eng_bom — SD1 ボール肩径(Yボール), 62% exact / 95% within 0.1 against the XD-8 DIMENSION sheet';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    await client.query(`ALTER TABLE tooling_spec_process ADD COLUMN IF NOT EXISTS ${COLUMN} NUMERIC`);
    // COMMENT ON takes no bind parameters; SOURCE is a literal defined above, not user input.
    await client.query(
      `COMMENT ON COLUMN tooling_spec_process.${COLUMN} IS '${`Synced from ${SOURCE}`.replace(/'/g, "''")}'`);
    log.push(`── column ──\n   ${COLUMN} ensured`);

    const cns = (await client.query('SELECT cn FROM tooling_spec_process')).rows.map((r) => r.cn);
    const cnSet = new Set(cns);

    const sph = (await maqPool.query(
      `SELECT ${KEY} k, control_no FROM lpb.eng_sph`)).rows.filter((r) => cnSet.has(r.k));
    log.push(`\n── factory lookup ──\n   eng_sph matched ${sph.length} of ${cns.length} spec rows`);

    const bom = (await maqPool.query(
      `SELECT parent_cn, child_cn FROM lpb.eng_bom WHERE parent_cn = ANY($1)`,
      [sph.map((r) => r.control_no)])).rows;
    const kids = new Map();
    for (const b of bom) {
      if (!kids.has(b.parent_cn)) kids.set(b.parent_cn, []);
      kids.get(b.parent_cn).push(b.child_cn);
    }

    // shoulder_dia is 0 on every normal ball; only the Y-balls carry one, so filter here
    // rather than writing thousands of nulls.
    const balls = new Map((await maqPool.query(
      `SELECT control_no, shoulder_dia FROM lpb.eng_ball
        WHERE control_no = ANY($1) AND shoulder_dia > 0`,
      [[...new Set(bom.map((b) => b.child_cn))]])).rows.map((r) => [r.control_no, r]));
    log.push(`   eng_ball rows carrying a shoulder_dia: ${balls.size}`);

    const updates = [];
    for (const s of sph) {
      const ball = (kids.get(s.control_no) || []).map((k) => balls.get(k)).find(Boolean);
      const sd = ball ? num(ball.shoulder_dia) : null;
      if (sd !== null) updates.push([s.k, sd]);
    }
    log.push(`\n── update ──\n   spec rows with an SD1: ${updates.length}`);

    // Chunked bulk UPDATE ... FROM (VALUES ...) — a per-row loop over thousands of rows
    // would take minutes. 2 params x 2000 rows is well under the 65535 limit.
    const CHUNK = 2000;
    let written = 0;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK);
      const ph = chunk.map((_, ri) => `($${ri * 2 + 1}::text,$${ri * 2 + 2}::numeric)`).join(',');
      const r = await client.query(
        `UPDATE tooling_spec_process t
            SET ${COLUMN} = v.sd
           FROM (VALUES ${ph}) AS v(cn, sd)
          WHERE t.cn = v.cn
        RETURNING 1`, chunk.flat());
      written += r.rowCount;
    }
    log.push(`   updated ${written} spec rows`);

    const cov = (await client.query(
      `SELECT count(*) FILTER (WHERE ${COLUMN} > 0)::int sd1,
              count(*) FILTER (WHERE ball_dia > 0 AND ball_width > 0)::int sd2_derivable,
              count(*)::int total
         FROM tooling_spec_process`)).rows[0];
    log.push(`\n── coverage ──\n   SD1 stored: ${cov.sd1}   SD2 derivable (ball_dia+ball_width): ${cov.sd2_derivable}   of ${cov.total}`);

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
