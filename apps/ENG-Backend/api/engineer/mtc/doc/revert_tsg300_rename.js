'use strict';

/**
 * revert_tsg300_rename.js
 *
 * Reverts the rename done by fix_tsg300_sds.js:
 *   TSG-300W  → TSG-300  (id=95,  code=556)
 *   TSG-300ZNC → TSG-300  (id=370, code=866)
 *
 * The revert CANNOT perfectly restore the original split of sds_parameter rows between
 * TSG-300W and TSG-300ZNC (1299 rows that conflicted were deleted). Instead, all current
 * 'TSG-300' sds_parameter rows are consolidated under 'TSG-300ZNC' (the group representative,
 * because machine_type_code='866' > '556' → last-wins in groupToRep).
 *
 * SDS page behaviour after revert:
 *   - groupToRep['TSG-300W/TSG-300ZNC'] = 'TSG-300ZNC'  (last-wins, code 866 > 556)
 *   - resolveMachine('TSG-300W/TSG-300ZNC') = 'TSG-300ZNC'
 *   - Both CARRIER and CHUTE COVER tools are assigned to 'TSG-300ZNC' section via
 *     sds_machine_tool T2='4556-01' / T1='4866-14' + eligibleOnes priority
 *   - Section shows as 'TSG-300ZNC' with T-Select data from 'TSG-300W/TSG-300ZNC' group ✓
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/doc/revert_tsg300_rename.js
 */

const { engPool } = require('../../../../instance/eng_db');

async function main() {
  console.log('=== Revert TSG-300 rename → restore TSG-300W / TSG-300ZNC ===\n');

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    // Verify current state (both should be 'TSG-300')
    const cur = await client.query(
      `SELECT id, machine_type_code, machine_type_name, machine_group
       FROM sds_machine_type_code WHERE id IN (95, 370) ORDER BY id`
    );
    console.log('Current sds_machine_type_code:');
    cur.rows.forEach(r =>
      console.log(`  id=${r.id}, code=${r.machine_type_code}, name='${r.machine_type_name}', group='${r.machine_group}'`)
    );

    const names = cur.rows.map(r => r.machine_type_name);
    if (names.some(n => n !== 'TSG-300')) {
      throw new Error(`Expected both to be 'TSG-300', got: ${names.join(', ')} — already reverted?`);
    }

    // Step 1: Consolidate sds_parameter from 'TSG-300' → 'TSG-300ZNC'
    // (safe: no 'TSG-300ZNC' rows exist yet, no conflict possible)
    const p = await client.query(
      `UPDATE sds_parameter SET machine_type_name='TSG-300ZNC' WHERE machine_type_name='TSG-300'`
    );
    console.log(`\nsds_parameter 'TSG-300' → 'TSG-300ZNC': ${p.rowCount} rows`);

    // Step 2: sds_machine_tool 'TSG-300' → 'TSG-300ZNC'
    const mt = await client.query(
      `UPDATE sds_machine_tool SET machine_type='TSG-300ZNC' WHERE machine_type='TSG-300'`
    );
    console.log(`sds_machine_tool 'TSG-300' → 'TSG-300ZNC': ${mt.rowCount} rows`);

    // Step 3: sds_excel_mapping 'TSG-300' → 'TSG-300ZNC'
    const em = await client.query(
      `UPDATE sds_excel_mapping SET machine_type_name='TSG-300ZNC' WHERE machine_type_name='TSG-300'`
    );
    console.log(`sds_excel_mapping 'TSG-300' → 'TSG-300ZNC': ${em.rowCount} rows`);

    // Step 4: Rename sds_machine_type_code id=370 → 'TSG-300ZNC'
    await client.query(
      `UPDATE sds_machine_type_code SET machine_type_name='TSG-300ZNC' WHERE id=370`
    );
    console.log(`sds_machine_type_code id=370: 'TSG-300' → 'TSG-300ZNC'`);

    // Step 5: Rename sds_machine_type_code id=95 → 'TSG-300W'
    // (no sds_parameter cascade needed — all rows already moved to TSG-300ZNC)
    await client.query(
      `UPDATE sds_machine_type_code SET machine_type_name='TSG-300W' WHERE id=95`
    );
    console.log(`sds_machine_type_code id=95: 'TSG-300' → 'TSG-300W'`);

    await client.query('COMMIT');
    console.log('\n✓ Committed.');

    // Verify final state
    const final = await client.query(
      `SELECT id, machine_type_code, machine_type_name, machine_group, is_active
       FROM sds_machine_type_code WHERE id IN (95, 370) ORDER BY id`
    );
    console.log('\nFinal sds_machine_type_code:');
    final.rows.forEach(r =>
      console.log(`  id=${r.id}, code=${r.machine_type_code}, name='${r.machine_type_name}', group='${r.machine_group}', active=${r.is_active}`)
    );

    const finalTools = await client.query(
      `SELECT machine_type, process_code, tool_number, tool_drawing_no
       FROM sds_machine_tool WHERE machine_type IN ('TSG-300W', 'TSG-300ZNC') ORDER BY process_code, tool_number`
    );
    console.log('\nFinal sds_machine_tool:');
    finalTools.rows.forEach(r =>
      console.log(`  ${r.machine_type} / ${r.process_code} / T${r.tool_number} = ${r.tool_drawing_no}`)
    );

    const paramCount = await client.query(
      `SELECT machine_type_name, COUNT(*) FROM sds_parameter
       WHERE machine_type_name IN ('TSG-300W', 'TSG-300ZNC', 'TSG-300')
       GROUP BY machine_type_name`
    );
    console.log('\nsds_parameter counts:');
    paramCount.rows.forEach(r => console.log(`  '${r.machine_type_name}': ${r.count} rows`));

    console.log('\nFlush cache: restart backend or DELETE /api/tooling-select/monitor/cache?prefix=sds:');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Revert failed:', err.message);
    throw err;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
