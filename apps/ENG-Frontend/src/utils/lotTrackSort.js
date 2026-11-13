// Ordering the lots on the Lot Status Tracker page.
//
// Each tracked entry is { key, lotNo, controlNo } with its fetch state
// ({ status, data }) kept beside it. Only a loaded lot ('ok') has the values a
// sort reads, so a lot still loading, failed or waiting for its control no. is
// always placed after the loaded ones, in the order it was added — whichever
// way the sort runs.

const dateOrNull = (s) => (s ? String(s) : null); // ISO strings compare as dates

export const LOT_SORTS = {
  added: { label: 'Order added', value: null },
  pct: { label: 'Progress %', value: (d) => d.summary?.pctComplete ?? null },
  due: { label: 'Plan finish (due date)', value: (d) => dateOrNull(d.header?.compPlanDate) },
  remaining: { label: 'Remaining process', value: (d) => d.summary?.remainingSteps ?? null },
  issued: { label: 'Issued date', value: (d) => dateOrNull(d.header?.entryDate) },
  moved: { label: 'Last moved', value: (d) => dateOrNull(d.lotUpdatedAt) },
  lot: { label: 'Lot no.', value: (d) => d.header?.lotNo ?? null },
};

const compare = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * The entries in display order.
 *
 * @param {{key:string}[]} entries  in the order they were added
 * @param {Object<string,{status:string,data?:object}>} stateByKey
 * @param {string} sortBy  a key of LOT_SORTS
 * @param {'asc'|'desc'} dir
 */
export function sortLots(entries, stateByKey, sortBy = 'added', dir = 'asc') {
  const get = LOT_SORTS[sortBy]?.value;
  if (!get) return dir === 'desc' ? [...entries].reverse() : [...entries];
  const sign = dir === 'desc' ? -1 : 1;
  const rows = entries.map((e, i) => {
    const st = stateByKey[e.key];
    const v = st?.status === 'ok' && st.data ? get(st.data) : null;
    return { e, i, v };
  });
  rows.sort((a, b) => {
    // Lots with no value (not loaded, or the field is empty) go last, as added.
    if (a.v == null || b.v == null) {
      if (a.v == null && b.v == null) return a.i - b.i;
      return a.v == null ? 1 : -1;
    }
    return sign * compare(a.v, b.v) || a.i - b.i;
  });
  return rows.map((r) => r.e);
}
