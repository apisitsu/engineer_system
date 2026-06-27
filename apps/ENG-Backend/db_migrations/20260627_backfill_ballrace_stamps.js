'use strict';
/**
 * Backfill SDS approval stamps for every BALL + RACE production sheet that is
 * currently un-stamped.
 *
 *   Prepared = LE485 Apisit Suwannakate (AD)
 *   Checked  = T1460 Pattanapong Promyai (ENG)
 *   Approved = T1460 Pattanapong Promyai (ENG)
 *   Date     = 2026-06-26 (yesterday), all <role>_source = 'backfill'
 *
 * Granularity = (cn, ACTUAL machine_type_name, process_code) — the unit the SDS
 * PDF renderer keys on (getApprovalSeals). Grouped machines (KS-400B1/B2/B7,
 * TSG-300W/ZNC) are stamped per member, matching the existing import convention
 * (members appear separately in sds_approval), NOT collapsed to the report's
 * group representative. sds_rev = 'NC' (0 sds_rev params → renderer default).
 *
 * Only machine names present in sds_machine_type_code (is_active) are stamped,
 * so every inserted seal is renderable. Idempotent: pre-filters to un-stamped
 * sheets and upserts on the sheet key.
 *
 * Run: node db_migrations/20260627_backfill_ballrace_stamps.js
 */
const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');
const { pool: rodpcPool } = require('../instance/instance');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');
const cnFormat = require('../api/engineer/mtc/utils/cnFormat');
const { ensureApprovalTables } = require('../api/engineer/mtc/controllers/sdsApprovalController');

const T = TABLES.SDS_APPROVAL;

// Report scope (defaults; overlaid with sds_report_config) — only the bits the
// universe depends on. Mirrors sdsV2ReportController.
const DEFAULT_SCOPE = {
  process_codes: ['1011','1012','1021','1022','1031','1041','1042','1061','1062','1101','1102','1161','1162','1241','1321'],
  work_centers:  ['05', '09', '29', '30', '31', '32', '37'],
  excluded_cns:  ['C39-00209', 'C29-04044', 'C29-04045'],
  since_date:    '2023-01-01',
};
const BALL_RACE_PREFIX = '^(3|2)'; // ball item-no starts 3, race starts 2

const normalizeCn = (raw) => cnFormat.toControlNo(raw) || String(raw || '').trim().toUpperCase().replace(/-[A-Z]$/, '');
function cnPartType(cn) {
  const m = String(cn || '').toUpperCase().match(/^C(\d{2})/);
  if (!m) return 'other';
  const n = parseInt(m[1], 10);
  if (n >= 31 && n <= 39) return 'ball';
  if (n >= 21 && n <= 29) return 'race';
  return 'other';
}

const SIGNERS = {
  prepared: { em_id: 'LE485', name: 'Apisit Suwannakate',  dept: 'AD'  },
  checked:  { em_id: 'T1460', name: 'Pattanapong Promyai', dept: 'ENG' },
  approved: { em_id: 'T1460', name: 'Pattanapong Promyai', dept: 'ENG' },
};
const SIGNED_AT = new Date(2026, 5, 26, 12, 0, 0); // 2026-06-26 12:00 local

