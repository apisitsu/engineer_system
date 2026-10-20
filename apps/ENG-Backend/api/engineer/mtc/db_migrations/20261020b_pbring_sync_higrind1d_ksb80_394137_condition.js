'use strict';

/**
 * Same per-CN condition sync as 20261020_pbring_sync_kvd300_394137_condition.js,
 * extended to HIGRIND1D (full) and KSB80 (partial — see gap note below), for
 * CN 394137, after the user asked which other machines could safely get the
 * same treatment (294065 is the only CN with a hand-typed pbring_sds_parameter
 * override to verify a mapping against — same method, see that migration's
 * header for the general approach).
 *
 * KSH150 was EXCLUDED on purpose: its 294065 override has multiple pairs of
 * sh-keys sharing the exact same value (e.g. sh3 and sh13 both 14.5000, sh4
 * and sh14 both 1000, sh5 and sh15 both 0.0700, sh7 and sh25 both 0.0000),
 * AND unlike KSB80 its row labels (pbring_sds_parameter row_N_A) are blank
 * for every individual data row — only 3 section headers exist ("[HONING
 * ROUGH]", "[HONING FINISH]", "[WORK DATA]") with no per-row text to
 * disambiguate which of a colliding pair belongs to which row. Writing this
 * without being certain risks printing a HONING ROUGH value into a HONING
 * FINISH cell or vice versa on a real tooling document — not attempted.
 *
 * HIGRIND1D mapping (confirmed live against 294065, position-based, no
 * ambiguity — row_N_A directly names each single-value quantity, and the
 * cutting-condition section is a fixed "1st Time"..."16th Time" row
 * sequence starting at row 40):
 *   row_31_H=(A) OUTER DIAMETER, row_32_H=(B) SHIM, row_33_H=(C) DISTANCE OF
 *   BLADE AND GW, row_34_H=(D) BLADE, row_35_H=(E) RW ANGLE, row_38_H=RW_Speed
 *   row_(39+n)_B = nth Time, row_(39+n)_H = nth-Ra (only when that Ra key
 *   exists in the source — most ordinals have no separate Ra reading).
 *
 * KSB80 mapping — PARTIAL. Its row_N_A labels literally carry the source
 * key's own number ("#01 JUMP FEED" -> sh1, "#23 WORK OFFSET" -> sh23, ...),
 * confirmed 1:1 against every sh-key in 294065's override for columns E
 * (rows 17-25, one reading per row) and H/F (rows 26-47, one or two
 * readings per row via a "_1" suffix). NOT included: sh13-sh18, which show
 * up as a SECOND value in column H on rows 17-22 (e.g. row_17_H=sh13) with
 * no "#NN" of their own to confirm which row each belongs to by anything
 * other than row order — three of those five values are literally
 * unconfirmable from one example alone. Left blank rather than guessed.
 *
 * Reuses pbringGridService.saveManualParams (see sibling migration for why).
 * `--revert` deletes exactly the rows this migration wrote.
 */

const { engPool } = require('../../../../instance/eng_db');
const { guard, recordRun, recordRevert } = require('../../../../db_migrations/lib/migrationLog');
const { saveManualParams } = require('../../pbring/pbringGridService');

const revert = process.argv.includes('--revert');
const CN = '394137';

const JOBS = [
  { machine: 'HIGRIND1D', processes: ['1011', '1012'] },
  { machine: 'KSB80', processes: ['1061', '1062'] },
];

const HIGRIND1D_SCALAR_MAP = {
  '(A)': 'row_31_H',
  '(B)': 'row_32_H',
  '(C)': 'row_33_H',
  '(D)': 'row_34_H',
  '(E)': 'row_35_H',
  RW_Speed: 'row_38_H',
};
const HIGRIND1D_ORDINAL_BASE_ROW = 39; // row = base + n, n = 1..16

