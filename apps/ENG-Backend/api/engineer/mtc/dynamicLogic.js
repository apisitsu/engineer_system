'use strict';
/**
 * Phase 2: Dynamic Rule Engine - Core Logic
 * 
 * รับ calc objects จาก fixtureLogic แล้วค้นหา Tooling ตามกฎในฐานข้อมูล
 * รองรับการ resolve nested calc keys เช่น "rollerShoe.A", "wd_A"
 */

const { engPool } = require('../../../instance/eng_db');

/**
 * Resolve ค่าจาก calc context โดยรองรับ nested key เช่น "rollerShoe.A"
 * @param {Object} calcObj - calc object สำหรับเครื่องจักรนั้น
 * @param {string} calcKey - key ที่ต้องการ เช่น "wd_A" หรือ "rollerShoe.A"
 * @returns {number|null}
 */
function resolveCalcKey(calcObj, calcKey) {
  if (!calcObj || !calcKey) return null;
  const parts = calcKey.split('.');
  let val = calcObj;
  for (const p of parts) {
    if (val === null || val === undefined) return null;
    val = val[p];
  }
  return (val !== undefined && val !== null && !isNaN(parseFloat(val))) ? parseFloat(val) : null;
}

/**
 * ค้นหา Tooling ตามกฎ Dynamic Rules สำหรับเครื่องจักรที่กำหนด
 * @param {Object} partData - ข้อมูล Spec ของ Part
 * @param {Object} allCalcs - object รวม calc ทุกเครื่อง เช่น { ks400b: ks400b_calc, ks03a: ks03a_calc, ... }
 * @param {Object} okFlags  - object ของ flag ว่าเครื่องไหน OK เช่น { ks400bOK: true, ks03aOK: false }
 */
