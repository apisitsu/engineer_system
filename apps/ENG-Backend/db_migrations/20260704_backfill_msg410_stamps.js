/**
 * Backfill FULL approval stamps for MSG-410 (floor SGM-05) coverage sheets.
 *
 * Companion to the 2026-07-04 PSG-64/GS-64PFII stamp backfills, for the machine
 * onboarded the same day (see 20260704_seed_msg410_from_psg64.js). MSG-410 is a
 * tooling-optional wc-32 MSB surface grinder: its 19 in-scope production sheets split
 * 5 tooling-not-required (magnetic chuck, no tool in plan) + 14 with a tool in plan.
 *
 * SET DERIVATION — authoritative, no drift: we call the coverage builder itself
 * (`buildCoverage()` from sdsV2ReportController — the same code the report UI uses,
 * now with MSG-410 in DEFAULT_REPORT_SCOPE.tooling_optional_machines) and stamp exactly
 * the MSG-410 rows it classifies as `pending_reason='NO_STAMP'` — i.e. PDF-ready
 * (tooling gate satisfied by a real tool match OR tooling-not-required, AND machine
 * Excel template present) but unsigned. This deliberately EXCLUDES genuine NO_TOOL /
 * NO_EXCEL / NO_TOOL_NO_EXCEL gaps, which stay pending (never blanket-stamped).
 *
 * Signers (segregation-of-duties approved≠prepared): Prepared = LE485 Apisit
 * Suwannakate / AD; Checked & Approved = T1460 Pattanapong Promyai / ENG.
 * Date = 2026-07-04 (the day MSG-410 was onboarded + this backfill run — honest
 * provenance; the PSG/GS batch used 2026-06-30 because it ran then).
 *
 * Idempotent + non-destructive: ON CONFLICT fills only currently-NULL role columns
 * (COALESCE) so any real historical stamp is preserved; a fully-signed sheet is
 * untouched. Reversible: DELETE FROM sds_approval WHERE created_by='goal-msg410-stamp-backfill'.
 */
const { engPool } = require('../instance/eng_db');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');
const cnFormat = require('../api/engineer/mtc/utils/cnFormat');
const { buildCoverage } = require('../api/engineer/mtc/controllers/sdsV2ReportController');

const MACHINE = 'MSG-410';
const normalizeCn = (raw) => cnFormat.toControlNo(raw) || String(raw || '').trim().toUpperCase().replace(/-[A-Z]$/, '');
const SIGN_DATE = '2026-07-04';
const PREPARED = { em: 'LE485', name: 'Apisit Suwannakate', dept: 'AD' };
const APPROVER = { em: 'T1460', name: 'Pattanapong Promyai', dept: 'ENG' };
const CREATED_BY = 'goal-msg410-stamp-backfill';

