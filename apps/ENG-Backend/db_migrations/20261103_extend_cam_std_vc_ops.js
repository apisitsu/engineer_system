/**
 * CAD/CAM standard cutting speeds — three more operations: parting, grooving, centre.
 *
 * 20261102_create_cam_std_vc.js made `cam_std_vc.operation` a CHECK over five
 * values. This widens it to eight and seeds draft ranges for the new ones.
 * Threading is still absent: no figure has been found that can be cited.
 *
 * WHERE THE FIGURES CAME FROM (2026-11-03, unverified — rows stay 'draft'):
 *   parting / grooving   Haas "Grooving Speeds & Feeds" chart, insert grade HU30, VDI 3323
 *                        groups N and M, converted from sfm (x0.3048):
 *                          parting  N 660–1480 sfm = 201–451   M 200–460 sfm = 61–140
 *                          grooving N 490–1310 sfm = 149–399   M 200–330 sfm = 61–101
 *                        Group M is wider than 17-4PH H1025 / 13-8Mo H1050 — treat as a ceiling.
 *   centre / spotting    Hoffmann HSS-E TiAlN spotting-drill datasheets and Hommel DIN 333:
 *                          aluminium 50–70   stainless >900 N/mm2 10–13   titanium 6–8
 *                        HSS values; a carbide centre drill would run faster.
 *   Titanium parting/grooving: no figure found, so none seeded (the client then says
 *   "no standard" for those tools instead of guessing).
 *
 * Idempotent: the constraint is replaced only when it does not already admit 'centre',
 * the seed is ON CONFLICT DO NOTHING (a range somebody corrected is never overwritten),
 * and the source note is appended only once.
 *
 * MIND WHOSE DATABASE THIS IS. apps/ENG-Backend/.env points PG_NEW_HOST at plbmp130,
 * so running this from the dev box alters the PRODUCTION table.
 *
 * Run: node db_migrations/20261103_extend_cam_std_vc_ops.js [--dry-run] [--revert] [--force]
 */
const { engPool } = require('../instance/eng_db');
const { guard, recordRun, recordRevert } = require('./lib/migrationLog');

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

const OLD_OPS = ['turning', 'milling', 'drilling', 'reaming', 'tap'];
const NEW_OPS = ['parting', 'grooving', 'centre'];
const CONSTRAINT = 'cam_std_vc_operation_check';
const NOTE = ' Parting/grooving: Haas HU30 chart (VDI 3323); centre drill: Hoffmann/Hommel HSS-E datasheets (2026-11-03). Unverified.';

// key -> [parting, grooving, centre]; null = no figure found
const SEED = {
  '7075-T73511': [[201, 451], [149, 399], [50, 70]],
  '17-4PH': [[61, 140], [61, 101], [10, 13]],
  'PH13-8Mo': [[61, 140], [61, 101], [10, 13]],
  'Ti-6Al-4V': [null, null, [6, 8]],
};

const list = (ops) => ops.map((o) => `'${o}'`).join(',');

async function setConstraint(client, ops) {
  await client.query(`ALTER TABLE cam_std_vc DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`);
  await client.query(`ALTER TABLE cam_std_vc ADD CONSTRAINT ${CONSTRAINT} CHECK (operation IN (${list(ops)}))`);
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    console.log(`Revert: delete ${NEW_OPS.join('/')} rows, restore the five-operation constraint.`);
    if (dryRun) { console.log('(dry run — nothing written)'); return; }
    const client = await engPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM cam_std_vc WHERE operation = ANY($1)', [NEW_OPS]);
      await setConstraint(client, OLD_OPS);
      await client.query('UPDATE cam_std_material SET source_note = REPLACE(source_note, $1, \'\')', [NOTE]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally { client.release(); }
    await recordRevert({ file: __filename });
    return;
  }

  console.log(`Allow ${NEW_OPS.join(', ')} in cam_std_vc and seed draft ranges for ${Object.keys(SEED).length} materials.`);
  if (dryRun) { console.log('(dry run — nothing written)'); return; }

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    await setConstraint(client, [...OLD_OPS, ...NEW_OPS]);
    for (const [key, ranges] of Object.entries(SEED)) {
      const exists = await client.query('SELECT 1 FROM cam_std_material WHERE key = $1', [key]);
      if (exists.rowCount === 0) { console.log(`  skip ${key}: no such material`); continue; }
      for (let i = 0; i < NEW_OPS.length; i++) {
        if (!ranges[i]) continue;
        await client.query(
          `INSERT INTO cam_std_vc (material_key, operation, vc_min, vc_max)
           VALUES ($1,$2,$3,$4) ON CONFLICT (material_key, operation) DO NOTHING`,
          [key, NEW_OPS[i], ranges[i][0], ranges[i][1]]
        );
      }
      await client.query(
        `UPDATE cam_std_material SET source_note = source_note || $2
          WHERE key = $1 AND position($2 in source_note) = 0`, [key, NOTE]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally { client.release(); }
  await recordRun({ file: __filename });
  console.log('Done.');
}

main()
  .catch((err) => { console.error('Migration failed:', err); process.exitCode = 1; })
  .finally(() => engPool.end());
