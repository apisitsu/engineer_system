'use strict';

/**
 * CAD/CAM machines — data access.
 *
 * One row per machine the shop has added, or changed from the client's built-in
 * list (same id = override; see the migration). The row's `data` is the machine
 * in the client's own shape, checked here so a bad save cannot reach every
 * operator's feeds and speeds.
 */

const { engPool } = require('../../../instance/eng_db');
const { TABLES, MACHINE_AXES } = require('./camConstants');

class MachineError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Linear axes of each axis set, as in the client's `AXES`. */
const LINEAR = {
  mill3: ['X', 'Y', 'Z'], mill4: ['X', 'Y', 'Z'], mill5bc: ['X', 'Y', 'Z'],
  turn2: ['X', 'Z'], turn3c: ['X', 'Z'], swiss: ['X', 'Y', 'Z'],
};
const AXES_FOR = { mill: ['mill3', 'mill4', 'mill5bc'], turn: ['turn2', 'turn3c', 'swiss'] };

function text(b, key, max, required) {
  const v = typeof b[key] === 'string' ? b[key].trim() : '';
  if (required && !v) throw new MachineError(400, `${key} is required`);
  if (v.length > max) throw new MachineError(400, `${key} must be at most ${max} characters`);
  return v;
}

function num(b, key, lo, hi, { required = true, integer = false } = {}) {
  const raw = b[key];
  if (raw === undefined || raw === null || raw === '') {
    if (required) throw new MachineError(400, `${key} is required`);
    return undefined;
  }
  const v = Number(raw);
  if (!Number.isFinite(v) || v < lo || v > hi || (integer && !Number.isInteger(v))) {
    throw new MachineError(400, `${key} must be ${integer ? 'a whole number ' : ''}from ${lo} to ${hi}`);
  }
  return v;
}

/** Validate one machine body; returns the cleaned `data` or throws a MachineError(400). */
function clean(id, body) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)) {
    throw new MachineError(400, 'machine id must be 1-48 lower-case letters, digits or -');
  }
  const b = body || {};
  if (!['mill', 'turn'].includes(b.kind)) throw new MachineError(400, 'kind must be mill or turn');
  const axes = b.axes ?? (b.kind === 'mill' ? 'mill3' : 'turn2');
  if (!MACHINE_AXES.includes(axes) || !AXES_FOR[b.kind].includes(axes)) {
    throw new MachineError(400, `axes must be one of ${AXES_FOR[b.kind].join(', ')} for a ${b.kind === 'mill' ? 'mill' : 'lathe'}`);
  }
  const data = {
    kind: b.kind,
    brand: text(b, 'brand', 60, true),
    model: text(b, 'model', 60, true),
    controller: text(b, 'controller', 40, true),
    note: text(b, 'note', 200, false),
    axes,
    maxRpm: num(b, 'maxRpm', 1, 100000),
    minRpm: num(b, 'minRpm', 0, 100000),
    maxFeed: num(b, 'maxFeed', 1, 200000),
    rapidRate: num(b, 'rapidRate', 1, 200000),
    rigidity: num(b, 'rigidity', 0.1, 1.5, { required: false }) ?? 1,
    toolStations: num(b, 'toolStations', 1, 500, { required: false, integer: true }),
  };
  if (data.minRpm >= data.maxRpm) throw new MachineError(400, 'minRpm must be below maxRpm');
  if (b.kind === 'turn') {
    data.maxTurnRpm = num(b, 'maxTurnRpm', 1, 100000, { required: false });
    data.maxTurnDia = num(b, 'maxTurnDia', 1, 5000, { required: false });
  }
  const travel = b.travel || {};
  const home = b.home || {};
  data.travel = {};
  data.home = {};
  for (const a of LINEAR[axes]) {
    data.travel[a] = num(travel, a, 1, 10000);
    // Home is a machine coordinate: 0 on most controls, where G28 is machine zero.
    data.home[a] = num(home, a, -10000, 10000, { required: false }) ?? 0;
  }
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
  return data;
}

const toMachine = (r) => ({ id: r.id, ...r.data, updatedBy: r.updated_by || null, updatedAt: r.updated_at });

/** Every machine row, by id. */
async function listAll() {
  const { rows } = await engPool.query(
    `SELECT id, data, updated_by, updated_at FROM ${TABLES.CAM_MACHINE} ORDER BY id`
  );
  return rows.map(toMachine);
}

/** Create or replace one machine. */
async function upsert(id, body, { empno }) {
  const data = clean(id, body);
  const { rows } = await engPool.query(
    `INSERT INTO ${TABLES.CAM_MACHINE} (id, data, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING id, data, updated_by, updated_at`,
    [id, data, empno]
  );
  return toMachine(rows[0]);
}

/** Remove one row: a built-in goes back to its own figures, an added machine is gone. */
async function remove(id) {
  const { rowCount } = await engPool.query(`DELETE FROM ${TABLES.CAM_MACHINE} WHERE id = $1`, [id]);
  if (rowCount === 0) throw new MachineError(404, 'no such machine');
}

module.exports = { listAll, upsert, remove, clean, MachineError };
