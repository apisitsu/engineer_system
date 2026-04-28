'use strict';

const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');

function computeOkFlags(calc, calcs, partData) {
  const { ks03a_calc, ks400b_calc, ks500rd_calc, ks400b5_calc, ks400b6_calc } = calcs;
  return {
    ksb22gOK:  calc.jawA <= 38 && partData.idAft >= 4.8 && partData.idAft < 16 && partData.wAft >= 14,
    ksb80OK:   calc.jawA > 15 && calc.jawA <= 70 && partData.idAft >= 7.9 && partData.wAft >= 14,
    ks03aOK:   partData.odAft <= 33 && !ks03a_calc.error,
    ks400bOK:  !ks400b_calc.error,
    ks500rdOK: !ks500rd_calc.error,
    ks400b5OK: !ks400b5_calc.error,
    ks400b6OK: !ks400b6_calc.error,
  };
}

async function fetchToolingRows(okFlags, calc) {
  const { ksb22gOK, ksb80OK, ks03aOK, ks400bOK, ks500rdOK, ks400b5OK, ks400b6OK } = okFlags;
  const none = Promise.resolve({ rows: [] });

  const [ksb22g, ksb80, tsg300, ks03a, ks400b, ks500rd, ks400b5, ks400b6] = await Promise.all([
    ksb22gOK ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             machine AS "Machine"
      FROM ${TABLES.TOOLING_KSB22G}
      WHERE (tooling_name ILIKE '%JAW%' AND dim_a BETWEEN $1 AND $2)
         OR (tooling_name ILIKE '%BACK PLATE%' AND dim_a BETWEEN $3 AND $4)`,
      [calc.jawA - 0.015, calc.jawA + 0.05, calc.bpAA, calc.bpAA + 2.5]
    ) : none,

    ksb80OK ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C",
             dim_d AS "Dim_D", dim_e AS "Dim_E",
             machine AS "Machine"
      FROM ${TABLES.TOOLING_KSB80}
      WHERE (tooling_name ILIKE '%JAW%' AND dim_a BETWEEN $1 AND $2)
         OR (tooling_name ILIKE '%BACK PLATE%' AND dim_a BETWEEN $3 AND $4)`,
      [calc.jawA - 0.015, calc.jawA + 0.05, calc.bpAA - 0.4, calc.bpAA + 3.1]
    ) : none,

    engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G",
             machine AS "Machine"
      FROM ${TABLES.TOOLING_TSG300}
      WHERE (tooling_name ILIKE '%CHUTE%' AND dim_a BETWEEN $1 AND $2 AND dim_b BETWEEN $3 AND $4)
         OR (tooling_name ILIKE '%CARRIER%' AND dim_a BETWEEN $5 AND $6)`,
      [
        calc.chuteCalcA, calc.chuteCalcA + 1.0,
        calc.chuteCalcB - 0.1, calc.chuteCalcB + 3.0,
        Math.min(calc.carrierCalcA, calc.tsgW_Amin) - 0.1,
        Math.max(calc.carrierCalcA + 1.0, calc.tsgW_Amax) + 0.1,
      ]
    ),

    ks03aOK ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
             dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
             dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
             dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
             dim_u AS "Dim_U", dim_v AS "Dim_V", machine AS "Machine"
      FROM ${TABLES.TOOLING_KS03A}
      WHERE tooling_name ILIKE ANY(ARRAY['%ROLLER SHOE%','%CPX SHOE%','%CHUTE COVER%','%FRONT PLATE%',
             '%SETTING GAUGE%','%MASTER RING%','%PLUG GAUGE%','%LOADER%','%ROTOR%'])`) : none,

    ks400bOK ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C",
             dim_d AS "Dim_D", dim_e AS "Dim_E", dim_f AS "Dim_F",
             machine AS "Machine"
      FROM ${TABLES.TOOLING_KS400B}
      WHERE tooling_name ILIKE ANY(ARRAY['%WORK DRIVER%','%SUPPORT BLOCK%','%CHUTE%','%PLUG%'])`) : none,

    ks500rdOK ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
             machine AS "Machine"
      FROM ${TABLES.TOOLING_KS500RD}
      WHERE tooling_name ILIKE ANY(ARRAY['%LOADING PINTLE%','%WORK DRIVER%','%FRONT SHOE%'])`) : none,

    ks400b5OK ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
             dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
             dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
             dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
             dim_u AS "Dim_U", dim_v AS "Dim_V", dim_w AS "Dim_W", dim_x AS "Type"
      FROM ${TABLES.TOOLING_KS400B5}
      WHERE tooling_name ILIKE ANY(ARRAY['%WORK CLAMP%','%SHAFT%','%WORK CHUTE%','%WORK LOADER%',
             '%WORK CHUCK%','%WORK HOLDER%','%CHUCK JAW%','%CHUTE GUIDE%','%STOPPER%','%MASTER RING%'])`) : none,

    ks400b6OK ? engPool.query(`
      SELECT tooling_name AS "Tooling_name", tooling_no AS "Tooling_no",
             dim_a AS "Dim_A", dim_b AS "Dim_B", dim_c AS "Dim_C", dim_d AS "Dim_D",
             dim_e AS "Dim_E", dim_f AS "Dim_F", dim_g AS "Dim_G", dim_h AS "Dim_H",
             dim_i AS "Dim_I", dim_j AS "Dim_J", dim_k AS "Dim_K", dim_l AS "Dim_L",
             dim_m AS "Dim_M", dim_n AS "Dim_N", dim_o AS "Dim_O", dim_p AS "Dim_P",
             dim_q AS "Dim_Q", dim_r AS "Dim_R", dim_s AS "Dim_S", dim_t AS "Dim_T",
             dim_u AS "Dim_U", dim_v AS "Dim_V", dim_w AS "Dim_W", dim_x AS "Type"
      FROM ${TABLES.TOOLING_KS400B6}
      WHERE tooling_name ILIKE ANY(ARRAY['%WORK DRIVER%','%CHUTE%','%PLUG%','%WORK GUIDE%',
             '%WORK PUSHER%','%FRONT SHOE%','%REAR SHOE%','%PILOT PIN%'])`) : none,
  ]);

  return {
    ksb22g:  ksb22g.rows,
    ksb80:   ksb80.rows,
    tsg300:  tsg300.rows,
    ks03a:   ks03a.rows,
    ks400b:  ks400b.rows,
    ks500rd: ks500rd.rows,
    ks400b5: ks400b5.rows,
    ks400b6: ks400b6.rows,
  };
}

module.exports = { computeOkFlags, fetchToolingRows };
