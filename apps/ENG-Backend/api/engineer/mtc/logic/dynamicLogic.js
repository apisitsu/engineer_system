'use strict';

const { engPool } = require('../../../../instance/eng_db');

/**
 * ดึงกฎทั้งหมดจาก Database และประมวลผลเพื่อค้นหา Tooling
 * @param {Object} part ข้อมูล Spec ของ Part (C/N)
 * @returns {Array} รายการเครื่องจักรและ Tooling ที่พบจาก Dynamic Rules
 */
async function findDynamicFixtures(part) {
    try {
        // 1. ดึงกฎที่ Active ทั้งหมด
        const rulesRes = await engPool.query('SELECT * FROM mtc_selection_rules WHERE is_active = true');
        const rules = rulesRes.rows;
        if (rules.length === 0) return [];

        // กลุ่มกฎตาม Machine และ Category
        const machineGroups = {};
        rules.forEach(rule => {
            if (!machineGroups[rule.machine_name]) machineGroups[rule.machine_name] = { name: rule.machine_name, tools: {} };
            if (!machineGroups[rule.machine_name].tools[rule.tool_category]) {
                machineGroups[rule.machine_name].tools[rule.tool_category] = {
                    category: rule.tool_category,
                    table: rule.target_tool_table,
                    rules: []
                };
            }
            machineGroups[rule.machine_name].tools[rule.tool_category].rules.push(rule);
        });

        const finalResults = [];

        // 2. ประมวลผลแต่ละกลุ่มเครื่องจักร
        for (const mName in machineGroups) {
            const mGroup = machineGroups[mName];
            const dynamicContent = [];
            let totalFoundInMachine = 0;
            let totalRequiredInMachine = Object.keys(mGroup.tools).length;

            for (const catName in mGroup.tools) {
                const toolSpec = mGroup.tools[catName];
                
                // สร้างคำสั่ง SQL สำหรับค้นหา Tool
                let sql = `SELECT * FROM ${toolSpec.table} WHERE 1=1`;
                const params = [];
                const conditions = [];
                const targets = [];
                const headers = [];
                const columns = [];

                toolSpec.rules.forEach((rule, idx) => {
                    // คำนวณค่า Target
                    let calculatedVal = parseFloat(part[rule.source_field]) || 0;
                    const offset = parseFloat(rule.offset_value) || 0;
                    
                    if (rule.operator === '+') calculatedVal += offset;
                    else if (rule.operator === '-') calculatedVal -= offset;
                    else if (rule.operator === '*') calculatedVal *= offset;
                    else if (rule.operator === '/' && offset !== 0) calculatedVal /= offset;

                    const min = calculatedVal - (parseFloat(rule.tolerance_minus) || 0);
                    const max = calculatedVal + (parseFloat(rule.tolerance_plus) || 0);

                    conditions.push(`${rule.target_tool_field} BETWEEN $${idx * 2 + 1} AND $${idx * 2 + 2}`);
                    params.push(min, max);
                    
                    targets.push(calculatedVal.toFixed(3));
                    headers.push(rule.rule_name || rule.target_tool_field);
                    columns.push(rule.target_tool_field);
                });

                if (conditions.length > 0) {
                    sql += " AND " + conditions.join(" AND ");
                }

                const toolRes = await engPool.query(sql, params);
                const foundTools = toolRes.rows.map(row => {
                    const mapped = { no: row.tooling_no || row.id, machine: row.machine || mName };
                    columns.forEach((col, i) => {
                        mapped[`val${i+1}`] = row[col];
                    });
                    return mapped;
                });

                if (foundTools.length > 0) totalFoundInMachine++;

                dynamicContent.push({
                    title: catName,
                    dataSource: foundTools,
                    columns: columns.map((_, i) => `val${i+1}`),
                    headers: headers,
                    targets: targets,
                    iconType: 'dynamic'
                });
            }

            finalResults.push({
                name: mName,
                group: 'DYNAMIC',
                hasData: true,
                dynamicContent: dynamicContent,
                requiredCount: totalRequiredInMachine,
                foundCount: totalFoundInMachine,
                isIncomplete: totalFoundInMachine < totalRequiredInMachine
            });
        }

        return finalResults;

    } catch (err) {
        console.error("Error in findDynamicFixtures:", err);
        return [];
    }
}

module.exports = { findDynamicFixtures };
