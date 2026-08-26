'use strict';

/**
 * Create `sds_print_log` — evidentiary record of every SDS PDF actually produced.
 * ------------------------------------------------------------------------------
 * WHY A NEW TABLE RATHER THAN `sds_access_log`
 *
 * `sds_access_log` answers "who opened the SDS screen" (VIEW). This answers a
 * different question — "which sheet was printed, for which part and lot, when" —
 * and it is the one that has to stand up as a reference later. Mixing them would
 * make the evidentiary rows impossible to separate from ordinary browsing, and
 * `sds_access_log` has no room for part/lot/hash.
 *
 * It also fills a gap that has been open since 2026-06-14: the `INSERT ... 'PDF'`
 * lived at `sdsV2PdfController.js:687`, and that whole file was deleted in commit
 * cd689e9f ("PDF cancel LibraOfice") when the Chrome grid renderer replaced
 * LibreOffice. The replacement never carried the logging over, so the last PDF row
 * in `sds_access_log` is 2026-06-13 even though PDFs have been produced since.
 *
 * WHAT EACH COLUMN IS FOR, AND HOW SURE IT IS
 *
 *   cn / item_no / machine_type_name / process_code / printed_at
 *       Certain — they come from the request itself.
 *
 *   parts_no / parts_name
 *       Resolved server-side from `lpb.eng_item` (the production plan) by control_no.
 *       Nobody has to send them. Measured on the 7 C/Ns that were actually printed in
 *       June: 7/7 resolved. This is deliberately NOT `tooling_spec_process.pn`, which
 *       is populated on only 13.7 % of rows (2,274 / 16,631).
 *
 *   lot_no / lot_verified
 *       NULL when the caller did not supply a lot. The system does NOT guess: an SDS
 *       is a setup sheet for a (CN, machine, process), and one sheet serves many lots
 *       — C31-04050 @1041 has 28 of them, C31-00781 has 208. Even inside a ±15-day
 *       window only 67.4 % of (CN, process) pairs resolve to a single lot, and a
 *       guessed lot that is wrong one time in three is worse evidence than no lot.
 *       So the lot is supplied by whoever knows it and we VERIFY it against
 *       `lpb.pc_lot_process`; `lot_verified` records the outcome
 *       (NULL = not supplied, true = found in the plan, false = supplied but not found).
 *
 *   source / requested_by
 *       'app'    — the in-app button, requested_by = JWT empno.
 *       'public' — the /api/public/sds/pdf deep link used by Ball_Grinding_Plan on
 *                  plb018, requested_by = the caller id it declares (or 'public').
 *
 *   pdf_sha256 / pdf_bytes
 *       The point of the whole table. Configuration changes over time — 24 slots were
 *       added to `sds_machine_tool` on 2026-08-25 alone — so the same CN printed on
 *       two dates is legitimately two different sheets. A row saying only "LE485
 *       printed C31-04050 on 8 Jun" cannot prove what the paper in someone's hand
 *       says; the hash can. The PDF itself is NOT stored — the hash is enough and a
 *       few hundred KB per print is not.
 *
 *   tooling_snapshot (jsonb)
 *       The T01–Tn fixture list as rendered, so the sheet's content is readable
 *       without re-rendering it against today's configuration.
 *
 * NOTHING HERE MAY BREAK A PRINT. Callers wrap the write so a logging failure is
 * reported to the console and the PDF is still returned.
 *
 * Idempotent; `--revert` drops the table.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');

const TABLE = 'sds_print_log';

const revert = process.argv.includes('--revert');

const DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  id                 BIGSERIAL PRIMARY KEY,
  cn                 VARCHAR(32)  NOT NULL,
  item_no            VARCHAR(32),
  parts_no           VARCHAR(64),
  parts_name         VARCHAR(128),
  lot_no             VARCHAR(32),
  lot_verified       BOOLEAN,
  machine_type_name  VARCHAR(64)  NOT NULL,
  process_code       VARCHAR(8),
  source             VARCHAR(16)  NOT NULL,
  requested_by       VARCHAR(64),
  pdf_sha256         CHAR(64),
  pdf_bytes          INTEGER,
  tooling_snapshot   JSONB,
  printed_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ${TABLE}_cn_printed_idx  ON ${TABLE} (cn, printed_at DESC);
CREATE INDEX IF NOT EXISTS ${TABLE}_lot_idx         ON ${TABLE} (lot_no) WHERE lot_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS ${TABLE}_printed_idx     ON ${TABLE} (printed_at DESC);
CREATE INDEX IF NOT EXISTS ${TABLE}_sha_idx         ON ${TABLE} (pdf_sha256) WHERE pdf_sha256 IS NOT NULL;
`;

const COMMENTS = `
COMMENT ON TABLE ${TABLE} IS $c$Evidentiary record of SDS PDFs actually produced. Separate from sds_access_log (which records VIEW). See api/engineer/mtc/db_migrations/20260825_sds_print_log.js.$c$;
COMMENT ON COLUMN ${TABLE}.lot_verified IS $c$NULL = caller supplied no lot; true = lot found in lpb.pc_lot_process for this CN+process; false = supplied but not found. The system never guesses a lot.$c$;
COMMENT ON COLUMN ${TABLE}.parts_no IS $c$Resolved from lpb.eng_item by control_no, not from tooling_spec_process.pn (which is only 13.7% populated).$c$;
COMMENT ON COLUMN ${TABLE}.pdf_sha256 IS $c$SHA-256 of the rendered PDF bytes. Configuration changes over time, so the same CN printed twice is legitimately two different sheets; this identifies which one.$c$;
`;

async function main() {

  if (await guard({ file: __filename, revert })) return;
  if (revert) {
    await engPool.query(`DROP TABLE IF EXISTS ${TABLE}`);
    console.log(`reverted: ${TABLE} dropped`);
    await recordRevert({ file: __filename });
    return;
  }

  const { rows: before } = await engPool.query(
    `SELECT to_regclass($1) IS NOT NULL AS exists`, [TABLE]);

  await engPool.query(DDL);
  await engPool.query(COMMENTS);

  const { rows: cols } = await engPool.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = $1 ORDER BY ordinal_position`, [TABLE]);

  console.log(before[0].exists ? `${TABLE} already existed — ensured schema` : `${TABLE} created`);
  console.log(cols.map((c) => `  ${c.column_name.padEnd(18)} ${c.data_type}`).join('\n'));
  await recordRun({ file: __filename });
  console.log(`\nundo with:  node api/engineer/mtc/db_migrations/20260825_sds_print_log.js --revert`);
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
