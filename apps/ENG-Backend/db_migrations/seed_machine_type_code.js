/**
 * Seed sds_machine_type_code from machine_type_code.xlsx
 * Run: node db_migrations/seed_machine_type_code.js
 */
const path = require('path');
const XLSX = require('xlsx');
const { engPool } = require('../instance/eng_db');

const XLSX_PATH = path.join(__dirname, '../api/engineer/mtc/templates/machine_type_code.xlsx');

async function seed() {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets['Innovator'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Skip header row
  const data = rows.slice(1)
    .map(r => ({ code: String(r[0] || '').trim(), name: String(r[1] || '').trim() }))
    .filter(r => r.code);

  console.log(`Seeding ${data.length} machine type codes...`);

  let inserted = 0, skipped = 0;
  for (const row of data) {
    try {
      await engPool.query(
        `INSERT INTO sds_machine_type_code (machine_type_code, machine_type_name)
         VALUES ($1, $2)
         ON CONFLICT (machine_type_code) DO UPDATE SET machine_type_name = EXCLUDED.machine_type_name`,
        [row.code, row.name || null]
      );
      inserted++;
    } catch (err) {
      console.error(`  Skip ${row.code}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`Done: ${inserted} upserted, ${skipped} skipped`);
  await engPool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
