'use strict';

/**
 * FTL-10(I) PUSHER OP1 — selectable by CONTROL NUMBER, not by formula.
 * ---------------------------------------------------------------------------
 * PUSHER OP1 has sat in the system as 63 unreachable shelf rows: inventory but
 * zero formulas and zero search rules, so `search()` never even listed it.
 *
 * That was deliberate and it stays right. Shipped exactly as its design sheet
 * states it (`A7 = IF(WORK TYPE="Y", SD1, SD2)`, ceiling lookup) the rule is
 * correct 2% of the time; seventeen candidate quantities were scored against 659
 * planned pushers and the best put only 25% within 0.5 mm of its own median. Every
 * sheet in the workbook says why at the top — 設計計算のみ有効・結果はACCESSに入力の事:
 * the sheet DESIGNS a new pusher, while the shop's choice among existing ones
 * lives in an ACCESS database this system cannot read.
 *
 * But the factory PLAN records what was actually fitted, C/N by C/N, and that is
 * a selection this system CAN serve. `lpb.eng_r_pi_tool` names a PUSHER OP1 shelf
 * row on 811 C/Ns, and only ONE of them plans more than one — so the mapping is
 * effectively 1:1 and needs no tie-break rule.
 *
 * WHY THE KEY IS `cn` AND NOT `parts_no`
 * `tooling_partno_map` already exists for exactly this shape of problem, keyed on
 * the workpiece part number. It is the wrong key here and the numbers say so: all
 * 811 planned C/Ns exist in `tooling_spec_process`, but only **66 of them (8%)**
 * carry a `parts_no`. Keying on cn reaches the whole family; keying on parts_no
 * would reach one part in twelve.
 *
 * (Convert control_no → spec cn with `cnFormat.toSpecCn` and nothing else. An
 * ad-hoc "strip the leading zeros" version silently mangles short suffixes —
 * A41-00045 becomes 4145 instead of 410045 — which is what made an earlier pass
 * of this analysis report 658 reachable C/Ns instead of 811.)
 *
 * A cn-keyed row stores `parts_no = NULL`, which needs the column's NOT NULL
 * dropped. Two reasons it must be NULL and not '':
 *   • the table's existing UNIQUE is (machine_name, tooling_name, parts_no,
 *     tool_dwg_no). Hundreds of C/Ns legitimately share one pusher drawing, so
 *     with a constant '' they all collapse onto the same key and the insert
 *     fails. Postgres treats NULLs as distinct in a unique index, so they don't.
 *   • every legacy consumer matches `parts_no = <a real part number>`, and SQL
 *     equality against NULL is never true — so these rows are invisible to all of
 *     them. This migration cannot change any existing selection.
 * (Verified: no spec row carries an empty-string pn — all 14,353 blanks are NULL —
 * so nothing joins to them by accident either.)
 *
 * IDEMPOTENT: re-running deletes this machine+tooling's cn-keyed rows and reseeds
 * from the live plan, so it also serves as the refresh when the plan moves.
 *
 *   node api/engineer/mtc/db_migrations/20260817_pusher_op1_cn_map.js            # apply
 *   node api/engineer/mtc/db_migrations/20260817_pusher_op1_cn_map.js --dry-run  # report only
 *   node api/engineer/mtc/db_migrations/20260817_pusher_op1_cn_map.js --revert   # remove the rows
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const cnFormat = require('../utils/cnFormat');

const MACHINE = 'FTL-10(I)';
const TOOLING = 'PUSHER OP1';
const INVENTORY = 'tooling_ftl10';
const SOURCE = '20260817_pusher_op1_cn_map (lpb.eng_r_pi_tool)';

const DRY = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');

async function ensureSchema() {
  await engPool.query(`ALTER TABLE tooling_partno_map ADD COLUMN IF NOT EXISTS cn TEXT`);
  // Relax NOT NULL so a cn-keyed row can leave parts_no empty. Purely a relaxation:
  // no existing row changes and the admin UI still supplies one on every write.
  await engPool.query(`ALTER TABLE tooling_partno_map ALTER COLUMN parts_no DROP NOT NULL`);
  // The table's existing UNIQUE is on (machine_name, tooling_name, parts_no, tool_dwg_no)
  // and NULL parts_no makes every cn-keyed row distinct there — so uniqueness for THEM
  // has to be enforced on the cn instead.
  await engPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS tooling_partno_map_cn_key
      ON tooling_partno_map (machine_name, tooling_name, cn, tool_dwg_no)
      WHERE cn IS NOT NULL`);
  await engPool.query(`
    CREATE INDEX IF NOT EXISTS tooling_partno_map_cn_idx
      ON tooling_partno_map (cn) WHERE cn IS NOT NULL`);
}

async function main() {
  await ensureSchema();

  if (REVERT) {
    const { rowCount } = await engPool.query(
      `DELETE FROM tooling_partno_map WHERE machine_name = $1 AND tooling_name = $2 AND cn IS NOT NULL`,
      [MACHINE, TOOLING]
    );
    console.log(`reverted — removed ${rowCount} cn-keyed rows`);
    return;
  }

  // 1. The shelf is the whitelist. A plan row naming a drawing we do not stock is
  //    not selectable, so it is not mapped.
  const { rows: shelf } = await engPool.query(
    `SELECT tooling_no FROM ${INVENTORY} WHERE tooling_name = $1`, [TOOLING]
  );
  const shelfNos = shelf.map(r => String(r.tooling_no).trim()).filter(Boolean);
  console.log(`shelf rows for ${TOOLING}: ${shelfNos.length}`);
  if (!shelfNos.length) throw new Error(`no ${TOOLING} rows in ${INVENTORY} — nothing to map`);

  // 2. What the factory actually fitted, per C/N.
  const { rows: plan } = await maqPool.query(
    `SELECT DISTINCT process_plan_no, tool_dwg_no
       FROM lpb.eng_r_pi_tool
      WHERE tool_dwg_no = ANY($1)`,
    [shelfNos]
  );
  console.log(`plan rows naming one of them: ${plan.length}`);

  // 3. control_no → spec CN. One C/N planning two different pushers is ambiguous:
  //    there is no rule to pick between them, so map neither and say so.
  const byCn = new Map();
  const ambiguous = new Set();
  for (const r of plan) {
    const cn = cnFormat.toSpecCn(r.process_plan_no);
    if (!cn) continue;
    const dwg = String(r.tool_dwg_no).trim();
    if (byCn.has(cn) && byCn.get(cn) !== dwg) { ambiguous.add(cn); continue; }
    byCn.set(cn, dwg);
  }
  for (const cn of ambiguous) byCn.delete(cn);

  console.log(`distinct C/Ns mapped : ${byCn.size}`);
  console.log(`ambiguous, skipped   : ${ambiguous.size}${ambiguous.size ? ' → ' + [...ambiguous].join(', ') : ''}`);

  // 4. How much of this is reachable today? A C/N with no spec row cannot be
  //    searched at all, so report the split rather than quietly seeding rows that
  //    will never be read.
  const cns = [...byCn.keys()];
  const { rows: specced } = await engPool.query(
    `SELECT cn FROM tooling_spec_process WHERE cn = ANY($1)`, [cns]
  );
  console.log(`... of which specced : ${specced.length} (the rest are seeded and become live if the C/N is ever added)`);

  if (DRY) {
    console.log('\n--dry-run — nothing written. Sample:');
    console.table(cns.slice(0, 8).map(cn => ({ cn, tool_dwg_no: byCn.get(cn) })));
    return;
  }

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const del = await client.query(
      `DELETE FROM tooling_partno_map WHERE machine_name = $1 AND tooling_name = $2 AND cn IS NOT NULL`,
      [MACHINE, TOOLING]
    );

    // Multi-row insert in chunks (7 cols; well under the 65535 param ceiling).
    const COLS = 7;
    const CHUNK = 2000;
    let inserted = 0;
    for (let i = 0; i < cns.length; i += CHUNK) {
      const slice = cns.slice(i, i + CHUNK);
      const values = slice.flatMap(cn => [MACHINE, TOOLING, null, cn, byCn.get(cn), false, SOURCE]);
      const ph = slice.map((_, ri) =>
        `(${Array.from({ length: COLS }, (__, ci) => `$${ri * COLS + ci + 1}`).join(',')})`
      ).join(',');
      const r = await client.query(
        `INSERT INTO tooling_partno_map
           (machine_name, tooling_name, parts_no, cn, tool_dwg_no, is_forbidden, source)
         VALUES ${ph}`,
        values
      );
      inserted += r.rowCount;
    }
    await client.query('COMMIT');
    console.log(`\nremoved ${del.rowCount}, inserted ${inserted} cn-keyed rows for ${MACHINE} · ${TOOLING}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => {
    console.error(e);
    await Promise.all([engPool.end(), maqPool.end()]).catch(() => {});
    process.exit(1);
  });
