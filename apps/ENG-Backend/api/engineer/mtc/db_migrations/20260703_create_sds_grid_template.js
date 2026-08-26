/**
 * Migration: Multiple SDS grid templates.
 *
 * Until now the SDS PDF grid layout lived as a single JSON blob in
 * sds_template_css_config (config_key = 'grid-layout'). This migration introduces a
 * named-template table so several layouts can coexist and be assigned per machine.
 *
 *   sds_grid_template          — named grid layouts (one flagged is_default)
 *   sds_machine_type_code.grid_template_id — optional per-machine template (NULL = default)
 *
 * The existing single grid-layout is copied into a default row named 'Standard' so the
 * current behaviour is preserved. The legacy grid-layout row is LEFT IN PLACE as a
 * fallback (the renderer still reads it if no template rows exist).
 */
const { engPool } = require('../../../../instance/eng_db');

async function migrate() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sds_grid_template (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(120) NOT NULL UNIQUE,
        grid_json   TEXT NOT NULL,
        is_default  BOOLEAN NOT NULL DEFAULT FALSE,
        created_by  VARCHAR(50),
        updated_by  VARCHAR(50),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // At most one default — a partial unique index enforces it.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sds_grid_template_one_default
        ON sds_grid_template (is_default) WHERE is_default
    `);

    // Assignable per-machine template (NULL → use the default template).
    await client.query(`
      ALTER TABLE sds_machine_type_code
        ADD COLUMN IF NOT EXISTS grid_template_id INTEGER
        REFERENCES sds_grid_template(id) ON DELETE SET NULL
    `);

    // Seed the 'Standard' default from the existing single grid-layout (once).
    const existing = await client.query(
      `SELECT config_value FROM sds_template_css_config WHERE config_key = 'grid-layout' LIMIT 1`
    );
    const already = await client.query(`SELECT 1 FROM sds_grid_template LIMIT 1`);
    if (!already.rows.length) {
      const gridJson = existing.rows[0]?.config_value
        || JSON.stringify({ rows: 56, cols: 48, borders: {}, fills: {}, cells: {}, merges: [] });
      await client.query(
        `INSERT INTO sds_grid_template (name, grid_json, is_default, created_by)
         VALUES ('Standard', $1, TRUE, 'migration')`,
        [gridJson]
      );
      console.log('[migration] seeded Standard default template from legacy grid-layout');
    } else {
      console.log('[migration] sds_grid_template already populated — skip seed');
    }

    await client.query('COMMIT');
    console.log('[migration] sds_grid_template created; grid_template_id added to sds_machine_type_code');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

migrate().catch(e => { console.error(e); process.exit(1); });
