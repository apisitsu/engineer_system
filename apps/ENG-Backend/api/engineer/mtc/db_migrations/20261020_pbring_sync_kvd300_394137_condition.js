'use strict';

/**
 * Populate the GRIND/DRESS CONDITION area (pbring_sds_parameter, the
 * row/col-keyed "Parameter Config" table that actually renders on the PDF)
 * for KVD300 / CN 394137, processes 1021 and 1022 — user found it blank on
 * a real PDF (2026-10-20): T01/T02 tooling printed fine (that comes from
 * pbring_sds_condition, auto-resolved), but every GRIND SPEED/DRESS
 * CONDITION/GRINDING CONDITION row was empty, because pbring_sds_parameter
 * only ever gets written by an admin hand-typing the "Parameter Config"
 * admin tab — it never auto-pulls from pbring_sds_param, where this CN's
 * real values already exist (from the original 2026-10-02 bulk import).
 *
 * The key -> row/col mapping below is NOT guessed — verified live against
 * CN 294065 (the one CN that already had a hand-typed pbring_sds_parameter
 * override for KVD300): its row_17_G..row_32_G values and row_34/35_B+H
 * values matched its own pbring_sds_param.params keys exactly, 1:1, for
 * every key present. Confirmed this is KVD300-specific — a different
 * machine's admin typed its own labels into different rows, so this
 * mapping must be re-verified the same way before reusing it elsewhere
 * (the plan file's "automating #3 from the xlsx" notes the general version
 * of this problem, not done here — this migration is scoped narrowly to
 * KVD300/394137 by explicit user decision, not a general sync tool).
 *
 * Deliberately reuses pbringGridService.saveManualParams rather than
 * duplicating its upsert SQL — same bulk-chunked, delete-by-omission
 * semantics the real "Parameter Config" admin tab's save button uses, so
 * this migration's result is indistinguishable from an admin having typed
 * it in by hand. Writes CN+process-scoped rows only (not also a process-
 * agnostic copy — 294065's pre-existing process-agnostic duplicate of the
 * same 15 rows looks like an accidental double-save, not a deliberate
 * pattern worth repeating).
 *
 * Only writes keys present in pbring_sds_param for that (cn, process_code)
 * — 394137/1021 has 1st/2nd grinding-condition data, 1022 has only 1st, so
 * row_36/37 (3rd/4th) are left untouched for both, same as 294065's own
 * data never went past 4th.
 *
 * `--revert` deletes exactly the rows this migration wrote (cn=394137,
 * machine=KVD300, process_code in 1021/1022), not a blanket wipe.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { saveManualParams } = require('../../pbring/pbringGridService');

const revert = process.argv.includes('--revert');
const MACHINE = 'KVD300';
const CN = '394137';
const PROCESSES = ['1021', '1022'];

// Verified live against CN 294065's own data (see header). Single-value
// GRIND SPEED/DRESS CONDITION rows (G column) first, then the per-ordinal
// GRINDING CONDITION rows (B = value in mm, H = Ra) — only 1st..4th are
// mapped because that's as far as any real data (294065 or 394137) goes;
// extending further needs its own live verification first (row 40's label
// duplicates row 38's "5th Time :" in KVD300's own hand-typed labels, so
// the row-by-position assumption can't just be extrapolated blindly).
const SCALAR_ROW_MAP = {
  Top_GW_Speed: 'row_17_G',
  Bottom_GW_Speed: 'row_18_G',
  Carrier_Auto_Speed: 'row_19_G',
  DressTimeR: 'row_21_G',
  DressTimeF: 'row_22_G',
  DressInfeedAmountR: 'row_23_G',
  DressInfeedAmountF: 'row_24_G',
  DressInfeedTimingR: 'row_25_G',
  DressInfeedTimingF: 'row_26_G',
  Top_GW_Dress_SpeedR: 'row_27_G',
  Top_GW_Dress_SpeedF: 'row_28_G',
  Bottom_GW_Dress_SpeedR: 'row_29_G',
  Bottom_GW_Dress_SpeedF: 'row_30_G',
  Spark_Out_Timer: 'row_31_G',
  Compensat_Amount: 'row_32_G',
};
const ORDINAL_ROW_MAP = [
  { valKey: '1st', raKey: '1Ra', row: 34 },
  { valKey: '2nd', raKey: '2Ra', row: 35 },
  { valKey: '3rd', raKey: '3Ra', row: 36 },
  { valKey: '4th', raKey: '4Ra', row: 37 },
];

function buildParamList(sourceParams) {
  const out = [];
  for (const [srcKey, rowKey] of Object.entries(SCALAR_ROW_MAP)) {
    if (sourceParams[srcKey] != null && sourceParams[srcKey] !== '') {
      out.push({ param_key: rowKey, param_value: sourceParams[srcKey] });
    }
  }
  for (const { valKey, raKey, row } of ORDINAL_ROW_MAP) {
    if (sourceParams[valKey] != null && sourceParams[valKey] !== '') {
      out.push({ param_key: `row_${row}_B`, param_value: sourceParams[valKey] });
    }
    if (sourceParams[raKey] != null && sourceParams[raKey] !== '') {
      out.push({ param_key: `row_${row}_H`, param_value: sourceParams[raKey] });
    }
  }
  return out;
}

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    const { rowCount } = await engPool.query(
      `DELETE FROM pbring_sds_parameter WHERE machine_type_name = $1 AND cn = $2 AND process_code = ANY($3)`,
      [MACHINE, CN, PROCESSES]
    );
    console.log(`reverted: deleted ${rowCount} row(s) for ${MACHINE}/${CN}/[${PROCESSES.join(',')}]`);
    await recordRevert({ file: __filename });
    return;
  }

  let totalWritten = 0;
  for (const processCode of PROCESSES) {
    const { rows } = await engPool.query(
      `SELECT params FROM pbring_sds_param WHERE cn = $1 AND mc_key = $2 AND process_code = $3`,
      [CN, MACHINE, processCode]
    );
    const sourceParams = rows[0]?.params;
    if (!sourceParams) {
      console.log(`${MACHINE}/${CN}/${processCode}: no pbring_sds_param row found, skipped`);
      continue;
    }
    const paramList = buildParamList(sourceParams);
    if (!paramList.length) {
      console.log(`${MACHINE}/${CN}/${processCode}: no mapped keys had data, skipped`);
      continue;
    }
    const saved = await saveManualParams(MACHINE, CN, processCode, paramList, 'migration:20261020');
    console.log(`${MACHINE}/${CN}/${processCode}: wrote ${saved.length} condition row(s)`);
    totalWritten += saved.length;
  }

  console.log(`\nTotal: ${totalWritten} pbring_sds_parameter row(s) written for ${MACHINE}/${CN}`);
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261020_pbring_sync_kvd300_394137_condition.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
