'use strict';

/**
 * CAD/CAM saved work — data access.
 *
 * Every row lives on exactly one **shelf**: the operator's own empno (private),
 * or `SHARED_SHELF` (the common library). `(shelf, key)` is unique, so two
 * people may both keep an "OP10" and neither can touch the other's — see the
 * header of `db_migrations/cam_saved_work.sql` for why that replaced a globally
 * unique `key`.
 *
 * The rules that keep it safe are all here rather than in the controller,
 * because they are rules about rows:
 *
 *  - a save always lands on the caller's own shelf. There is no parameter for
 *    saving somewhere else, so no request can ask to;
 *  - publishing MOVES a row to the shared shelf, and refuses if that would
 *    replace a shared item somebody else put there;
 *  - deleting needs the row to be yours (or the caller to be an admin).
 *
 * `assertOwner`-style checks are done by re-reading the row inside the same
 * transaction as the write, not by trusting anything the client sent: the id in
 * the URL says *which* row, never *whose*.
 *
 * The client half is `cam/lib/workApi.js`; naming, ordering and the record shape
 * stay on the client in `engine/savedWork.js`, where they are tested.
 */

const { engPool } = require('../../../instance/eng_db');
const { TABLES, SHARED_SHELF } = require('./camConstants');

/** An error the controller turns into a 4xx with this message shown to the user. */
class LibraryError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * The row shape the client lists against — its own meta, plus who, where, and
 * what this caller may do to it.
 *
 * The permission booleans are computed here, next to the rules the write paths
 * enforce, rather than being left for the panel to re-derive. A UI that decides
 * for itself which buttons to grey out is a UI that will one day disagree with
 * the server — and the direction that disagreement usually goes is a button
 * that looks available and then fails.
 */
function toItem(r, { empno, isAdmin = false }) {
  const shared = r.shelf === SHARED_SHELF;
  const mine = r.owner_empno != null && r.owner_empno === empno;
  return {
    ...r.meta,
    id: String(r.id),
    shared,
    owner_empno: r.owner_empno,
    owner_name: r.owner_name,
    mine,
    canShare: !shared && (r.shelf === empno || isAdmin),
    // An ownerless shared row cannot go back to a shelf that was never recorded
    // — `unshare` refuses it, so the button must not offer it.
    canUnshare: shared && r.owner_empno != null && (mine || isAdmin),
    canDelete: (r.shelf === empno) || (shared && mine) || isAdmin,
  };
}

const COLUMNS = 'id, shelf, meta, owner_empno, owner_name, updated_at';

/**
 * Everything this operator may see: their own shelf and the shared one.
 *
 * `data` is deliberately not selected: a project carries a base64 STL and can be
 * megabytes, and the list shows none of it. Fetching payloads here would make
 * opening the library cost the size of the whole library.
 */
async function listMeta({ empno, isAdmin = false }) {
  const { rows } = await engPool.query(
    `SELECT ${COLUMNS}
       FROM ${TABLES.CAM_SAVED_WORK}
      WHERE shelf = $1 OR shelf = $2
      ORDER BY updated_at DESC`,
    [empno ?? '', SHARED_SHELF]
  );
  return rows.map((r) => toItem(r, { empno, isAdmin }));
}

/**
 * One payload, by row id. `undefined` when it is not there — **or when it is on
 * somebody else's private shelf**, which is the same answer on purpose: a 404
 * that distinguishes the two would confirm that a colleague has a job by that
 * name.
 */
async function getData(id, { empno }) {
  const { rows } = await engPool.query(
    `SELECT data FROM ${TABLES.CAM_SAVED_WORK}
      WHERE id = $1 AND (shelf = $2 OR shelf = $3)`,
    [id, empno ?? '', SHARED_SHELF]
  );
  return rows.length ? rows[0].data : undefined;
}

/**
 * Upsert one record **onto the caller's own shelf**.
 *
 * "Saving over a name replaces it" is the rule the client's key encodes, and it
 * is still the rule — but now only within one operator's own work, which is
 * where it was always a reasonable thing to mean. `ON CONFLICT (shelf, key)` is
 * the whole implementation.
 *
 * `created_at` is left alone on conflict: re-saving is an edit, not a new item.
 */
async function putRecord({ meta, data, owner }) {
  if (!owner?.empno) {
    throw new LibraryError(400, 'Cannot tell who is saving this — sign in again.');
  }
  const { rows } = await engPool.query(
    `INSERT INTO ${TABLES.CAM_SAVED_WORK}
       (shelf, key, name, kind, meta, data, owner_empno, owner_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (shelf, key) DO UPDATE SET
       name        = EXCLUDED.name,
       kind        = EXCLUDED.kind,
       meta        = EXCLUDED.meta,
       data        = EXCLUDED.data,
       owner_name  = EXCLUDED.owner_name,
       updated_at  = NOW()
     RETURNING ${COLUMNS}`,
    [
      owner.empno,
      meta.key,
      meta.name ?? '',
      meta.kind ?? '',
      JSON.stringify(meta),
      JSON.stringify(data ?? {}),
      owner.empno,
      owner.name ?? null,
    ]
  );
  return toItem(rows[0], { empno: owner.empno });
}

/** Read one row for a write that is about to check who owns it. */
async function lockRow(client, id) {
  const { rows } = await client.query(
    `SELECT id, shelf, key, name, owner_empno, owner_name
       FROM ${TABLES.CAM_SAVED_WORK}
      WHERE id = $1
        FOR UPDATE`,
    [id]
  );
  return rows[0];
}

