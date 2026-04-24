const { TABLES } = require('../mtcConstants');

const PART_TYPE_MAP = {
  C31: { type: 'BALL',      table: TABLES.LPB_ENG_BALL },
  C32: { type: 'BALL',      table: TABLES.LPB_ENG_BALL },
  C33: { type: 'BALL',      table: TABLES.LPB_ENG_BALL },
  C34: { type: 'BALL',      table: TABLES.LPB_ENG_BALL },
  C35: { type: 'BALL',      table: TABLES.LPB_ENG_BALL },
  C37: { type: 'BALL',      table: TABLES.LPB_ENG_BALL },
  C38: { type: 'BALL',      table: TABLES.LPB_ENG_BALL },
  C39: { type: 'BALL',      table: TABLES.LPB_ENG_BALL },
  C21: { type: 'RACE',      table: TABLES.LPB_ENG_RACE },
  C22: { type: 'RACE',      table: TABLES.LPB_ENG_RACE },
  C23: { type: 'RACE',      table: TABLES.LPB_ENG_RACE },
  C24: { type: 'RACE',      table: TABLES.LPB_ENG_RACE },
  C25: { type: 'RACE',      table: TABLES.LPB_ENG_RACE },
  C26: { type: 'RACE',      table: TABLES.LPB_ENG_RACE },
  C27: { type: 'RACE',      table: TABLES.LPB_ENG_RACE },
  C28: { type: 'RACE',      table: TABLES.LPB_ENG_RACE },
  C29: { type: 'RACE',      table: TABLES.LPB_ENG_RACE },
  C11: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C12: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C13: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C14: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C15: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C16: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C17: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C18: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C19: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C51: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C52: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C53: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C54: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C55: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C56: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C57: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C58: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C59: { type: 'BODY',      table: TABLES.LPB_ENG_BODY },
  C61: { type: 'SLEEVE',    table: TABLES.LPB_ENG_SLEEVE },
  C62: { type: 'SLEEVE',    table: TABLES.LPB_ENG_SLEEVE },
  C63: { type: 'SLEEVE',    table: TABLES.LPB_ENG_SLEEVE },
  C64: { type: 'SLEEVE',    table: TABLES.LPB_ENG_SLEEVE },
  C69: { type: 'SLEEVE',    table: TABLES.LPB_ENG_SLEEVE },
  A41: { type: 'SPHERICAL', table: TABLES.LPB_ENG_SPH },
  A42: { type: 'SPHERICAL', table: TABLES.LPB_ENG_SPH },
  A43: { type: 'SPHERICAL', table: TABLES.LPB_ENG_SPH },
  A44: { type: 'SPHERICAL', table: TABLES.LPB_ENG_SPH },
  A48: { type: 'SPHERICAL', table: TABLES.LPB_ENG_SPH },
  A49: { type: 'SPHERICAL', table: TABLES.LPB_ENG_SPH },
};

function itemNoToCN(itemNo) {
  if (!/^\d{6}$/.test(itemNo)) return null;
  const classNum = itemNo.slice(0, 2);
  const seq = itemNo.slice(2);
  const prefix = classNum >= '41' && classNum <= '49' ? 'A' : 'C';
  return `${prefix}${classNum}-0${seq}`;
}

function sortBySeq(a, b) {
  const s1 = (parseInt(a.seq_no) || 0) - (parseInt(b.seq_no) || 0);
  if (s1 !== 0) return s1;
  return (parseInt(a.process_seqno) || 0) - (parseInt(b.process_seqno) || 0);
}

/**
 * @param {string} cn
 * @param {{ query: Function }} maqPool
 * @param {{ query: Function }} rodpcPool
 * @returns {Promise<object>}
 */
