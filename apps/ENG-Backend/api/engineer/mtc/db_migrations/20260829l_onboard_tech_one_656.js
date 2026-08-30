'use strict';

/**
 * Onboard SDS machine-type code 656 as "TECH ONE" — closes one of the 9 TEMPLATE_B
 * `none` pairs (SUPER FINISH @ process 1081).
 * ============================================================================
 * Evidence (both cited sources agree, and the factory plan confirms):
 *   • TEMPLATE_B  sheet RACE2, process 1081 SUPER FINISH: machine column = "TECH ONE",
 *     tools CHUCK JAW 4656-06 and QUILL 4656-10.
 *   • 20260202 index: family 4656 → 治具選定=1, machine "SUPER FINISH".
 *   • lpb.eng_r_pi_tool: 4656-06 planned on 34 C/N, 4656-10 on 4 C/N — BOTH only ever at
 *     process 1081. 4656 is a full auto load/unload super-finish station family
 *     (供給ハンド / 除材ハンド / チャック / QUILL / 砥石成形).
 *
 * Why a direct UPDATE and not PUT /api/sds/v2/admin/machine-types/:id (the usual cascade
 * path): code 656 has NEVER been usable — 0 rows in sds_parameter / sds_machine_tool /
 * sds_excel_mapping reference it — so there is nothing for the rename to cascade. The
 * 1,299-row incident was renaming an ACTIVE machine with dependent rows; this is naming a
 * dead placeholder.
 *
 * NOT onboarded here (the other 4 unnamed codes) — see the parity roadmap "Layer 6":
 *   001 HX400iα  — family 4001-01 is a per-C/N base-plate sprawl across 13 processes, not a
 *                  T-slot whitelist; needs the cn-map treatment.
 *   571 / 577 / 713 — no usable machine name in either source (process-named / ambiguous /
 *                  absent).
 *
 * Slot order follows TEMPLATE_B RACE2: T1 = 4656-06 CHUCK JAW, T2 = 4656-10 QUILL.
 * tool_drawing_no is the 2-segment family, matching every existing sds_machine_tool row.
 * Idempotent. `--revert` restores 'no data' / is_active=false and drops the two slots.
 *
 * NOTE: the in-process `sds:` search cache (10-min TTL) is not flushed by a direct DB
 * write — a new sheet for TECH ONE/1081 appears on the next TTL turn or a server restart.
 * templateBConformance re-reads on `?refresh=1`.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260829l_onboard_tech_one_656.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260829l_onboard_tech_one_656.js
 *   node api/engineer/mtc/db_migrations/20260829l_onboard_tech_one_656.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const CODE = '656';
const NAME = 'TECH ONE';
const SLOTS = [
  ['T1', '1081', '4656-06'], // CHUCK JAW
  ['T2', '1081', '4656-10'], // QUILL
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query(
      `SELECT id, machine_type_name, is_active FROM sds_machine_type_code WHERE machine_type_code = $1`,
      [CODE])).rows[0];
    if (!row) throw new Error(`sds_machine_type_code ${CODE} not found`);
    const mid = row.id;

    if (revert) {
      await client.query(
        `DELETE FROM sds_machine_tool WHERE machine_type = $1 AND process_code = ANY($2)`,
        [NAME, [...new Set(SLOTS.map((s) => s[1]))]]);
      await client.query(
        `UPDATE sds_machine_type_code SET machine_type_name = 'no data', is_active = false
          WHERE machine_type_code = $1 AND machine_type_name = $2`, [CODE, NAME]);
      console.log(`[techone] reverted: name → 'no data', is_active → false, slots removed`);
    } else {
      const u = await client.query(
        `UPDATE sds_machine_type_code SET machine_type_name = $2, is_active = true
          WHERE machine_type_code = $1 AND machine_type_name IN ('no data', $2)`, [CODE, NAME]);
      console.log(`[techone] code ${CODE} (id ${mid}) → '${NAME}', is_active=true  (${u.rowCount} row)`);
      for (const [tn, pc, dwg] of SLOTS) {
        await client.query(
          `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tool_number, process_code, machine_type) DO UPDATE
             SET tool_drawing_no = EXCLUDED.tool_drawing_no, machine_type_id = EXCLUDED.machine_type_id`,
          [tn, pc, NAME, dwg, mid]);
        console.log(`[techone]   ${tn} ${pc} ${dwg}`);
      }
    }

    if (dryRun) { console.log('[techone] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[techone] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[techone] FAILED:', e.message); process.exit(1); });
