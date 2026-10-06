'use strict';

/**
 * Fills item_name/dwg_no/w_c on 7 "issued" ti_list rows (CVX2132-CVX2138, received
 * 2026-09-25 10:30) that are missing them because a later CSV re-sync - once the
 * factory source filled in item_name - created a separate duplicate row instead of
 * updating the original (buildUid() keys on po_no+receive_date+time+item_name, so a
 * changed item_name looks like a brand-new record). See .claude/rules/backend-gotchas.md
 * for the import's UID scheme.
 *
 * Does NOT delete the duplicate "named, never issued" rows - those are left for a
 * separate, explicit cleanup once someone from Tooling Inspection confirms they're safe
 * to remove.
 *
 * Idempotent: re-finds the pairs by query every run, so once the fields are filled the
 * WHERE no longer matches and a re-run is a no-op.
 */

const { engPool } = require('../instance/eng_db');
const { guard, recordRun, recordRevert } = require('./lib/migrationLog');

const revert = process.argv.includes('--revert');

async function findPairs() {
  const { rows } = await engPool.query(`
    SELECT
      a.id AS issued_id, a.po_no,
      b.item_name, b.dwg_no, b.w_c
    FROM ti_list a
    JOIN ti_list b
      ON a.po_no = b.po_no AND a.receive_date = b.receive_date AND a.time = b.time
     AND a.id <> b.id
    WHERE (a.item_name = '' OR a.item_name IS NULL)
      AND a.issue_date IS NOT NULL
      AND (b.item_name <> '' AND b.item_name IS NOT NULL)
      AND b.issue_date IS NULL
    ORDER BY a.po_no
  `);
  return rows;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    // Revert = blank the three fields back out on the known ids. Safe even if the
    // duplicate row was since deleted - we're not reading it back, just restoring
    // the pre-migration state these specific issued rows had.
    const ids = [5019, 5020, 5021, 5022, 5023, 5024, 5025];
    await engPool.query(
      `UPDATE ti_list SET item_name = '', dwg_no = '', w_c = '' WHERE id = ANY($1)`,
      [ids]
    );
    console.log(`Reverted ${ids.length} rows.`);
    await recordRevert({ file: __filename });
    return;
  }

  const pairs = await findPairs();
  console.log(`Found ${pairs.length} row(s) to fill`);
  for (const p of pairs) {
    await engPool.query(
      `UPDATE ti_list SET item_name = $1, dwg_no = $2, w_c = $3 WHERE id = $4`,
      [p.item_name, p.dwg_no, p.w_c, p.issued_id]
    );
    console.log(`${p.po_no}: filled id ${p.issued_id} -> "${p.item_name}" / "${p.dwg_no}" / w_c="${p.w_c}"`);
  }

  await recordRun({ file: __filename });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
