'use strict';

/**
 * `sds_machine_tool` — remove the guard families too small to earn a permanent slot.
 * ------------------------------------------------------------------------------
 * `20260827_` added, alongside TEMPLATE_B's own families, **every** family of a machine the
 * factory plan uses at that process — a guard against the whitelist hiding a planned tool
 * (that migration's Rule 1). The threshold it used was **1 C/N**, and that was too low.
 *
 * A configured family with no Tool No for a part still prints its NAME on that part's sheet.
 * That is intended for a fixture the machine really has; it is noise for one carried by 0.1%
 * of the work. Worse, it can never go away: `alternativeFamilies` needs `MIN_ALT_CNS` (5) C/Ns
 * on BOTH families before it will call a pair alternatives, so a family below that floor is
 * outside the one rule that could suppress its row.
 *
 * Reported from the floor as `HIGH PALLET BASE ASSY` (`4918-10`, **2 C/N**) sitting on
 * MD-V9910WA @3491 sheets — 0.9% of that process's work, printed on the other 99%.
 *
 * The guard floor is now the same number as the alternative floor: **every configured family
 * is either well enough used to earn its row, or judgeable by the alternative rule.** Two
 * thresholds that must agree should be one number, and this is the migration that made them.
 *
 * 26 rows go. The cost is that 43 C/N (1–4 each) lose a planned tool from
 * their sheet — measured against a name row on thousands of others, and the same trade
 * `20260827_` already made deliberately for 4858-04 at 2071 (0.8% → left out) versus 2021
 * (41% → added as T8).
 *
 * Idempotent; `--revert` puts them back at the end of their combo.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// m = machine_type, p = process_code, f = drawing family
const DROP = [
  { m: 'GI-20N', p: '1061', f: '4652-03' },         // 1 C/N · 0.1% ของงานที่ process นี้
  { m: 'IG-15N', p: '1161', f: '4671-04' },         // 3 C/N · 3.6% ของงานที่ process นี้
  { m: 'LNC45/C200', p: '0341', f: '4651-10' },     // 1 C/N · 9.1% ของงานที่ process นี้
  { m: 'LNC45/C200', p: '0341', f: '4651-26' },     // 2 C/N · 18.2% ของงานที่ process นี้
  { m: 'LNC45/C200', p: '0611', f: '4651-20' },     // 2 C/N · 7.1% ของงานที่ process นี้
  { m: 'LNC45/C200', p: '1061', f: '4651-10' },     // 4 C/N · 0.6% ของงานที่ process นี้
  { m: 'MD-V9910WA', p: '3491', f: '4918-10' },     // 2 C/N · 0.9% ของงานที่ process นี้
  { m: 'TSG-300W', p: '1021', f: '4556-05' },       // 1 C/N · 0.1% ของงานที่ process นี้
  { m: 'TSG-300W', p: '1021', f: '4556-10' },       // 1 C/N · 0.1% ของงานที่ process นี้
  { m: 'TSG-300W', p: '1021', f: '4556-11' },       // 1 C/N · 0.1% ของงานที่ process นี้
  { m: 'TSG-300ZNC', p: '1031', f: '4866-10' },     // 2 C/N · 11.8% ของงานที่ process นี้
  { m: 'その他', p: '1011', f: '4800-68' },            // 1 C/N · 0.0% ของงานที่ process นี้
  { m: 'その他', p: '1041', f: '4800-10' },            // 3 C/N · 0.3% ของงานที่ process นี้
  { m: 'その他', p: '1041', f: '4800-49' },            // 1 C/N · 0.1% ของงานที่ process นี้
  { m: 'その他', p: '1041', f: '4800-68' },            // 2 C/N · 0.2% ของงานที่ process นี้
  { m: 'その他', p: '1061', f: '4800-10' },            // 1 C/N · 0.1% ของงานที่ process นี้
  { m: 'その他', p: '1121', f: '4800-40' },            // 1 C/N · 1.1% ของงานที่ process นี้
  { m: 'その他', p: '1121', f: '4800-68' },            // 2 C/N · 2.3% ของงานที่ process นี้
  { m: 'その他', p: '1161', f: '4800-68' },            // 1 C/N · 1.2% ของงานที่ process นี้
  { m: 'その他', p: '2501', f: '4800-38' },            // 1 C/N · 3.2% ของงานที่ process นี้
  { m: 'その他', p: '2511', f: '4800-08' },            // 1 C/N · 0.1% ของงานที่ process นี้
  { m: 'その他', p: '3001', f: '4800-38' },            // 1 C/N · 2.4% ของงานที่ process นี้
  { m: 'その他', p: '3001', f: '4800-43' },            // 2 C/N · 4.9% ของงานที่ process นี้
  { m: 'その他', p: '3001', f: '4800-50' },            // 2 C/N · 4.9% ของงานที่ process นี้
  { m: 'その他', p: '3002', f: '4800-47' },            // 2 C/N · 0.8% ของงานที่ process นี้
  { m: 'その他', p: '3491', f: '4800-39' },            // 2 C/N · 0.9% ของงานที่ process นี้
];

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const { rows: before } = await engPool.query(`SELECT count(*)::int AS n FROM ${TABLE}`);
  console.log(`\nrows before: ${before[0].n}`);
  if (dryRun) {
    for (const d of DROP) console.log(`   ${revert ? 'restore' : 'remove '} ${d.m} @${d.p} ${d.f}`);
    console.log(`--dry-run: ${DROP.length} rows`);
    return;
  }

  const client = await engPool.connect();
  let n = 0;
  try {
    await client.query('BEGIN');
    for (const d of DROP) {
      if (revert) {
        const { rows: dup } = await client.query(
          `SELECT 1 FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
          [d.m, d.p, d.f]);
        if (dup.length) continue;
        const { rows: mx } = await client.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(tool_number FROM 2) AS int)), 0) AS mx
             FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2`, [d.m, d.p]);
        await client.query(
          `INSERT INTO ${TABLE} (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
           SELECT $1, $2, $3, $4, MIN(machine_type_id) FROM ${TABLE}
            WHERE machine_type = $3 AND process_code = $2`,
          [`T${mx[0].mx + 1}`, d.p, d.m, d.f]);
        n++;
      } else {
        const r = await client.query(
          `DELETE FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
          [d.m, d.p, d.f]);
        n += r.rowCount;
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  const { rows: after } = await engPool.query(`SELECT count(*)::int AS n FROM ${TABLE}`);
  console.log(`${revert ? 'restored' : 'removed'} ${n} rows - table now ${after[0].n}`);
  if (revert) { await recordRevert({ file: __filename }); return; }
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260827c_sds_machine_tool_trim_low_evidence_guards.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