/**
 * Publish one of my own saved items to the common library.
 *
 * A **move**, not a copy: an item is in one place, and the row that was mine is
 * the row that is now everyone's. Two copies of the same name in two places is
 * exactly the confusion this whole change is trying to remove.
 *
 * The one thing it will not do is replace somebody else's published work. That
 * is the danger the shared-by-default library had, and re-introducing it here
 * as a side effect of a Share button would be worse — the operator would not
 * even be typing the name that did it.
 */
async function share(id, { empno, isAdmin = false }) {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const row = await lockRow(client, id);
    if (!row) throw new LibraryError(404, 'That saved item is no longer there.');
    if (row.shelf === SHARED_SHELF) {
      throw new LibraryError(409, 'That is already in the shared library.');
    }
    if (row.shelf !== empno && !isAdmin) {
      throw new LibraryError(403, 'That is not yours to share.');
    }

    const { rows: clash } = await client.query(
      `SELECT id, owner_empno, owner_name FROM ${TABLES.CAM_SAVED_WORK}
        WHERE shelf = $1 AND key = $2 FOR UPDATE`,
      [SHARED_SHELF, row.key]
    );
    if (clash.length) {
      const held = clash[0];
      const ownedByCaller = held.owner_empno != null && held.owner_empno === empno;
      if (!ownedByCaller && !isAdmin) {
        const who = held.owner_name || held.owner_empno || 'somebody else';
        throw new LibraryError(
          409,
          `The shared library already has “${row.name ?? row.key}” from ${who}. `
          + 'Rename yours before sharing it, or open theirs instead.'
        );
      }
      // Replacing my own published copy is the ordinary "saving over a name"
      // rule, so the old row goes and mine takes its place.
      await client.query(`DELETE FROM ${TABLES.CAM_SAVED_WORK} WHERE id = $1`, [held.id]);
    }

    const { rows } = await client.query(
      `UPDATE ${TABLES.CAM_SAVED_WORK}
          SET shelf = $1, updated_at = NOW()
        WHERE id = $2
      RETURNING ${COLUMNS}`,
      [SHARED_SHELF, id]
    );
    await client.query('COMMIT');
    return toItem(rows[0], { empno, isAdmin });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Take one of my published items back out of the common library.
 *
 * It returns to **its owner's** shelf, not to the caller's — so an admin
 * tidying up hands the work back rather than taking it. A row whose owner is
 * unknown (there are some: everything that predates private shelves was moved
 * onto the shared one by the migration, and the oldest of those were saved
 * before the app recorded who saved them) has nowhere to go back to, and says so
 * rather than guessing.
 */
async function unshare(id, { empno, isAdmin = false }) {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const row = await lockRow(client, id);
    if (!row) throw new LibraryError(404, 'That saved item is no longer there.');
    if (row.shelf !== SHARED_SHELF) {
      throw new LibraryError(409, 'That is not in the shared library.');
    }
    const ownedByCaller = row.owner_empno != null && row.owner_empno === empno;
    if (!ownedByCaller && !isAdmin) {
      const who = row.owner_name || row.owner_empno || 'somebody else';
      throw new LibraryError(403, `That was shared by ${who}, so it is not yours to remove.`);
    }
    if (!row.owner_empno) {
      throw new LibraryError(
        409,
        'Nobody is recorded as owning that, so there is no private shelf to move '
        + 'it back to. Delete it instead if it is no longer wanted.'
      );
    }

    // The owner may already have something of that name of their own; their own
    // work replacing their own work is the rule everywhere else too.
    await client.query(
      `DELETE FROM ${TABLES.CAM_SAVED_WORK} WHERE shelf = $1 AND key = $2 AND id <> $3`,
      [row.owner_empno, row.key, id]
    );
    const { rows } = await client.query(
      `UPDATE ${TABLES.CAM_SAVED_WORK}
          SET shelf = $1, updated_at = NOW()
        WHERE id = $2
      RETURNING ${COLUMNS}`,
      [row.owner_empno, id]
    );
    await client.query('COMMIT');
    return toItem(rows[0], { empno, isAdmin });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Remove a record.
 *
 * Anything on my own shelf is mine to delete. On the shared shelf only what I
 * put there is — otherwise the shared library would be one misplaced click away
 * from losing somebody's setup, which is the failure this whole change exists to
 * remove. Admins can delete either, because somebody has to be able to.
 */
async function deleteRecord(id, { empno, isAdmin = false }) {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const row = await lockRow(client, id);
    if (!row) {
      // Deleting something already gone is not an error — the caller wanted it
      // absent and it is absent.
      await client.query('COMMIT');
      return String(id);
    }
    const onMyShelf = row.shelf === empno;
    const minePublished = row.shelf === SHARED_SHELF
      && row.owner_empno != null && row.owner_empno === empno;
    if (!onMyShelf && !minePublished && !isAdmin) {
      const who = row.owner_name || row.owner_empno || 'somebody else';
      throw new LibraryError(403, `That belongs to ${who}, so it is not yours to delete.`);
    }
    await client.query(`DELETE FROM ${TABLES.CAM_SAVED_WORK} WHERE id = $1`, [id]);
    await client.query('COMMIT');
    return String(id);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Empty every shelf belonging to everybody. Admin only — see the route. */
async function clearAll() {
  await engPool.query(`DELETE FROM ${TABLES.CAM_SAVED_WORK}`);
}

module.exports = {
  LibraryError,
  listMeta,
  getData,
  putRecord,
  share,
  unshare,
  deleteRecord,
  clearAll,
};
