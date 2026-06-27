'use strict';
/**
 * stamp_status_check.js — one-off automatic check (read-only).
 *
 * Answers: of the Setup Data Sheets the SDS coverage report tracks, how many
 * already carry an approval STAMP (sds_approval record) and how many REMAIN
 * un-stamped — broken down, and which.
 *
 * Rebuilds the report's SDS-sheet universe (cn, machine_type_name, process_code)
 * directly from production — skipping only the heavy per-CN Tooling Select
 * fallback, which affects the COMPLETE/PENDING split but NOT which sheets exist.
 * COMPLETE/PENDING is then taken from the persisted coverage cache.
 *
 * Run: node scripts/stamp_status_check.js
 */
const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');
const { pool: rodpcPool } = require('../instance/instance');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');
const cnFormat = require('../api/engineer/mtc/utils/cnFormat');

const DEFAULT_SCOPE = {
  part_types:    ['ball', 'race', 'mecha'],
  process_codes: ['1011','1012','1021','1022','1031','1041','1042','1061','1062','1101','1102','1161','1162','1241','1321'],
  work_centers:  ['05', '09', '29', '30', '31', '32', '37'],
  excluded_cns:  ['C39-00209', 'C29-04044', 'C29-04045'],
  since_date:    '2023-01-01',
};
const PART_TYPE_ITEM_PREFIX = { ball: '3', race: '2', body: '[15]', sleeve: '6', mecha: '9', spherical: '4' };

const normalizeCn = (raw) => cnFormat.toControlNo(raw) || String(raw || '').trim().toUpperCase().replace(/-[A-Z]$/, '');
function cnPartType(cn) {
  const m = String(cn || '').toUpperCase().match(/^([A-Z])(\d{2})/);
  if (!m) return 'other';
  const [, letter, digits] = m; const n = parseInt(digits, 10);
  if (letter === 'C') {
    if (n >= 31 && n <= 39) return 'ball';
    if (n >= 21 && n <= 29) return 'race';
    if ((n >= 11 && n <= 19) || (n >= 51 && n <= 59)) return 'body';
    if ((n >= 61 && n <= 64) || n === 69) return 'sleeve';
    if (n === 95 || n === 99) return 'mecha';
  }
  if (letter === 'A' && n >= 41 && n <= 49) return 'spherical';
  return 'other';
}

