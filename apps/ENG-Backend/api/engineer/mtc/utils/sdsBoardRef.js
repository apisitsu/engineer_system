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

/**
 * The reverse direction: a board key's machine segment → the real machine type
 * names it could mean.
 *
 * `boardRef` deliberately loses information — TSG-300ZNC and TSG-300W both write
 * `TSG-300W/TSG-300ZNC` — which is right for identifying the card and wrong for
 * anything that has to touch `sds_approval`, whose rows are keyed by the actual
 * machine. Anyone reading a `source_ref` back (the board's inline sign panel) has
 * to expand it and then decide, because a group label names no single sheet.
 *
 * A name that is not a group label is its own only candidate, which is the common
 * case: 38 of the 40 links on the live board resolve straight through.
 *
 * @returns {Promise<string[]>} one entry for an ordinary machine, several for a group
 */
async function groupMembers(machineSegment) {
  if (!machineSegment) return [];
  try {
    const map = await groupMap();
    const members = Object.entries(map)
      .filter(([, group]) => group === machineSegment)
      .map(([name]) => name)
      .sort();
    return members.length ? members : [machineSegment];
  } catch (_) {
    return [machineSegment];
  }
}

/** Drop the cache — call after machine types are renamed or regrouped. */
function invalidate() {
  _map = null;
  _loadedAt = 0;
}

module.exports = { boardRef, boardMachineName, groupMembers, invalidate };
