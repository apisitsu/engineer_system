'use strict';

/**
 * CAD/CAM shared library — data access.
 *
 * The client half of this is `cam/lib/workApi.js`, which presents exactly the
 * interface the old IndexedDB module did (`listMeta` / `getData` / `putRecord` /
 * `deleteRecord` / `clearAll`). These five functions are the server side of that
 * contract and nothing more; naming, ordering and the record shape stay on the
 * client in `engine/savedWork.js`, where they are tested.
 */

const { engPool } = require('../../../instance/eng_db');
const { TABLES } = require('./camConstants');

/**
 * Every row the list needs — meta only.
 *
 * `data` is deliberately not selected: a project carries a base64 STL and can be
 * megabytes, and the list shows none of it. Fetching payloads here would make
 * opening the library cost the size of the whole library.
 */
async function listMeta() {
  const { rows } = await engPool.query(
    `SELECT meta, owner_empno, owner_name, updated_at
       FROM ${TABLES.CAM_SAVED_WORK}
      ORDER BY updated_at DESC`
  );
  // The client's own meta shape is authoritative; who saved it is added on top
  // so a shared library can say whose work a row is.
  return rows.map((r) => ({
    ...r.meta,
    owner_empno: r.owner_empno,
    owner_name: r.owner_name,
  }));
}

/** One payload, by key. `undefined` when it is not there — same as the old store. */
async function getData(key) {
  const { rows } = await engPool.query(
    `SELECT data FROM ${TABLES.CAM_SAVED_WORK} WHERE key = $1`,
    [key]
  );
  return rows.length ? rows[0].data : undefined;
}

/**
 * Upsert one record. Saving over a name replaces it — that rule lives in the
 * key, so `ON CONFLICT (key)` is the whole implementation of it.
 *
 * `created_at` is deliberately left alone on conflict: re-saving is an edit, not
 * a new item, and the original author keeps the credit for creating it.
 */
async function putRecord({ meta, data, owner }) {
  const { rows } = await engPool.query(
    `INSERT INTO ${TABLES.CAM_SAVED_WORK}
       (key, name, kind, meta, data, owner_empno, owner_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (key) DO UPDATE SET
       name        = EXCLUDED.name,
       kind        = EXCLUDED.kind,
       meta        = EXCLUDED.meta,
       data        = EXCLUDED.data,
       owner_empno = EXCLUDED.owner_empno,
       owner_name  = EXCLUDED.owner_name,
       updated_at  = NOW()
     RETURNING meta, owner_empno, owner_name`,
    [
      meta.key,
      meta.name ?? '',
      meta.kind ?? '',
      JSON.stringify(meta),
      JSON.stringify(data ?? {}),
      owner?.empno ?? null,
      owner?.name ?? null,
    ]
  );
  const r = rows[0];
  return { ...r.meta, owner_empno: r.owner_empno, owner_name: r.owner_name };
}

/** Remove a record. Deleting a key that is already gone is not an error. */
async function deleteRecord(key) {
  await engPool.query(`DELETE FROM ${TABLES.CAM_SAVED_WORK} WHERE key = $1`, [key]);
  return key;
}

/** Empty the whole shared library. Admin only — see the route. */
async function clearAll() {
  await engPool.query(`DELETE FROM ${TABLES.CAM_SAVED_WORK}`);
}

module.exports = { listMeta, getData, putRecord, deleteRecord, clearAll };
