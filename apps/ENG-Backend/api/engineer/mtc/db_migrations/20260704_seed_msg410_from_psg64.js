/**
 * Onboard MSG-410 (floor code SGM-05, rodpc wc 32) into the SDS + Tooling-Select
 * system by cloning the PSG-64 surface-grinder template.
 *
 * WHY: MSG-410 exists in rodpc.m_machine (SGM-05 → m_model 'MSG-410', wc 32) and is
 * actively producing (process 1101 surface grind, 19 parts through 2026-07-02) but had
 * NO row in sds_machine_type_code, so it never resolved into the SDS/coverage system.
 * User asked to add it, copying the PSG-64 / GS-64PFII template. PSG-64 (type_code 547,
 * SDS id 86, T-Select machine_id 19) and GS-64PFII (762 / 298 / 49) carry byte-identical
 * SDS tool lists (process 1101+1102, T1–T6, 4547-01 jig family) and T-Select config
 * (5 formulas A=ID + Thai-collet B-gate, 5 rules, 0 limits, inventory tooling_psg64).
 * MSG-410 is the same wc-32 MSB surface grinder → mirror PSG-64 verbatim.
 *
 * Identity chain (no sds_machine_code override needed): SGM-05 → rodpc m_model 'MSG-410'
 * → sds_machine_type_code name 'MSG-410' → new type_code '410' (free; mnemonic of
 * MSG-410). Because rodpc m_model already equals the SDS name, buildMachineResolver
 * resolves it directly.
 *
 * WHAT IT WRITES (idempotent — safe to re-run; each block delete/upsert by MSG-410 key):
 *   1. sds_machine_type_code   — MSG-410 / '410' / 'SURFACE GRINDING AREA'  (upsert)
 *   2. sds_machine_tool        — copy PSG-64 rows (1101+1102, T1–T6) → MSG-410
 *   3. sds_parameter (cn NULL) — copy PSG-64's 179 machine-level params → MSG-410
 *   4. tooling_machine         — MSG-410 T-Select machine (inventory tooling_psg64)
 *   5. tooling_formula         — copy PSG-64 (machine_id 19) formulas → new machine_id
 *   6. tooling_search_rule     — copy PSG-64 rules → new machine_id
 *   7. clears sds_coverage_cache so the coverage report rebuilds
 *
 * CAVEATS (surfaced to the user):
 *  - The tool DWG numbers (4547-01 jig family) are COPIED from PSG-64. If MSG-410's real
 *    fixtures differ, update sds_machine_tool + the T-Select answer key. Because MSG-410
 *    is a tooling-optional (magnetic-chuck) machine, parts whose factory plan lists no
 *    tool are correctly classified "tooling not required" regardless.
 *  - Process 1102 tool rows are copied from the template though MSG-410 currently only
 *    produces 1101 (+ a little 1021); harmless (unused until it runs 1102).
 *  - Code change (separate): add 'MSG-410' to DEFAULT_REPORT_SCOPE.tooling_optional_machines
 *    in sdsV2ReportController.js so its no-tool sheets classify as optional, not NO_TOOL.
 *  - In-memory sds:/tselect: caches are NOT flushed by this script (server-side). After
 *    running, flush via DELETE /api/tooling-select/monitor/cache?prefix=sds: (and ?prefix=
 *    tooling:) or restart the backend.
 *
 * Reversible:
 *   DELETE FROM sds_machine_tool  WHERE machine_type='MSG-410';
 *   DELETE FROM sds_parameter     WHERE machine_type_name='MSG-410';
 *   DELETE FROM tooling_search_rule WHERE machine_id=(SELECT id FROM tooling_machine WHERE machine_name='MSG-410');
 *   DELETE FROM tooling_formula     WHERE machine_id=(SELECT id FROM tooling_machine WHERE machine_name='MSG-410');
 *   DELETE FROM tooling_machine   WHERE machine_name='MSG-410';
 *   DELETE FROM sds_machine_type_code WHERE machine_type_code='410';
 */
const { engPool } = require('../../../../instance/eng_db');

