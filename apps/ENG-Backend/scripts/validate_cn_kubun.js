'use strict';

/**
 * Validate the RE21000H 区分 decode (api/engineer/mtc/utils/cnKubun.js) against the
 * live control-number population. Read-only — touches no table, writes nothing.
 *
 *   node scripts/validate_cn_kubun.js
 *
 * Reports: every 2-digit class present in lpb.eng_item, its enabled-CN count, and
 * whether the decode knows it. A class in the data but not the standard (27 / 37
 * historically) is expected and printed as UNMAPPED, not an error.
 */

const { maqPool } = require('../instance/maq_db');
const { KUBUN, NON_GRIND_KUBUN } = require('../api/engineer/mtc/utils/cnKubun');

(async () => {
  const { rows } = await maqPool.query(`
    SELECT substring(sub_class from 2 for 2) AS k,
           count(DISTINCT control_no)        AS enabled
      FROM lpb.eng_item
     WHERE sub_class ~ '^[A-Z][0-9]{2}'
       AND condition = 'Enable'
     GROUP BY 1
     ORDER BY 1`);

  let mapped = 0, unmapped = 0, mappedCns = 0, unmappedCns = 0, nonGrindCns = 0;
  console.log('class | enabled CNs | decode');
  console.log('------+-------------+---------------------------------------------');
  for (const r of rows) {
    const n = parseInt(r.enabled, 10);
    const k = KUBUN[r.k];
    if (k) {
      mapped += 1; mappedCns += n;
      if (!k.needsGrindSds) nonGrindCns += n;
      const flag = k.needsGrindSds ? '' : '  [non-grind]';
      console.log(`  ${r.k}  | ${String(n).padStart(11)} | ${k.family} · ${k.desc}${flag}`);
    } else {
      unmapped += 1; unmappedCns += n;
      console.log(`  ${r.k}  | ${String(n).padStart(11)} | *** UNMAPPED (in data, not in RE21000H §4-3(2)) ***`);
    }
  }

  const known = Object.keys(KUBUN);
  const missingFromData = known.filter((c) => !rows.some((r) => r.k === c));

  console.log('\nsummary');
  console.log(`  classes in data:      ${rows.length}  (${mapped} decoded, ${unmapped} unmapped)`);
  console.log(`  enabled CNs decoded:  ${mappedCns}  of ${mappedCns + unmappedCns}`);
  console.log(`  non-grind CNs:        ${nonGrindCns}  (excluded from SDS audit by NON_GRIND_KUBUN = [${NON_GRIND_KUBUN.join(', ')}])`);
  console.log(`  decode entries never seen in data: ${missingFromData.length ? missingFromData.join(', ') : '(none)'}`);
  console.log(unmapped === 0
    ? '\nOK — every class in the live data is decoded.'
    : `\nNOTE — ${unmapped} class(es) in the data are not in the standard; resolveKubun() returns null for them (safe).`);

  await maqPool.end();
  process.exit(0);
})().catch((e) => { console.error('validate_cn_kubun FAILED:', e.message); process.exit(1); });
