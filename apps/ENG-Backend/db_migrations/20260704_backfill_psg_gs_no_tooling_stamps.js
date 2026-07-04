/**
 * Backfill FULL approval stamps for PSG-64 / GS-64PFII "tooling not required" sheets.
 *
 * Context: surface-grind machines hold most parts on a magnetic chuck with no fixture.
 * The 2026-07-04 coverage change added `tooling_optional_machines` so a sheet whose
 * process plan lists NO tool on these machines is `tooling_not_required` (satisfies the
 * tooling gate) instead of a false NO_TOOL gap. Such a sheet becomes COMPLETE only once
 * it ALSO carries a full approval stamp — but the earlier "delete stamped-pending" pass
 * (2026-06-27) removed the stamps these sheets used to have (they were PENDING/NO_TOOL
 * back then). This migration re-stamps exactly that set so they read COMPLETE.
 *
 * Set derivation (mirrors buildCoverage EXACTLY, minus the T-Select fallback which is
 * irrelevant to tooling_not_required):
 *   production (lpb.pc_production) in report scope, machine resolving to PSG-64/GS-64PFII,
 *   part_type in scope, dedup by (normalizeCn, machine, process, earliest first_seen),
 *   KEEP only rows whose process plan (lpb.eng_r_pi_tool) has NO tool for that process.
 *
 * Signers (same convention as prior backfills, satisfies segregation-of-duties
 * approved≠prepared): Prepared = LE485 Apisit Suwannakate / AD;
 * Checked & Approved = T1460 Pattanapong Promyai / ENG. Date = 2026-06-30.
 *
 * Idempotent + non-destructive: ON CONFLICT fills only role columns that are currently
 * NULL (COALESCE) so any existing REAL historical stamp is preserved; a sheet already
 * fully signed is left untouched. Reversible:
 *   DELETE FROM sds_approval WHERE created_by='goal-psg-gs-notool-backfill'
 *     AND prepared_at='2026-06-30' ...  (only removes rows this run INSERTED — see below).
 * Rows this run only UPDATED (filled a missing role on a pre-existing sheet) keep the
 * other signers; to fully revert those, restore from sds_approval history if needed.
 */
const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');
const { pool: rodpcPool } = require('../instance/instance');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');
const cnFormat = require('../api/engineer/mtc/utils/cnFormat');

const PART_TYPE_ITEM_PREFIX = { ball: '3', race: '2', body: '[15]', sleeve: '6', mecha: '9', spherical: '4' };
const DEFAULT_REPORT_SCOPE = {
  part_types:    ['ball', 'race', 'mecha'],
  process_codes: ['1011','1012','1021','1022','1031','1041','1042','1061','1062','1101','1102','1161','1162','1241','1321'],
  work_centers:  ['05', '09', '29', '30', '31', '32', '37'],
  excluded_cns:  ['C39-00209', 'C29-04044', 'C29-04045'],
  since_date:    '2023-01-01',
  tooling_optional_machines: ['PSG-64', 'GS-64PFII'],
};

const normalizeCn = (raw) => cnFormat.toControlNo(raw) || String(raw || '').trim().toUpperCase().replace(/-[A-Z]$/, '');
function cnPartType(cn) {
  const m = String(cn || '').toUpperCase().match(/^([A-Z])(\d{2})/);
  if (!m) return 'other';
  const [, l, d] = m; const n = parseInt(d, 10);
  if (l === 'C') {
    if (n >= 31 && n <= 39) return 'ball';
    if (n >= 21 && n <= 29) return 'race';
    if ((n >= 11 && n <= 19) || (n >= 51 && n <= 59)) return 'body';
    if ((n >= 61 && n <= 64) || n === 69) return 'sleeve';
  }
  if (l === 'A' && n >= 41 && n <= 49) return 'spherical';
  if (l === 'C' && (n === 95 || n === 99)) return 'mecha';
  return 'other';
}

const SIGN_DATE = '2026-06-30';
const PREPARED = { em: 'LE485', name: 'Apisit Suwannakate', dept: 'AD' };
const APPROVER = { em: 'T1460', name: 'Pattanapong Promyai', dept: 'ENG' };
const CREATED_BY = 'goal-psg-gs-notool-backfill';

async function getScope() {
  const scope = { ...DEFAULT_REPORT_SCOPE };
  try {
    const r = await engPool.query(`SELECT key, value FROM sds_report_config`);
    for (const row of r.rows) if (row.key in scope) scope[row.key] = row.value;
  } catch (_) { /* table may not exist yet → defaults */ }
  if (Array.isArray(scope.since_date)) scope.since_date = scope.since_date[0];
  return scope;
}

