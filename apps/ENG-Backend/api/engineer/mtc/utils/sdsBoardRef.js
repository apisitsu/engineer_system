'use strict';

/**
 * The board key for one Setup Data Sheet: `<cn>||<machine>||<process_code>`.
 *
 * Two different callers have to agree on this string or the same sheet ends up
 * with two cards:
 *   • sdsApprovalController — when someone signs, using the machine they picked
 *     on screen, which may be any member of a group (e.g. TSG-300ZNC);
 *   • sdsV2ReportController — when the coverage report finds an unsigned sheet,
 *     using the group's *representative* (e.g. TSG-300W).
 *
 * So the machine segment is normalised to the GROUP LABEL whenever the machine
 * belongs to one. The group is used rather than the report's representative
 * because the representative is chosen by which member happens to carry the
 * Excel config — it moves when config moves, and a key that moves orphans every
 * card already linked under the old value.
 */

const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');

const TTL_MS = 10 * 60 * 1000;
let _map = null;      // machine_type_name → machine_group
let _loadedAt = 0;

async function groupMap() {
  if (_map && Date.now() - _loadedAt < TTL_MS) return _map;
  const { rows } = await engPool.query(
    `SELECT machine_type_name, machine_group
       FROM ${TABLES.SDS_MACHINE_TYPE_CODE}
      WHERE machine_group IS NOT NULL AND machine_type_name IS NOT NULL`
  );
  _map = Object.fromEntries(rows.map((r) => [r.machine_type_name, r.machine_group]));
  _loadedAt = Date.now();
  return _map;
}

/** Machine name as it should appear in a board key: the group label, or itself. */
async function boardMachineName(machineTypeName) {
  if (!machineTypeName) return '';
  try {
    return (await groupMap())[machineTypeName] || machineTypeName;
  } catch (_) {
    return machineTypeName; // fail-open: an un-normalised key beats no card at all
  }
}

async function boardRef(cn, machineTypeName, processCode) {
  return `${cn}||${await boardMachineName(machineTypeName)}||${processCode}`;
}

/** Drop the cache — call after machine types are renamed or regrouped. */
function invalidate() {
  _map = null;
  _loadedAt = 0;
}

module.exports = { boardRef, boardMachineName, invalidate };
