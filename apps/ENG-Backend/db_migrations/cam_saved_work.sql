-- CAD/CAM shared library.
--
-- Replaces the per-browser IndexedDB store the CAM module shipped with. That
-- store is scoped to an ORIGIN, so work saved on localhost:3100 was invisible
-- from plbmp118, which was invisible from plbmp130 — and invisible to every
-- other operator on the same machine. This table is the shared one.
--
-- `key` is the client's own record key ('project:<name>' / 'program:<name>'),
-- which is what makes "saving over a name replaces it" work: it is the primary
-- key, so an upsert on it is the whole rule.
--
-- meta / data are split for the same reason they are two object stores in the
-- browser: the list only needs meta, and a project with an imported STL inside
-- it can be megabytes. Reading the list must not drag every payload with it.

CREATE TABLE IF NOT EXISTS cam_saved_work (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  meta        JSONB NOT NULL,
  data        JSONB NOT NULL,
  owner_empno TEXT,
  owner_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The list is always "newest first"; the client sorts too, but this keeps the
-- query from becoming a full sort as the library grows.
CREATE INDEX IF NOT EXISTS cam_saved_work_updated_at_idx
  ON cam_saved_work (updated_at DESC);