(async () => {
  await ensureApprovalTables();

  // Effective scope overlay
  const scope = { ...DEFAULT_SCOPE };
  try {
    const r = await engPool.query(`SELECT key, value FROM sds_report_config`);
    for (const row of r.rows) if (row.key in scope) scope[row.key] = row.value;
  } catch (_) {}
  if (Array.isArray(scope.since_date)) scope.since_date = scope.since_date[0];
  const exclItemNos = scope.excluded_cns.map(c => cnFormat.toItemNo(c)).filter(Boolean);

  // ── Sources ────────────────────────────────────────────────────────────────
  const [pairsRes, codeRes, rodpcRes, typeRes, stampRes] = await Promise.all([
    maqPool.query(`
      SELECT control_no, machine, process
      FROM ${TABLES.LPB_PC_PRODUCTION}
      WHERE control_no IS NOT NULL AND control_no NOT LIKE 'PM%'
        AND control_no <> ALL($1) AND comp_date >= $2
        AND machine IS NOT NULL AND wc = ANY($3)
        AND process = ANY($4) AND control_no ~ $5
      GROUP BY control_no, machine, process`,
      [exclItemNos, scope.since_date, scope.work_centers, scope.process_codes, BALL_RACE_PREFIX]),
    engPool.query(`SELECT machine_code, machine_name FROM ${TABLES.SDS_MACHINE_CODE}`),
    rodpcPool.query(`SELECT machine_code, TRIM(m_model) AS m_model FROM m_machine
                     WHERE wc = ANY($1) AND m_model IS NOT NULL AND TRIM(m_model) != ''`, [scope.work_centers]),
    engPool.query(`SELECT machine_type_name FROM ${TABLES.SDS_MACHINE_TYPE_CODE} WHERE is_active`),
    engPool.query(`SELECT cn, machine_type_name, process_code FROM ${T}
                    WHERE prepared_em_id IS NOT NULL OR checked_em_id IS NOT NULL OR approved_em_id IS NOT NULL`),
  ]);

  // machine_code → actual machine_type_name (rodpc base, sds_machine_code override)
  const machineCodeMap = {};
  for (const r of rodpcRes.rows) if (r.m_model) machineCodeMap[r.machine_code] = r.m_model;
  for (const r of codeRes.rows) machineCodeMap[r.machine_code] = r.machine_name;

  const validNames = new Set(typeRes.rows.map(r => r.machine_type_name)); // renderable only
  const EXCLUDED_MACHINE_TYPES = new Set(['KS-H70(#C41)']);
  const EXCLUDED_MACHINE_CODES = new Set(['SPG-08']);
  const EXCLUDED_CNS = new Set(scope.excluded_cns.map(normalizeCn));

  // Existing stamp keys (exact, renderer-keyed)
  const stamped = new Set(stampRes.rows.map(r => `${r.cn}||${r.machine_type_name}||${r.process_code}`));

  // ── Build un-stamped ball+race universe at ACTUAL-machine granularity ───────
  const sheets = new Map();
  let skippedUnmapped = 0, skippedNotRenderable = 0;
  for (const row of pairsRes.rows) {
    if (row.machine === 'SGM-01' || EXCLUDED_MACHINE_CODES.has(row.machine)) continue;
    const name = machineCodeMap[row.machine];
    if (!name) { skippedUnmapped++; continue; }
    if (EXCLUDED_MACHINE_TYPES.has(name)) continue;
    if ((row.process === '1021' || row.process === '1022') && name.toUpperCase().startsWith('SGM')) continue;
    const cn = normalizeCn(row.control_no);
    if (EXCLUDED_CNS.has(cn)) continue;
    if (!['ball', 'race'].includes(cnPartType(cn))) continue;
    if (!validNames.has(name)) { skippedNotRenderable++; continue; }
    const key = `${cn}||${name}||${row.process}`;
    if (stamped.has(key)) continue;          // already stamped — leave untouched
    if (!sheets.has(key)) sheets.set(key, { cn, machine_type_name: name, process_code: row.process, part_type: cnPartType(cn) });
  }
  const toInsert = [...sheets.values()];

  const byType = toInsert.reduce((a, r) => (a[r.part_type] = (a[r.part_type] || 0) + 1, a), {});
  console.log(`Un-stamped ball+race sheets to backfill: ${toInsert.length}  (ball ${byType.ball || 0}, race ${byType.race || 0})`);
  console.log(`  skipped: unmapped-machine ${skippedUnmapped} (distinct rows), not-in-sds_machine_type_code ${skippedNotRenderable}`);
  if (process.argv.includes('--dry')) {
    const byMachine = {};
    for (const r of toInsert) byMachine[r.machine_type_name] = (byMachine[r.machine_type_name] || 0) + 1;
    console.log('  by machine:', Object.entries(byMachine).sort((a, b) => b[1] - a[1]));
    await Promise.all([engPool.end(), maqPool.end(), rodpcPool.end()]);
    return;
  }
  if (!toInsert.length) { console.log('Nothing to do.'); await Promise.all([engPool.end(), maqPool.end(), rodpcPool.end()]); return; }

  // ── Chunked upsert (20 cols/row) ───────────────────────────────────────────
  const COLS = 20;
  const CHUNK = 1000;
  const p = SIGNERS.prepared, c = SIGNERS.checked, a = SIGNERS.approved;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const placeholders = chunk.map((_, ri) =>
      `(${Array.from({ length: COLS }, (__, ci) => `$${ri * COLS + ci + 1}`).join(',')})`).join(',');
    const vals = chunk.flatMap(r => [
      r.cn, r.machine_type_name, r.process_code, 'NC',
      p.em_id, p.name, p.dept, SIGNED_AT, 'backfill',
      c.em_id, c.name, c.dept, SIGNED_AT, 'backfill',
      a.em_id, a.name, a.dept, SIGNED_AT, 'backfill',
      'system-backfill',
    ]);
    await engPool.query(
      `INSERT INTO ${T}
         (cn, machine_type_name, process_code, sds_rev,
          prepared_em_id, prepared_name, prepared_dept, prepared_at, prepared_source,
          checked_em_id,  checked_name,  checked_dept,  checked_at,  checked_source,
          approved_em_id, approved_name, approved_dept, approved_at, approved_source,
          created_by)
       VALUES ${placeholders}
       ON CONFLICT (cn, machine_type_name, process_code, COALESCE(sds_rev,''))
       DO UPDATE SET
         prepared_em_id = EXCLUDED.prepared_em_id, prepared_name = EXCLUDED.prepared_name, prepared_dept = EXCLUDED.prepared_dept, prepared_at = EXCLUDED.prepared_at, prepared_source = EXCLUDED.prepared_source,
         checked_em_id  = EXCLUDED.checked_em_id,  checked_name  = EXCLUDED.checked_name,  checked_dept  = EXCLUDED.checked_dept,  checked_at  = EXCLUDED.checked_at,  checked_source  = EXCLUDED.checked_source,
         approved_em_id = EXCLUDED.approved_em_id, approved_name = EXCLUDED.approved_name, approved_dept = EXCLUDED.approved_dept, approved_at = EXCLUDED.approved_at, approved_source = EXCLUDED.approved_source,
         updated_at = now()`,
      vals
    );
    inserted += chunk.length;
  }
  console.log(`✅ Backfilled ${inserted} sheets (Prepared=LE485, Checked/Approved=T1460, date 2026-06-26).`);

  const after = await engPool.query(`SELECT COUNT(*)::int n FROM ${T}`);
  console.log(`sds_approval total rows now: ${after.rows[0].n}`);
  await Promise.all([engPool.end(), maqPool.end(), rodpcPool.end()]);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