async function searchByCn(cn, maqPool, rodpcPool) {
  let cnUpper = cn.trim().toUpperCase();
  if (/^\d{6}$/.test(cnUpper)) {
    const converted = itemNoToCN(cnUpper);
    if (!converted) throw new Error(`Cannot convert item_no: ${cnUpper}`);
    cnUpper = converted;
  }

  const prefix = cnUpper.slice(0, 3);
  const partInfo = PART_TYPE_MAP[prefix];
  if (!partInfo) throw new Error(`Unknown CN prefix: ${prefix}`);

  const [partTypeResult, dimensionResult, toolingResult, itemResult, cadRevResult, processInfoLpbResult] = await Promise.all([
    maqPool.query(`SELECT class1, class1_name, sub_class, sub_class_name, t_parts_name AS part_type FROM ${TABLES.LPB_ENG_TEMP_PARTS} WHERE class1 = $1 LIMIT 1`, [prefix]),
    maqPool.query(`SELECT * FROM ${partInfo.table} WHERE control_no = $1`, [cnUpper]),
    maqPool.query(`
      SELECT t.process_plan_no, t.seq_no, t.rev, t.process_code, t.tool_dwg_no, t.update_date AS tool_update_date, tl.tool_name, t.process_seqno
      FROM ${TABLES.LPB_ENG_R_PI_TOOL} t
      LEFT JOIN ${TABLES.LPB_ENG_TOOLING} tl ON tl.tool_dwg_no = t.tool_dwg_no
      WHERE t.process_plan_no = $1 OR t.process_plan_no IN (SELECT process_plan_no FROM ${TABLES.LPB_ENG_R_PI_ITEM} WHERE control_no = $1)
    `, [cnUpper]),
    maqPool.query(`SELECT parts_no, gnk, remark FROM ${TABLES.LPB_ENG_ITEM} WHERE control_no = $1 LIMIT 1`, [cnUpper]),
    maqPool.query(`SELECT draw_rev_0 AS dwg_rev FROM ${TABLES.LPB_ENG_CAD_REV_DATA} WHERE drawing_no = $1 LIMIT 1`, [`${cnUpper}_1`]),
    maqPool.query(`
      SELECT seq_no, process_seqno, rev, process_code, wc, ct, st, batch_size
      FROM ${TABLES.LPB_ENG_PROCESS_INFO}
      WHERE process_plan_no = $1 OR process_plan_no IN (SELECT process_plan_no FROM ${TABLES.LPB_ENG_R_PI_ITEM} WHERE control_no = $1)
    `, [cnUpper]),
  ]);

  const itemData = itemResult.rows[0];

  const bomResult = await maqPool.query(
    `SELECT child_cn, child_pn FROM ${TABLES.LPB_ENG_BOM} WHERE parent_cn = $1 LIMIT 1`,
    [cnUpper]
  );
  const bomRow = bomResult.rows[0];

  let rawMaterial = null;
  if (bomRow?.child_cn) {
    const pmItemResult = await maqPool.query(
      `SELECT control_no, parts_no, parts_name, remark, gnk FROM ${TABLES.LPB_ENG_ITEM} WHERE control_no = $1`,
      [bomRow.child_cn]
    );
    rawMaterial = pmItemResult.rows[0] || null;
  }

  const uniqueProcessCodes = [...new Set([
    ...toolingResult.rows.map(r => r.process_code),
    ...processInfoLpbResult.rows.map(r => r.process_code),
  ])].filter(Boolean);

  const pmPartsNo = rawMaterial?.parts_no || bomRow?.child_pn;
  const purchaseCodePrefix = pmPartsNo ? pmPartsNo.slice(0, 4) : null;

  const [productionResult, processMasterResult, mcodeResult] = await Promise.all([
    rodpcPool.query(`SELECT control_no, model, customer, type, packing, approval_type, cust_dwg_no, cust_dwg_no_rev, sdwg_no, sdwg_no_rev, update_date FROM ${TABLES.RODPC_ENG_PRODUCTION} WHERE control_no = $1`, [cnUpper]),
    uniqueProcessCodes.length > 0
      ? rodpcPool.query(`SELECT process_code, process_name, process_eng FROM ${TABLES.RODPC_ENG_PROCESS} WHERE process_code = ANY($1)`, [uniqueProcessCodes])
      : Promise.resolve({ rows: [] }),
    purchaseCodePrefix
      ? maqPool.query(`SELECT mate_code, as400name, procument_spec, mate_name, mate_sprc FROM lpb.eng_mcode WHERE mate_class_code4 = $1 LIMIT 1`, [purchaseCodePrefix])
      : Promise.resolve({ rows: [] }),
  ]);

  const mcodeRow = mcodeResult.rows[0] || null;
  const finalMaterial = rawMaterial ? {
    material:       mcodeRow?.as400name || null,
    mate_code:      mcodeRow?.mate_code || null,
    procument_spec: mcodeRow?.procument_spec || null,
    raw_control_no: rawMaterial.control_no,
    raw_parts_no:   rawMaterial.parts_no,
  } : null;

  const processMap = processMasterResult.rows.reduce((acc, row) => {
    acc[row.process_code] = row;
    return acc;
  }, {});

  const mergedProcessPlan = toolingResult.rows.map(r => ({
    ...r,
    process_name: processMap[r.process_code]?.process_name || null,
    process_eng:  processMap[r.process_code]?.process_eng || null,
  })).sort(sortBySeq);

  const mergedProcessInfo = processInfoLpbResult.rows.map(r => ({
    ...r,
    process_name: processMap[r.process_code]?.process_name || null,
    process_eng:  processMap[r.process_code]?.process_eng || null,
  })).sort(sortBySeq);

  return {
    result: 'true',
    cn: cnUpper,
    item_no: cnUpper.slice(1, 3) + cnUpper.slice(-4),
    part_type: partInfo.type,
    part_info: partTypeResult.rows[0] || null,
    parts_no: itemData?.parts_no || null,
    dwg_rev: /^[A-Z]$/i.test(cadRevResult.rows[0]?.dwg_rev?.trim())
      ? cadRevResult.rows[0].dwg_rev.trim().toUpperCase() : 'NC',
    material: finalMaterial,
    dimension: dimensionResult.rows[0] || null,
    process_info: mergedProcessInfo,
    process_plan: mergedProcessPlan,
    production: productionResult.rows[0] || null,
  };
}

module.exports = { searchByCn, PART_TYPE_MAP, itemNoToCN };
