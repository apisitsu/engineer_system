'use strict';

/**
 * `sds_print_log` — record WHICH COMPUTER asked for the sheet.
 * ------------------------------------------------------------------------------
 * The log already answers what was printed, for which part and lot, and when. It could
 * not answer *from where*, and for the deep-link path that gap is the whole attribution:
 * `/api/public/sds/pdf` runs without a login by design, so `requested_by` is NULL on
 * every one of those rows and `source = 'public'` is all that remains. Seventeen of the
 * nineteen rows in the table are that shape.
 *
 *     client_ip    VARCHAR(64)    the caller's address
 *     client_host  VARCHAR(128)   its DNS name, when it resolves
 *
 * WHY BOTH, AND WHY THE NAME CAN BE NULL
 *
 * The IP is a fact the socket already carries — free and always present. The name is what
 * a person actually recognises ("plb018"), and it comes from a reverse DNS lookup that can
 * fail, time out, or return nothing for a host with no PTR record. Storing only the name
 * would lose the row when DNS is unhelpful; storing only the IP would make the log
 * unreadable. So: the IP is authoritative, the name is a convenience that may be NULL.
 *
 * WHAT THE ADDRESS ACTUALLY IS HERE
 *
 * `server.js` sets no `trust proxy`, and `nginx.conf` forwards Host/Upgrade/Connection but
 * NOT `X-Forwarded-For` — and production's `apiUrl` points straight at :2005, bypassing
 * nginx entirely. So the socket address IS the caller in the normal case. The reader still
 * prefers `X-Forwarded-For` when something upstream sets it, because a future proxy would
 * otherwise make every row read as the proxy.
 *
 * Existing rows keep NULL in both columns — they were written before this and nothing can
 * honestly backfill where they came from.
 *
 * Idempotent; `--revert` drops both columns.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_print_log';
const revert = process.argv.includes('--revert');

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    await engPool.query(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS client_ip`);
    await engPool.query(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS client_host`);
    console.log('reverted: client_ip and client_host dropped');
    await recordRevert({ file: __filename });
    return;
  }

  await engPool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS client_ip VARCHAR(64)`);
  await engPool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS client_host VARCHAR(128)`);
  await engPool.query(
    `COMMENT ON COLUMN ${TABLE}.client_ip IS $c$Caller address. X-Forwarded-For when set, else the socket address. Authoritative — client_host is derived from it and may be NULL.$c$`);
  await engPool.query(
    `COMMENT ON COLUMN ${TABLE}.client_host IS $c$Reverse-DNS name for client_ip, best effort. NULL when the lookup fails, times out, or the host has no PTR record.$c$`);
  await engPool.query(
    `CREATE INDEX IF NOT EXISTS ${TABLE}_client_ip_idx ON ${TABLE} (client_ip) WHERE client_ip IS NOT NULL`);

  const { rows } = await engPool.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = $1 ORDER BY ordinal_position`, [TABLE]);
  console.log(rows.map((r) => `  ${r.column_name.padEnd(18)} ${r.data_type}`).join('\n'));

  await recordRun({ file: __filename });
  console.log(`\nundo with:  node api/engineer/mtc/db_migrations/20260826b_sds_print_log_client.js --revert`);
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
