'use strict';

/**
 * Backfills `receive_date` on `pbring_tooling` rows that are already
 * status='Received' with a known `po_no` (and price), but never got a
 * receive_date set — using `comp_date` from `lpb.pc_material_purchase`
 * (maqdb), matched by `po_no` directly.
 *
 * Not the fuzzy tool_code matching `pbringCostDetectService.detectMissingCost()`
 * uses — po_no is already known here, and every po_no in the matched data has
 * at most one purchase line (verified against the live data before writing
 * this), so there's no multi-line ambiguity to resolve with tool_code.
 *
 * `detectMissingCost()` never reaches these rows on its own: its candidate
 * pool is explicitly `WHERE po_no IS NULL` (it exists to FIND a po_no, not to
 * backfill a date once one is already on record), so a row that already has
 * po_no+price but is missing receive_date falls through every existing
 * detection path — this migration is that missing path, run once.
 *
 * Only fills rows whose po_no has exactly one matching purchase line with a
 * non-null comp_date in maqdb. A po_no with zero matches (not every po_no
 * series used here is tracked in lpb.pc_material_purchase — `RD00xxx`,
 * `DC1xxxx`, `HRD00xx`, `IC00xxx`, `LRD00xx` are not) or with conflicting
 * comp_date across multiple lines is left untouched rather than guessed at.
 *
 * Idempotent: re-finds candidates by query every run — once receive_date is
 * filled, the WHERE no longer matches and a re-run is a no-op.
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

async function findCandidates() {
  const { rows } = await engPool.query(`
    SELECT id, po_no FROM pbring_tooling
     WHERE status = 'Received' AND receive_date IS NULL
       AND po_no IS NOT NULL AND po_no <> ''
  `);
  return rows;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    // Known ids from the forward run (2026-10-06) — restoring these specific
    // rows' prior state (receive_date NULL) rather than re-matching by WHERE,
    // same as the ti_list precedent this migration follows.
    const ids = [7, 14, 298, 310, 312, 324, 457, 503, 510, 678, 736, 882, 889, 1714];
    await engPool.query(`UPDATE pbring_tooling SET receive_date = NULL WHERE id = ANY($1)`, [ids]);
    console.log(`Reverted ${ids.length} row(s).`);
    await recordRevert({ file: __filename });
    return;
  }

  const candidates = await findCandidates();
  if (!candidates.length) {
    console.log('No candidates found (already filled, or nothing matches the WHERE any more).');
    await recordRun({ file: __filename });
    return;
  }

  const poNos = [...new Set(candidates.map((r) => r.po_no))];
  const { rows: purchases } = await maqPool.query(
    `SELECT po_no, comp_date FROM lpb.pc_material_purchase WHERE po_no = ANY($1)`,
    [poNos]
  );
  const byPo = new Map();
  for (const p of purchases) {
    if (!byPo.has(p.po_no)) byPo.set(p.po_no, new Set());
    if (p.comp_date) byPo.get(p.po_no).add(p.comp_date.toISOString().slice(0, 10));
  }

  const toFill = [];
  const skippedNoMatch = new Set();
  const skippedAmbiguous = new Set();
  for (const row of candidates) {
    const dates = byPo.get(row.po_no);
    if (!dates || dates.size === 0) { skippedNoMatch.add(row.po_no); continue; }
    if (dates.size > 1) { skippedAmbiguous.add(row.po_no); continue; }
    toFill.push({ id: row.id, po_no: row.po_no, receive_date: [...dates][0] });
  }

  console.log(
    `Candidates: ${candidates.length} | fillable: ${toFill.length} | ` +
    `po_no not found in maqdb: ${skippedNoMatch.size} | ambiguous (>1 comp_date): ${skippedAmbiguous.size}`
  );

  for (const f of toFill) {
    await engPool.query(
      `UPDATE pbring_tooling SET receive_date = $1, updated_at = now() WHERE id = $2`,
      [f.receive_date, f.id]
    );
    console.log(`id ${f.id} (po_no ${f.po_no}) -> receive_date = ${f.receive_date}`);
  }

  await recordRun({ file: __filename });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
