'use strict';

/**
 * Phase B/C follow-up — two safe, evidence-backed config corrections.
 * ------------------------------------------------------------------------------
 * From `api/engineer/mtc/doc/formula_vs_workbook.md` + `api/engineer/mtc/doc/tooling_calc_blocks/phase_c.md`:
 *
 * 1. LB15 ARBOR / COLLAR / NUT — `A = ID - 0.3` → `A = ID - 0.2`
 *    The 球削アーバー workbook (`20201019_球削アーバー(4649-05)`, `Sheet1.pdf`) is a per-P/N
 *    list with **no calculation block**; the `A = ID - 0.3` was flagged INFERRED in its own
 *    `description`. The two 適用型式 rows that resolve to a spec put the arbor diameter `D3`
 *    at **ID - 0.2**, not -0.3. `A` is a match dim with a ±1.0 window, so a 0.1 shift is well
 *    inside tolerance — this replaces a guess with a slightly better-evidenced guess, no risk
 *    of a selection swing. (LB15 is still a weak config alongside KS-400B6 4931 — recorded.)
 *
 * 2. `tooling_machine_limit` — add an honest `description` to the four rows that have NULL:
 *    KS-500RD ID/OD, KVD-300CRII OD/W. Their bounds were set during config and no source was
 *    recorded (audit G-4). This does not change any bound — it just stops the provenance gap
 *    from being silent. KVD-300CRII OD (`9.5-46`) also carries the note that TEMPLATE_B says
 *    `MAX OD Φ25` (audit K-1) — a real open question, left for the owner to resolve.
 *
 * NOT in this migration — needs a proper seed migration / analysis, deliberately not rushed:
 *   - KS-H70 4907 LOADER: `tooling_ksh70` carries ZERO dims for family 4907 (every dim_a = '0'),
 *     so a ball-dia band rule cannot be wired until the shelf is populated from the band-table
 *     PDFs (`4907-0[1356]_*.pdf`). That is a data-entry seed migration.
 *   - KS-400B6 4931 溝研, KN-312 4832/4837 溝研: need `lpb.eng_r_pi_tool` analysis for a cn-map.
 *   - MSB grinders 4547: need the workbook calc block located first.
 *
 * Idempotent; `--revert` restores the prior formula and NULLs the descriptions.
 *
 * Run from apps/ENG-Backend/:
 *   node api/engineer/mtc/db_migrations/20260828e_phaseb_c_config_nits.js --dry-run
 *   node api/engineer/mtc/db_migrations/20260828e_phaseb_c_config_nits.js
 *   node api/engineer/mtc/db_migrations/20260828e_phaseb_c_config_nits.js --revert
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const LB15_OLD = 'ID - 0.3';
const LB15_NEW = 'ID - 0.2';

// (machine, input_var) → description to set (forward). Revert sets NULL.
const LIMIT_DESC = [
  ['KS-500RD', 'ID', 'Provenance not recorded — bound set during config, source unknown (audit G-4). ID 14–38.125.'],
  ['KS-500RD', 'OD', 'Provenance not recorded — bound set during config, source unknown (audit G-4). OD 26–59.531.'],
  ['KVD-300CRII', 'OD', 'Provenance not recorded (audit K-1). Config OD 9.5–46; TEMPLATE_B states MAX OD φ25 — open question, owner to resolve.'],
  ['KVD-300CRII', 'W', 'Provenance not recorded (audit K-1). W 6–29.'],
];

async function main() {
  if (await guard({ file: __filename, revert })) return;
  const client = await engPool.connect();
  try {
    const lb15From = revert ? LB15_NEW : LB15_OLD;
    const lb15To   = revert ? LB15_OLD : LB15_NEW;

    // ── report ──
    const { rows: lb } = await client.query(
      `SELECT f.id, f.tooling_name, f.output_key, f.formula_expr
         FROM tooling_formula f JOIN tooling_machine tm ON tm.id = f.machine_id
        WHERE tm.machine_name = 'LB15' AND f.output_key = 'A'
          AND f.tooling_name IN ('ARBOR', 'COLLAR', 'NUT')
        ORDER BY f.tooling_name`);
    console.log('[nits] LB15 A rows:');
    for (const r of lb) console.log(`   #${r.id} ${r.tooling_name}  "${r.formula_expr}"`);

    const { rows: lim } = await client.query(
      `SELECT tm.machine_name, l.input_var, l.description
         FROM tooling_machine_limit l JOIN tooling_machine tm ON tm.id = l.machine_id
        WHERE (tm.machine_name, l.input_var) IN
              (('KS-500RD','ID'),('KS-500RD','OD'),('KVD-300CRII','OD'),('KVD-300CRII','W'))
        ORDER BY 1, 2`);
    console.log('[nits] limit descriptions:');
    for (const r of lim) console.log(`   ${r.machine_name} ${r.input_var}: ${r.description === null ? 'NULL' : `"${String(r.description).slice(0, 50)}…"`}`);

    if (dryRun) { console.log('\n[nits] --dry-run — no changes written'); return; }

    await client.query('BEGIN');

    const { rowCount: fc } = await client.query(
      `UPDATE tooling_formula
          SET formula_expr = $1, updated_at = NOW()
        WHERE output_key = 'A' AND formula_expr = $2
          AND tooling_name IN ('ARBOR', 'COLLAR', 'NUT')
          AND machine_id = (SELECT id FROM tooling_machine WHERE machine_name = 'LB15')`,
      [lb15To, lb15From]);

    let lc = 0;
    for (const [m, v, desc] of LIMIT_DESC) {
      const r = await client.query(
        `UPDATE tooling_machine_limit
            SET description = $1
          WHERE input_var = $2
            AND machine_id = (SELECT id FROM tooling_machine WHERE machine_name = $3)`,
        [revert ? null : desc, v, m]);
      lc += r.rowCount;
    }

    await client.query('COMMIT');
    console.log(`\n[nits] LB15 formula rows updated: ${fc} · limit descriptions ${revert ? 'cleared' : 'set'}: ${lc}`);
    revert ? await recordRevert({ file: __filename }) : await recordRun({ file: __filename });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
    await engPool.end();
  }
}

main().catch((e) => { console.error('[nits] FAILED:', e.message); process.exit(1); });
