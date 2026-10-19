'use strict';

/**
 * Seed `pbring_machine_tool` from the existing `pbring_sds_condition` data —
 * one row per (machine_type_name, process_code, tool_number), family = the
 * MOST COMMON DWG family that tool_number has carried across every CN on
 * file for that machine+process. Ties broken alphabetically for determinism.
 *
 * Scope: numbered slots only (tool_number matches ^T\d+$) — GW/RW and the
 * Turning-only named slots (F_DW/Upper_GW/Lower_GW/R_DW/Left_GW/Right_GW)
 * are condition-list data, not swappable fixtures (same reasoning
 * CONDITION_SOURCED_TOOL_NUMBERS already uses in pbringGridService.js), so
 * they are intentionally left out of this whitelist and keep coming from
 * pbring_sds_condition exactly as before.
 *
 * Family derivation mirrors `toolingFamily()` in pbringGridService.js (first
 * two dash-segments; the whole string when there's only one dash) — not
 * replicated by requiring that file (migrations stay dependency-free of the
 * service layer by convention), just the same small, stable rule.
 *
 * Idempotent: delete-then-reinsert, so re-running after the condition table
 * changes recomputes the whitelist from scratch rather than leaving stale
 * rows. `--revert` deletes every row this migration would seed (not a
 * blanket truncate, in case an admin hand-adds a row later through the
 * table directly).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const SOURCE = 'seed:pbring_sds_condition-mode-20261019';

function toolingFamily(toolingNo) {
  const s = String(toolingNo || '').trim();
  const parts = s.split('-');
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : s;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    const { rowCount } = await engPool.query(
      `DELETE FROM pbring_machine_tool WHERE created_by = $1`, [SOURCE]
    );
    console.log(`reverted: ${rowCount} row(s) deleted`);
    await recordRevert({ file: __filename });
    return;
  }

  const { rows } = await engPool.query(
    `SELECT mc_key, process_code, tool_number, tooling_no FROM pbring_sds_condition
      WHERE tool_number ~ '^T[0-9]+$' AND tooling_no IS NOT NULL AND trim(tooling_no) <> ''`
  );
  console.log(`source rows: ${rows.length}`);

  // key = mc_key||process_code||tool_number -> Map<family, count>
  const groups = new Map();
  for (const r of rows) {
    const family = toolingFamily(r.tooling_no);
    if (!family) continue;
    const key = `${r.mc_key}\u0001${r.process_code}\u0001${r.tool_number}`;
    if (!groups.has(key)) groups.set(key, new Map());
    const famCounts = groups.get(key);
    famCounts.set(family, (famCounts.get(family) || 0) + 1);
  }

  const seedRows = [];
  for (const [key, famCounts] of groups) {
    const [mc_key, process_code, tool_number] = key.split('\u0001');
    let bestFamily = null, bestCount = -1;
    for (const [family, count] of [...famCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (count > bestCount) { bestCount = count; bestFamily = family; }
    }
    seedRows.push([mc_key, process_code, tool_number, bestFamily]);
  }
  console.log(`distinct (machine, process, tool_number) combos: ${seedRows.length}`);

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM pbring_machine_tool WHERE created_by = $1`, [SOURCE]);
    const COLS = 5;
    const CHUNK = 2000;
    let inserted = 0;
    for (let i = 0; i < seedRows.length; i += CHUNK) {
      const chunk = seedRows.slice(i, i + CHUNK);
      const placeholders = chunk.map((_, ri) =>
        `($${ri * COLS + 1}, $${ri * COLS + 2}, $${ri * COLS + 3}, $${ri * COLS + 4}, $${ri * COLS + 5})`
      ).join(',');
      const params = chunk.flatMap((r) => [...r, SOURCE]);
      await client.query(
        `INSERT INTO pbring_machine_tool (machine_type_name, process_code, tool_number, family, created_by)
         VALUES ${placeholders}
         ON CONFLICT (machine_type_name, process_code, tool_number) DO UPDATE SET
           family = EXCLUDED.family, updated_by = EXCLUDED.created_by, updated_at = NOW()`,
        params
      );
      inserted += chunk.length;
    }
    await client.query('COMMIT');
    console.log(`seeded: ${inserted} row(s)`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261019d_pbring_seed_machine_tool_whitelist.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
