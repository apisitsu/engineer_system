/**
 * Migration: Create sds_template_css_config table
 * Stores CSS variable overrides for the Chrome/Puppeteer PDF template.
 * If no row exists for a key, the template's built-in fallback value is used.
 */
const { engPool } = require('../instance/eng_db');

async function migrate() {
  const client = await engPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sds_template_css_config (
        id          SERIAL PRIMARY KEY,
        config_key  TEXT NOT NULL UNIQUE,
        config_value TEXT NOT NULL,
        description TEXT,
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed default rows (only if table was empty)
    await client.query(`
      INSERT INTO sds_template_css_config (config_key, config_value, description) VALUES
        ('font-size-base',       '5.3pt',   'Body text — Excel sz=10 at 53% scale'),
        ('font-size-title',      '7pt',     'Title bar "SETUP DATA SHEET"'),
        ('font-size-section',    '9pt',     '"TOOLING & GRINDING CONDITION" heading'),
        ('font-size-badge',      '4.5pt',   'Tool ID badges (T01, T02 …)'),
        ('height-row-normal',    '3.65mm',  'Normal body row — 19.5pt × 53%'),
        ('height-row-sep',       '0.84mm',  'Thin separator row — 4.5pt × 53%'),
        ('height-row-img',       '21.9mm',  'Tool image row — 6 × normal row'),
        ('width-params-panel',   '26.13%',  'Params panel width (cols A-J)'),
        ('width-tooling-panel',  '54.60%',  'Tooling panel width (cols K-AN)'),
        ('width-grinding-panel', '19.27%',  'Grinding panel width (cols AO-AV)'),
        ('color-border-outer',   '#000000', 'Page outer border + major section dividers'),
        ('color-border-inner',   '#aaaaaa', 'Cell internal thin borders'),
        ('color-badge-bg',       '#1a3a8c', 'Tool ID badge background (blue)'),
        ('color-value-red',      '#cc0000', 'Highlighted value text (red)'),
        ('color-header-bg',      '#e0e0e0', 'Param-section header row background'),
        ('color-sep-bg',         '#f0f0f0', 'Thin separator row background')
      ON CONFLICT (config_key) DO NOTHING
    `);

    console.log('[migration] sds_template_css_config created/seeded');
  } finally {
    client.release();
  }
}

migrate().catch(e => { console.error(e); process.exit(1); });