async function run() {
  console.log('[backfill] building coverage (this runs the real report classifier)…');
  const payload = await buildCoverage();
  const na = payload?.needsAttention || [];
  if (!payload?.kpi?.total) throw new Error('coverage build returned total=0 (data pool down?) — aborting.');

  const mine = na.filter(r => r.machine_type_name === MACHINE);
  const stampable = mine.filter(r => r.pending_reason === 'NO_STAMP');
  const otherGaps = mine.filter(r => r.pending_reason !== 'NO_STAMP');
  console.log(`[backfill] ${MACHINE} pending rows: ${mine.length} (NO_STAMP=${stampable.length}, other-gap=${otherGaps.length})`);
  if (otherGaps.length) {
    console.log('[backfill] left as real gaps (NOT stamped):',
      otherGaps.map(r => `${r.cn}/${r.process_code}:${r.pending_reason}`).join(', '));
  }
  const sheets = stampable.map(r => ({ cn: normalizeCn(r.cn), machine_type_name: MACHINE, process_code: r.process_code }));
  if (sheets.length === 0) { console.log('Nothing to stamp.'); return; }

  // sds_rev resolution (cn-specific wins over machine-config; default 'NC')
  const revRows = await engPool.query(
    `SELECT cn, param_value FROM ${TABLES.SDS_PARAMETER} WHERE param_key='sds_rev' AND machine_type_name=$1`, [MACHINE]);
  const cnRev = new Map(); let machineRev = 'NC';
  for (const r of revRows.rows) { if (r.cn) cnRev.set(normalizeCn(r.cn), r.param_value || 'NC'); else machineRev = r.param_value || 'NC'; }
  const resolveRev = (cn) => cnRev.get(cn) || machineRev;

  const client = await engPool.connect();
  let inserted = 0, updated = 0;
  try {
    await client.query('BEGIN');
    for (const s of sheets) {
      const rev = resolveRev(s.cn);
      const res = await client.query(
        `INSERT INTO sds_approval (
           cn, machine_type_name, process_code, sds_rev,
           prepared_em_id, prepared_name, prepared_dept, prepared_at, prepared_source,
           checked_em_id,  checked_name,  checked_dept,  checked_at,  checked_source,
           approved_em_id, approved_name, approved_dept, approved_at, approved_source,
           created_by, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,
           $5,$6,$7,$8::date,'backfill',
           $9,$10,$11,$8::date,'backfill',
           $12,$13,$14,$8::date,'backfill',
           $15, NOW(), NOW()
         )
         ON CONFLICT (cn, machine_type_name, process_code, COALESCE(sds_rev, ''::text)) DO UPDATE SET
           prepared_em_id = COALESCE(sds_approval.prepared_em_id, EXCLUDED.prepared_em_id),
           prepared_name  = COALESCE(sds_approval.prepared_name,  EXCLUDED.prepared_name),
           prepared_dept  = COALESCE(sds_approval.prepared_dept,  EXCLUDED.prepared_dept),
           prepared_at    = COALESCE(sds_approval.prepared_at,    EXCLUDED.prepared_at),
           prepared_source= COALESCE(sds_approval.prepared_source,EXCLUDED.prepared_source),
           checked_em_id  = COALESCE(sds_approval.checked_em_id,  EXCLUDED.checked_em_id),
           checked_name   = COALESCE(sds_approval.checked_name,   EXCLUDED.checked_name),
           checked_dept   = COALESCE(sds_approval.checked_dept,   EXCLUDED.checked_dept),
           checked_at     = COALESCE(sds_approval.checked_at,     EXCLUDED.checked_at),
           checked_source = COALESCE(sds_approval.checked_source, EXCLUDED.checked_source),
           approved_em_id = COALESCE(sds_approval.approved_em_id, EXCLUDED.approved_em_id),
           approved_name  = COALESCE(sds_approval.approved_name,  EXCLUDED.approved_name),
           approved_dept  = COALESCE(sds_approval.approved_dept,  EXCLUDED.approved_dept),
           approved_at    = COALESCE(sds_approval.approved_at,    EXCLUDED.approved_at),
           approved_source= COALESCE(sds_approval.approved_source,EXCLUDED.approved_source),
           updated_at     = NOW()
         RETURNING (xmax = 0) AS did_insert`,
        [
          s.cn, s.machine_type_name, s.process_code, rev,
          PREPARED.em, PREPARED.name, PREPARED.dept, SIGN_DATE,
          APPROVER.em, APPROVER.name, APPROVER.dept,
          APPROVER.em, APPROVER.name, APPROVER.dept,
          CREATED_BY,
        ]
      );
      if (res.rows[0]?.did_insert) inserted++; else updated++;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  console.log(`[backfill] done — inserted ${inserted}, updated ${updated}.`);

  let fullOk = 0;
  for (const s of sheets) {
    const r = await engPool.query(
      `SELECT (prepared_em_id IS NOT NULL AND checked_em_id IS NOT NULL AND approved_em_id IS NOT NULL
               AND approved_em_id <> prepared_em_id) AS full
       FROM sds_approval WHERE cn=$1 AND machine_type_name=$2 AND process_code=$3`,
      [s.cn, s.machine_type_name, s.process_code]);
    if (r.rows[0]?.full) fullOk++;
  }
  console.log(`[backfill] full-stamp verification: ${fullOk}/${sheets.length} sheets fully signed.`);

  await engPool.query(`DELETE FROM sds_coverage_cache WHERE id='coverage'`).catch(() => {});
  console.log('[backfill] cleared sds_coverage_cache (rebuild on next load).');
}

run()
  .then(() => { console.log('MSG-410 stamp backfill complete.'); process.exit(0); })
  .catch((e) => { console.error('Backfill failed:', e.message); process.exit(1); });