const NEW_NAME = 'MSG-410';
const NEW_CODE = '410';
const SRC_SDS_NAME = 'PSG-64';   // sds_machine_tool / sds_parameter source
const SRC_TS_MACHINE_ID = 19;    // tooling_machine.id for PSG-64 (formulas/rules source)

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // 1. sds_machine_type_code — upsert MSG-410 (mirror PSG-64's attributes)
    const typeRes = await client.query(
      `INSERT INTO sds_machine_type_code
         (machine_type_code, machine_type_name, grinding_area_label, is_active, machine_group, tool_code_filter, grid_template_id)
       SELECT $1, $2, grinding_area_label, true, machine_group, tool_code_filter, grid_template_id
         FROM sds_machine_type_code WHERE machine_type_name = $3 AND is_active = true
       ON CONFLICT (machine_type_code) DO UPDATE SET
         machine_type_name   = EXCLUDED.machine_type_name,
         grinding_area_label = EXCLUDED.grinding_area_label,
         is_active           = true,
         machine_group       = EXCLUDED.machine_group,
         tool_code_filter    = EXCLUDED.tool_code_filter
       RETURNING id`,
      [NEW_CODE, NEW_NAME, SRC_SDS_NAME]
    );
    const newTypeId = typeRes.rows[0].id;
    console.log(`[1] sds_machine_type_code: ${NEW_NAME}/${NEW_CODE} → id ${newTypeId}`);

    // 2. sds_machine_tool — copy PSG-64's tool list (process 1101+1102, T1–T6)
    await client.query(`DELETE FROM sds_machine_tool WHERE machine_type = $1`, [NEW_NAME]);
    const toolRes = await client.query(
      `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
       SELECT tool_number, process_code, $1, tool_drawing_no, $2
         FROM sds_machine_tool WHERE machine_type = $3
       ORDER BY process_code, tool_number`,
      [NEW_NAME, newTypeId, SRC_SDS_NAME]
    );
    console.log(`[2] sds_machine_tool: copied ${toolRes.rowCount} tool rows from ${SRC_SDS_NAME}`);

    // 3. sds_parameter — copy machine-level (cn NULL) params
    await client.query(`DELETE FROM sds_parameter WHERE machine_type_name = $1 AND cn IS NULL`, [NEW_NAME]);
    const paramRes = await client.query(
      `INSERT INTO sds_parameter
         (cn, machine_type_name, param_key, param_value, process_code, machine_type_id, created_by, created_at, updated_at)
       SELECT NULL, $1, param_key, param_value, process_code, $2, 'seed-msg410', NOW(), NOW()
         FROM sds_parameter WHERE machine_type_name = $3 AND cn IS NULL`,
      [NEW_NAME, newTypeId, SRC_SDS_NAME]
    );
    console.log(`[3] sds_parameter: copied ${paramRes.rowCount} machine-level params from ${SRC_SDS_NAME}`);

    // 4. tooling_machine — T-Select machine (reuse PSG-64 inventory table)
    let newMachineId;
    const existTm = await client.query(`SELECT id FROM tooling_machine WHERE machine_name = $1`, [NEW_NAME]);
    if (existTm.rows[0]) {
      newMachineId = existTm.rows[0].id;
      await client.query(
        `UPDATE tooling_machine SET label=$2, inventory_table=t.inventory_table,
           inventory_machine_filter=t.inventory_machine_filter, enabled=true, machine_group=t.machine_group,
           sds_machine_type_id=$3, updated_at=NOW()
         FROM (SELECT inventory_table, inventory_machine_filter, machine_group FROM tooling_machine WHERE id=$4) t
         WHERE tooling_machine.id=$1`,
        [newMachineId, NEW_NAME, newTypeId, SRC_TS_MACHINE_ID]
      );
    } else {
      const ins = await client.query(
        `INSERT INTO tooling_machine
           (machine_name, label, inventory_table, inventory_machine_filter, enabled, machine_group, sds_machine_type_id, created_at, updated_at)
         SELECT $1, $2, inventory_table, inventory_machine_filter, true, machine_group, $3, NOW(), NOW()
           FROM tooling_machine WHERE id = $4
         RETURNING id`,
        [NEW_NAME, NEW_NAME, newTypeId, SRC_TS_MACHINE_ID]
      );
      newMachineId = ins.rows[0].id;
    }
    console.log(`[4] tooling_machine: ${NEW_NAME} → machine_id ${newMachineId} (inventory tooling_psg64)`);

    // 5. tooling_formula — copy PSG-64 formulas
    await client.query(`DELETE FROM tooling_formula WHERE machine_id = $1`, [newMachineId]);
    const fRes = await client.query(
      `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order, description, condition_expr, created_at, updated_at)
       SELECT $1, tooling_name, output_key, formula_expr, sort_order, description, condition_expr, NOW(), NOW()
         FROM tooling_formula WHERE machine_id = $2`,
      [newMachineId, SRC_TS_MACHINE_ID]
    );
    console.log(`[5] tooling_formula: copied ${fRes.rowCount} formulas`);

    // 6. tooling_search_rule — copy PSG-64 rules
    await client.query(`DELETE FROM tooling_search_rule WHERE machine_id = $1`, [newMachineId]);
    const rRes = await client.query(
      `INSERT INTO tooling_search_rule
         (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, inventory_table_override, is_match_dim)
       SELECT $1, tooling_name, output_key, inventory_column, tol_plus, tol_minus, sort_priority, label, inventory_tooling_filter, inventory_table_override, is_match_dim
         FROM tooling_search_rule WHERE machine_id = $2`,
      [newMachineId, SRC_TS_MACHINE_ID]
    );
    console.log(`[6] tooling_search_rule: copied ${rRes.rowCount} rules`);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // 7. Bust the persisted coverage cache so the report rebuilds with MSG-410 in scope.
  await engPool.query(`DELETE FROM sds_coverage_cache WHERE id='coverage'`).catch(() => {});
  console.log('[7] cleared sds_coverage_cache (rebuild on next load).');
}

run()
  .then(() => { console.log('MSG-410 onboarding complete.'); process.exit(0); })
  .catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
