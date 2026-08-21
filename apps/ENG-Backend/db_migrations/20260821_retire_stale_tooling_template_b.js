'use strict';

/**
 * Retire the stale `tooling_template_b` table.
 * ------------------------------------------------------------------------------
 * WHAT IT IS
 *
 * An 86-row partial import of TEMPLATE_B.xlsx (columns: part, process_code, mc,
 * tool_dwg, category) covering 7 process codes. The real workbook carries 834
 * tooling rows across 59 process codes, so it was never more than a fragment.
 *
 * WHY IT GOES
 *
 * Its process-1021 rows attribute the drawings to the WRONG machines — the two
 * face-grind carriers are swapped against both the workbook and the live config:
 *
 *     tooling_template_b          TEMPLATE_B.xlsx + tooling_machine
 *     ------------------------    ---------------------------------------
 *     TSG-300ZNC → 4556-01        SEIBU / TSG-300W → CARRIER    4556-01
 *     TSG-300ZNC → 4866-14        SEIBU / TSG-300W → CHUTE COVER 4866-14
 *     TSG300W    → 4564-03        HAMAI 5B         → CARRIER    4564-03
 *
 * Verified live 2026-08-21: `tooling_tsg300` holds 4556-01 (78 CARRIER) and
 * 4866-14 (231 CHUTE COVER) under TSG-300W; `tooling_tsg300w` holds 4564-03
 * (73 CARRIER) under HAMAI 5B. The SDS registry corroborates independently —
 * machine_type_code 556 → TSG-300W, 564 → HAMAI 5B, 866 → TSG-300ZNC — so the
 * drawing family's middle digits ARE the machine code, and the stale table has
 * 4564-03 filed under the machine whose code is 556.
 *
 * NOTHING READS IT. `grep -rn "tooling_template_b"` over the whole repo (js/jsx/sql,
 * excluding node_modules) returns zero hits. Selection runs off tooling_machine /
 * tooling_formula / tooling_search_rule, none of which join to this table.
 *
 * WHY RENAME RATHER THAN DROP
 *
 * The rows are wrong but they are also evidence of how the import went wrong, and
 * something outside this repo (a BI dashboard, a hand-written query) could still
 * name it. Renaming makes accidental use impossible and is undone in one command;
 * dropping is not. Re-run with `--revert` to put the name back.
 *
 * Idempotent: running it twice reports "already retired" and changes nothing.
 */

const { engPool } = require('../instance/eng_db');

const LIVE = 'tooling_template_b';
const DEAD = 'tooling_template_b_stale_20260821';
const NOTE =
  'RETIRED 2026-08-21. Partial (86/834) import of TEMPLATE_B.xlsx whose process-1021 ' +
  'rows swap TSG-300W and HAMAI 5B: 4556-01/4866-14 are filed under TSG-300ZNC and ' +
  '4564-03 under TSG300W, the reverse of the workbook and of tooling_machine. ' +
  'Nothing reads it. Authoritative source is TEMPLATE_B.xlsx on the shared drive.';

const revert = process.argv.includes('--revert');

async function tableExists(client, name) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1`, [name]);
  return rows.length > 0;
}

async function main() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    const hasLive = await tableExists(client, LIVE);
    const hasDead = await tableExists(client, DEAD);

    if (revert) {
      if (!hasDead) {
        console.log(hasLive ? `nothing to revert — "${LIVE}" is already in place`
                            : `neither "${LIVE}" nor "${DEAD}" exists`);
      } else if (hasLive) {
        throw new Error(`both "${LIVE}" and "${DEAD}" exist — resolve by hand`);
      } else {
        await client.query(`ALTER TABLE "${DEAD}" RENAME TO "${LIVE}"`);
        await client.query(`COMMENT ON TABLE "${LIVE}" IS NULL`);
        console.log(`reverted: "${DEAD}" → "${LIVE}"`);
      }
      await client.query('COMMIT');
      return;
    }

    if (hasDead && !hasLive) {
      console.log(`already retired — "${DEAD}" is in place, nothing to do`);
      await client.query('COMMIT');
      return;
    }
    if (!hasLive) {
      console.log(`"${LIVE}" does not exist — nothing to do`);
      await client.query('COMMIT');
      return;
    }
    if (hasDead) throw new Error(`both "${LIVE}" and "${DEAD}" exist — resolve by hand`);

    const { rows: [{ count }] } = await client.query(`SELECT count(*)::int AS count FROM "${LIVE}"`);
    const { rows: sample } = await client.query(
      `SELECT mc, tool_dwg FROM "${LIVE}" WHERE process_code = '1021' ORDER BY tool_dwg`);

    console.log(`"${LIVE}": ${count} rows`);
    console.log('process-1021 rows being retired (machine ← drawing):');
    for (const r of sample) console.log(`  ${String(r.mc).padEnd(12)} ${r.tool_dwg}`);

    await client.query(`ALTER TABLE "${LIVE}" RENAME TO "${DEAD}"`);
    // COMMENT is a utility statement — it does not accept bind parameters, so the
    // text is dollar-quoted instead. NOTE is a constant in this file, never input.
    await client.query(`COMMENT ON TABLE "${DEAD}" IS $note$${NOTE}$note$`);

    await client.query('COMMIT');
    console.log(`\nretired: "${LIVE}" → "${DEAD}" (comment set)`);
    console.log(`undo with:  node db_migrations/20260821_retire_stale_tooling_template_b.js --revert`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
