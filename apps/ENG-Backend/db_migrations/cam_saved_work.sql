-- CAD/CAM saved work: a private shelf per operator, plus one shared shelf.
--
-- History, because the shape only makes sense with it. This began as the CAM
-- module's per-browser IndexedDB store, which was scoped to an ORIGIN — work
-- saved on localhost:3100 was invisible from plbmp118, invisible from plbmp130,
-- and invisible to every other operator. Moving it here fixed that by making
-- ONE library everybody shared.
--
-- That went too far the other way. `key` was the primary key and `key` is the
-- client's own 'project/<name>' — so two people who both saved "OP10" were
-- writing to the same row, and the second silently replaced the first's work.
-- Deleting was unrestricted for the same reason. "Saving over a name replaces
-- it" is a reasonable rule about YOUR OWN work and a trap when the namespace is
-- the whole shop's.
--
-- So a record now lives on exactly one **shelf**:
--
--   shelf = '<empno>'   the operator's own. Private: only they list it.
--   shelf = '~shared'   the common library everybody sees.
--
-- and it is `(shelf, key)` that is unique, not `key`. Two operators may both
-- keep an "OP10"; neither can touch the other's. Publishing is an explicit act
-- that MOVES the row to '~shared' (see `camService.share`), and it refuses to
-- overwrite a shared item somebody else put there.
--
-- '~shared' cannot collide with an employee number: empnos are alphanumeric and
-- this starts with a tilde. It is spelled once, in `camConstants.SHARED_SHELF`.
--
-- Rows now need a surrogate id: the same `key` can legitimately exist twice (my
-- copy and the shared copy), so `key` can no longer address one row over HTTP.
--
-- meta / data stay split for the reason they were two object stores in the
-- browser: the list only needs meta, and a project with an imported STL inside
-- it can be megabytes. Listing must not drag every payload with it.

CREATE TABLE IF NOT EXISTS cam_saved_work (
  id          BIGSERIAL PRIMARY KEY,
  shelf       TEXT NOT NULL,
  key         TEXT NOT NULL,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  meta        JSONB NOT NULL,
  data        JSONB NOT NULL,
  owner_empno TEXT,
  owner_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Upgrade an existing table (the one created by the first version of this file,
-- which is already live on plbmp130). Every statement is idempotent, so this
-- file can be re-run against either shape.
-- ---------------------------------------------------------------------------

ALTER TABLE cam_saved_work ADD COLUMN IF NOT EXISTS shelf TEXT;
ALTER TABLE cam_saved_work ADD COLUMN IF NOT EXISTS id    BIGSERIAL;

-- Everything already in the table goes to the SHARED shelf, not to its owner's.
-- These rows were saved into a library everybody could see, and colleagues may
-- be relying on seeing them; quietly making them private would look like data
-- loss. Only saves made from here on are private by default, and an owner can
-- pull their own work back off the shared shelf whenever they like.
UPDATE cam_saved_work SET shelf = '~shared' WHERE shelf IS NULL;
ALTER TABLE cam_saved_work ALTER COLUMN shelf SET NOT NULL;

-- `key` was the primary key. It cannot be, now that my "OP10" and the shared
-- "OP10" are two rows.
ALTER TABLE cam_saved_work DROP CONSTRAINT IF EXISTS cam_saved_work_pkey;
ALTER TABLE cam_saved_work ADD  CONSTRAINT cam_saved_work_pkey PRIMARY KEY (id);

-- This pair is what "saving over a name replaces it" now means, and it is what
-- `ON CONFLICT` in `camService.putRecord` infers.
CREATE UNIQUE INDEX IF NOT EXISTS cam_saved_work_shelf_key_idx
  ON cam_saved_work (shelf, key);

-- Both list queries are "one shelf, newest first".
CREATE INDEX IF NOT EXISTS cam_saved_work_shelf_updated_idx
  ON cam_saved_work (shelf, updated_at DESC);

-- Superseded by the index above; a plain updated_at scan is never asked for now.
DROP INDEX IF EXISTS cam_saved_work_updated_at_idx;
