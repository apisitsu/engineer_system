/**
 * Backfill FULL approval stamps for PSG-64 / GS-64PFII sheets that DO use tooling
 * but are currently NO_STAMP (PDF-ready-but-unsigned).
 *
 * Companion to 20260704_backfill_psg_gs_no_tooling_stamps.js. That one covered the
 * "tooling not required" (magnetic-chuck, no fixture) sheets. THIS one covers the
 * remaining PSG-64/GS-64PFII sheets whose process plan DOES list a tool (matched via
 * saved factory plan or the Tooling Select fallback) — they have a tooling match +
 * Excel template, so their only gap is the approval stamp. User asked to stamp these
 * too, dated 2026-06-30.
 *
 * Source of the set = the coverage report's own `needsAttention` (persisted in
 * `sds_coverage_cache`), filtered to machine ∈ {PSG-64, GS-64PFII} AND
 * pending_reason='NO_STAMP'. Using the report's own output guarantees we stamp exactly
 * the sheets it shows as NO_STAMP (no scope/T-Select drift). REQUIRES a fresh cache —
 * the caller should have rebuilt coverage (?refresh=1) first; the script asserts the
 * cache exists and is non-empty.
 *
 * Signers/date identical to the companion (segregation-of-duties approved≠prepared):
 * Prepared=LE485 Apisit Suwannakate/AD, Checked+Approved=T1460 Pattanapong Promyai/ENG,
 * date 2026-06-30, source='backfill'. Upsert fills only NULL role columns (COALESCE).
 * Reversible: DELETE FROM sds_approval WHERE created_by='goal-psg-gs-tooling-stamp-backfill'.
 */
const { engPool } = require('../../../../instance/eng_db');
const { TABLES } = require('../mtcConstants');
const cnFormat = require('../utils/cnFormat');

const normalizeCn = (raw) => cnFormat.toControlNo(raw) || String(raw || '').trim().toUpperCase().replace(/-[A-Z]$/, '');
const TARGET = new Set(['PSG-64', 'GS-64PFII']);
const SIGN_DATE = '2026-06-30';
const PREPARED = { em: 'LE485', name: 'Apisit Suwannakate', dept: 'AD' };
const APPROVER = { em: 'T1460', name: 'Pattanapong Promyai', dept: 'ENG' };
const CREATED_BY = 'goal-psg-gs-tooling-stamp-backfill';

async function run() {
  // Authoritative set: the report's persisted needsAttention (NO_STAMP rows).
  const cache = await engPool.query(`SELECT data FROM sds_coverage_cache WHERE id='coverage' LIMIT 1`);
  if (!cache.rows[0]) throw new Error('sds_coverage_cache is empty — rebuild coverage (?refresh=1) before running.');
  const needsAttention = cache.rows[0].data?.needsAttention || [];
  if (needsAttention.length === 0) throw new Error('needsAttention is empty — cache looks degraded; rebuild coverage first.');

  const sheets = needsAttention
    .filter(r => TARGET.has(r.machine_type_name) && r.pending_reason === 'NO_STAMP')
    .map(r => ({ cn: normalizeCn(r.cn), machine_type_name: r.machine_type_name, process_code: r.process_code }));

  // sds_rev resolution (cn-specific 'sds_rev' param wins over machine-config; default 'NC')
  const sdsRevRows = await engPool.query(
    `SELECT cn, machine_type_name, param_value FROM ${TABLES.SDS_PARAMETER}
     WHERE param_key='sds_rev' AND machine_type_name = ANY($1)`, [[...TARGET]]
  );
  const cnRev = new Map(), machineRev = new Map();
  for (const r of sdsRevRows.rows) {
    if (r.cn) cnRev.set(`${normalizeCn(r.cn)}||${r.machine_type_name}`, r.param_value || 'NC');
    else machineRev.set(r.machine_type_name, r.param_value || 'NC');
  }
  const resolveRev = (cn, m) => cnRev.get(`${cn}||${m}`) || machineRev.get(m) || 'NC';

  console.log(`[backfill] PSG-64/GS-64PFII NO_STAMP (has-tooling) sheets: ${sheets.length}`);
  if (sheets.length === 0) { console.log('Nothing to stamp.'); return; }

  const client = await engPool.connect();
  let inserted = 0, updated = 0;
  try {
    await client.query('BEGIN');
    for (const s of sheets) {
      const rev = resolveRev(s.cn, s.machine_type_name);
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
      [s.cn, s.machine_type_name, s.process_code]
    );
    if (r.rows[0]?.full) fullOk++;
  }
  console.log(`[backfill] full-stamp verification: ${fullOk}/${sheets.length} sheets fully signed.`);

  // Bust the persisted cache so the next report load rebuilds and reflects COMPLETE.
  await engPool.query(`DELETE FROM sds_coverage_cache WHERE id='coverage'`);
  console.log('[backfill] cleared sds_coverage_cache (rebuild on next load).');
}

run()
  .then(() => { console.log('Migration complete.'); process.exit(0); })
  .catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
