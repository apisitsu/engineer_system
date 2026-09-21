'use strict';

/**
 * `sds_machine_tool` — remove the centreless OD-grind whitelist at process 3491 (L/MARKING).
 * ------------------------------------------------------------------------------
 * Process 3491 is laser marking; its machine is MD-V9910WA (4918-01/02/03). The four
 * centreless grinders each carry a 5-slot whitelist there (4560-18/21/11/04/10) that is a
 * copy of their 1011 block:
 *
 *   OC-16A        ids 1125-1129   inserted as a batch with its 0401 / 1012 copies
 *   OC-18BR-150   ids 1290-1294  \
 *   OC-20BR-200   ids 1310-1314   } copied from OC-16A by 20260831f (OD_PROCESSES included 3491)
 *   HI-GRIND-1-D  ids 1330-1334  /
 *
 * The factory plan has ZERO 4560-xx tool rows at 3491 (98% of the family's ~4,229 rows are
 * at 1011). The only source is TEMPLATE_B's SLEEVE sheet, which puts "3491" beside an
 * "OD GRIND" block while labelling its PALLET rows "L / MARKING" - a labelling slip. 20260827
 * had already declined to configure OC-16A @3491 for exactly this reason (0 C/N); the pre-existing
 * rows were simply never removed, and 20260831f then propagated them to three more machines.
 *
 * Effect on the SDS page: any C/N whose route includes 3491 lists every machine configured
 * at that code, and Tooling Select's process-blind OC-16A results get attached under it
 * (seen on 414303, a never-produced C/N, so the production-history filter is bypassed).
 * Removing the combos gives those sheets back to MD-V9910WA alone. No C/N plans 4560-xx at
 * 3491, so no printed sheet loses a tool.
 *
 * Safety: refuses to delete unless the live rows for the four combos are EXACTLY the
 * expected 5 slots each. `--revert` restores them verbatim. Idempotent.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const PROCESS = '3491';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const SLOTS = [
  ['T1', '4560-18'], ['T2', '4560-21'], ['T3', '4560-11'], ['T4', '4560-04'], ['T5', '4560-10'],
];
const MACHINES = [
  { machine: 'OC-16A', id: 99 },
  { machine: 'OC-18BR-150', id: 11 },
  { machine: 'OC-20BR-200', id: 414 },
  { machine: 'HI-GRIND-1-D', id: 46 },
];

async function liveRows(client) {
  const { rows } = await client.query(
    `SELECT machine_type, tool_number, tool_drawing_no, machine_type_id
       FROM ${TABLE} WHERE process_code = $1 AND machine_type = ANY($2)
      ORDER BY machine_type, LPAD(SUBSTRING(tool_number FROM 2), 3, '0')`,
    [PROCESS, MACHINES.map(m => m.machine)]);
  return rows;
}

function show(label, rows) {
  console.log(`\n${label}`);
  const by = {};
  for (const r of rows) by[r.machine_type] = (by[r.machine_type] || 0) + 1;
  if (!rows.length) console.log('   (none of the four combos exist)');
  for (const m of MACHINES) if (by[m.machine]) console.log(`   ${m.machine.padEnd(13)} @${PROCESS}  ${by[m.machine]} slots`);
}

// true when a machine's live rows are exactly SLOTS
function matchesExpected(rows, machine) {
  const mine = rows.filter(r => r.machine_type === machine);
  return mine.length === SLOTS.length
    && SLOTS.every(([t, d]) => mine.some(r => r.tool_number === t && r.tool_drawing_no === d));
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  const client = await engPool.connect();
  try {
    const before = await liveRows(client);
    show(revert ? '-- before revert --' : '-- before --', before);
    if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

    await client.query('BEGIN');

    if (revert) {
      for (const m of MACHINES) {
        if (before.some(r => r.machine_type === m.machine)) continue;   // only restore an empty combo
        for (const [t, d] of SLOTS) {
          await client.query(
            `INSERT INTO ${TABLE} (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
             VALUES ($1, $2, $3, $4, $5)`, [t, PROCESS, m.machine, d, m.id]);
        }
        console.log(`   restored ${SLOTS.length} - ${m.machine} @${PROCESS}`);
      }
      await client.query('COMMIT');
      show('-- after revert --', await liveRows(client));
      await recordRevert({ file: __filename });
      return;
    }

    let removed = 0;
    for (const m of MACHINES) {
      if (!before.some(r => r.machine_type === m.machine)) continue;     // idempotent
      if (!matchesExpected(before, m.machine)) {
        throw new Error(`${m.machine} @${PROCESS} no longer matches the expected 5-slot 4560 block - refusing to delete; inspect by hand`);
      }
      const res = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2`, [m.machine, PROCESS]);
      removed += res.rowCount;
      console.log(`   removed ${String(res.rowCount).padStart(2)} - ${m.machine} @${PROCESS}`);
    }
    await client.query('COMMIT');
    console.log(`\nremoved ${removed} rows`);
    show('-- after --', await liveRows(client));
    await recordRun({ file: __filename });
    console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260921_sds_machine_tool_disable_centreless_3491.js --revert');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
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
