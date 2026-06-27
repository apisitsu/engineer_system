'use strict';
/**
 * Bulk-import historical SDS approvals from templates/approval_backup.xlsx into the
 * wide sds_approval table (one row per sheet, prepared_/checked_/approved_ columns).
 *
 * Source layout (Sheet1, 1 row per signed Setup Data Sheet):
 *   CN | Setup_Data_Sheet_REV | PN | Process | Machine | Process_Code | Material |
 *   Prepared_By | Prepared_Date | Checked_By | Checked_Date | Approved_By | Approved_Date
 *
 * Key handling — must match exactly what the PDF renderer computes, or the seal
 * silently won't show:
 *   - cn          : itemNoToCN(rawCN) → canonical C##-##### (same util the SDS search uses)
 *   - sds_rev     : taken from the file ('NC'); the renderer resolves sds_rev from
 *                   sds_parameter and there are currently 0 sds_rev rows → always 'NC',
 *                   so file 'NC' matches. (If sds_rev params are added later, re-key.)
 *   - process_code: text, one code per row
 *   - machine     : machine_type_name (must equal sds_machine_type_code.name)
 *
 * Signer (em_id/name/dept) resolved from the corporate email by matching the email's
 * first-name token against m_user_profile.u_name (only 4 distinct signers in the file).
 * All imported signatures are tagged <role>_source = 'backfill'.
 *
 * Idempotent: ON CONFLICT (sheet key) DO UPDATE overwrites; re-running re-applies.
 * Run: node db_migrations/20260627_import_approval_backup.js
 */
const path = require('path');
const ExcelJS = require('exceljs');
const { engPool } = require('../instance/eng_db');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');
const { itemNoToCN } = require('../api/engineer/mtc/utils/cnFormat');
const { ensureApprovalTables } = require('../api/engineer/mtc/controllers/sdsApprovalController');

const T = TABLES.SDS_APPROVAL;
const XLSX = path.join(__dirname, '..', 'api', 'engineer', 'mtc', 'templates', 'approval_backup.xlsx');
const ROLES = ['prepared', 'checked', 'approved'];

// Backup machine names → the exact sds_machine_type_code.name the renderer is called
// with (else the seal silently won't show). Confirmed 2026-06-27: TSG300W was just a
// missing hyphen; the others are model-name variants the SDS system stores differently.
// Machines with NO SDS counterpart (KS-R22S2, KS-350R2, Mazak QUICK TURN…, KVD350C…)
// are intentionally left unmapped — they have no SDS PDF anyway.
const MACHINE_REMAP = {
  'TSG300W': 'TSG-300W',
  'GS-64PF': 'GS-64PFII',
  'PSG-64DX': 'PSG-64',
  'HIGRIND-1-D': 'HI-GRIND-1-D',
  'NISSIN_HIGRIND-1-D': 'HI-GRIND-1-D',
};

// "apisit.su@minebea.co.th (Prepared with Notification)" → "apisit.su@minebea.co.th"
const cleanEmail = (v) => (v == null ? '' : String(v).replace(/\s*\(.*\)\s*$/, '').trim());
const toDate = (v) => { if (!v) return null; const d = (v instanceof Date) ? v : new Date(v); return isNaN(d) ? null : d; };

// Build email → { em_id, name, dept } by matching the email's first-name token to u_name.
async function buildSignerMap(emails) {
  const map = {}; const unresolved = [];
  for (const email of emails) {
    const first = email.split('@')[0].split('.')[0]; // apisit.su → apisit
    const r = await engPool.query(
      `SELECT u_code, u_name, u_department FROM m_user_profile WHERE u_name ILIKE $1`,
      [first + '%']
    );
    if (r.rows.length === 1) {
      map[email] = { em_id: r.rows[0].u_code, name: r.rows[0].u_name, dept: r.rows[0].u_department || null };
    } else {
      // Fallback: keep the import non-blocking — store the email as em_id so the row
      // still renders a (name-only) seal; flag for manual fixup.
      map[email] = { em_id: email, name: email.split('@')[0], dept: null };
      unresolved.push(`${email} (${r.rows.length} matches)`);
    }
  }
  return { map, unresolved };
}