const KSB80_SH_MAP = {
  sh1: 'row_17_E', sh2: 'row_18_E', sh3: 'row_19_E', sh5: 'row_20_E', sh6: 'row_21_E',
  sh7: 'row_22_E', sh8: 'row_23_E', sh10: 'row_24_E', sh11: 'row_25_E',
  sh12: 'row_26_H', sh19: 'row_27_H', sh20: 'row_28_H',
  sh21: 'row_29_F', sh21_1: 'row_29_H', sh22: 'row_30_H', sh23: 'row_31_H',
  sh31: 'row_33_H', sh32: 'row_34_H', sh33: 'row_35_H', sh34: 'row_36_H',
  sh35: 'row_37_H', sh36: 'row_38_H', sh37: 'row_39_H', sh38: 'row_40_H',
  sh41: 'row_42_H', sh42: 'row_43_H', sh43: 'row_44_H', sh44: 'row_45_H',
  sh45: 'row_46_H', sh46: 'row_47_F', sh46_1: 'row_47_H',
};

function buildHigrind1dParamList(src) {
  const out = [];
  for (const [srcKey, rowKey] of Object.entries(HIGRIND1D_SCALAR_MAP)) {
    if (src[srcKey] != null && src[srcKey] !== '') out.push({ param_key: rowKey, param_value: src[srcKey] });
  }
  for (let n = 1; n <= 16; n++) {
    const row = HIGRIND1D_ORDINAL_BASE_ROW + n;
    const valKey = `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
    const raKey = `${n}Ra`;
    if (src[valKey] != null && src[valKey] !== '') out.push({ param_key: `row_${row}_B`, param_value: src[valKey] });
    if (src[raKey] != null && src[raKey] !== '') out.push({ param_key: `row_${row}_H`, param_value: src[raKey] });
  }
  return out;
}

function buildKsb80ParamList(src) {
  const out = [];
  for (const [srcKey, rowKey] of Object.entries(KSB80_SH_MAP)) {
    if (src[srcKey] != null && src[srcKey] !== '') out.push({ param_key: rowKey, param_value: src[srcKey] });
  }
  return out;
}

const BUILDERS = { HIGRIND1D: buildHigrind1dParamList, KSB80: buildKsb80ParamList };

async function main() {
  if (await guard({ file: __filename, revert })) return;

  if (revert) {
    const machines = JOBS.map((j) => j.machine);
    const processes = [...new Set(JOBS.flatMap((j) => j.processes))];
    const { rowCount } = await engPool.query(
      `DELETE FROM pbring_sds_parameter WHERE machine_type_name = ANY($1) AND cn = $2 AND process_code = ANY($3)`,
      [machines, CN, processes]
    );
    console.log(`reverted: deleted ${rowCount} row(s) for [${machines.join(',')}]/${CN}`);
    await recordRevert({ file: __filename });
    return;
  }

  let totalWritten = 0;
  for (const { machine, processes } of JOBS) {
    const build = BUILDERS[machine];
    for (const processCode of processes) {
      const { rows } = await engPool.query(
        `SELECT params FROM pbring_sds_param WHERE cn = $1 AND mc_key = $2 AND process_code = $3`,
        [CN, machine, processCode]
      );
      const sourceParams = rows[0]?.params;
      if (!sourceParams) {
        console.log(`${machine}/${CN}/${processCode}: no pbring_sds_param row found, skipped`);
        continue;
      }
      const paramList = build(sourceParams);
      if (!paramList.length) {
        console.log(`${machine}/${CN}/${processCode}: no mapped keys had data, skipped`);
        continue;
      }
      const saved = await saveManualParams(machine, CN, processCode, paramList, 'migration:20261020b');
      console.log(`${machine}/${CN}/${processCode}: wrote ${saved.length} condition row(s)`);
      totalWritten += saved.length;
    }
  }

  console.log(`\nTotal: ${totalWritten} pbring_sds_parameter row(s) written for CN ${CN} (HIGRIND1D full, KSB80 partial — see header)`);
  await recordRun({ file: __filename });
  console.log('\nundo with:  node api/engineer/mtc/db_migrations/20261020b_pbring_sync_higrind1d_ksb80_394137_condition.js --revert');
}

main()
  .then(() => engPool.end())
  .catch(async (e) => {
    console.error(e);
    await engPool.end().catch(() => {});
    process.exit(1);
  });
