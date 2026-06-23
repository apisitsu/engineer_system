'use strict';
/**
 * Add the missing `category` → B5 mapping in sds_excel_mapping (shared layout).
 *
 * The SDS grid template has a "CATEGORY :" label at A5 with a merged value cell
 * B5:I5 (same single-cell pattern as material→M5 and program_name→Z5), but no
 * sds_excel_mapping row ever pointed `category` at it — so the part category
 * ("Ball Parts", "Race Parts", …) never rendered on the PDF. buildValueMap already
 * produces map['category']; it just had nowhere to land.
 *
 * Idempotent: skips if a shared `category` mapping already exists.
 * Run: node db_migrations/20260618_add_category_excel_mapping.js
 */
const { engPool } = require('../instance/eng_db');

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, cell_address FROM sds_excel_mapping
       WHERE param_key = 'category' AND machine_type_name IS NULL`
    );
    if (rows.length > 0) {
      console.log(`[skip] shared category mapping already exists: ${JSON.stringify(rows)}`);
      await client.query('ROLLBACK');
      return;
    }
    const ins = await client.query(
      `INSERT INTO sds_excel_mapping (machine_type_name, cell_address, param_key, description, is_active)
       VALUES (NULL, 'B5', 'category', 'Part category (CATEGORY : field)', true)
       RETURNING id, cell_address, param_key`
    );
    await client.query('COMMIT');
    console.log(`[ok] inserted category mapping: ${JSON.stringify(ins.rows[0])}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[error]', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
})();