(async () => {
  try {
    await ensureApprovalTables();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(XLSX);
    const ws = wb.getWorksheet('Sheet1');
    if (!ws) throw new Error('Sheet1 not found');

    // Pass 1: collect distinct signer emails → resolve to em_id/name/dept.
    const emailSet = new Set();
    for (let r = 2; r <= ws.rowCount; r++) {
      const v = ws.getRow(r).values;
      for (const ci of [8, 10, 12]) { const e = cleanEmail(v[ci]); if (e) emailSet.add(e); }
    }
    const { map: signers, unresolved } = await buildSignerMap([...emailSet]);
    console.log('Signer resolution:');
    for (const [e, s] of Object.entries(signers)) console.log(`  ${e} -> ${s.em_id} / ${s.name}`);
    if (unresolved.length) console.log('  ⚠ UNRESOLVED (stored email as em_id):', unresolved.join('; '));

    // Pass 2: build one record per sheet, deduped by key (last row wins — avoids
    // "ON CONFLICT cannot affect row a second time" in a multi-row upsert).
    const byKey = new Map();
    let badCn = 0, skipped = 0;
    for (let r = 2; r <= ws.rowCount; r++) {
      const v = ws.getRow(r).values;
      const rawCn = v[1]; let machine = v[5] && String(v[5]).trim();
      if (machine && MACHINE_REMAP[machine]) machine = MACHINE_REMAP[machine];
      const process_code = v[6] != null ? String(v[6]).trim() : '';
      const sds_rev = v[2] != null ? String(v[2]).trim() : '';
      if (!rawCn || !machine || !process_code) { skipped++; continue; }
      let cn; try { cn = itemNoToCN(String(rawCn).trim()); } catch (_) { cn = null; }
      if (!cn) { badCn++; continue; }

      const rec = { cn, machine, process_code, sds_rev: sds_rev || null };
      let anyRole = false;
      const cols = [[8, 9, 'prepared'], [10, 11, 'checked'], [12, 13, 'approved']];
      for (const [eci, dci, role] of cols) {
        const email = cleanEmail(v[eci]);
        if (!email) continue;
        const s = signers[email];
        rec[`${role}_em_id`] = s.em_id;
        rec[`${role}_name`] = s.name;
        rec[`${role}_dept`] = s.dept;
        rec[`${role}_at`] = toDate(v[dci]);
        rec[`${role}_source`] = 'backfill';
        anyRole = true;
      }
      if (!anyRole) { skipped++; continue; }
      byKey.set(`${cn}|${machine}|${process_code}|${sds_rev}`, rec);
    }

    const records = [...byKey.values()];
    console.log(`\nRows parsed: ${ws.rowCount - 1} | sheets to import: ${records.length} | dup-collapsed: ${(ws.rowCount - 1) - records.length - badCn - skipped} | badCN: ${badCn} | skipped: ${skipped}`);

    // Chunked multi-row upsert. 20 cols/row × 2000 = 40000 < 65535 param limit.
    const COLS = [
      'cn', 'machine_type_name', 'process_code', 'sds_rev',
      'prepared_em_id', 'prepared_name', 'prepared_dept', 'prepared_at', 'prepared_source',
      'checked_em_id', 'checked_name', 'checked_dept', 'checked_at', 'checked_source',
      'approved_em_id', 'approved_name', 'approved_dept', 'approved_at', 'approved_source',
      'created_by',
    ];
    const setCols = COLS.filter((c) => !['cn', 'machine_type_name', 'process_code', 'sds_rev'].includes(c));
    const toRow = (rec) => [
      rec.cn, rec.machine, rec.process_code, rec.sds_rev,
      rec.prepared_em_id || null, rec.prepared_name || null, rec.prepared_dept || null, rec.prepared_at || null, rec.prepared_source || null,
      rec.checked_em_id || null, rec.checked_name || null, rec.checked_dept || null, rec.checked_at || null, rec.checked_source || null,
      rec.approved_em_id || null, rec.approved_name || null, rec.approved_dept || null, rec.approved_at || null, rec.approved_source || null,
      'import_backup',
    ];

    const CHUNK = 2000;
    let inserted = 0;
    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK);
      const ph = chunk.map((_, ri) =>
        `(${COLS.map((__, ci) => `$${ri * COLS.length + ci + 1}`).join(',')})`
      ).join(',');
      const updates = setCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ') + ', updated_at = now()';
      await engPool.query(
        `INSERT INTO ${T} (${COLS.join(',')}) VALUES ${ph}
         ON CONFLICT (cn, machine_type_name, process_code, COALESCE(sds_rev,''))
         DO UPDATE SET ${updates}`,
        chunk.flatMap(toRow)
      );
      inserted += chunk.length;
      console.log(`  upserted ${inserted}/${records.length}`);
    }

    const tot = await engPool.query(`SELECT COUNT(*)::int n FROM ${T}`);
    console.log(`\nDone. sds_approval now has ${tot.rows[0].n} rows.`);
  } catch (err) {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await engPool.end().catch(() => {});
  }
})();
