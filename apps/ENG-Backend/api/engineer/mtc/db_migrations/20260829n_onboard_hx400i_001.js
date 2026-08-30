'use strict';

/**
 * Onboard SDS machine-type code 001 as "HX400iα" — closes a second of the 9 TEMPLATE_B
 * `none` pairs (DRILL INSPECT HOLE @ process 0331). Owner-confirmed 2026-08-29.
 * ============================================================================
 * Evidence:
 *   • 20260202 index: family 4001 → machine "HX400iα" (a Mazak horizontal machining
 *     centre — the factory's own spelling, α = U+03B1, kept verbatim like `LB15` /
 *     `測定用治具全般` are kept as the registry spells them).
 *   • TEMPLATE_B sheet F-BODY, process 0331 DRILL INSPECT HOLE: two tool rows, BASE PLATE
 *     and PLATE, both drawing family 4001-01, both white (= selected).
 *   • lpb.eng_r_pi_tool: 4001-01 planned on 138 C/N at 0331 (275 rows, 12 distinct
 *     drawings) — and 4001-01 is the ONLY family the plan uses there.
 *
 * Whitelist = the single family {4001-01} (TEMPLATE_B families ∪ planned families both
 * reduce to it). The 12 distinct 4001-01 drawings a C/N may carry all pass this family
 * filter and are slotted by `(canon name, DWG family)` — no planned tool is hidden.
 *
 * Direct UPDATE is safe: code 001 has 0 dependent sds_parameter / sds_machine_tool /
 * sds_excel_mapping rows (its name has always been NULL). Idempotent; `--revert` restores
 * NULL / is_active=false and drops the slot.
 *
 * NOTE: in-process `sds:` cache (10-min TTL) is not flushed by a direct DB write.
 *
 *   node api/engineer/mtc/db_migrations/20260829n_onboard_hx400i_001.js [--dry-run|--revert]
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const CODE = '001';
const NAME = 'HX400iα';
const SLOTS = [
  ['T1', '0331', '4001-01'], // BASE PLATE / PLATE (one family)
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query(
      `SELECT id, machine_type_name FROM sds_machine_type_code WHERE machine_type_code = $1`, [CODE])).rows[0];
    if (!row) throw new Error(`sds_machine_type_code ${CODE} not found`);
    const mid = row.id;

    if (revert) {
      await client.query(
        `DELETE FROM sds_machine_tool WHERE machine_type = $1 AND process_code = ANY($2)`,
        [NAME, [...new Set(SLOTS.map((s) => s[1]))]]);
      await client.query(
        `UPDATE sds_machine_type_code SET machine_type_name = NULL, is_active = false
          WHERE machine_type_code = $1 AND machine_type_name = $2`, [CODE, NAME]);
      console.log(`[hx400i] reverted: name → NULL, is_active → false, slot removed`);
    } else {
      const u = await client.query(
        `UPDATE sds_machine_type_code SET machine_type_name = $2, is_active = true
          WHERE machine_type_code = $1 AND (machine_type_name IS NULL OR machine_type_name = $2)`, [CODE, NAME]);
      console.log(`[hx400i] code ${CODE} (id ${mid}) → '${NAME}', is_active=true  (${u.rowCount} row)`);
      for (const [tn, pc, dwg] of SLOTS) {
        await client.query(
          `INSERT INTO sds_machine_tool (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tool_number, process_code, machine_type) DO UPDATE
             SET tool_drawing_no = EXCLUDED.tool_drawing_no, machine_type_id = EXCLUDED.machine_type_id`,
          [tn, pc, NAME, dwg, mid]);
        console.log(`[hx400i]   ${tn} ${pc} ${dwg}`);
      }
    }

    if (dryRun) { console.log('[hx400i] --dry-run — ROLLBACK'); await client.query('ROLLBACK'); return; }
    await client.query('COMMIT');
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
    console.log('[hx400i] done');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[hx400i] FAILED:', e.message); process.exit(1); });
