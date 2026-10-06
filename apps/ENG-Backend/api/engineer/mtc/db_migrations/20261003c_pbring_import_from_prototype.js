'use strict';

/**
 * One-time import: load the standalone "PB Ring Tooling Manager" prototype's
 * already-built CSVs (`db/tooling.csv`, `db/setup_params.csv`,
 * `db/setup_conditions.csv` — produced by that project's `etl.py` from the two
 * source Excel workbooks) into `pbring_tooling` / `pbring_sds_param` /
 * `pbring_sds_condition`.
 * ------------------------------------------------------------------------------
 * After this runs once, those tables are the live, DB-managed record — the
 * prototype's Excel files and localStorage layer are no longer consulted. Going
 * forward, edits happen through the pbring API/UI, not by re-running this file
 * against a newer export (re-running would need `--force` and would duplicate
 * rows, since this is a plain INSERT, not an upsert — there is no natural key
 * in the source data stable enough to upsert on).
 *
 * The source directory lives outside this repo (a sibling project, not checked
 * into git) — override with PBRING_IMPORT_DIR if it's not at the default path.
 *
 * `--revert` deletes every row these three tables hold (not just the imported
 * ones) — safe only when run before any manual edits/approvals have happened
 * through the pbring UI. It intentionally does NOT touch `pbring_cost_pending`
 * or `pbring_approver`.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const IMPORT_DIR = process.env.PBRING_IMPORT_DIR || 'C:\\User DATA\\PB_Ring_SDS_Project\\db';

// Machine-name normalization, ported verbatim from the prototype's `nk`/`ALIAS`/`mk`
// (tooling_manager.html) so mc_key here matches what the prototype already computed.
const nk = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const ALIAS = {
  KVD300CRII: 'KVD300', KVD350C: 'KVD350', NISSINHIGRIND1D: 'HIGRIND1D',
  QUICKTURNSMART200M: 'QTSMART200M', KSB80PB: 'KSB80',
};
const mk = (s) => { const k = nk(s); return ALIAS[k] || k; };

const num = (v) => (v === '' || v == null ? null : Number(v));
const str = (v) => (v === '' || v == null ? null : String(v));

function readCsv(file) {
  const p = path.join(IMPORT_DIR, file);
  if (!fs.existsSync(p)) throw new Error(`PB Ring import source not found: ${p} (set PBRING_IMPORT_DIR)`);
  return parse(fs.readFileSync(p), { columns: true, skip_empty_lines: true, bom: true });
}

/** INSERT in chunks of `size` rows — never a per-row loop (see .claude/rules/db-patterns.md). */
async function bulkInsert(table, columns, rows, size = 2000) {
  let n = 0;
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const c = columns.length;
    const placeholders = chunk.map((_, ri) =>
      `(${Array.from({ length: c }, (__, ci) => `$${ri * c + ci + 1}`).join(',')})`
    ).join(',');
    await engPool.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`,
      chunk.flat()
    );
    n += chunk.length;
  }
  return n;
}

function importTooling() {
  const rows = readCsv('tooling.csv');
  const cols = ['part_group', 'cn', 'part_name', 'part_no', 'process_code', 'process_name',
    'mc_type', 'mc_key', 'mc_no', 'tooling_item', 'tool_code', 'tool_code_base', 'tool_rev',
    'maker', 'po_no', 'machine_qty', 'order_qty', 'unit_price', 'total_price', 'receive_date',
    'status', 'remark', 'pic', 'new_dwg_no', 'rank', 'created_by'];
  const values = rows.map((r) => [
    str(r.part_group), str(r.cn), str(r.part_name), str(r.part_no), str(r.process_code),
    str(r.process_name), str(r.mc_type), str(r.mc_key) || mk(r.mc_type), str(r.mc_no),
    str(r.tooling_item), str(r.tool_code), str(r.tool_code_base), str(r.tool_rev), str(r.maker),
    str(r.po_no), num(r.machine_qty), num(r.order_qty), num(r.unit_price), num(r.total_price),
    str(r.receive_date), str(r.status), str(r.remark), str(r.pic), str(r.new_dwg_no), num(r.rank),
    'import:pbring-prototype',
  ]);
  return { rows, cols, values };
}

function importSdsParams() {
  const rows = readCsv('setup_params.csv'); // sheet,cn,pn,process_code,process,machine,param,value
  const groups = new Map();
  for (const r of rows) {
    const key = [r.sheet, r.cn, r.pn, r.process_code, r.process, r.machine].join('\u0001');
    if (!groups.has(key)) {
      groups.set(key, {
        cn: str(r.cn), pn: str(r.pn), process_code: str(r.process_code),
        process_name: str(r.process), machine: str(r.machine), mc_key: mk(r.machine),
        params: {},
      });
    }
    if (r.param) groups.get(key).params[r.param] = r.value;
  }
  const cols = ['cn', 'pn', 'process_code', 'process_name', 'machine', 'mc_key', 'params'];
  const values = [...groups.values()].map((g) =>
    [g.cn, g.pn, g.process_code, g.process_name, g.machine, g.mc_key, JSON.stringify(g.params)]);
  return { rows: [...groups.values()], cols, values };
}

function importSdsConditions(toolCodeBaseSet) {
  const rows = readCsv('setup_conditions.csv');
  const cols = ['cn', 'pn', 'process_code', 'machine', 'mc_key', 'kind', 'sds_rev', 'tool_number',
    'tooling_no', 'maker', 'tool_detail', 'insert_info', 'holder_info', 'holder_maker', 'overhang',
    'vc', 'f', 'ap', 'nose_r', 'in_tooling_list'];
  const values = rows.map((r) => {
    const toolingNo = str(r.tooling_no);
    const inList = toolingNo ? toolCodeBaseSet.has(toolingNo.trim().toUpperCase()) : false;
    return [
      str(r.cn), str(r.pn), str(r.process_code), str(r.machine), str(r.mc_key) || mk(r.machine),
      str(r.kind), str(r.sds_rev), str(r.tool_number), toolingNo, str(r.maker), str(r.tool_detail),
      str(r.insert_info), str(r.holder_info), str(r.holder_maker), str(r.overhang), str(r.vc),
      str(r.f), str(r.ap), str(r.nose_r), inList,
    ];
  });
  return { rows, cols, values };
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DELETE FROM pbring_sds_condition');
    await engPool.query('DELETE FROM pbring_sds_param');
    await engPool.query('DELETE FROM pbring_tooling');
    console.log('reverted: all rows deleted from pbring_tooling, pbring_sds_param, pbring_sds_condition');
    await recordRevert({ file: __filename });
    return;
  }

  const tooling = importTooling();
  const nTooling = await bulkInsert('pbring_tooling', tooling.cols, tooling.values);
  console.log(`pbring_tooling: imported ${nTooling} / ${tooling.rows.length} row(s)`);

  const toolCodeBaseSet = new Set(
    tooling.rows.map((r) => str(r.tool_code_base)).filter(Boolean).map((v) => v.trim().toUpperCase())
  );

  const params = importSdsParams();
  const nParams = await bulkInsert('pbring_sds_param', params.cols, params.values);
  console.log(`pbring_sds_param: imported ${nParams} grouped row(s) (from ${params.rows.length > nParams ? 'more' : nParams} source rows)`);

  const conditions = importSdsConditions(toolCodeBaseSet);
  const nConditions = await bulkInsert('pbring_sds_condition', conditions.cols, conditions.values);
  console.log(`pbring_sds_condition: imported ${nConditions} / ${conditions.rows.length} row(s)`);

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261003c_pbring_import_from_prototype.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
