'use strict';

/**
 * Create the core PB Ring tooling tables — `pbring_tooling`, `pbring_cost_pending`,
 * `pbring_approver`.
 * ------------------------------------------------------------------------------
 * PB Ring is a separate, DB-backed port of the standalone "PB Ring Tooling Manager"
 * prototype (outside this repo). Every table here is new and `pbring_`-prefixed —
 * none of it is read or written by the live SDS pipeline / Tooling Select, and
 * `mc_type`/`mc_key` on `pbring_tooling` are PB Ring's own free-text machine-name
 * space, never checked against `sds_machine_type_code` or `tooling_machine`. See
 * the "Machine Names (MTC)" section of the root CLAUDE.md for why that separation
 * matters (those tables are joined by raw machine-name string, and a collision
 * there fails silently for every other part on the floor).
 *
 * `pbring_cost_pending` is the dual-cost-input queue: a row is inserted whenever
 * an auto-detect pass against `maqdb.lpb.pc_material_purchase` finds a PO/price/
 * qty/receive-date that differs from what's stored on `pbring_tooling`, and it sits
 * `pending` until a listed `pbring_approver` explicitly approves or rejects it.
 * Manual edits never go through this table — they write `pbring_tooling` directly
 * with `cost_source='manual'`.
 *
 * Idempotent; `--revert` drops all three tables (child-to-parent order).
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const revert = process.argv.includes('--revert');

const DDL = `
CREATE TABLE IF NOT EXISTS pbring_tooling (
  id                 BIGSERIAL PRIMARY KEY,
  part_group         VARCHAR(16),
  cn                 VARCHAR(64),
  part_name          VARCHAR(128),
  part_no            VARCHAR(64),
  process_code       VARCHAR(32),
  process_name       VARCHAR(128),
  mc_type            VARCHAR(64),
  mc_key             VARCHAR(64),
  mc_no              VARCHAR(32),
  tooling_item       VARCHAR(255),
  tool_code          VARCHAR(128),
  tool_code_base     VARCHAR(64),
  tool_rev           VARCHAR(16),
  maker              VARCHAR(64),
  po_no              VARCHAR(64),
  machine_qty        NUMERIC,
  order_qty          NUMERIC,
  unit_price         NUMERIC,
  total_price        NUMERIC,
  receive_date       DATE,
  status             VARCHAR(64),
  remark             TEXT,
  pic                VARCHAR(64),
  new_dwg_no         VARCHAR(64),
  rank               NUMERIC,
  cost_source        VARCHAR(16) NOT NULL DEFAULT 'manual' CHECK (cost_source IN ('manual','maqdb')),
  cost_updated_at    TIMESTAMPTZ,
  cost_approved_by   VARCHAR(64),
  created_by         VARCHAR(64),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pbring_tooling_part_group_idx     ON pbring_tooling (part_group);
CREATE INDEX IF NOT EXISTS pbring_tooling_cn_idx              ON pbring_tooling (cn);
CREATE INDEX IF NOT EXISTS pbring_tooling_mc_type_idx         ON pbring_tooling (mc_type);
CREATE INDEX IF NOT EXISTS pbring_tooling_status_idx          ON pbring_tooling (status);
CREATE INDEX IF NOT EXISTS pbring_tooling_tool_code_base_idx  ON pbring_tooling (tool_code_base);
CREATE INDEX IF NOT EXISTS pbring_tooling_po_no_idx           ON pbring_tooling (po_no) WHERE po_no IS NOT NULL AND po_no <> '';

CREATE TABLE IF NOT EXISTS pbring_cost_pending (
  id                     BIGSERIAL PRIMARY KEY,
  tooling_id             BIGINT NOT NULL REFERENCES pbring_tooling(id) ON DELETE CASCADE,
  source                 VARCHAR(16) NOT NULL DEFAULT 'maqdb',
  detected_po_no         VARCHAR(64),
  detected_price         NUMERIC,
  detected_qty           NUMERIC,
  detected_receive_date  DATE,
  detected_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                 VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by             VARCHAR(64),
  decided_at             TIMESTAMPTZ,
  note                   TEXT
);
-- At most one open ("pending") detection per tooling row — re-running detection
-- updates this row instead of piling up duplicates for the same drift.
CREATE UNIQUE INDEX IF NOT EXISTS pbring_cost_pending_one_open_idx
  ON pbring_cost_pending (tooling_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS pbring_cost_pending_status_idx ON pbring_cost_pending (status);

CREATE TABLE IF NOT EXISTS pbring_approver (
  u_code     VARCHAR(32) PRIMARY KEY,
  active     BOOLEAN NOT NULL DEFAULT true,
  added_by   VARCHAR(64),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

const COMMENTS = `
COMMENT ON TABLE pbring_tooling IS $c$PB Ring tooling + cost, DB-backed port of the standalone tooling_manager.html prototype. Independent of sds_*/tooling_* — mc_type/mc_key are PB Ring's own machine-name space. See api/engineer/mtc/db_migrations/20261003_pbring_create_core.js.$c$;
COMMENT ON COLUMN pbring_tooling.cost_source IS $c$'manual' = typed in by a user; 'maqdb' = copied in from an approved pbring_cost_pending row detected against lpb.pc_material_purchase.$c$;
COMMENT ON TABLE pbring_cost_pending IS $c$Pending maqdb-detected cost drift awaiting an explicit decision from a listed pbring_approver. Manual edits never pass through this table.$c$;
COMMENT ON TABLE pbring_approver IS $c$Named allow-list of u_code who may approve/reject a pbring_cost_pending row. Admin-managed.$c$;
`;

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query('DROP TABLE IF EXISTS pbring_cost_pending');
    await engPool.query('DROP TABLE IF EXISTS pbring_approver');
    await engPool.query('DROP TABLE IF EXISTS pbring_tooling');
    console.log('reverted: pbring_cost_pending, pbring_approver, pbring_tooling dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(DDL);
  await engPool.query(COMMENTS);

  for (const t of ['pbring_tooling', 'pbring_cost_pending', 'pbring_approver']) {
    const { rows } = await engPool.query(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(`${t}: ${rows[0].n} row(s)`);
  }

  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261003_pbring_create_core.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
