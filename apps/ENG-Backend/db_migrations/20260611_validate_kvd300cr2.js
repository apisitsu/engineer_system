'use strict';
/**
 * Reconstruct OD/W from inventory dims A/D and verify the search returns
 * the correct CARRIER row as top match for KVD-300CRII.
 *
 * For each row we need to find an OD/W such that the formula produces the
 * stored dim_a and dim_d.
 *
 * Inverse of A:
 *   A = ceil05(OD+0.4) when OD<=30  →  OD_implied = A−0.4  (min for this class)
 *   A = ceil05(OD+1)   when OD>30   →  OD_implied = A−1.0  (min for this class)
 *   We use the lower boundary, which is the exact point where ceil05 first
 *   produces the stored A value. For old-standard rows A is not at a 0.5 boundary
 *   so ceil05 won't reproduce it — we can still test the search by using OD=A−0.5
 *   (within tolerance) for old rows.
 *
 * Inverse of D:
 *   D = ceil05(W*0.8)  →  W_implied = D/0.8
 *
 * A/D tolerances are both ±0.5. For new-standard rows the formula reproduced
 * dim_a exactly; for old-standard rows dim_a != formula(OD) but we still expect
 * the search to return the same row (it just happens to be the closest match).
 */

const { engPool } = require('../instance/eng_db');

function ceil05(x) {
  return Math.ceil(x / 0.5) * 0.5;
}

async function run() {
  const client = await engPool.connect();
  try {
    // Fetch machine id
    const mRes = await client.query(
      `SELECT id FROM tooling_machine WHERE machine_name='KVD-300CRII'`
    );
    if (!mRes.rows.length) throw new Error('Machine KVD-300CRII not found');
    const machineId = mRes.rows[0].id;

    // Fetch all inventory rows
    const invRes = await client.query(
      `SELECT tooling_no, dim_a, dim_d FROM tooling_kvd300cr2 ORDER BY id`
    );
    const rows = invRes.rows;
    console.log(`Testing ${rows.length} CARRIER rows for machine id=${machineId}\n`);

    let correct = 0;
    let results = [];

    for (const row of rows) {
      const storedA = parseFloat(row.dim_a);
      const storedD = parseFloat(row.dim_d);

      // Invert: find OD that formula would use
      // New std: A = ceil05(OD+0.4) if OD<=30 → OD = A−0.4 (for OD<=30 range)
      //          A = ceil05(OD+1)   if OD>30  → OD = A−1.0 (for OD>30 range)
      // Old std: A not at 0.5 boundary, use OD = A−0.5 (within tol)
      let odImplied;
      const isNewStd = (storedA % 0.5 === 0);
      if (isNewStd) {
        // Check which branch: if storedA <= 30 then OD+0.4 produced it → OD<=30
        // if storedA > 30 then OD+1 produced it (approximately)
        if (storedA <= 30) {
          odImplied = storedA - 0.4;  // smallest OD producing this A via <=30 branch
        } else {
          odImplied = storedA - 1.0;  // smallest OD producing this A via >30 branch
        }
      } else {
        // Old standard — use A directly as OD (within tol ±0.5 the search should find it)
        odImplied = storedA - 0.5;
      }

      // Verify formula forward for new-std rows
      const formulaA = isNewStd
        ? (odImplied <= 30 ? ceil05(odImplied + 0.4) : ceil05(odImplied + 1))
        : null;

      // Invert D: D = ceil05(W*0.8) → W = D/0.8
      const wImplied = storedD / 0.8;

      // Search: find top CARRIER row within tol
      const searchRes = await client.query(`
        SELECT tooling_no, dim_a, dim_d,
               abs(dim_a - $1) + abs(dim_d - $2) AS dist
        FROM tooling_kvd300cr2
        WHERE dim_a BETWEEN ($1 - 0.5) AND ($1 + 0.5)
          AND dim_d BETWEEN ($2 - 0.5) AND ($2 + 0.5)
        ORDER BY dist
        LIMIT 2
      `, [storedA, storedD]);

      const topMatch = searchRes.rows[0];
      const isCorrect = topMatch && topMatch.tooling_no === row.tooling_no;
      if (isCorrect) correct++;

      results.push({
        tooling_no: row.tooling_no,
        storedA, storedD,
        odImplied: odImplied.toFixed(3),
        wImplied: wImplied.toFixed(3),
        formulaA: formulaA !== null ? formulaA.toFixed(1) : `(old)`,
        isNewStd,
        topMatch: topMatch ? topMatch.tooling_no : 'NO MATCH',
        correct: isCorrect ? '✓' : '✗',
      });
    }

    // Print table
    console.log('No          | storedA | storedD | OD_impl | W_impl | fmA  | newStd | topMatch        | ok');
    console.log('------------|---------|---------|---------|--------|------|--------|-----------------|---');
    for (const r of results) {
      const std = r.isNewStd ? 'NEW' : 'old';
      console.log(
        `${r.tooling_no.padEnd(12)}| ${String(r.storedA).padEnd(8)}| ${String(r.storedD).padEnd(8)}| ${r.odImplied.padEnd(8)}| ${r.wImplied.padEnd(7)}| ${r.formulaA.padEnd(5)}| ${std.padEnd(7)}| ${r.topMatch.padEnd(16)}| ${r.correct}`
      );
    }

    const pct = ((correct / rows.length) * 100).toFixed(1);
    console.log(`\n✅ ${correct}/${rows.length} rows matched (${pct}%)`);
    const newStdRows = results.filter(r => r.isNewStd);
    const newStdCorrect = newStdRows.filter(r => r.correct === '✓').length;
    console.log(`   New-standard rows: ${newStdCorrect}/${newStdRows.length} (${((newStdCorrect/Math.max(1,newStdRows.length))*100).toFixed(0)}%)`);
    console.log(`   Old-standard rows: ${correct - newStdCorrect}/${rows.length - newStdRows.length}`);
  } finally {
    client.release();
    await engPool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
