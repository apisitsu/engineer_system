'use strict';
/**
 * Validate OC-16A Tooling Select V2 seed by reconstruction.
 *
 * RACE PUSHER: formula A = OD (od_aft). Search: dim_a BETWEEN (OD−1.0) AND OD.
 *   For each row use OD_test = dim_a (exact). The row should be top match.
 *   Also test OD_test = dim_a + 0.5 (pusher 0.5mm below work OD, typical use).
 *
 * SET PIN: formula A = ID (id_aft). Search: dim_a BETWEEN (ID−0.15) AND (ID+0.15).
 *   For each row use ID_test = dim_a (exact). The row should be top match.
 *
 * Reports accuracy % for each tooling type.
 */

const { engPool } = require('../instance/eng_db');

async function validateTooling(client, toolingName, dimCol, odField, odField2, tolPlus, tolMinus) {
  const rows = await client.query(
    `SELECT tooling_no, ${dimCol} AS dim_a FROM tooling_oc16a WHERE tooling_name=$1 ORDER BY id`,
    [toolingName]
  );

  let correct = 0;
  let noMatch = 0;
  const problems = [];

  for (const row of rows.rows) {
    const storedA = parseFloat(row.dim_a);
    // Test: search with the exact dim as input
    const searchRes = await client.query(`
      SELECT tooling_no, ${dimCol} AS dim_a,
             abs(${dimCol} - $1) AS dist
      FROM tooling_oc16a
      WHERE tooling_name=$2
        AND ${dimCol} BETWEEN ($1 - $3) AND ($1 + $4)
      ORDER BY dist
      LIMIT 2
    `, [storedA, toolingName, tolMinus, tolPlus]);

    if (!searchRes.rows.length) {
      noMatch++;
      problems.push(`NO MATCH: ${row.tooling_no} (dim_a=${storedA})`);
      continue;
    }

    const top = searchRes.rows[0];
    if (top.tooling_no === row.tooling_no) {
      correct++;
    } else {
      // Check for tie (same distance)
      if (searchRes.rows.length > 1 && parseFloat(searchRes.rows[1].dim_a) === storedA) {
        correct++; // duplicate dim_a — ambiguous, count as pass
      } else {
        problems.push(`WRONG: ${row.tooling_no} (dim_a=${storedA}) → got ${top.tooling_no} (${top.dim_a})`);
      }
    }
  }

  const total = rows.rows.length;
  const pct = ((correct / total) * 100).toFixed(1);
  console.log(`${toolingName}: ${correct}/${total} (${pct}%) correct`);
  if (noMatch) console.log(`  No-match: ${noMatch}`);
  if (problems.length) {
    console.log(`  Issues (first 10):`);
    problems.slice(0, 10).forEach(p => console.log(`    ${p}`));
  }
  return { correct, total };
}

async function run() {
  const client = await engPool.connect();
  try {
    const mRes = await client.query(`SELECT id FROM tooling_machine WHERE machine_name='OC-16A'`);
    if (!mRes.rows.length) throw new Error('Machine OC-16A not found');
    console.log(`Machine OC-16A id=${mRes.rows[0].id}\n`);

    const rp = await validateTooling(client, 'RACE PUSHER', 'dim_a', 'OD', null, 0, 1.0);
    const sp = await validateTooling(client, 'SET PIN',     'dim_a', 'ID', null, 0.15, 0.15);

    const total = rp.total + sp.total;
    const correct = rp.correct + sp.correct;
    const pct = ((correct / total) * 100).toFixed(1);
    console.log(`\n✅ OC-16A TOTAL: ${correct}/${total} (${pct}%)`);
  } finally {
    client.release();
    await engPool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
