'use strict';
/**
 * Standard cutting speeds for the CAD/CAM module (2026-11-02).
 *
 * The CAM module opens an NC program, works out which material it is for, reads
 * each tool's Vc, and — on the operator's confirmation — proposes the standard
 * range instead (`cam/engine/cam/stdVc.js`). The ranges are kept here so the
 * shop can correct and sign them off without a deploy.
 *
 *   cam_std_material  one row per material (label, ISO group, the names a file is
 *                     recognised by, draft/approved)
 *   cam_std_vc        one row per (material, operation) — Vc range in m/min
 *
 * THE SEED IS A DRAFT. It is the "Vc_Table_Internal" supplied by the shop, whose
 * named sources (Sandvik, Kennametal, Seco/ISCAR, Machinery's Handbook) were never
 * cited by edition or page and have not been verified. Every material is seeded
 * `status = 'draft'`; the client labels each proposal made from a draft row. An
 * administrator marks a material 'approved' once its figures have been checked
 * against the tool maker's data.
 *
 * Additive only — it touches no existing table — so it can land before or after
 * the code that reads it (the client treats a missing table as "no standard
 * available" and proposes nothing).
 *
 * Idempotent: CREATE ... IF NOT EXISTS, and the seed uses ON CONFLICT DO NOTHING
 * so a re-run NEVER overwrites a range somebody has since corrected.
 *
 * MIND WHOSE DATABASE THIS IS. apps/ENG-Backend/.env points PG_NEW_HOST at
 * plbmp130, so running this from the dev box creates the tables in PRODUCTION.
 *
 * Run: node db_migrations/20261102_create_cam_std_vc.js [--dry-run] [--revert] [--force]
 */
const { engPool } = require('../instance/eng_db');
const { guard, recordRun, recordRevert } = require('./lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

// key, label, iso, aliases, then [turning, milling, drilling, reaming, tap]
const SEED = [
  ['7075-T73511', '7075-T73511 (aluminium)', 'ISO N', ['7075', '7075-T73511', 'AL7075', 'AL-7075'],
    [[300, 800], [300, 1000], [150, 300], [50, 100], [15, 30]]],
  ['17-4PH', '17-4PH H1025', 'ISO M/H', ['17-4PH', '17-4', '17_4PH', '174PH', '1.4548'],
    [[70, 120], [60, 100], [40, 70], [30, 50], [5, 12]]],
  ['PH13-8Mo', 'PH13-8Mo H1050', 'ISO M/H', ['PH13-8Mo', 'PH13-8', '13-8Mo', '13-8PH'],
    [[50, 90], [40, 80], [30, 60], [25, 45], [4, 10]]],
  ['Ti-6Al-4V', 'Ti-6Al-4V (Grade 5)', 'ISO S', ['Ti-6Al-4V', 'Ti6Al4V', 'TI-6AL-4V', 'Ti64', 'Titanium'],
    [[40, 80], [35, 70], [25, 50], [20, 40], [4, 8]]],
];
const OPS = ['turning', 'milling', 'drilling', 'reaming', 'tap'];

const DDL = `
CREATE TABLE IF NOT EXISTS cam_std_material (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  iso_group   TEXT NOT NULL DEFAULT '',
  aliases     TEXT[] NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  source_note TEXT NOT NULL DEFAULT '',
  sort_order  INT  NOT NULL DEFAULT 100,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS cam_std_vc (
  material_key TEXT NOT NULL REFERENCES cam_std_material(key) ON DELETE CASCADE,
  operation    TEXT NOT NULL CHECK (operation IN ('turning','milling','drilling','reaming','tap')),
  vc_min       NUMERIC NOT NULL CHECK (vc_min > 0),
  vc_max       NUMERIC NOT NULL CHECK (vc_max >= vc_min),
  PRIMARY KEY (material_key, operation)
);`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    console.log('Revert: dropping cam_std_vc and cam_std_material (any edits made since are lost).');
    if (!dryRun) {
      await engPool.query('DROP TABLE IF EXISTS cam_std_vc; DROP TABLE IF EXISTS cam_std_material;');
      await recordRevert({ file: __filename });
    }
    return;
  }

  console.log(`Create cam_std_material / cam_std_vc and seed ${SEED.length} draft materials.`);
  if (dryRun) { console.log('(dry run — nothing written)'); return; }

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(DDL);
    for (let i = 0; i < SEED.length; i++) {
      const [key, label, iso, aliases, ranges] = SEED[i];
      await client.query(
        `INSERT INTO cam_std_material (key, label, iso_group, aliases, status, source_note, sort_order, updated_by)
         VALUES ($1,$2,$3,$4,'draft',$5,$6,'migration')
         ON CONFLICT (key) DO NOTHING`,
        [key, label, iso, aliases,
          'Seed: shop-supplied Vc_Table_Internal (2026-10-30). Sources named there are not verified.', (i + 1) * 10]
      );
      for (let j = 0; j < OPS.length; j++) {
        await client.query(
          `INSERT INTO cam_std_vc (material_key, operation, vc_min, vc_max)
           VALUES ($1,$2,$3,$4) ON CONFLICT (material_key, operation) DO NOTHING`,
          [key, OPS[j], ranges[j][0], ranges[j][1]]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await recordRun({ file: __filename });
  console.log('Done.');
}

main()
  .catch((err) => { console.error('Migration failed:', err); process.exitCode = 1; })
  .finally(() => engPool.end());
