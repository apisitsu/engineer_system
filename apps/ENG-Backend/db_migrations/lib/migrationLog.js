'use strict';

/**
 * Migration run log — makes `db_migrations` answer "has this already been applied?"
 * ------------------------------------------------------------------------------
 * The table has existed since 2026-04-21 and, until now, held **one row against 111
 * migration files**: only `migrate_kanban_performance.js` ever wrote to it. So the
 * answer to "did this run?" lived nowhere, and the cost showed up on 2026-08-26 —
 * `20260821n_` had added two X-100 fixture slots, a person deliberately removed them
 * through SDS Admin, and nothing would have stopped the next person re-running the
 * migration and putting them straight back.
 *
 * There is no migration RUNNER in this project and this does not add one. Migrations
 * are still `node <file>.js` by hand. What changes is that each one can now say what it
 * is, and refuse to repeat itself by accident.
 *
 * USAGE — three calls, all optional, all safe to add to an existing migration:
 *
 *     const { guard, recordRun, recordRevert } = require('./lib/migrationLog');
 *     //  from api/engineer/mtc/db_migrations/:  require('../../../../db_migrations/lib/migrationLog')
 *
 *     if (await guard({ file: __filename, revert })) return;   // top of main()
 *     …
 *     await recordRun({ file: __filename });                   // after a successful apply
 *     await recordRevert({ file: __filename });                // after a successful --revert
 *
 * WHAT `guard` DOES, AND WHAT IT DELIBERATELY DOES NOT DO
 *
 * It stops an accidental re-run: if the file is recorded as applied it prints when, and
 * tells the caller to return. `--force` runs anyway. It does **not** stop:
 *
 *   • `--revert`   — reverting something recorded as applied is the whole point
 *   • `--dry-run`  — a dry run changes nothing, so let people look
 *   • a migration that declares `alwaysRerun: true` — several here are *meant* to be
 *     re-run, because re-running IS the refresh when the factory plan moves
 *     (`seedCnMapFromPlan`, the cn-map seeds). Those pass the flag and only get a note.
 *
 * IT FAILS OPEN, ALWAYS. A missing table, a closed pool, a permissions error — every
 * failure path lets the migration proceed and prints a warning. A bookkeeping table must
 * never be the reason a schema change cannot be applied, and a fresh database has no
 * `db_migrations` row for anything.
 *
 * The key is the file's BASENAME, matching the one row that predates this
 * (`20260421_kanban_performance_indexes`, stored without an extension), so both spellings
 * resolve to the same record.
 */

const path = require('path');
const { engPool } = require('../../instance/eng_db');

const TABLE = 'db_migrations';

/** Basename without extension — the stable identity of a migration. */
function nameOf(file) {
  return path.basename(String(file || ''), path.extname(String(file || '')));
}

const argv = () => process.argv.slice(2);
const hasFlag = (f) => argv().includes(f);

/** Best-effort "who ran it", for the audit trail. Never throws. */
function whoAmI() {
  try {
    const u = process.env.USERNAME || process.env.USER || '';
    const h = require('os').hostname();
    return [u, h].filter(Boolean).join('@').slice(0, 64) || null;
  } catch (_) { return null; }
}

/** Read the row for a migration, or null. Never throws. */
async function lookup(file, pool = engPool) {
  try {
    const { rows } = await pool.query(
      `SELECT name, executed_at, reverted_at, run_by FROM ${TABLE} WHERE name = $1`,
      [nameOf(file)]);
    return rows[0] || null;
  } catch (e) {
    // Table missing / not yet migrated / no permission — treat as "unknown", never fatal.
    return null;
  }
}

/**
 * Call at the top of main(). Returns TRUE when the caller should return without doing
 * anything, i.e. "already applied and you did not pass --force".
 */
async function guard({ file, revert = false, dryRun = null, alwaysRerun = false, pool = engPool } = {}) {
  const name = nameOf(file);
  const isDry = dryRun === null ? (hasFlag('--dry-run') || hasFlag('--dryrun')) : dryRun;
  if (revert || isDry) return false;

  const row = await lookup(file, pool);
  if (!row || row.reverted_at) return false;      // never applied, or applied then reverted

  const when = row.executed_at ? new Date(row.executed_at).toISOString().slice(0, 16).replace('T', ' ') : '?';
  const by = row.run_by ? ` by ${row.run_by}` : '';

  if (alwaysRerun) {
    console.log(`[migration-log] ${name} — applied ${when}${by}; re-running (this migration refreshes on re-run)\n`);
    return false;
  }
  if (hasFlag('--force')) {
    console.log(`[migration-log] ${name} — applied ${when}${by}; --force given, running anyway\n`);
    return false;
  }

  console.log(
    `\n[migration-log] ${name} was already applied on ${when}${by}.\n` +
    `  Nothing was changed. Someone may have adjusted the result by hand since —\n` +
    `  re-running would put the original values back.\n` +
    `  To run it anyway:  node ${path.relative(process.cwd(), file).replace(/\\/g, '/')} --force\n` +
    `  To undo it:        …  --revert\n`);
  return true;
}

/** Record a successful apply. Never throws. */
async function recordRun({ file, pool = engPool } = {}) {
  const name = nameOf(file);
  try {
    await pool.query(
      `INSERT INTO ${TABLE} (name, executed_at, run_by, reverted_at)
       VALUES ($1, now(), $2, NULL)
       ON CONFLICT (name) DO UPDATE
         SET executed_at = now(), run_by = EXCLUDED.run_by, reverted_at = NULL`,
      [name, whoAmI()]);
  } catch (e) {
    console.warn(`[migration-log] could not record "${name}": ${e.message}`);
  }
}

/** Record a successful revert — keeps the row, stamps `reverted_at`. Never throws. */
async function recordRevert({ file, pool = engPool } = {}) {
  const name = nameOf(file);
  try {
    await pool.query(
      `UPDATE ${TABLE} SET reverted_at = now(), run_by = $2 WHERE name = $1`,
      [name, whoAmI()]);
  } catch (e) {
    console.warn(`[migration-log] could not record revert of "${name}": ${e.message}`);
  }
}

module.exports = { guard, recordRun, recordRevert, lookup, nameOf };
