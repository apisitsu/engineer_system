'use strict';

/**
 * Seed `tooling_partno_map` cn-keyed rows for a tooling family from the factory plan.
 * ---------------------------------------------------------------------------------
 * For a family whose selection rule cannot be derived — the design sheet computes a
 * NEW tool, while the shop's choice among existing ones is recorded per part — the
 * factory process plan (`lpb.eng_r_pi_tool`) is itself the selection. Pin it per C/N.
 *
 * Extracted from `20260817_pusher_op1_cn_map.js` when XD-8 needed the same treatment
 * for three families. Everything load-bearing is in that migration's header; the two
 * rules worth repeating here:
 *
 *   • Convert control_no → spec cn with `cnFormat.toSpecCn` and NOTHING else. An
 *     ad-hoc "strip leading zeros" version mangles short suffixes (A41-00045 → 4145
 *     instead of 410045).
 *   • cn-keyed rows leave `parts_no` NULL. The table's UNIQUE covers parts_no and
 *     many C/Ns share one drawing, so a constant placeholder collides; and NULL keeps
 *     the rows invisible to every legacy `parts_no = <value>` consumer.
 *
 * The SHELF is the whitelist: a plan row naming a drawing the inventory table does not
 * stock is not selectable, so it is not mapped and is reported instead. A C/N planning
 * two different tools of the same family is AMBIGUOUS — there is no rule to choose
 * between them, so it is skipped rather than guessed.
 *
 * Idempotent per (machine, tooling): deletes that family's cn-keyed rows and reseeds,
 * so re-running is also the refresh when the plan moves.
 */

const cnFormat = require('../../utils/cnFormat');

/**
 * @param {object}  o
 * @param {object}  o.engPool     eng_system pool
 * @param {object}  o.maqPool     maqdb pool (holds lpb.*)
 * @param {string}  o.machine     tooling_machine.machine_name
 * @param {string}  o.tooling     tooling_name, in BOTH the inventory table and the map
 * @param {string}  o.inventory   inventory table holding the shelf
 * @param {string}  o.family      drawing family prefix, e.g. '4858-15'
 * @param {string}  o.source      provenance written to tooling_partno_map.source
 * @param {boolean} o.dryRun      report only
 * @returns {Promise<{mapped:number,ambiguous:string[],offShelf:number,specced:number,inserted:number}>}
 */
async function seedCnMapFromPlan({ engPool, maqPool, machine, tooling, inventory, family, source, dryRun = false }) {
  // 1. The shelf — the set of drawings that can actually be selected.
  const { rows: shelf } = await engPool.query(
    `SELECT tooling_no FROM ${inventory} WHERE tooling_name = $1`, [tooling]
  );
  const shelfNos = new Set(shelf.map(r => String(r.tooling_no).trim()).filter(Boolean));
  if (!shelfNos.size) throw new Error(`no ${tooling} rows in ${inventory} — nothing to map`);

  // 2. What the factory actually fitted, per C/N.
  const { rows: plan } = await maqPool.query(
    `SELECT DISTINCT process_plan_no, tool_dwg_no
       FROM lpb.eng_r_pi_tool
      WHERE tool_dwg_no LIKE $1`, [`${family}%`]
  );

  const byCn = new Map();
  const ambiguous = new Set();
  let offShelf = 0;
  for (const r of plan) {
    const cn = cnFormat.toSpecCn(r.process_plan_no);
    if (!cn) continue;
    const dwg = String(r.tool_dwg_no).trim();
    if (!shelfNos.has(dwg)) { offShelf++; continue; }
    if (byCn.has(cn) && byCn.get(cn) !== dwg) { ambiguous.add(cn); continue; }
    byCn.set(cn, dwg);
  }
  for (const cn of ambiguous) byCn.delete(cn);

  const cns = [...byCn.keys()];
  const { rows: specced } = await engPool.query(
    `SELECT cn FROM tooling_spec_process WHERE cn = ANY($1)`, [cns]
  );

  const stats = {
    shelf: shelfNos.size,
    mapped: cns.length,
    ambiguous: [...ambiguous],
    offShelf,
    specced: specced.length,
    inserted: 0,
    removed: 0,
  };
  if (dryRun) return stats;

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const del = await client.query(
      `DELETE FROM tooling_partno_map
        WHERE machine_name = $1 AND tooling_name = $2 AND cn IS NOT NULL`,
      [machine, tooling]
    );
    stats.removed = del.rowCount;

    const COLS = 7;
    const CHUNK = 2000;
    for (let i = 0; i < cns.length; i += CHUNK) {
      const slice = cns.slice(i, i + CHUNK);
      const values = slice.flatMap(cn => [machine, tooling, null, cn, byCn.get(cn), false, source]);
      const ph = slice.map((_, ri) =>
        `(${Array.from({ length: COLS }, (__, ci) => `$${ri * COLS + ci + 1}`).join(',')})`
      ).join(',');
      const r = await client.query(
        `INSERT INTO tooling_partno_map
           (machine_name, tooling_name, parts_no, cn, tool_dwg_no, is_forbidden, source)
         VALUES ${ph}`,
        values
      );
      stats.inserted += r.rowCount;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return stats;
}

/** The schema both cn-map migrations need. Safe to call repeatedly. */
async function ensureCnMapSchema(engPool) {
  await engPool.query(`ALTER TABLE tooling_partno_map ADD COLUMN IF NOT EXISTS cn TEXT`);
  await engPool.query(`ALTER TABLE tooling_partno_map ALTER COLUMN parts_no DROP NOT NULL`);
  await engPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS tooling_partno_map_cn_key
      ON tooling_partno_map (machine_name, tooling_name, cn, tool_dwg_no)
      WHERE cn IS NOT NULL`);
  await engPool.query(`
    CREATE INDEX IF NOT EXISTS tooling_partno_map_cn_idx
      ON tooling_partno_map (cn) WHERE cn IS NOT NULL`);
}

module.exports = { seedCnMapFromPlan, ensureCnMapSchema };
