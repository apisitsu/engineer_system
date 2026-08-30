'use strict';

/**
 * `sds_machine_tool` — align the SPH turning machines with TEMPLATE_B.
 * ------------------------------------------------------------------------------
 * A full sweep of TEMPLATE_B (31 sheets -> 274 distinct (process, DWG family) pairs,
 * every family resolved to a machine through the `machine_type_code` = family middle
 * digits rule) found 97 pairs the config lacks and 273 config rows the workbook does
 * not list. Most of that second number is FINE and must stay:
 *
 *   - 25 rows are the `...1 / ...2` process pair (KS-H70 1082/1242, OC-16A 1012, ...).
 *     TEMPLATE_B usually writes only the first; carrying both is deliberate.
 *   - ~11 groups are the FACTORY PLAN overriding the workbook: KS-400B6 @1041 has
 *     182 C/Ns, GI-20N @1121 has 84. The plan beats the workbook (see
 *     .claude/rules/tooling-select.md); deleting those would break live sheets.
 *
 * THE BAR FOR DELETING IS BOTH SOURCES AGREEING: TEMPLATE_B does not list the pair
 * AND the factory plan barely uses it. Three combos clear it, and no others.
 *
 * -- REMOVED --------------------------------------------------------------------
 *   XD-8    @2031  6 slots   plan @2031: 3 rows / 1 C/N   TEMPLATE_B: 2071, 2021
 *   J-WAVE  @2031  6 slots   plan @2031: 2 rows / 1 C/N   TEMPLATE_B: 2071
 *   KN-312A @1161  2 slots   plan @1161: 0                TEMPLATE_B: 1041
 *
 * 2031 (TURN SPH OD) belongs to X-100 and FTL: 4857 has 531 C/Ns there and 4501 has
 * 171, against ONE C/N for each of 4858 and 4879. XD-8 and J-WAVE were configured for
 * it by copy from their own 2071 rows.
 *
 * KN-312A @1161 is a WRONG-FAMILY whitelist, and removing it GIVES SHEETS BACK.
 * KN-312A is legitimately used at 1161 - its own code is 837 and 16 C/Ns plan a 4837-xx
 * tool there. But the two whitelist rows named 4828, which belongs to `KN-312A (EGM)`
 * (code 828) and is planned at 1041 and NOWHERE else: **zero** 4828 plan rows exist at
 * 1161. And a whitelist FILTERS the plan - `buildValueMap` keeps only tools that resolve
 * to a configured slot - so those two rows were discarding every real 4837 tool the part
 * carried and leaving the sheet with nothing but two T-Select 4828 suggestions.
 *
 * Verified on C39-00728 after this ran: T01 PLATE 4837-01-0003, T02 COLLET FOR INNER
 * GROOVE 4837-08-0001, T03 LOADER JAW 4837-01-0002, T04 SHAFT 4837-02-0003 - four factory
 * tools that the 4828 whitelist had been hiding.
 *
 * (4837 is in no TEMPLATE_B sheet, so no whitelist is proposed for it here; the legacy
 * `machine_type_code` fill now serves those sheets correctly.)
 *
 * > Two `sds_approval` rows name KN-312A @1161 (C35-00164, C35-00648, both
 * > `source='backfill'` from the 2025-11 import). THEY ARE NOT TOUCHED - signatures are
 * > the shop's record. Both parts' own 1161 plan is entirely 4931-xx, so the machine on
 * > those imported rows is itself what looks wrong; that is for the floor to confirm.
 *
 * -- ADDED ----------------------------------------------------------------------
 *   XD-8       @2021  8 slots   plan: 353 rows / 67 C/N    TEMPLATE_B: yes (+1, below)
 *   FTL-10(I)  @2021  2 slots   plan:  62 rows / 19 C/N    TEMPLATE_B: yes
 *   J-WAVE     @2021  7 slots   plan: 118 rows / 23 C/N    TEMPLATE_B: silent, see below
 *   X-100      @2031  1 slot    plan: 479 rows / 479 C/N   TEMPLATE_B: yes
 *
 * A WHITELIST DROPS A FACTORY TOOL THAT IS NOT ON IT. `buildValueMap` filters the part's
 * own process plan through `configSlotOf`, so creating a combo's first whitelist row can
 * REMOVE a tool that renders today. Measured per family before choosing the slot lists:
 *
 *   XD-8    @2021  4858-04 INTERMEDIATE STATION ASSY   28 of 69 C/N (41%)  -> ADDED as T8
 *   XD-8    @2021  4858-05 / -06 / -09                  2 of 69 each       -> not added
 *   J-WAVE  @2021  4879-07 / -08 push arbor + guide     5 of 23 (22%)      -> not added
 *   FTL     @2021  4501-09 / -10                        1 of 20 each       -> not added
 *
 * 4858-04 is added at 2021 and NOT at 2071, and the asymmetry is the measurement, not an
 * oversight: an intermediate station sits between operations, and the plan agrees — 28 C/N
 * at 2021 against 11 of 1,305 (0.8%) at 2071. Every whitelist family also puts a NAMED,
 * Tool-No-less row on every sheet that does not use it, so a family carried by 1% of the
 * work is noise on the other 99%. J-WAVE's push arbors sit at 22% and are left out to match
 * that machine's existing 2071 list, which omits them and has been live; add them if the
 * floor says the second operation really needs them.
 *
 * 4858-09 PIN is correctly absent everywhere: TEMPLATE_B writes it `(4858-09-`, in
 * parentheses, marking it a sub-component of the WRIST END ASSY rather than its own slot.
 *
 * PROCESS 2021 (TURN SPH END FACE) HAD NO CONFIG AT ALL - not one row for any machine,
 * so every 2021 sheet fell through to the `machine_type_code` fallback. TEMPLATE_B's
 * SPH(D->T) sheet heads that block `2071 / 2021` and lists XD-8's and FTL's sets under it.
 *
 * Slot ORDER mirrors each machine's own 2071 rows rather than the workbook's row order,
 * the same choice `20260821o_` made for TP-SW-03 2412 mirroring 2411. Two sheets for one
 * machine that disagree about which fixture is T2 are worse than either order.
 *
 * J-WAVE @2021 is the one addition TEMPLATE_B does not state. The plan does: 4879-04
 * (23 C/N), -05 (21), -03 (19), -02 (17), -06 (5) - the same five families already
 * configured at 2071, and the plan beats the workbook's silence. Flagged here because it
 * is the only entry in this migration resting on a single source.
 *
 * X-100 gets 4857-04 WRIST END at 2031 ONLY. 4857-06 LOADER JAW and 4857-08 INVERSION
 * JAW are ALSO missing against TEMPLATE_B (116 and 102 C/N at 2071, 408 and 400 at 2031)
 * and are deliberately NOT restored: `20260821k_`/`20260821n_` added them and they were
 * removed by hand afterwards. 4857-04 was never inserted by any migration - it is a gap,
 * not a decision.
 *
 * Idempotent; `--revert` restores the three deleted combos and drops the four added.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_machine_tool';
const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// Combos to remove - restored verbatim by --revert.
const REMOVE = [
  { machine: 'XD-8',    process: '2031', machine_type_id: 362,
    slots: ['4858-01', '4858-08', '4858-12', '4858-15', '4858-17', '4858-22'] },
  { machine: 'J-WAVE',  process: '2031', machine_type_id: 383,
    slots: ['4879-04', '4879-05', '4879-03', '4879-03', '4879-06', '4879-06'] },
  { machine: 'KN-312A', process: '1161', machine_type_id: null,
    slots: ['4828-01', '4828-02'] },
];

// Slots to add. `whole: true` = the combo is created from nothing, so --revert deletes
// it entirely; X-100 already has 2031 rows, so only its one new slot is dropped.
const ADD = [
  { machine: 'XD-8',      process: '2021', machine_type_id: 362, whole: true,
    slots: ['4858-01', '4858-08', '4858-12', '4858-15', '4858-17', '4858-22', '4858-11',
            '4858-04'] },
  { machine: 'FTL-10(I)', process: '2021', machine_type_id: 40,  whole: true,
    slots: ['4501-01', '4501-02'] },
  { machine: 'J-WAVE',    process: '2021', machine_type_id: 383, whole: true,
    slots: ['4879-04', '4879-05', '4879-03', '4879-03', '4879-06', '4879-06', '4879-02'] },
  { machine: 'X-100',     process: '2031', machine_type_id: 361, whole: false,
    slots: ['4857-04'], startAt: 4 },
];

const AFFECTED = [
  ['XD-8', '2031'], ['XD-8', '2021'], ['J-WAVE', '2031'], ['J-WAVE', '2021'],
  ['KN-312A', '1161'], ['FTL-10(I)', '2021'], ['X-100', '2031'],
];

async function show(label, client = engPool) {
  const { rows } = await client.query(
    `SELECT machine_type, process_code, count(*)::int AS slots
       FROM ${TABLE}
      WHERE machine_type = ANY($1) AND process_code = ANY($2)
      GROUP BY 1,2 ORDER BY 1,2`,
    [AFFECTED.map(a => a[0]), AFFECTED.map(a => a[1])]
  );
  const keep = rows.filter(r => AFFECTED.some(a => a[0] === r.machine_type && a[1] === r.process_code));
  console.log(`\n${label}`);
  if (!keep.length) console.log('   (none of the affected combos exist)');
  for (const r of keep) console.log(`   ${r.machine_type.padEnd(12)} @${r.process_code}  ${r.slots} slots`);
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  await show(revert ? '-- before revert --' : '-- before --');
  if (dryRun) { console.log('\n--dry-run: nothing written'); return; }

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    if (revert) {
      for (const a of ADD) {
        if (a.whole) {
          await client.query(`DELETE FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2`,
            [a.machine, a.process]);
        } else {
          for (const dwg of a.slots) {
            await client.query(
              `DELETE FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2 AND tool_drawing_no = $3`,
              [a.machine, a.process, dwg]);
          }
        }
      }
      for (const r of REMOVE) {
        // Re-insert only when the combo is empty, so a partial revert is safe to re-run.
        const { rows } = await client.query(
          `SELECT count(*)::int AS n FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2`,
          [r.machine, r.process]);
        if (rows[0].n > 0) continue;
        for (let i = 0; i < r.slots.length; i++) {
          await client.query(
            `INSERT INTO ${TABLE} (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [`T${i + 1}`, r.process, r.machine, r.slots[i], r.machine_type_id]);
        }
      }
      await client.query('COMMIT');
      await show('-- after revert --');
      await recordRevert({ file: __filename });
      return;
    }

    let removed = 0;
    for (const r of REMOVE) {
      const res = await client.query(
        `DELETE FROM ${TABLE} WHERE machine_type = $1 AND process_code = $2`, [r.machine, r.process]);
      removed += res.rowCount;
      console.log(`   removed ${String(res.rowCount).padStart(2)} - ${r.machine} @${r.process}`);
    }

    let added = 0;
    for (const a of ADD) {
      const base = a.startAt || 1;
      for (let i = 0; i < a.slots.length; i++) {
        const dwg = a.slots[i];
        const tool = `T${base + i}`;
        // Idempotent: a slot already carrying this drawing is left alone.
        const { rows } = await client.query(
          `SELECT 1 FROM ${TABLE}
            WHERE machine_type = $1 AND process_code = $2 AND tool_number = $3 AND tool_drawing_no = $4`,
          [a.machine, a.process, tool, dwg]);
        if (rows.length) continue;
        await client.query(
          `INSERT INTO ${TABLE} (tool_number, process_code, machine_type, tool_drawing_no, machine_type_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [tool, a.process, a.machine, dwg, a.machine_type_id]);
        added++;
      }
      console.log(`   added   ${String(a.slots.length).padStart(2)} - ${a.machine} @${a.process}`);
    }

    await client.query('COMMIT');
    console.log(`\nremoved ${removed} rows - inserted ${added} rows`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  await show('-- after --');
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20260826d_sds_machine_tool_template_b_align.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
