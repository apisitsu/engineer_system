/**
 * The shared saved-work library, over the API.
 *
 * Drop-in replacement for `lib/workDb.js`: same five operations, same record
 * shapes, so `libraryStore` did not have to change beyond which module it
 * imports. The difference is where the work lives.
 *
 * IndexedDB is scoped to an **origin**, and that turned out to be the wrong
 * shape for this app entirely. Work saved while developing on localhost:3100 was
 * invisible from plbmp118, which was invisible from plbmp130 — and invisible to
 * every other operator, even on the same PC in a different browser profile. A
 * setup somebody saved is a thing the next shift needs to open; a per-browser
 * cache cannot do that. So the library is a table (`cam_saved_work`) behind
 * `/api/engineer/cam/library`, and every origin sees the same one.
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
 * The old store reported whether IndexedDB could be opened at all (private
 * browsing blocks it). A server-backed library has no such per-browser gate, so
 * this is always true and failures arrive as errors on the action that failed,
 * where they can say what actually went wrong.
 */
export function dbAvailable() {
  return true;
}

/** Every row the list shows, unordered — `sortLibrary` decides the order. */
export async function listMeta() {
  const { data } = await httpClient.get(BASE);
  return Array.isArray(data?.items) ? data.items : [];
}

/** One payload, by key. Undefined when it is not there. */
export async function getData(key) {
  try {
    const { data } = await httpClient.get(`${BASE}/${encodeURIComponent(key)}`, { timeout: BIG });
    return data?.data;
  } catch (err) {
    // "Not there" is a normal answer for a library the shop shares — somebody
    // may have deleted it since this list was drawn. Anything else is a fault.
    if (err?.response?.status === 404) return undefined;
    throw err;
  }
}

/** Write a record. Returns the stored meta, including who saved it. */
export async function putRecord({ meta, data }) {
  const res = await httpClient.put(BASE, { meta, data }, { timeout: BIG });
  return res.data?.meta ?? meta;
}

/** Remove a record. Deleting a key that is gone is not an error. */
export async function deleteRecord(key) {
  await httpClient.delete(`${BASE}/${encodeURIComponent(key)}`);
  return key;
}

/**
 * Empty the library. Now wipes work belonging to everyone, so the route behind
 * this is admin-only; nothing in the UI calls it.
 */
export async function clearAll() {
  await httpClient.delete(BASE);
}

/**
 * Browser storage quota, which no longer applies — the library is on the server.
 * Kept so the store's shape is unchanged; null means "nothing to report", which
 * is what the panel already did on browsers that would not say.
 */
export async function storageUse() {
  return null;
}
