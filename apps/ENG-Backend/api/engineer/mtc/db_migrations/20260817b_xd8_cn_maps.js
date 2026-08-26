'use strict';

/**
 * XD-8 — the three families TEMPLATE_B selects and Tooling Select could not.
 * ---------------------------------------------------------------------------
 * Reported from the floor 2026-08-17: XD-8 was returning 4858-22 / 4858-12 / 4858-08
 * while TEMPLATE_B's SPH(DT) sheet lists 4858-22 / 4858-15 / 4858-17 / 4858-01.
 *
 * Both halves of that were true. `20260814f_xd8_sph.js` loaded SIX families into
 * `tooling_xd8` but only wrote formulas for three, so STOPPER L (4858-15, 32 rows),
 * STOPPER R (4858-17, 44) and WRIST END ASSY (4858-01, 30) sat on the shelf
 * unreachable — 106 rows the search never listed. (`.claude/rules/tooling-select.md`
 * claimed all six shipped; it was wrong and is corrected.)
 *
 * WHY THEY ARE PINNED PER C/N RATHER THAN GIVEN FORMULAS
 * The XD-8 workbook's STOPPER(L) sheet has a full calculation block, and it was
 * measured against 1,206 planned stoppers before this was chosen:
 *
 *   • `A: ボール肩径以上なら可` → `dim_a >= SD` holds for **99% (L) / 100% (R)**, so it
 *     is a real constraint — but the median stopper sits **5.45 mm (L) / 8.13 mm (R)**
 *     above SD. It is a sanity floor, not a selector: on a 32-row shelf it excludes
 *     almost nothing.
 *   • `B = ROUND(BW/2, 2)`, the sheet's own design dimension, reproduces the shelf on
 *     **20% within 0.1 mm** for L and **0%** for R (median +10.34 — R's dim_b is not
 *     that quantity at all).
 *   • The block's other outputs read the COLLET sheet (`J41/K41 = IF(COLLET!D25…)`),
 *     so they cannot be computed from the part alone.
 *   • The shelf's own `組合せ コレット` column pairs each stopper to one or more collets.
 *     Read as a list (the cell uses `・` separators) it agrees with the plan on only
 *     **62% (L) / 69% (R)**, and covers 27 of 32 / 21 of 44 shelf rows.
 *
 * The sheet says why, in its own words above the block:
 * 「設計では従来通り進めてもらうが、"選定"では…」 — proceed as before for DESIGN, but
 * SELECTION is a different question. Same shape as FTL PUSHER OP1: the design rule is
 * not the selection rule, and `lpb.eng_r_pi_tool` records the selection per C/N.
 *
 * Mappable (measured): STOPPER L 1,343 C/Ns (2 ambiguous) · STOPPER R 1,344 (1) ·
 * WRIST END ASSY 863 (0). WRIST END ASSY has 109 plan rows naming a drawing not on its
 * 29-row shelf — those are reported, not mapped, because an unstocked drawing is not
 * selectable.
 *
 *   node api/engineer/mtc/db_migrations/20260817b_xd8_cn_maps.js            # apply
 *   node api/engineer/mtc/db_migrations/20260817b_xd8_cn_maps.js --dry-run  # report only
 *   node api/engineer/mtc/db_migrations/20260817b_xd8_cn_maps.js --revert   # remove the rows
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');

const MACHINE = 'XD-8';
const INVENTORY = 'tooling_xd8';
const SOURCE = '20260817b_xd8_cn_maps (lpb.eng_r_pi_tool)';

const FAMILIES = [
  { tooling: 'STOPPER L', family: '4858-15' },
  { tooling: 'STOPPER R', family: '4858-17' },
  { tooling: 'WRIST END ASSY', family: '4858-01' },
];

const DRY = process.argv.includes('--dry-run');
const REVERT = process.argv.includes('--revert');

async function main() {
  await ensureCnMapSchema(engPool);

  if (REVERT) {
    for (const f of FAMILIES) {
      const { rowCount } = await engPool.query(
        `DELETE FROM tooling_partno_map
          WHERE machine_name = $1 AND tooling_name = $2 AND cn IS NOT NULL`,
        [MACHINE, f.tooling]
      );
      console.log(`reverted ${MACHINE} · ${f.tooling}: removed ${rowCount}`);
    }
    return;
  }

  const table = [];
  for (const f of FAMILIES) {
    const s = await seedCnMapFromPlan({
      engPool, maqPool, machine: MACHINE, inventory: INVENTORY,
      tooling: f.tooling, family: f.family, source: SOURCE, dryRun: DRY,
    });
    table.push({
      tooling: f.tooling,
      family: f.family,
      shelf: s.shelf,
      mapped: s.mapped,
      specced: s.specced,
      ambiguous: s.ambiguous.length,
      'plan rows off-shelf': s.offShelf,
      removed: s.removed,
      inserted: s.inserted,
    });
    if (s.ambiguous.length) {
      console.log(`  ${f.tooling}: skipped ambiguous C/Ns → ${s.ambiguous.join(', ')}`);
    }
  }
  console.table(table);
  if (DRY) console.log('--dry-run — nothing written.');
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => {
    console.error(e);
    await Promise.all([engPool.end(), maqPool.end()]).catch(() => {});
    process.exit(1);
  });
