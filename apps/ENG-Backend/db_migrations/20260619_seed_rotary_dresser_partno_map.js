'use strict';
/**
 * Seed the ROTARY DRESSER part-number lookup for KS-400B5 / KS-400B6.
 *
 * The rotary diamond dresser (DWG family 4800-42, ロータリーダイヤモンドドレッサー) is the
 * one KS-400B5/B6 fixture that is NOT selected by a dimensional formula — it is chosen by
 * the workpiece **part number (品番 / parts_no)**. So it has no `tooling_formula` row; the
 * mapping lives only in the engineering TOOLING LIST spreadsheets. This migration imports
 * those Part No → dresser-DWG mappings into `tooling_partno_map` so the SDS PDF can fill the
 * ROTARY DRESSER slot by parts_no (see sdsV2HeadlessController buildValueMap).
 *
 * Sources (api/engineer/mtc/templates/Select_tool_backup/):
 *   B5: 20241223_TOOLING LIST_KS-400B5.xlsx → sheet "ROTARY DRESSER", right block
 *       (col H = 4800-42-XXXX dwg, cols I/J/K = part numbers, col N = 使用禁止 forbidden flag,
 *        cols L/O = note). The right block is the active KS-400B5(THAI) list.
 *   B6: （計算式追加予定_山本）20240912_TOOLING LIST_KS-400B6.xlsx → sheet "MASTER"
 *       (col A = parts_no, col AI = ROTARY DRESSER as DD#### = 4800-42-####).
 *
 * Validated against the factory process plan: e.g. 3HTY6VP-60B-T → 4800-42-0226 (CN C35-00480),
 * 3ZRBFB06XB-BA-T → 4800-42-0218 (C35-00541) — both match lpb.eng_r_pi_tool exactly.
 *
 * Idempotent: deletes only the rows that came from these xlsx sources, then re-inserts — rows
 * added/edited via the admin UI (source='manual') are preserved across re-runs. Forbidden
 * (使用禁止) mappings are kept with is_forbidden=true; the lookup prefers non-forbidden via
 * ORDER BY is_forbidden ASC.
 *
 * Run: node db_migrations/20260619_seed_rotary_dresser_partno_map.js
 */

const path = require('path');
const XLSX = require('xlsx');
const { engPool } = require('../instance/eng_db');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');
const { toDD } = require('../api/engineer/mtc/utils/rotaryDwg');

const DIR = path.join(__dirname, '../api/engineer/mtc/templates/Select_tool_backup');
const TOOLING_NAME = 'ROTARY DRESSER';
const norm = (s) => String(s == null ? '' : s).trim();
// A real workpiece part number (品番): starts with a digit, ends in -T; drop descriptive
// cells like 爪成形 / サイドドレス / 爪成型用.
const isPartNo = (s) => /^[0-9]/.test(s) && /-T$/.test(s) && !/成形|成型|ドレス/.test(s);

function extractB5() {
  const file = '20241223_TOOLING LIST_KS-400B5.xlsx';
  const wb = XLSX.readFile(path.join(DIR, file));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['ROTARY DRESSER'], { header: 1, defval: '' });
  const out = [];
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const dwg = norm(row[7]);                    // col H
    if (!/^4800-42-\d+/.test(dwg)) continue;
    const models = [row[8], row[9], row[10]].map(norm).filter(isPartNo);  // I/J/K
    const forbidden = /使用禁止/.test(norm(row[13]));                       // col N
    const note = [norm(row[11]), norm(row[14])].filter(Boolean).join(' '); // L, O
    for (const pn of models) {
      out.push({ machine: 'KS-400B5', parts_no: pn, dwg, forbidden, note, source: file });
    }
  }
  return out;
}

function extractB6() {
  const file = '（計算式追加予定_山本）20240912_TOOLING LIST_KS-400B6.xlsx';
  const wb = XLSX.readFile(path.join(DIR, file));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['MASTER'], { header: 1, defval: '' });
  const A = XLSX.utils.decode_col('A'), AI = XLSX.utils.decode_col('AI');
  const out = [];
  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    const pn = norm(row[A]);
    const dd = norm(row[AI]);                     // col AI = DD####
    if (!pn || !/^DD0?\d+$/.test(dd)) continue;
    const num = dd.replace(/^DD/, '').padStart(4, '0');
    out.push({ machine: 'KS-400B6', parts_no: pn, dwg: `4800-42-${num}`, forbidden: false, note: '', source: file });
  }
  return out;
}

async function run() {
  const client = await engPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TABLES.TOOLING_PARTNO_MAP} (
        id           SERIAL PRIMARY KEY,
        machine_name TEXT NOT NULL,
        tooling_name TEXT NOT NULL,
        parts_no     TEXT NOT NULL,
        tool_dwg_no  TEXT NOT NULL,
        is_forbidden BOOLEAN NOT NULL DEFAULT false,
        note         TEXT,
        source       TEXT,
        created_at   TIMESTAMPTZ DEFAULT now(),
        UNIQUE (machine_name, tooling_name, parts_no, tool_dwg_no)
      )`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_${TABLES.TOOLING_PARTNO_MAP}_lookup
       ON ${TABLES.TOOLING_PARTNO_MAP} (machine_name, tooling_name, parts_no)`
    );

    const rowsAll = [...extractB5(), ...extractB6()];

    // Re-seed only the rows that came from THESE xlsx sources. Rows added/edited via the
    // admin UI (source='manual', or any other source) survive a re-run — so re-importing an
    // updated spreadsheet never wipes hand-maintained mappings.
    const xlsxSources = [...new Set(rowsAll.map((r) => r.source))];

    await client.query('BEGIN');
    await client.query(
      `DELETE FROM ${TABLES.TOOLING_PARTNO_MAP} WHERE tooling_name = $1 AND source = ANY($2::text[])`,
      [TOOLING_NAME, xlsxSources]
    );
    let n = 0;
    for (const r of rowsAll) {
      const res = await client.query(
        `INSERT INTO ${TABLES.TOOLING_PARTNO_MAP}
           (machine_name, tooling_name, parts_no, tool_dwg_no, is_forbidden, note, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (machine_name, tooling_name, parts_no, tool_dwg_no) DO NOTHING`,
        [r.machine, TOOLING_NAME, r.parts_no, toDD(r.dwg), r.forbidden, r.note || null, r.source]
      );
      n += res.rowCount;
    }
    await client.query('COMMIT');

    const byMachine = await client.query(
      `SELECT machine_name, count(*) AS c FROM ${TABLES.TOOLING_PARTNO_MAP}
       WHERE tooling_name = $1 GROUP BY machine_name ORDER BY machine_name`,
      [TOOLING_NAME]
    );
    console.log(`✅ ${TOOLING_NAME} part-no map seeded: ${n} rows`);
    byMachine.rows.forEach((r) => console.log(`   ${r.machine_name}: ${r.c}`));
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
