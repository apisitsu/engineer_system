---
paths:
  - "apps/ENG-Backend/**"
---

## Bulk DB operations (pg.Pool)

Never loop individual queries — use bulk patterns:
- **Fetch:** `WHERE col = ANY($1)` with array param, build lookup map from results
- **Insert:** multi-row VALUES in chunks of 2000 rows (24 params × 2000 = 48000 < pg 65535 limit)

```javascript
// Bulk fetch
const r = await pool.query(`SELECT * FROM t WHERE col = ANY($1)`, [ids]);
const map = Object.fromEntries(r.rows.map(row => [row.col, row]));

// Multi-row insert
const COLS = 24;
const placeholders = chunk.map((_, ri) =>
  `(${Array.from({ length: COLS }, (__, ci) => `$${ri * COLS + ci + 1}`).join(',')})`
).join(',');
await pool.query(`INSERT INTO t (...) VALUES ${placeholders}`, chunk.flat());
```

Per-row loops for 500+ items cause HTTP timeouts (~90s). **INSERT column order** must exactly match the parameter array — mismatch silently writes wrong data.

## Expensive build → DB-persisted cache (not in-memory-only)

For results that take seconds–minutes to compute (aggregate reports, per-CN Tooling Select, rendered templates), an **in-memory cache alone forces a cold rebuild on every process restart**. Use this layered pattern (already applied to the SDS coverage report `sds_coverage_cache`, per-CN T-Select `tselect_cn_cache`, the headless CSS config cache, and `sds:{CN}`):

1. **In-memory** map/var = the fast path (short TTL).
2. **Persist** each successful build to a DB table (`CREATE TABLE IF NOT EXISTS` lazily — no migration needed; JSONB for payloads). On a fresh process, **hydrate the in-memory cache from the persisted row** before deciding to rebuild.
3. **Warm-on-start**: a short `setTimeout` (e.g. 8s, after startup) loads the persisted copy into memory and kicks a background rebuild *only if missing/stale* — so the first user almost never waits.
4. **Stale-while-revalidate**: serve the cached/stale value immediately and rebuild in the background; reserve the blocking/202 path for the true first-ever build (`?refresh=1` / `?wait=1` escape hatches).
5. **Invalidate on mutation**: clear the persisted cache from the existing config/data-flush chokepoints (e.g. `flushConfig` middleware, write-method middleware on the mutating router) so edits reflect immediately; keep a TTL only as a backstop.
6. **Bulk-warm** a per-key persisted cache with one `WHERE key = ANY($1)` preload before a loop, instead of a per-key round trip.

## PDF / Excel generation

- PDF: Puppeteer or `pdf-lib` / `pdfkit`; Excel: `exceljs` with template-based mapping
- Generation logic belongs in the Service layer, not the controller
- ExcelJS solid fill cells **must** set both `fgColor` and `bgColor` — LibreOffice ignores fills where `bgColor` is absent
