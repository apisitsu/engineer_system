/**
 * Saved work, over the API: a private shelf per operator plus one shared library.
 *
 * Two moves got this here, and the second exists because the first overshot.
 *
 * It began as IndexedDB, which is scoped to an **origin** — work saved while
 * developing on localhost:3100 was invisible from plbmp118, invisible from
 * plbmp130, and invisible to every other operator even on the same PC in another
 * browser profile. A setup somebody saved is a thing the next shift needs to
 * open, so it moved to a table (`cam_saved_work`) behind
 * `/api/engineer/cam/library`.
 *
 * But that made it **one** library, keyed by the record's own
 * `'project/<name>'`. Two people who both saved "OP10" were writing to the same
 * row, and the second silently replaced the first's work — and anybody could
 * delete anybody's. "Saving over a name replaces it" is a fine rule about your
 * own work and a trap when the namespace is the whole shop's.
 *
 * So each row now sits on a shelf: yours, or the shared one. Saving is always
 * private; publishing is an explicit `share`, and it refuses rather than
 * overwrite somebody else's published item. Every one of those rules is enforced
 * server-side against the row — see `api/engineer/cam/camService.js`. What is
 * here is transport.
 *
 * Rows are addressed by **id**, not by the record key: my "OP10" and the shared
 * "OP10" are two rows, so the key no longer names one of them.
 *
 * `httpClient` is the app's shared axios instance: it prefixes `apiUrl`, attaches
 * the JWT, and force-logs-out on a 401 like every other call in EngineerSystem.
 *
 * A project carries a base64 STL and can be megabytes, so the writes and the
 * payload read override the client's 10s default timeout. The list does not — it
 * is meta only and should be fast; if it is not, something is wrong and a short
 * timeout says so.
 */
import { httpClient } from '../../../../../utils/HttpClient';

const BASE = 'api/engineer/cam/library';
const BIG = 120000; // ms — a project upload/download is not a 10s request

/**
 * The sentence the server wrote, or the best available substitute.
 *
 * Refusals here are *written for the operator* — "The shared library already has
 * “OP10” from Somchai. Rename yours before sharing it, or open theirs instead."
 * is the entire value of refusing. Axios throws with `message` set to "Request
 * failed with status code 409", so letting the raw error through would replace
 * every explanation with a status code.
 */
function explain(err) {
  const said = err?.response?.data?.message;
  if (typeof said === 'string' && said.trim()) return new Error(said);
  return err;
}

/*
 * There is deliberately no `dbAvailable()` here. The IndexedDB store had one,
 * because private browsing can refuse to open a database at all and there was
 * no point offering buttons that could not work. A server-backed library has no
 * such per-browser gate: it is either reachable or it is not, and that is not
 * knowable in advance — so a failure arrives as an error on the action that
 * failed, where it can say what actually went wrong.
 */

/**
 * Every row this operator may see — their own shelf and the shared one, each row
 * carrying `shared`, who owns it, and what this caller may do to it
 * (`canShare` / `canUnshare` / `canDelete`). Unordered; `sortLibrary` decides.
 */
export async function listMeta() {
  try {
    const { data } = await httpClient.get(BASE);
    return Array.isArray(data?.items) ? data.items : [];
  } catch (err) {
    throw explain(err);
  }
}

/** One payload, by row id. Undefined when it is not there. */
export async function getData(id) {
  try {
    const { data } = await httpClient.get(`${BASE}/${encodeURIComponent(id)}`, { timeout: BIG });
    return data?.data;
  } catch (err) {
    // "Not there" is a normal answer — somebody may have deleted a shared item
    // since this list was drawn. Anything else is a fault.
    if (err?.response?.status === 404) return undefined;
    throw explain(err);
  }
}

/** Write a record to **my own** shelf. Returns the stored row. */
export async function putRecord({ meta, data }) {
  try {
    const res = await httpClient.put(BASE, { meta, data }, { timeout: BIG });
    return res.data?.meta ?? meta;
  } catch (err) {
    throw explain(err);
  }
}

/** Publish one of my saved items to the shared library. */
export async function shareRecord(id) {
  try {
    const res = await httpClient.post(`${BASE}/${encodeURIComponent(id)}/share`);
    return res.data?.meta;
  } catch (err) {
    throw explain(err);
  }
}

/** Take one of my published items back onto my own shelf. */
export async function unshareRecord(id) {
  try {
    const res = await httpClient.post(`${BASE}/${encodeURIComponent(id)}/unshare`);
    return res.data?.meta;
  } catch (err) {
    throw explain(err);
  }
}

/** Remove a record. Deleting something already gone is not an error. */
export async function deleteRecord(id) {
  try {
    await httpClient.delete(`${BASE}/${encodeURIComponent(id)}`);
    return id;
  } catch (err) {
    throw explain(err);
  }
}

/**
 * Empty every shelf belonging to everybody, so the route behind this is
 * admin-only; nothing in the UI calls it.
 */
export async function clearAll() {
  try {
    await httpClient.delete(BASE);
  } catch (err) {
    throw explain(err);
  }
}