async function findDynamicFixtures(partData, allCalcs = {}, okFlags = {}) {
  try {
    const rulesRes = await engPool.query(
      'SELECT * FROM mtc_selection_rules WHERE is_active = true ORDER BY machine_name, tool_category, id'
    );
    const rules = rulesRes.rows;
    if (rules.length === 0) return [];

    // จัดกลุ่มกฎตาม machine + category
    const machineGroups = {};
    for (const rule of rules) {
      if (!machineGroups[rule.machine_name]) {
        machineGroups[rule.machine_name] = {
          name: rule.machine_name,
          calc_context: rule.calc_context,
          machine_ok_condition: rule.machine_ok_condition,
          tools: {}
        };
      }
      if (!machineGroups[rule.machine_name].tools[rule.tool_category]) {
        machineGroups[rule.machine_name].tools[rule.tool_category] = {
          category: rule.tool_category,
          table: rule.target_tool_table,
          result_fields: rule.result_fields || [],
          dims: rule.dims || [],
          // legacy fields (old schema compatibility)
          legacyRules: []
        };
      }

      // รองรับทั้ง schema เก่า (dims in row) และใหม่ (dims in JSONB column)
      if (!rule.dims || rule.dims.length === 0) {
        machineGroups[rule.machine_name].tools[rule.tool_category].legacyRules.push(rule);
      }
    }

    const finalResults = [];

    for (const mName of Object.keys(machineGroups)) {
      const mGroup = machineGroups[mName];
      const calcContext = mGroup.calc_context; // เช่น 'ks400b'
      const calcObj = calcContext ? allCalcs[calcContext] : null;

      // ตรวจสอบว่าเครื่องนี้ OK ไหม
      const okCondition = mGroup.machine_ok_condition;
      if (okCondition && okFlags[okCondition] === false) continue;
      if (calcObj && calcObj.error) continue;

      const dynamicContent = [];
      let totalFoundInMachine = 0;
      const totalRequiredInMachine = Object.keys(mGroup.tools).length;

      for (const catName of Object.keys(mGroup.tools)) {
        const toolSpec = mGroup.tools[catName];
        const dims = toolSpec.dims;
        const legacyRules = toolSpec.legacyRules;

        let sql = `SELECT * FROM ${toolSpec.table} WHERE tooling_name ILIKE $1`;
        const params = [`%${catName}%`];
        const targets = [];
        const headers = [];
        const columns = [];
        let diffCalc = null;  // function to compute diff per row

        if (dims && dims.length > 0 && calcObj) {
          // === New-style JSONB dims ===
          const dimConditions = [];
          dims.forEach((dim, idx) => {
            const targetVal = resolveCalcKey(calcObj, dim.calc_key);
            if (targetVal === null) return;
            const tPlus  = parseFloat(dim.tol_plus  || 99);
            const tMinus = parseFloat(dim.tol_minus || 99);
            const pIdx = params.length;
            dimConditions.push(`${dim.tool_field} BETWEEN $${pIdx + 1} AND $${pIdx + 2}`);
            params.push(targetVal - tMinus, targetVal + tPlus);
            targets.push(targetVal.toFixed(3));
            headers.push(dim.label || dim.tool_field.replace('dim_', 'Dim ').toUpperCase());
            columns.push(dim.tool_field);
          });
          if (dimConditions.length > 0) {
            sql += ' AND ' + dimConditions.join(' AND ');
          }

          // สร้าง diff function จาก dims
          diffCalc = (row) => {
            let totalDiff = 0;
            dims.forEach(dim => {
              const targetVal = resolveCalcKey(calcObj, dim.calc_key);
              if (targetVal === null) return;
              const rowVal = parseFloat(row[dim.tool_field]);
              if (isNaN(rowVal)) { totalDiff += 100; return; }
              const diff = Math.abs(rowVal - targetVal);
              const penalty = (dim.penalty_over && diff > parseFloat(dim.penalty_over)) ? 10000 : 0;
              totalDiff += diff * (dim.sort_priority || 1) + penalty;
            });
            return totalDiff;
          };

        } else if (legacyRules.length > 0) {
          // === Legacy schema (source_field + offset) ===
          const legacyConditions = [];
          legacyRules.forEach((rule, idx) => {
            let calcVal = parseFloat(partData[rule.source_field]) || 0;
            const offset = parseFloat(rule.offset_value) || 0;
            if (rule.operator === '+') calcVal += offset;
            else if (rule.operator === '-') calcVal -= offset;
            else if (rule.operator === '*') calcVal *= offset;
            else if (rule.operator === '/' && offset !== 0) calcVal /= offset;

            const min = calcVal - (parseFloat(rule.tolerance_minus) || 0);
            const max = calcVal + (parseFloat(rule.tolerance_plus) || 0);
            const pIdx = params.length;
            legacyConditions.push(`${rule.target_tool_field} BETWEEN $${pIdx + 1} AND $${pIdx + 2}`);
            params.push(min, max);
            targets.push(calcVal.toFixed(3));
            headers.push(rule.rule_name || rule.target_tool_field);
            columns.push(rule.target_tool_field);
          });
          if (legacyConditions.length > 0) {
            sql += ' AND ' + legacyConditions.join(' AND ');
          }
          diffCalc = (row) => columns.reduce((sum, col) => {
            const v = parseFloat(row[col]);
            return sum + (isNaN(v) ? 100 : Math.abs(v - parseFloat(targets[columns.indexOf(col)])));
          }, 0);
        }

        const toolRes = await engPool.query(sql, params);
        const resultCols = toolSpec.result_fields && toolSpec.result_fields.length > 0
          ? toolSpec.result_fields
          : columns.map((c, i) => ({ tool_field: c, label: headers[i] || c }));

        const foundTools = toolRes.rows
          .map(row => {
            const mapped = {
              no:      row.tooling_no || row.id,
              machine: row.machine || mName,
              _diff:   diffCalc ? diffCalc(row) : 0
            };
            resultCols.forEach((rf, i) => {
              mapped[`val${i + 1}`] = row[rf.tool_field ?? rf];
            });
            return mapped;
          })
          .sort((a, b) => a._diff - b._diff)
          .slice(0, 3);  // Top 3

        if (foundTools.length > 0) totalFoundInMachine++;

        dynamicContent.push({
          title:      catName,
          dataSource: foundTools,
          columns:    resultCols.map((_, i) => `val${i + 1}`),
          headers:    resultCols.map(rf => rf.label || rf),
          targets,
          iconType: 'dynamic'
        });
      }

      finalResults.push({
        name:          mName,
        group:         'DYNAMIC',
        hasData:       true,
        dynamicContent,
        requiredCount: totalRequiredInMachine,
        foundCount:    totalFoundInMachine,
        isIncomplete:  totalFoundInMachine < totalRequiredInMachine
      });
    }

    return finalResults;

  } catch (err) {
    console.error('Error in findDynamicFixtures:', err);
    return [];
  }
}

module.exports = { findDynamicFixtures };