(async () => {
  // ── Effective scope (overlay sds_report_config on defaults) ────────────────
  const scope = { ...DEFAULT_SCOPE };
  try {
    const r = await engPool.query(`SELECT key, value FROM sds_report_config`);
    for (const row of r.rows) if (row.key in scope) scope[row.key] = row.value;
  } catch (_) {}
  if (Array.isArray(scope.since_date)) scope.since_date = scope.since_date[0];

  const exclItemNos = scope.excluded_cns.map(c => cnFormat.toItemNo(c)).filter(Boolean);
  const prefixRegex = `^(${scope.part_types.map(pt => PART_TYPE_ITEM_PREFIX[pt]).filter(Boolean).join('|')})`;

  // ── Source queries (the universe-defining subset of buildCoverage) ─────────
  const [pairsRes, codeRes, rodpcRes, typeRes] = await Promise.all([
    maqPool.query(`
      SELECT control_no, machine, process, MIN(comp_date) AS first_seen
      FROM ${TABLES.LPB_PC_PRODUCTION}
      WHERE control_no IS NOT NULL AND control_no NOT LIKE 'PM%'
        AND control_no <> ALL($1) AND comp_date >= $2
        AND machine IS NOT NULL AND wc = ANY($3)
        AND process = ANY($4) AND control_no ~ $5
      GROUP BY control_no, machine, process`,
      [exclItemNos, scope.since_date, scope.work_centers, scope.process_codes, prefixRegex]),
    engPool.query(`SELECT machine_code, machine_name FROM ${TABLES.SDS_MACHINE_CODE}`),
    rodpcPool.query(`SELECT machine_code, TRIM(m_model) AS m_model FROM m_machine
                     WHERE wc = ANY($1) AND m_model IS NOT NULL AND TRIM(m_model) != ''`, [scope.work_centers]),
    engPool.query(`SELECT id, machine_type_name, machine_group FROM ${TABLES.SDS_MACHINE_TYPE_CODE} WHERE is_active`),
  ]);

  // machine_code → machine_type_name (rodpc base, sds_machine_code override)
  const machineCodeMap = {};
  for (const r of rodpcRes.rows) if (r.m_model) machineCodeMap[r.machine_code] = r.m_model;
  for (const r of codeRes.rows) machineCodeMap[r.machine_code] = r.machine_name;

  // group representative (lowest id) + name→group
  const nameToGroup = {}, groupMembers = {};
  for (const r of typeRes.rows) {
    if (!r.machine_group) continue;
    nameToGroup[r.machine_type_name] = r.machine_group;
    (groupMembers[r.machine_group] = groupMembers[r.machine_group] || []).push({ id: r.id, name: r.machine_type_name });
  }
  const groupRep = {};
  for (const [g, mem] of Object.entries(groupMembers)) { mem.sort((a, b) => a.id - b.id); groupRep[g] = mem[0].name; }
  const repOf = (name) => (name && nameToGroup[name]) ? (groupRep[nameToGroup[name]] || name) : name;

  // exclusions (mirror buildCoverage)
  const EXCLUDED_MACHINE_TYPES = new Set(['KS-H70(#C41)']);
  const EXCLUDED_MACHINE_CODES = new Set(['SPG-08']);
  const EXCLUDED_CNS = new Set(scope.excluded_cns.map(normalizeCn));

  // dedup → universe of (cn, repMachine, process) sheets, part-type filtered
  const deduped = new Map();
  for (const row of pairsRes.rows) {
    if (row.machine === 'SGM-01' || EXCLUDED_MACHINE_CODES.has(row.machine)) continue;
    const mName = machineCodeMap[row.machine] || '';
    if (EXCLUDED_MACHINE_TYPES.has(mName)) continue;
    if ((row.process === '1021' || row.process === '1022') && mName.toUpperCase().startsWith('SGM')) continue;
    const cn = normalizeCn(row.control_no);
    if (EXCLUDED_CNS.has(cn)) continue;
    if (!scope.part_types.includes(cnPartType(cn))) continue;
    const rep = repOf(machineCodeMap[row.machine] || null);
    const key = `${cn}||${rep}||${row.process}`;
    if (!deduped.has(key)) deduped.set(key, { cn, machine_type_name: rep, process_code: row.process, part_type: cnPartType(cn) });
  }
  const universe = [...deduped.values()];

  // ── PENDING set from persisted cache ───────────────────────────────────────
  const cov = await engPool.query(`SELECT data, built_at FROM sds_coverage_cache WHERE id = 'coverage' LIMIT 1`);
  const pendingKeys = new Set();
  let builtAt = null;
  if (cov.rows[0]) {
    builtAt = cov.rows[0].built_at;
    for (const r of (cov.rows[0].data.needsAttention || []))
      pendingKeys.add(`${r.cn}||${r.machine_type_name || r.machine_code || ''}||${r.process_code || ''}`);
  }

  // ── Stamp set (align to rep namespace) ─────────────────────────────────────
  const stampRes = await engPool.query(`
    SELECT cn, machine_type_name, process_code,
           (prepared_em_id IS NOT NULL AND checked_em_id IS NOT NULL AND approved_em_id IS NOT NULL) AS full
    FROM sds_approval`);
  const anyStamp = new Set(), fullStamp = new Set();
  for (const r of stampRes.rows) {
    const rep = repOf(r.machine_type_name);
    const k = `${r.cn}||${rep}||${r.process_code}`;
    anyStamp.add(k);
    if (r.full) fullStamp.add(k);
  }

  // ── Classify universe ──────────────────────────────────────────────────────
  const key = (r) => `${r.cn}||${r.machine_type_name}||${r.process_code}`;
  let stamped = 0, stampedFull = 0;
  const remaining = [];
  for (const r of universe) {
    const k = key(r);
    r.pending = pendingKeys.has(k);
    if (anyStamp.has(k)) { stamped++; if (fullStamp.has(k)) stampedFull++; }
    else remaining.push(r);
  }
  const completeUniverse = universe.filter(r => !r.pending);
  const remainingComplete = remaining.filter(r => !r.pending);

  // ── Stamps that match NO current report sheet (e.g. retired machines) ──────
  const universeKeys = new Set(universe.map(key));
  let orphanStamps = 0;
  for (const r of stampRes.rows) {
    const k = `${r.cn}||${repOf(r.machine_type_name)}||${r.process_code}`;
    if (!universeKeys.has(k)) orphanStamps++;
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  const P = (n) => String(n).padStart(5);
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SDS STAMP STATUS — auto-check vs Setup Data Sheet report       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Coverage report built: ${builtAt ? new Date(builtAt).toISOString().slice(0,16).replace('T',' ') : 'n/a'}`);

  console.log('\n── Stamp table (sds_approval) ─────────────────────────────────');
  const t = await engPool.query(`SELECT COUNT(*)::int n,
    COUNT(*) FILTER (WHERE approved_em_id IS NOT NULL)::int approved FROM sds_approval`);
  console.log(`  Sheets with a stamp record : ${t.rows[0].n}`);
  console.log(`  …fully signed (3 roles)    : ${t.rows[0].approved}  (missing only Approved: ${t.rows[0].n - t.rows[0].approved})`);
  console.log(`  Stamps not matching any current report sheet (retired/out-of-scope machines): ${orphanStamps}`);

  console.log('\n── Universe = SDS sheets the report tracks ────────────────────');
  console.log(`  Total SDS sheets (cn × machine × process) : ${P(universe.length)}`);
  console.log(`     of which PDF-ready (COMPLETE)          : ${P(completeUniverse.length)}`);
  console.log(`     of which PENDING (needs config)        : ${P(universe.length - completeUniverse.length)}`);

  console.log('\n── STAMPED vs REMAINING (whole universe) ──────────────────────');
  console.log(`  ✅ STAMPED   : ${P(stamped)}  (${(stamped/universe.length*100).toFixed(1)}%)   [fully signed: ${stampedFull}]`);
  console.log(`  ⬜ REMAINING : ${P(remaining.length)}  (${(remaining.length/universe.length*100).toFixed(1)}%)`);

  console.log('\n── REMAINING among PDF-ready (COMPLETE) sheets — the actionable set ─');
  console.log(`  COMPLETE sheets stamped   : ${P(completeUniverse.length - remainingComplete.length)}`);
  console.log(`  COMPLETE sheets REMAINING : ${P(remainingComplete.length)}`);

  // breakdown of remaining (complete) by machine
  const byMachine = new Map();
  for (const r of remainingComplete) {
    const m = byMachine.get(r.machine_type_name) || { n: 0, cns: new Set() };
    m.n++; m.cns.add(r.cn); byMachine.set(r.machine_type_name, m);
  }
  console.log('\n── REMAINING (COMPLETE) by machine — top 25 ───────────────────');
  const ranked = [...byMachine.entries()].sort((a, b) => b[1].n - a[1].n);
  for (const [m, v] of ranked.slice(0, 25))
    console.log(`  ${String(m).padEnd(20)} sheets ${P(v.n)}   distinct CN ${v.cns.size}`);

  // breakdown by part type
  console.log('\n── REMAINING (whole universe) by part type ────────────────────');
  for (const pt of scope.part_types) {
    const all = universe.filter(r => r.part_type === pt).length;
    const rem = remaining.filter(r => r.part_type === pt).length;
    console.log(`  ${pt.padEnd(8)} : remaining ${P(rem)} / ${all}`);
  }

  // dump full remaining-complete list to file
  const fs = require('fs');
  const outPath = require('path').join(__dirname, 'stamp_remaining.csv');
  const lines = ['cn,machine_type_name,process_code,part_type,coverage_level'];
  for (const r of remaining.sort((a, b) => a.cn.localeCompare(b.cn)))
    lines.push(`${r.cn},${r.machine_type_name},${r.process_code},${r.part_type},${r.pending ? 'PENDING' : 'COMPLETE'}`);
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`\nFull remaining list (${remaining.length} rows) written → scripts/stamp_remaining.csv`);

  await Promise.all([engPool.end(), maqPool.end(), rodpcPool.end()]);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
