/**
 * The shop's machines, over the API (`cam_machine`, behind
 * `/api/engineer/cam/machines`). Transport only — how a row becomes a machine is
 * `engine/cam/machines.js`.
 *
 * A row is `{ id, ...machineRow(m) }`. An id of a built-in machine changes that
 * machine; any other id is a machine added. Adding, changing and deleting is
 * for engineers — the server says so (403) to anyone else.
 */
import { httpClient } from '../../../../../utils/HttpClient';

const BASE = 'api/engineer/cam/machines';

/** The server's own sentence when it wrote one, instead of "status code 403". */
function explain(err) {
  const said = err?.response?.data?.message || err?.response?.data?.error;
  if (typeof said === 'string' && said.trim()) return new Error(said);
  return err;
}

/** Every row. Rejects with a readable error when the table cannot be read. */
export async function listMachines() {
  try {
    const { data } = await httpClient.get(BASE);
    return Array.isArray(data?.machines) ? data.machines : [];
  } catch (err) {
    throw explain(err);
  }
}

/** Add a machine, or change one. */
export async function saveMachine(id, body) {
  try {
    const { data } = await httpClient.put(`${BASE}/${encodeURIComponent(id)}`, body);
    return data?.machine;
  } catch (err) {
    throw explain(err);
  }
}

/** Remove a row: a built-in goes back to its own figures, an added machine is gone. */
export async function deleteMachine(id) {
  try {
    await httpClient.delete(`${BASE}/${encodeURIComponent(id)}`);
  } catch (err) {
    throw explain(err);
  }
}
