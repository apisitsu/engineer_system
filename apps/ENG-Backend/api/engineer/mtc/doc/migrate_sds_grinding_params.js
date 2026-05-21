'use strict';

/**
 * migrate_sds_grinding_params.js
 *
 * Reads old SDS Excel templates (A16:I55 zone) and populates sds_parameter:
 *   - Plain text cells  → cn=NULL  (static layout: labels, units, row headers)
 *   - {{param_key}} cells → per-CN values from sds_setup_parameter_value
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/doc/migrate_sds_grinding_params.js
 *
 * Idempotent: uses ON CONFLICT ... DO UPDATE.
 */

const path   = require('path');
const ExcelJS = require('exceljs');
const { engPool }  = require('../../../../instance/eng_db');
const { TABLES }   = require('../mtcConstants');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/** Convert old 6-digit item_no (e.g. "310016") to new CN format ("C31-00016") */
function itemNoToCN(itemNo) {
  if (!/^[0-9]{6}$/.test(itemNo)) return itemNo; // already converted or unknown
  const classNum = itemNo.slice(0, 2);
  const seq = itemNo.slice(2);
  const prefix = parseInt(classNum) >= 41 && parseInt(classNum) <= 49 ? 'A' : 'C';
  return `${prefix}${classNum}-0${seq}`;
}

// Template file → machine groups
// old: name used in sds_setup_sheet.machine
// new: machine_type_name used in sds_machine_type_code / sds_parameter
const MACHINE_GROUPS = [
  {
    file: 'spg_ks400b1.xlsx',
    machines: [
      { old: 'KS-400B1', new: 'KS-400B1' },
      { old: 'KS-400B2', new: 'KS-400B2' },
      { old: 'KS-400B7', new: 'KS-400B7' },
    ],
  },
  { file: 'spg_ks400b5.xlsx',   machines: [{ old: 'KS-400B5',   new: 'KS-400B5'   }] },
  { file: 'spg_ks400b6.xlsx',   machines: [{ old: 'KS-400B6',   new: 'KS-400B6'   }] },
  { file: 'spg_ks500rd.xlsx',   machines: [{ old: 'KS-500RD',   new: 'KS-500RD'   }] },
  { file: 'idg_ks03a.xlsx',     machines: [{ old: 'KS-03A',     new: 'KS-03A'     }] },
  { file: 'idg_ksb22g.xlsx',    machines: [{ old: 'KS-B22G',    new: 'KS-B22G'    }] },
  { file: 'idg_ksb22rd.xlsx',   machines: [{ old: 'KS-B22RD',   new: 'KS-B22RD'   }] },
  { file: 'idg_ksb80.xlsx',     machines: [{ old: 'KS-B80',     new: 'KS-B80'     }] },
  { file: 'hsg_kvd300.xlsx',    machines: [{ old: 'KVD-300CRII', new: 'KVD300-CRⅡ' }] },
  { file: 'hsg_kvd350.xlsx',    machines: [{ old: 'KVD350C',    new: 'KVD350S'    }] },
  { file: 'vsg_tsg300w.xlsx',   machines: [{ old: 'TSG300W',    new: 'TSG-300W'   }] },
  { file: 'vsg_tsg300znc.xlsx', machines: [{ old: 'TSG-300ZNC', new: 'TSG-300ZNC' }] },
];

const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

function cellText(rawVal) {
  if (rawVal === null || rawVal === undefined) return null;
  if (typeof rawVal === 'string') return rawVal;
  if (typeof rawVal === 'number') return String(rawVal);
  if (rawVal.richText) return rawVal.richText.map(r => r.text || '').join('');
  if (rawVal.result !== undefined) return String(rawVal.result ?? '');
  return String(rawVal);
}

/** Returns the param_key name if cell is purely {{param_key}}, else null. */
function extractPlaceholder(str) {
  if (!str) return null;
  const m = str.trim().match(/^\{\{(\w+)\}\}$/);
  return m ? m[1] : null;
}

async function upsertParam(cn, machine_type_name, param_key, param_value) {
  await engPool.query(
    `INSERT INTO ${TABLES.SDS_PARAMETER} (cn, machine_type_name, param_key, param_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (COALESCE(cn,'__machine_config__'), machine_type_name, param_key)
     DO UPDATE SET param_value = EXCLUDED.param_value`,
    [cn, machine_type_name, param_key, param_value]
  );
}

async function migrateTemplate(templateFile, machineGroup) {
  const filePath = path.join(TEMPLATES_DIR, templateFile);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const ws = workbook.worksheets[0];

  const staticCells = [];      // { param_key, param_value }
  const placeholderCells = []; // { param_key, placeholder }

  for (let rowNum = 16; rowNum <= 55; rowNum++) {
    for (const colLetter of COL_LETTERS) {
      const raw = ws.getCell(`${colLetter}${rowNum}`).value;
      const str = cellText(raw);
      if (!str || str.trim() === '') continue;

      const paramKey = `row_${rowNum}_${colLetter}`;
      const placeholder = extractPlaceholder(str);

      if (placeholder) {
        placeholderCells.push({ paramKey, placeholder });
      } else {
        staticCells.push({ paramKey, param_value: str.trim() });
      }
    }
  }

  // Static layout rows → cn=NULL for every machine in the group
  for (const { paramKey, param_value } of staticCells) {
    for (const m of machineGroup) {
      await upsertParam(null, m.new, paramKey, param_value);
    }
  }

  // Placeholder cells → per-CN values from setup_parameter_value
  for (const { paramKey, placeholder } of placeholderCells) {
    for (const m of machineGroup) {
      const result = await engPool.query(
        `SELECT DISTINCT ON (ss.cn) ss.cn, COALESCE(v.param_value, '') AS param_value
         FROM sds_setup_sheet ss
         LEFT JOIN sds_setup_parameter_value v
           ON v.setup_sheet_id = ss.id AND v.param_key = $1
         WHERE ss.machine = $2
         ORDER BY ss.cn, ss.setup_data_sheet_rev DESC NULLS LAST`,
        [placeholder, m.old]
      );

      for (const row of result.rows) {
        if (!row.cn) continue;
        await upsertParam(itemNoToCN(row.cn), m.new, paramKey, row.param_value);
      }
    }
  }

  const cnCount = placeholderCells.length > 0
    ? (await engPool.query(
        `SELECT COUNT(DISTINCT cn) FROM ${TABLES.SDS_PARAMETER}
         WHERE cn IS NOT NULL AND machine_type_name = $1`,
        [machineGroup[0].new]
      )).rows[0].count
    : 0;

  console.log(
    `[${templateFile}] static=${staticCells.length} cells/machine,` +
    ` placeholders=${placeholderCells.length}, affected CNs≈${cnCount}`
  );
}

async function main() {
  console.log('=== SDS Grinding Params Migration ===');
  for (const group of MACHINE_GROUPS) {
    const filePath = path.join(TEMPLATES_DIR, group.file);
    if (!require('fs').existsSync(filePath)) {
      console.warn(`  SKIP (file not found): ${group.file}`);
      continue;
    }
    process.stdout.write(`Processing ${group.file}... `);
    await migrateTemplate(group.file, group.machines);
  }
  console.log('\nMigration complete.');
  await engPool.end();
}

main().catch(err => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
