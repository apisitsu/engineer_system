'use strict';

/**
 * 20260815p_jwave_4879.js
 *
 * Adds **J-WAVE** (高松 J-WAVE, 組切削, process 2071/2031) and six of its seven tooling
 * families — 253 shelf rows across 4879-02 … 4879-06. It was the last family blocked on
 * the SPH component dimensions, and `20260815f_` + `20260815j_` between them supplied
 * every input its workbook asks for.
 *
 * ── The workbook states its own definitions, which is why this one is cheap ──
 * `20210315_TOOLING LIST_J-WAVE.xlsx` is the most explicit of the three 組切削 workbooks:
 * `DIMENSION` row 17 names every column in Japanese and row 18 says whether it is
 * ノミナル, MAX, 計算値 or 入力値. Nothing here is reverse-engineered from a tooling list.
 *
 *     RW  レース巾 (nom)      race_width   100 %      BD  ボール球径   ball_dia    100 %
 *     ROD レース外径 (MAX)    race_od       95 %      ID  ボール内径   ball_bore    95 %
 *     BW  ボール巾 (nom)      ball_width   100 %      SW  SPHレース巾  sph_width    59 % / 91 % ±0.1
 *     OD1 D切削後 SPH外径 (MAX)              OD2 組切削後 SPH外径 (MAX)
 *     SD  ボール肩径   =IF(Yボール, 入力値, ROUND(SQRT(BD^2-BW^2),1))   → SD1 / SD2
 *     TB  レースとば口径 =ROUND(SQRT(BD^2-SW^2),2)                      → TB
 *
 * > **This is the third workbook to define TB off SW rather than RW, and here it is exact:
 * > `sqrt(BD² − SW²)` reproduces its TB column 100 % (23/23) against 9 % for RW.** Together
 * > with X-100 and FTL that settles the reading `20260815i_` had wrong; only XD-8 uses the
 * > race blank, and `TBrace` exists for it.
 *
 * Three step tables live in the sheet itself, keyed on RW or SW, and are transcribed here:
 *
 *     alpha(RW)  <6 -> 0.5  <10 -> 0.3  else 0.1        (TYPE 1 only, not used below)
 *     beta(RW)   <6 -> 0.8  <10 -> 1.0  else 1.2
 *     gamma(SW)  <6 -> 0.8  <10 -> 1.0  else 1.2
 *
 * ── The collets are selected on B, and the sheet gives its own tolerance ────
 * `COLLET OP1` does its shelf lookup on **column B, not A** —
 * `MIN(IF(B_shelf >= B_computed))` — and rows 18-19 of the same sheet write the band out
 * in words:
 *
 *     推奨値  ワーク外径MAX ～ ワーク外径MAX + 0.1
 *     許容値  ワーク外径ノミナル ～ ワーク外径MAX + 0.15      → tol_minus 0.05, tol_plus 0.15
 *
 * That is a documented tolerance, not a fitted one, and it is used for both collets.
 *
 * ── TYPE turned out not to matter, which was the open worry ─────────────────
 * `B` is `VLOOKUP(TYPE)`: ROD for TYPE 1 (スウェジ後), OD1 for TYPE 2, OD2 for TYPE 3 — and
 * TYPE (工程パターン) is not derivable from anything the system holds; process codes
 * separate TYPE 1 but not 2 from 3, because `lpb.eng_r_pi_tool` only lists processes that
 * carry tooling. Measured against the plan, the question is moot:
 *
 *     COLLET OP1  dim_b = OD2   median  0.00   68 % ±0.05 · 98 % ±0.5
 *     COLLET OP1  dim_b = ROD   median -1.69    2 % ±0.5
 *     COLLET OP2  dim_b = OD2   median  0.00   91 % ±0.05 · 100 % ±0.3
 *
 * The planned collets are keyed on OD2 whatever their TYPE, so `OD2` ships for all of
 * them. OD1 is never needed: it only differs from OD2 on TYPE 2 (5 of 23 sheet rows) and
 * even there the shelf follows OD2.
 *
 * `OD2 = sph_od + 0.15` — the same turning allowance measured on XD-8 and FTL in
 * `20260815m_`, now confirmed a third time and more tightly than either.
 *
 * ── Measured live, and the flag that decided it ─────────────────────────────
 * Against the same answer key (52 C/Ns carrying a 4879, 47 specced):
 *
 *     GUIDE PIN         93 %     COLLET OP1        68 %
 *     WRIST END COLLAR  89 %     GUIDE PIN HOLDER  68 %
 *     COLLET OP2        85 %     WRIST END         64 %
 *
 * Three of those started at 36-46 % and were fixed by one flag. **`is_match_dim = false`
 * is not "rank-only" — it is "does not rank either".** A rule with both tolerances NULL
 * already applies no filter; setting `is_match_dim = false` on top of that removes it from
 * the ORDER BY as well, leaving it decorative. The primary dimensions here have heavy
 * ties (`ID - 0.3` alone leaves the shelf's duplicates unresolved), so the secondary
 * dimensions have to rank:
 *
 *     GUIDE PIN         46 % -> 93 %      COLLET OP2  76 % -> 85 %
 *     GUIDE PIN HOLDER  36 % -> 68 %      COLLET OP1  66 % -> 68 %
 *     WRIST END         36 % -> 64 %
 *
 * WRIST END COLLAR is the exception and keeps its secondaries off: they went 89 % -> 67 %,
 * and the offline scoring agrees — its A reproduces at 33 % within 0.1 and its C at 11 %,
 * so they carry noise rather than signal. Turn the flag on where the dimension measured
 * well and off where it did not; do not set it by habit.
 *
 * ── INVERSION JAW (4879-02) is not shipped ──────────────────────────────────
 * Its sheet has no design block: the shelf is keyed on ストローク (38 と 48 の時の径), a
 * machine setting, and the only formulas are `A = 36.5 - L` and `A MIN = SW/2`, both of
 * which read a value out of the row rather than producing one. Its 10 rows are loaded so
 * the data is not lost; no formula, no rule.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260815p_jwave_4879.js --dry
 *   node api/engineer/mtc/db_migrations/20260815p_jwave_4879.js
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../../../../instance/eng_db');

const DRY = process.argv.includes('--dry');
const MACHINE = 'J-WAVE';                 // the name SDS already uses for machine_type_code 879
const INV = 'tooling_jwave';
const PROCESS = ['2071', '2031'];

// Step tables transcribed from DIMENSION!U4:W16.
const BETA = 'if(raceWidth < 6, 0.8, if(raceWidth < 10, 1.0, 1.2))';
const GAMMA = 'if(sphWidth < 6, 0.8, if(sphWidth < 10, 1.0, 1.2))';
// DIMENSION!O = IF(SD(N)="-", SD(Y), SD(N)) — the Y-ball value is manual, the normal one
// geometric. Branch on the ball shape, exactly as the sheet does.
const SD = 'if(isYBall == 1, SD1, SD2)';
// 組切削後 SPH外径 at MAX. -999 is the fail-closed sentinel for a BETWEEN rule.
const OD2 = 'if(sphOd > 0, roundN(sphCutOd_max, 2), -999)';

const FAMILIES = [
  {
    tooling: 'COLLET OP1', drawing: '4879-04', tool: 'T1',
    formulas: [
      ['B', OD2, 0, 'COLLET OP1 sheet B = VLOOKUP(TYPE): ROD / OD1 / OD2. Ships as OD2 for every TYPE — measured against the factory plan, dim_b tracks OD2 (median 0.00, 68% within 0.05) and ROD not at all (median -1.69, 2% within 0.5). OD2 = sph_od + 0.15, the turning allowance corroborated on XD-8, FTL and this sheet.'],
      ['A', `roundN(ballWidth / 2 - roundN(sphCutOd_max, 2) * 0.03 - ${BETA}, 1)`, 1, 'COLLET OP1 sheet A, TYPE 2/3 branch: BW/2 - OD1 x 0.03 - beta, with beta the sheet\'s own RW step table (<6 -> 0.8, <10 -> 1.0, else 1.2). Rank-only: against the plan it sits a median 1.40 high, which is the TYPE 1 branch (BW/2 + ROD x 0.03 - alpha) showing through on parts whose TYPE the system cannot see.'],
      ['C', 'roundN(ballBore - 1, 1)', 2, 'COLLET OP1 sheet C = ROUND(ID - 1, 1). Rank-only.'],
      ['D', `roundN(if(sphWidth < ballWidth, (TB + ${SD}) / 2, ${SD}), 1)`, 3, 'COLLET OP1 sheet D(*1) = ROUND(IF(SW < BW, (TB + SD)/2, SD), 1). Rank-only — the sheet notes its own formula changed (*1: 以前の式ではTB+0.2だった) so the shelf mixes two generations.'],
    ],
    rules: [
      ['B', 'dim_b', '0.15', '0.05', 0, 'Collet bore — the sheet\'s own 許容値: work OD nominal to MAX + 0.15', true],
      ['A', 'dim_a', null, null, 1, 'Collet face', true],
      ['C', 'dim_c', null, null, 2, 'Collet bore step', true],
      ['D', 'dim_d', null, null, 3, 'Collet nose', true],
    ],
  },
  {
    tooling: 'COLLET OP2', drawing: '4879-05', tool: 'T2',
    formulas: [
      ['B', OD2, 0, 'COLLET OP2 sheet B = ROUND(OD2, 2), the 組切削後 SPH外径 at MAX. The tightest rule in this machine: median 0.00 against the plan, 91% within 0.05 and 100% within 0.3.'],
      ['A', `roundN(sphWidth / 2 - roundN(sphCutOd_max, 2) * 0.03 - ${GAMMA}, 1)`, 1, 'COLLET OP2 sheet A = ROUND(SW/2 - OD2 x 0.03 - gamma, 1), gamma being the sheet\'s SW step table. The sheet drops the collet when A < 1.5. Rank-only.'],
      ['C', `roundN(TB + ${GAMMA}, 1)`, 2, 'COLLET OP2 sheet C = ROUND(TB + gamma, 1). Rank-only.'],
    ],
    rules: [
      ['B', 'dim_b', '0.15', '0.05', 0, 'Collet bore — work OD nominal to MAX + 0.15', true],
      ['A', 'dim_a', null, null, 1, 'Collet face', true],
      ['C', 'dim_c', null, null, 2, 'Collet mouth', true],
    ],
  },
  {
    tooling: 'GUIDE PIN HOLDER', drawing: '4879-03', tool: 'T3',
    formulas: [
      ['B', 'if(sphOd > 0, roundN(sphCutOd_max - 0.4, 1), -999)', 0, 'GUIDE PIN sheet, holder B MAX = ROUND(OD2 - 0.4, 1). The most discriminating of the holder\'s dimensions (its shelf runs 11.8-22.7); A and C are small numbers that separate little.'],
      ['A', 'roundN(TB + 0.3, 1)', 1, 'Holder A MIN = ROUND(TB + 0.3, 1). Rank-only — the sheet notes 以前の式ではTB+0.2だった, so the shelf carries both generations and a filter would exclude the older half.'],
      ['C', 'roundN((ballWidth - sphWidth) / 2 + 0.5, 1)', 2, 'Holder C MIN = ROUND((BW - SW)/2 + 0.5, 1). Rank-only.'],
    ],
    rules: [
      ['B', 'dim_b', '0.5', '0.5', 0, 'Holder bore', true],
      ['A', 'dim_a', null, null, 1, 'Holder nose', true],
      ['C', 'dim_c', null, null, 2, 'Holder step', true],
    ],
  },
  {
    tooling: 'GUIDE PIN', drawing: '4879-03', tool: 'T4',
    formulas: [
      ['A', 'if(ballBore > 0, roundN(ballBore - 0.3, 1), -999)', 0, 'GUIDE PIN sheet, pin A = ROUND(ID - 0.3, 1) — the pin enters the ball bore. Against the plan: median 0.00, 95% within 0.1, 100% within 0.3.'],
      ['B', 'roundN(ballWidth / 2 - 0.3, 1)', 1, 'Pin B = ROUND(BW/2 - 0.3, 1). Rank-only: 98% within 0.3 but only 39% within 0.1, so it orders candidates rather than excluding them.'],
    ],
    rules: [
      ['A', 'dim_a', '0.1', '0.1', 0, 'Pin diameter — enters the ball bore', true],
      ['B', 'dim_b', null, null, 1, 'Pin land', true],
    ],
  },
  {
    tooling: 'WRIST END', drawing: '4879-06', tool: 'T5',
    formulas: [
      ['A', 'if(ballBore > 0, roundN(ballBore - 0.3, 1), -999)', 0, 'WRIST END sheet A = ROUND(ID - 0.3, 1) (the sheet adds A = ID - 0.5 まで可). 100% within 0.3 against the plan, though on only 11 planned wrist ends.'],
      ['B', `roundN(${SD} - 0.3, 1)`, 1, 'WRIST END B = ROUND(SD - 0.3, 1), SD being the ball shoulder. Rank-only.'],
      ['C', 'floorN(ballWidth / 2, 1)', 2, 'WRIST END C = ROUNDDOWN(BW/2, 1). Rank-only.'],
      ['D', 'roundN(37 - ballWidth / 2 - 0.5 - 16, 1)', 3, 'WRIST END D = ROUND(37 - BW/2 - 0.5 - 16, 1) — 37 and 16 are machine constants. Rank-only.'],
    ],
    rules: [
      ['A', 'dim_a', '0.3', '0.3', 0, 'Wrist end bore', true],
      ['B', 'dim_b', null, null, 1, 'Shoulder seat', true],
      ['C', 'dim_c', null, null, 2, 'Half the ball width', true],
      ['D', 'dim_d', null, null, 3, 'Body length', true],
    ],
  },
  {
    tooling: 'WRIST END COLLAR', drawing: '4879-06', tool: 'T6',
    formulas: [
      ['B', 'if(TB > 0, roundN(TB + 0.5, 1), -999)', 0,
        'Collar B = ROUND(TB + 0.5, 1) — the race mouth plus clearance. 89% within 0.5 against the plan (n=9, the smallest sample here). -999 keeps a part with no SPH off the shelf.'],
      ['A', `roundN(${SD} - 0.3, 1)`, 1, 'Collar A = ROUND(SD - 0.3, 1). Rank-only.'],
      ['C', 'roundN(roundN(sphCutOd_max, 2) - 0.3, 1)', 2, 'Collar C = ROUND(OD2 - 0.3, 1). Rank-only.'],
      ['D', 'ceilN((ballWidth - sphWidth) / 2 + 0.8, 1)', 3, 'Collar D = ROUNDUP((BW - SW)/2 + 0.8, 1). Rank-only.'],
    ],
    rules: [
      ['B', 'dim_b', '0.5', '0.5', 0, 'Collar bore — the race mouth plus 0.5', true],
      ['A', 'dim_a', null, null, 1, 'Shoulder seat', false],
      ['C', 'dim_c', null, null, 2, 'Collar outside', false],
      ['D', 'dim_d', null, null, 3, 'Collar step', false],
    ],
  },
  // INVERSION JAW: rows loaded, no formulas, no rules — see the header.
  { tooling: 'INVERSION JAW', drawing: '4879-02', tool: null, formulas: [], rules: [] },
];

async function run() {
  const client = await engPool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${INV} (
        id            SERIAL PRIMARY KEY,
        tooling_name  TEXT NOT NULL,
        tooling_no    TEXT NOT NULL,
        machine       TEXT,
        dim_a NUMERIC, dim_b NUMERIC, dim_c NUMERIC, dim_d NUMERIC, dim_e NUMERIC
      )`);
    log.push(`── inventory ──\n   ${INV} ensured`);

    const data = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'data', 'jwave_4879.json'), 'utf8'));

    let m = (await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [MACHINE])).rows[0];
    if (!m) {
      m = (await client.query(
        `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled)
         VALUES ($1,$2,$3,true) RETURNING id`,
        [MACHINE, 'J-WAVE (高松 組切削 · process 2071/2031)', INV])).rows[0];
      log.push(`\n── machine ──\n   created ${MACHINE} (id ${m.id}) -> ${INV}`);
    } else {
      log.push(`\n── machine ──\n   ${MACHINE} already exists (id ${m.id})`);
    }
    const mid = m.id;

    const typeId = (await client.query(
      `SELECT id FROM sds_machine_type_code
        WHERE machine_type_name = $1 AND COALESCE(is_active,true) = true ORDER BY id LIMIT 1`,
      [MACHINE])).rows[0]?.id ?? null;

    for (const fam of FAMILIES) {
      log.push(`\n══ ${fam.tooling} ══`);
      const rows = data[fam.tooling] || [];

      const have = (await client.query(
        `SELECT count(*)::int n FROM ${INV} WHERE tooling_name = $1`, [fam.tooling])).rows[0].n;
      if (have > 0) {
        log.push(`   inventory: already ${have} rows — left alone`);
      } else if (!rows.length) {
        log.push('   inventory: no rows in the data file');
      } else {
        // Column order below must match the values array exactly — a mismatch does not raise.
        const COLS = 8;
        const ph = rows.map((_, i) =>
          `(${Array.from({ length: COLS }, (__, c) => `$${i * COLS + c + 1}`).join(',')})`).join(',');
        const vals = rows.flatMap((r) => [
          fam.tooling, r.tooling_no, MACHINE,
          r.dim_a ?? null, r.dim_b ?? null, r.dim_c ?? null, r.dim_d ?? null, r.dim_e ?? null,
        ]);
        await client.query(
          `INSERT INTO ${INV} (tooling_name, tooling_no, machine, dim_a, dim_b, dim_c, dim_d, dim_e)
           VALUES ${ph}`, vals);
        log.push(`   inventory: inserted ${rows.length} rows`);
      }

      for (const [key, expr, sort, desc] of fam.formulas) {
        const r = await client.query(
          `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description)
           SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
            WHERE NOT EXISTS (SELECT 1 FROM tooling_formula
                               WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
           RETURNING id`, [mid, fam.tooling, key, expr, sort, desc]);
        log.push(`   ${r.rowCount ? 'added ' : 'exists'}  ${key} = ${expr.length > 70 ? expr.slice(0, 67) + '...' : expr}`);
      }

      for (const [key, col, plus, minus, prio, label, match] of fam.rules) {
        const r = await client.query(
          `INSERT INTO tooling_search_rule
             (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
              sort_priority, label, inventory_tooling_filter, is_match_dim)
           SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$2::text,$9::boolean
            WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule
                               WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
           RETURNING id`, [mid, fam.tooling, key, col, plus, minus, prio, label, match]);
        // Re-running must converge on the declared shape, not just on "a row exists".
        // The ranking flags below were set by measurement, and an earlier run of this
        // file shipped different ones — without this the two states would diverge.
        const fixed = r.rowCount ? 0 : (await client.query(
          `UPDATE tooling_search_rule
              SET tol_plus = $4::numeric, tol_minus = $5::numeric, is_match_dim = $6::boolean
            WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3
              AND (tol_plus IS DISTINCT FROM $4::numeric
                OR tol_minus IS DISTINCT FROM $5::numeric
                OR is_match_dim IS DISTINCT FROM $6::boolean)
          RETURNING id`, [mid, fam.tooling, key, plus, minus, match])).rowCount;
        log.push(`   ${r.rowCount ? 'added ' : fixed ? 'fixed ' : 'exists'}  rule ${key} -> ${col} ` +
                 `${plus !== null ? `+${plus}/-${minus}` : 'no filter'}${match ? ' · ranks' : ''}`);
      }

      if (fam.tool) {
        let added = 0;
        for (const pc of PROCESS) {
          added += (await client.query(
            `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
             SELECT $1::text,$2::text,$3::text,$4::text,$5::int
              WHERE NOT EXISTS (SELECT 1 FROM sds_machine_tool
                                 WHERE process_code=$2 AND machine_type=$3 AND tool_drawing_no=$4 AND tool_number=$1)
             RETURNING id`, [fam.tool, pc, MACHINE, fam.drawing, typeId])).rowCount;
        }
        log.push(`   sds_machine_tool ${fam.drawing} (${fam.tool}) -> ${added} new`);
      }
    }
    log.push(`\n   sds_machine_type_code id for ${MACHINE}: ${typeId ?? 'NOT FOUND'}`);

    if (DRY) { await client.query('ROLLBACK'); log.push('\n*** DRY RUN — ROLLED BACK. ***'); }
    else { await client.query('COMMIT'); log.push('\n*** COMMITTED. tsv2ConfigCache reloads within 60 s. ***'); }
    console.log(log.join('\n'));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nFAILED — rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
}

run();
