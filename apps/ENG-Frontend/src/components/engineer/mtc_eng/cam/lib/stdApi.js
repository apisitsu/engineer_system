/**
 * Standard cutting speeds, over the API.
 *
 * The ranges live in the database (`cam_std_material` / `cam_std_vc`, behind
 * `/api/engineer/cam/std-vc`) so the shop can correct and sign them off without
 * a deploy; this is transport only. What a range *means* — which tool it applies
 * to, what to propose — is `engine/cam/stdVc.js`.
 *
 * Every material comes back as
 *   { key, label, isoGroup, aliases, status: 'draft'|'approved', sourceNote,
 *     vc: { turning: [min,max], milling, drilling, reaming, tap } }
 */
import { httpClient } from '../../../../../utils/HttpClient';

const BASE = 'api/engineer/cam/std-vc';

/** The server's own sentence when it wrote one, instead of "status code 403". */
function explain(err) {
  const said = err?.response?.data?.message;
  if (typeof said === 'string' && said.trim()) return new Error(said);
  return err;
}

/** Every material and its ranges. Rejects with a readable error when the table cannot be read. */
export async function listStd() {
  try {
    const { data } = await httpClient.get(BASE);
    return Array.isArray(data?.materials) ? data.materials : [];
  } catch (err) {
    throw explain(err);
  }
}

/** Create or update one material (engineers; marking it approved needs an administrator). */
export async function saveStd(key, body) {
  try {
    const { data } = await httpClient.put(`${BASE}/${encodeURIComponent(key)}`, body);
    return data?.material;
  } catch (err) {
    throw explain(err);
  }
}