async function run() {
  const scope = await getScope();
  const TARGET = new Set(scope.tooling_optional_machines || []);
  if (TARGET.size === 0) { console.log('No tooling_optional_machines configured — nothing to do.'); return; }
  const exclItemNos = scope.excluded_cns.map(c => cnFormat.toItemNo(c)).filter(Boolean);
  const prefixRegex = `^(${scope.part_types.map(pt => PART_TYPE_ITEM_PREFIX[pt]).filter(Boolean).join('|')})`;
  const excludedCnSet = new Set(scope.excluded_cns.map(normalizeCn));

  // ── Replicate the coverage tooling_not_required set for the target machines ──
  const [prod, rpiTool, mcode, rodpcMachine, sdsRevRows] = await Promise.all([
    maqPool.query(
      `SELECT control_no, machine, process, MIN(comp_date) AS first_seen
       FROM ${TABLES.LPB_PC_PRODUCTION}
       WHERE control_no IS NOT NULL AND control_no NOT LIKE 'PM%' AND control_no <> ALL($1)
         AND comp_date >= $2 AND machine IS NOT NULL AND wc = ANY($3) AND process = ANY($4)
         AND control_no ~ $5
       GROUP BY control_no, machine, process`,
      [exclItemNos, scope.since_date, scope.work_centers, scope.process_codes, prefixRegex]
    ),
    maqPool.query(
      `SELECT process_plan_no AS control_no, process_code FROM ${TABLES.LPB_ENG_R_PI_TOOL}
       WHERE process_plan_no IS NOT NULL AND process_plan_no ~ '^[A-Z][0-9]{2}-' AND tool_dwg_no IS NOT NULL`
    ),
    engPool.query(`SELECT machine_code, machine_name FROM ${TABLES.SDS_MACHINE_CODE}`),
    rodpcPool.query(
      `SELECT machine_code, TRIM(m_model) AS m_model FROM m_machine
       WHERE wc = ANY($1) AND m_model IS NOT NULL AND TRIM(m_model) != ''`, [scope.work_centers]
    ),
    // sds_rev resolution source: sds_parameter param_key 'sds_rev' for the target machines
    engPool.query(
      `SELECT cn, machine_type_name, param_value FROM ${TABLES.SDS_PARAMETER}
       WHERE param_key = 'sds_rev' AND machine_type_name = ANY($1)`, [[...TARGET]]
    ),
  ]);

  const machineCodeMap = {};
  for (const r of rodpcMachine.rows) if (r.m_model) machineCodeMap[r.machine_code] = r.m_model;
  for (const r of mcode.rows) machineCodeMap[r.machine_code] = r.machine_name; // sds_machine_code override wins

  const planHasTool = new Set();
  for (const r of rpiTool.rows) planHasTool.add(`${r.control_no}||${r.process_code}`);

  // resolveSdsRev: cn-specific row wins over machine-config (cn IS NULL); default 'NC'
  const cnRev = new Map(), machineRev = new Map();
  for (const r of sdsRevRows.rows) {
    if (r.cn) cnRev.set(`${normalizeCn(r.cn)}||${r.machine_type_name}`, r.param_value || 'NC');
    else machineRev.set(r.machine_type_name, r.param_value || 'NC');
  }
  const resolveRev = (cn, machine) =>
    cnRev.get(`${cn}||${machine}`) || machineRev.get(machine) || 'NC';

  const dedup = new Map();
  for (const row of prod.rows) {
    const mName = machineCodeMap[row.machine] || null;
    if (!TARGET.has(mName)) continue;
    const cn = normalizeCn(row.control_no);
    if (excludedCnSet.has(cn)) continue;
    const pt = cnPartType(cn);
    if (!scope.part_types.includes(pt)) continue;
    if (planHasTool.has(`${cn}||${row.process}`)) continue; // has a tool → NOT tooling_not_required
    const key = `${cn}||${mName}||${row.process}`;
    const ex = dedup.get(key);
    if (!ex || row.first_seen < ex.first_seen) dedup.set(key, { cn, machine_type_name: mName, process_code: row.process });
  }
  const sheets = [...dedup.values()];
  console.log(`[backfill] tooling_not_required sheets for ${[...TARGET].join('/')}: ${sheets.length}`);

  if (sheets.length === 0) { console.log('Nothing to stamp.'); return; }

  // ── Upsert full stamps (fill only missing role columns) ──
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
  console.log(`[backfill] done — inserted ${inserted} new sheets, updated ${updated} existing (missing roles filled / already full).`);

  // Verify: every target sheet now has a full stamp (approved≠prepared)
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
  console.log(`[backfill] full-stamp verification: ${fullOk}/${sheets.length} sheets are fully signed.`);
}

run()
  .then(() => { console.log('Migration complete.'); process.exit(0); })
  .catch((e) => { console.error('Migration failed:', e); process.exit(1); });
