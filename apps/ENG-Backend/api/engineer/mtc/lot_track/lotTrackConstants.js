'use strict';

/**
 * Lot Status Tracker — constants.
 *
 * A self-contained MTC sub-module that answers "where is this production lot right
 * now, what has it passed, what is left, how long did each step take" and renders it
 * as a roadmap. It reads only from maqdb (`lpb.*`) via `maqPool` and touches nothing
 * else in the codebase — one route line in `server.js`, no migration.
 *
 * The data source is deliberately behind a registry (`sources/`) so a future
 * real-time feed (AS/400 DB2, or the KZW job-check service) can be added as one more
 * source file without changing the route, the service or the page. Today the only
 * implementation is `maqdb`.
 */

const SOURCES = {
  MAQDB: 'maqdb',
};

const DEFAULT_SOURCE = process.env.LOT_TRACK_SOURCE || SOURCES.MAQDB;

// `lpb.pc_production.update_time` buckets (checked live 2026-09-01) land at roughly
// 04:00 / 12:00 / 21:00 UTC — a scheduled sync ~3×/day, NOT real-time. The page
// shows this so an operator knows the "current" step can be up to a shift behind.
const SYNC_NOTE = 'Synced from the production system about 3× a day (≈ 11:00 / 19:00 / 04:00 local) — the "current" step can be up to ~8 h behind.';

const TABLES = {
  PC_LOT: 'lpb.pc_lot',
  PC_LOT_PROCESS: 'lpb.pc_lot_process',
  PC_PRODUCTION: 'lpb.pc_production',
  ENG_PROCESS: 'lpb.eng_process',
};

module.exports = { SOURCES, DEFAULT_SOURCE, SYNC_NOTE, TABLES };
