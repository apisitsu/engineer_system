'use strict';
/**
 * backfill_nostamp_approvals.js — one-off: record Prepared / Checked / Approved on
 * every NO_STAMP sheet the SDS coverage report currently lists.
 *
 *   Prepared → LE485        Checked → T1460        Approved → T1460
 *
 * Dates: each stamp lands in [base, base + WINDOW_DAYS] with prepared <= checked
 *        <= approved, at fixed offsets OFF_DAYS = {prepared:+1, checked:+3,
 *        approved:+5} @ 09:00 local. base = last_prod_date, or first_prod_date when
 *        last is null; a sheet with neither is skipped and reported.
 *
 * Only EMPTY roles are written. A sheet already carrying a real prepared/checked
 * signature keeps it, and any role we add is clamped to be >= that existing date
 * (so checked/approved never predate a prepared that is already outside the window).
 * Every write is source='backfill' — the Kanban intake ignores those, so this does
 * NOT move any board card.
 *
 * Modes:
 *   (default)   DRY RUN — prints the plan + counts, writes nothing
 *   --commit    execute; writes a manifest to scripts/_out/backfill_nostamp_<ts>.json
 *   --revert [--manifest <path>]
 *               undo a --commit: clears ONLY the exact role columns this script
 *               wrote (source still 'backfill' AND em_id + _at unchanged), then
 *               deletes any manifest row left with no signature at all.
 *   --fix-dates [--manifest <path>]
 *               corrective pass over a prior --commit: re-dates every backfill-source
 *               role on those sheets into AUG_WINDOW (2026-08), keeping
 *               prepared <= checked <= approved. Only `<role>_at` changes; em_id /
 *               name / dept / source are untouched. Writes its own audit manifest
 *               (old -> new per role) so it is itself revertible with --fix-dates-revert.
 *   --fix-dates-revert [--manifest <path>]   restore `_at` from a fix-dates manifest
 *   --as-of=YYYY-MM-DD
 *               ignore each sheet's production date; stamp every missing role on that
 *               one day (P 09:00 / C 11:00 / A 13:00). For dating the whole current
 *               NO_STAMP backlog in one batch. Combine with --commit; --revert clears
 *               it the same way (source='backfill').
 *   --rebuild   force a fresh buildCoverage() instead of the persisted cache
 *   --limit N   cap the number of sheets processed (testing)
 *
 *   node scripts/backfill_nostamp_approvals.js                 # preview
 *   node scripts/backfill_nostamp_approvals.js --commit
 *   node scripts/backfill_nostamp_approvals.js --fix-dates            # preview
 *   node scripts/backfill_nostamp_approvals.js --fix-dates --commit
 *   node scripts/backfill_nostamp_approvals.js --revert
 */

const fs = require('fs');
const path = require('path');
const { engPool } = require('../instance/eng_db');
const { TABLES } = require('../api/engineer/mtc/mtcConstants');

const T = TABLES.SDS_APPROVAL;          // 'sds_approval'
const TP = TABLES.SDS_PARAMETER;        // 'sds_parameter'
const ROLE_ORDER = ['prepared', 'checked', 'approved'];

const SIGNERS = {
  prepared: 'LE485',
  checked:  'T1460',
  approved: 'T1460',
};
const WINDOW_DAYS = 5;
const OFF_DAYS = { prepared: 1, checked: 3, approved: 5 };  // all <= WINDOW_DAYS
const STAMP_HOUR = 9;

// --fix-dates target: every re-dated stamp must land inside this calendar window.
const AUG_WINDOW = { y: 2026, m: 8, startDay: 1, endDay: 31 };
// Fallback anchor when a sheet's production base date is unknown / outside August.
const AUG_FALLBACK_PREPARED_DAY = 25;   // → P Aug 25, C Aug 27, A Aug 29

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const COMMIT = has('--commit');
const REVERT = has('--revert');
const FIXDATES = has('--fix-dates');
const FIXDATES_REVERT = has('--fix-dates-revert');
const REBUILD = has('--rebuild');
const LIMIT = valOf('--limit') ? parseInt(valOf('--limit'), 10) : null;
const OUT_DIR = path.join(__dirname, '_out');

// --as-of=YYYY-MM-DD : stamp EVERY missing role on that one calendar day instead of
// deriving the date from the sheet's production history. P/C/A land at 09:00 / 11:00
// / 13:00 so prepared <= checked <= approved still holds. Used to backfill the current
// NO_STAMP backlog "as of yesterday" in one dated batch.
const AS_OF_RAW = (args.find(a => a.startsWith('--as-of=')) || '').split('=')[1] || valOf('--as-of');
const AS_OF = AS_OF_RAW ? new Date(`${AS_OF_RAW}T00:00:00`) : null;
if (AS_OF_RAW && isNaN(+AS_OF)) { console.error(`ABORT: bad --as-of date '${AS_OF_RAW}' (want YYYY-MM-DD).`); process.exit(1); }
const AS_OF_HOURS = { prepared: 0, checked: 2, approved: 4 };
function asOfStamp(role) {
  const d = new Date(AS_OF);
  d.setHours(STAMP_HOUR + AS_OF_HOURS[role], 0, 0, 0);
  return d;
}

// P/C/A dates inside August 2026, monotonic, keeping the +2 / +4 day spacing but
// never past Aug 31. base = the sheet's production "detect" date (Date | null).
function augTriple(base) {
  const AUG1 = new Date(AUG_WINDOW.y, AUG_WINDOW.m - 1, AUG_WINDOW.startDay, STAMP_HOUR, 0, 0, 0);
  const AUG31 = new Date(AUG_WINDOW.y, AUG_WINDOW.m - 1, AUG_WINDOW.endDay, STAMP_HOUR, 0, 0, 0);
  const inAug = base && base >= new Date(AUG_WINDOW.y, AUG_WINDOW.m - 1, 1)
                     && base <= new Date(AUG_WINDOW.y, AUG_WINDOW.m - 1, 31, 23, 59, 59);
  let p;
  if (inAug) {
    p = new Date(base); p.setHours(STAMP_HOUR, 0, 0, 0);
    p.setDate(p.getDate() + OFF_DAYS.prepared);          // detect + 1
  } else {
    p = new Date(AUG_WINDOW.y, AUG_WINDOW.m - 1, AUG_FALLBACK_PREPARED_DAY, STAMP_HOUR, 0, 0, 0);
  }
  if (p < AUG1) p = new Date(AUG1);
  if (p > AUG31) p = new Date(AUG31);
  const shift = (d, days) => { const x = new Date(d); x.setDate(x.getDate() + days); return x > AUG31 ? new Date(AUG31) : x; };
  let c = shift(p, OFF_DAYS.checked - OFF_DAYS.prepared);   // +2
  let a = shift(p, OFF_DAYS.approved - OFF_DAYS.prepared);  // +4
  if (c < p) c = new Date(p);
  if (a < c) a = new Date(c);
  return { prepared: p, checked: c, approved: a };
}

const roleCols = (role) => ({
  em_id: `${role}_em_id`, name: `${role}_name`, dept: `${role}_dept`,
  at: `${role}_at`, source: `${role}_source`,
});

// ── resolveSdsRev — byte-for-byte the same query sdsApprovalController uses ─────
async function resolveSdsRev(cn, machine_type_name) {
  try {
    const { rows } = await engPool.query(
      `SELECT param_value FROM ${TP}
        WHERE machine_type_name = $2 AND param_key = 'sds_rev'
          AND (cn IS NULL OR cn = $1) AND process_code IS NULL
        ORDER BY (cn IS NULL) DESC`,
      [cn, machine_type_name]
    );
    return (rows.length ? rows[rows.length - 1].param_value : '') || 'NC';
  } catch (_) { return 'NC'; }
}

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : 'n/a');
const P = (n) => String(n).padStart(6);

// base date + offset days, at STAMP_HOUR local, as a Date
function stampAt(base, offDays) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offDays);
  d.setHours(STAMP_HOUR, 0, 0, 0);
  return d;
}

async function loadNeedsAttention() {
  if (REBUILD) {
    const { buildCoverage } = require('../api/engineer/mtc/controllers/sdsV2ReportController');
    console.log('Rebuilding coverage (buildCoverage) …');
    const payload = await buildCoverage();
    return { rows: payload.needsAttention || [], builtAt: Date.now(), src: 'rebuild' };
  }
  const r = await engPool.query(
    `SELECT data, built_at FROM sds_coverage_cache WHERE id = 'coverage' LIMIT 1`
  );
  if (!r.rows[0]) {
    console.log('No persisted coverage cache — falling back to a fresh build.');
    const { buildCoverage } = require('../api/engineer/mtc/controllers/sdsV2ReportController');
    const payload = await buildCoverage();
    return { rows: payload.needsAttention || [], builtAt: Date.now(), src: 'rebuild(no-cache)' };
  }
  return { rows: r.rows[0].data.needsAttention || [], builtAt: r.rows[0].built_at, src: 'cache' };
}

async function getSheet(cn, machine, process_code, sds_rev) {
  const { rows } = await engPool.query(
    `SELECT * FROM ${T}
      WHERE cn = $1 AND machine_type_name = $2 AND process_code = $3
        AND COALESCE(sds_rev,'') = COALESCE($4,'')
      LIMIT 1`,
    [cn, machine, process_code, sds_rev || null]
  );
  return rows[0] || null;
}

async function writeRole(d) {
  const c = roleCols(d.role);
  await engPool.query(
    `INSERT INTO ${T}
       (cn, machine_type_name, process_code, sds_rev,
        ${c.em_id}, ${c.name}, ${c.dept}, ${c.at}, ${c.source}, created_by)
     VALUES ($1,$2,$3,$4, $5,$6,$7, $8::timestamptz, 'backfill', $9)
     ON CONFLICT (cn, machine_type_name, process_code, COALESCE(sds_rev,''))
     DO UPDATE SET
       ${c.em_id}  = EXCLUDED.${c.em_id},
       ${c.name}   = EXCLUDED.${c.name},
       ${c.dept}   = EXCLUDED.${c.dept},
       ${c.at}     = EXCLUDED.${c.at},
       ${c.source} = EXCLUDED.${c.source},
       updated_at  = now()`,
    [d.cn, d.machine, d.process_code, d.sds_rev || null,
     d.em_id, d.name, d.dept, d.at, d.created_by || 'backfill-script']
  );
}

// ─────────────────────────────────────────────────────────────────────────────
async function runBackfill() {
  const { rows: needs, builtAt, src } = await loadNeedsAttention();

  // Signer identities — never guessed. Abort if either is missing.
  const ids = [...new Set(Object.values(SIGNERS))];
  const uRes = await engPool.query(
    `SELECT u_code, u_name, u_department FROM m_user_profile WHERE u_code = ANY($1)`, [ids]
  );
  const userMap = Object.fromEntries(uRes.rows.map(u => [u.u_code, u]));
  for (const id of ids) {
    if (!userMap[id]) {
      console.error(`ABORT: no m_user_profile row for signer '${id}'.`);
      process.exit(1);
    }
  }

  let noStamp = needs.filter(r => r.pending_reason === 'NO_STAMP' && !r.limit_excluded);
  noStamp.sort((a, b) => String(a.cn).localeCompare(String(b.cn)));
  if (LIMIT) noStamp = noStamp.slice(0, LIMIT);

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  BACKFILL NO_STAMP APPROVALS                                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`DB host           : ${process.env.PG_NEW_HOST}:${process.env.PG_NEW_PORT}  db=${process.env.PG_NEW_DB}`);
  console.log(`Coverage source   : ${src}   built ${fmt(builtAt)}`);
  console.log(`NO_STAMP sheets    : ${noStamp.length}${LIMIT ? `  (--limit ${LIMIT})` : ''}`);
  console.log(`Signers           : prepared=${SIGNERS.prepared} (${userMap[SIGNERS.prepared].u_name})  `
    + `checked/approved=${SIGNERS.checked} (${userMap[SIGNERS.checked].u_name})`);
  console.log(AS_OF
    ? `Date              : --as-of ${AS_OF_RAW}  →  P ${STAMP_HOUR}:00 · C ${STAMP_HOUR + AS_OF_HOURS.checked}:00 · A ${STAMP_HOUR + AS_OF_HOURS.approved}:00 (all one day)`
    : `Date window       : base .. base+${WINDOW_DAYS}d   offsets ${JSON.stringify(OFF_DAYS)} @ ${STAMP_HOUR}:00`);
  console.log(`Mode              : ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}\n`);

  const plan = [];                 // { cn, machine, process_code, sds_rev, base, roles:[{role,em_id,name,dept,at}] }
  const skipNoDate = [];
  const skipNoProcess = [];
  const alreadyFull = [];          // all 3 roles already signed (NO_STAMP only because approver == preparer)
  let roleCount = { prepared: 0, checked: 0, approved: 0 };

  for (const r of noStamp) {
    const cn = r.cn;
    const machine = r.machine_type_name;
    const process_code = r.process_code;
    if (!machine || !process_code) { skipNoProcess.push(r); continue; }

    const base = r.last_prod_date || r.first_prod_date;
    if (!base && !AS_OF) { skipNoDate.push(r); continue; }
    const stampFor = (role) => (AS_OF ? asOfStamp(role) : stampAt(base, OFF_DAYS[role]));

    const sds_rev = await resolveSdsRev(cn, machine);
    const existing = await getSheet(cn, machine, process_code, sds_rev);

    // resolved timestamp per role: keep existing, else offset — clamped monotonic
    const at = {};
    let prev = null;
    const missing = [];
    for (const role of ROLE_ORDER) {
      const exAt = existing && existing[`${role}_at`];
      const exId = existing && existing[`${role}_em_id`];
      let ts;
      if (exId) {
        ts = exAt ? new Date(exAt) : stampFor(role);
      } else {
        ts = stampFor(role);
        if (prev && ts < prev) ts = new Date(prev);        // never predate the previous role
        missing.push(role);
      }
      at[role] = ts;
      prev = ts;
    }

    if (missing.length === 0) { alreadyFull.push({ cn, machine, process_code }); continue; }

    const roles = missing.map(role => ({
      role,
      em_id: SIGNERS[role],
      name: userMap[SIGNERS[role]].u_name,
      dept: userMap[SIGNERS[role]].u_department || null,
      at: at[role].toISOString(),
    }));
    for (const role of missing) roleCount[role]++;
    plan.push({ cn, machine, process_code, sds_rev, base: new Date(base).toISOString().slice(0, 10), roles });
  }

  console.log('── Plan ──────────────────────────────────────────────────────────');
  console.log(`  sheets to touch          : ${P(plan.length)}`);
  console.log(`  role writes  prepared     : ${P(roleCount.prepared)}`);
  console.log(`               checked      : ${P(roleCount.checked)}`);
  console.log(`               approved     : ${P(roleCount.approved)}`);
  console.log(`  skipped — no prod date    : ${P(skipNoDate.length)}`);
  console.log(`  skipped — no machine/proc : ${P(skipNoProcess.length)}`);
  console.log(`  already 3-signed (SoD)    : ${P(alreadyFull.length)}`);

  console.log('\n── Sample (first 15) ─────────────────────────────────────────────');
  for (const p of plan.slice(0, 15)) {
    console.log(`  ${p.cn.padEnd(11)} ${String(p.machine).padEnd(16)} ${p.process_code}  rev=${(p.sds_rev || '').padEnd(4)}`
      + `  base ${p.base}  → ${p.roles.map(x => `${x.role[0].toUpperCase()}:${x.at.slice(0, 10)}`).join('  ')}`);
  }
  if (skipNoDate.length) {
    console.log('\n  no-prod-date sheets:');
    for (const r of skipNoDate.slice(0, 20)) console.log(`    ${r.cn}  ${r.machine_type_name}  ${r.process_code}`);
    if (skipNoDate.length > 20) console.log(`    … +${skipNoDate.length - 20} more`);
  }

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to apply.');
    return;
  }

  // ── Commit ──────────────────────────────────────────────────────────────────
  let written = 0;
  const manifestRoles = [];
  for (const p of plan) {
    for (const role of p.roles) {
      await writeRole({
        cn: p.cn, machine: p.machine, process_code: p.process_code, sds_rev: p.sds_rev,
        role: role.role, em_id: role.em_id, name: role.name, dept: role.dept, at: role.at,
      });
      written++;
      manifestRoles.push({
        cn: p.cn, machine_type_name: p.machine, process_code: p.process_code,
        sds_rev: p.sds_rev || null, role: role.role, em_id: role.em_id, at: role.at,
      });
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifestPath = path.join(OUT_DIR, `backfill_nostamp_${stamp}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify({
    created_at: new Date().toISOString(),
    db: `${process.env.PG_NEW_HOST}:${process.env.PG_NEW_PORT}/${process.env.PG_NEW_DB}`,
    coverage_source: src, coverage_built_at: builtAt ? new Date(builtAt).toISOString() : null,
    signers: SIGNERS, window_days: WINDOW_DAYS, off_days: OFF_DAYS,
    as_of: AS_OF ? AS_OF_RAW : null,
    counts: { sheets: plan.length, roles_written: written, ...roleCount,
      skipped_no_date: skipNoDate.length, skipped_no_process: skipNoProcess.length,
      already_full: alreadyFull.length },
    roles: manifestRoles,
  }, null, 2));

  console.log(`\nCOMMITTED — ${written} role writes across ${plan.length} sheets.`);
  console.log(`Manifest → ${path.relative(process.cwd(), manifestPath)}`);
  console.log('Revert with:  node scripts/backfill_nostamp_approvals.js --revert');
}

// ─────────────────────────────────────────────────────────────────────────────
async function runRevert() {
  let manifestPath = valOf('--manifest');
  if (!manifestPath) {
    const files = fs.existsSync(OUT_DIR)
      ? fs.readdirSync(OUT_DIR).filter(f => f.startsWith('backfill_nostamp_') && f.endsWith('.json')).sort()
      : [];
    if (!files.length) { console.error('No manifest in scripts/_out/ — pass --manifest <path>.'); process.exit(1); }
    manifestPath = path.join(OUT_DIR, files[files.length - 1]);
  }
  const man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`\nREVERT from ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`  ${man.roles.length} role writes recorded  (committed ${man.created_at})`);
  console.log(`  Mode: ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}\n`);

  let cleared = 0, kept = 0;
  const touchedSheets = new Set();
  for (const e of man.roles) {
    const c = roleCols(e.role);
    touchedSheets.add(`${e.cn}||${e.machine_type_name}||${e.process_code}||${e.sds_rev || ''}`);
    // Only clear if the column is STILL exactly what we wrote (not re-signed since).
    const guard =
      `WHERE cn = $1 AND machine_type_name = $2 AND process_code = $3
         AND COALESCE(sds_rev,'') = COALESCE($4,'')
         AND ${c.source} = 'backfill' AND ${c.em_id} = $5
         AND ${c.at} = $6::timestamptz`;
    const params = [e.cn, e.machine_type_name, e.process_code, e.sds_rev || null, e.em_id, e.at];
    if (COMMIT) {
      const res = await engPool.query(
        `UPDATE ${T} SET ${c.em_id}=NULL, ${c.name}=NULL, ${c.dept}=NULL, ${c.at}=NULL,
           ${c.source}=NULL, updated_at=now() ${guard}`, params);
      cleared += res.rowCount;
      kept += (1 - res.rowCount);
    } else {
      const res = await engPool.query(`SELECT 1 FROM ${T} ${guard}`, params);
      cleared += res.rowCount;
      kept += (1 - res.rowCount);
    }
  }

  // Drop any of our sheets now left with no signature at all (mirror the DELETE endpoint).
  let deleted = 0;
  for (const key of touchedSheets) {
    const [cn, machine, process_code, sds_rev] = key.split('||');
    const q = `cn = $1 AND machine_type_name = $2 AND process_code = $3 AND COALESCE(sds_rev,'') = COALESCE($4,'')
               AND prepared_em_id IS NULL AND checked_em_id IS NULL AND approved_em_id IS NULL`;
    const params = [cn, machine, process_code, sds_rev || null];
    if (COMMIT) {
      const res = await engPool.query(`DELETE FROM ${T} WHERE ${q}`, params);
      deleted += res.rowCount;
    } else {
      const res = await engPool.query(`SELECT 1 FROM ${T} WHERE ${q}`, params);
      deleted += res.rowCount;
    }
  }

  console.log(`  role columns ${COMMIT ? 'cleared' : 'clearable'} : ${cleared}`);
  console.log(`  left as-is (re-signed since)      : ${kept}`);
  console.log(`  empty rows ${COMMIT ? 'deleted' : 'deletable'}    : ${deleted}`);
  if (!COMMIT) console.log('\nDRY RUN — nothing written. Re-run with --revert --commit to apply.');
}

function pickManifest(prefix) {
  let mp = valOf('--manifest');
  if (mp) return mp;
  const files = fs.existsSync(OUT_DIR)
    ? fs.readdirSync(OUT_DIR).filter(f => f.startsWith(prefix) && f.endsWith('.json')).sort()
    : [];
  if (!files.length) { console.error(`No ${prefix}*.json in scripts/_out/ — pass --manifest <path>.`); process.exit(1); }
  return path.join(OUT_DIR, files[files.length - 1]);
}
const dstr = (d) => new Date(d).toISOString().slice(0, 10);

// ── --fix-dates — re-date backfill-source roles on a prior --commit into August ──
async function runFixDates() {
  const manifestPath = pickManifest('backfill_nostamp_');
  const man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`\nFIX-DATES from ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`  target window : ${AUG_WINDOW.y}-08-01 .. ${AUG_WINDOW.y}-08-31`);
  console.log(`  Mode: ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}\n`);

  // group manifest role entries by sheet
  const bySheet = new Map();
  for (const r of man.roles) {
    const k = `${r.cn}||${r.machine_type_name}||${r.process_code}||${r.sds_rev || ''}`;
    (bySheet.get(k) || bySheet.set(k, []).get(k)).push(r);
  }

  const baseFromRoles = (roles) => {
    const p = roles.find(r => r.role === 'prepared');
    if (p) { const d = new Date(p.at); d.setDate(d.getDate() - OFF_DAYS.prepared); return d; }
    const c = roles.find(r => r.role === 'checked');
    if (c) { const d = new Date(c.at); d.setDate(d.getDate() - OFF_DAYS.checked); return d; }
    return null;
  };

  const updates = [];    // { cn, machine, process_code, sds_rev, role, em_id, old_at, new_at }
  let skippedNonBackfill = 0, sheetsFixed = 0, sample = [];
  for (const [k, roles] of bySheet) {
    const [cn, machine, process_code, sds_rev] = k.split('||');
    const { rows } = await engPool.query(
      `SELECT * FROM ${T} WHERE cn=$1 AND machine_type_name=$2 AND process_code=$3
         AND COALESCE(sds_rev,'')=COALESCE($4,'') LIMIT 1`,
      [cn, machine, process_code, sds_rev || null]
    );
    const row = rows[0];
    if (!row) continue;
    const triple = augTriple(baseFromRoles(roles));
    let touched = false;
    for (const role of ROLE_ORDER) {
      if (!row[`${role}_em_id`]) continue;
      if (row[`${role}_source`] !== 'backfill') { skippedNonBackfill++; continue; }
      const oldAt = row[`${role}_at`] ? new Date(row[`${role}_at`]) : null;
      const newAt = triple[role];
      if (oldAt && Math.abs(oldAt - newAt) < 1000) continue;   // already correct
      updates.push({ cn, machine, process_code, sds_rev: sds_rev || null, role,
        em_id: row[`${role}_em_id`], old_at: oldAt ? oldAt.toISOString() : null, new_at: newAt.toISOString() });
      touched = true;
    }
    if (touched) { sheetsFixed++; if (sample.length < 15) sample.push({ cn, machine, process_code, triple }); }
  }

  console.log(`  sheets to re-date            : ${sheetsFixed}`);
  console.log(`  role-date updates            : ${updates.length}`);
  console.log(`  roles skipped (not backfill) : ${skippedNonBackfill}`);
  console.log('\n── Sample (first 15) ─────────────────────────────────────────────');
  for (const s of sample) {
    console.log(`  ${s.cn.padEnd(11)} ${String(s.machine).padEnd(16)} ${s.process_code}  → `
      + `P ${dstr(s.triple.prepared)}  C ${dstr(s.triple.checked)}  A ${dstr(s.triple.approved)}`);
  }

  if (!COMMIT) { console.log('\nDRY RUN — nothing written. Re-run with --fix-dates --commit to apply.'); return; }

  for (const u of updates) {
    const c = roleCols(u.role);
    await engPool.query(
      `UPDATE ${T} SET ${c.at} = $6::timestamptz, updated_at = now()
        WHERE cn=$1 AND machine_type_name=$2 AND process_code=$3
          AND COALESCE(sds_rev,'')=COALESCE($4,'') AND ${c.em_id}=$5 AND ${c.source}='backfill'`,
      [u.cn, u.machine, u.process_code, u.sds_rev, u.em_id, u.new_at]
    );
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mp = path.join(OUT_DIR, `backfill_fixdates_${stamp}.json`);
  fs.writeFileSync(mp, JSON.stringify({
    created_at: new Date().toISOString(), from_manifest: path.basename(manifestPath),
    target_window: `${AUG_WINDOW.y}-08`, updates,
  }, null, 2));
  console.log(`\nCOMMITTED — ${updates.length} role-date updates across ${sheetsFixed} sheets.`);
  console.log(`Manifest → ${path.relative(process.cwd(), mp)}`);
  console.log('Revert with:  node scripts/backfill_nostamp_approvals.js --fix-dates-revert');
}

async function runFixDatesRevert() {
  const manifestPath = pickManifest('backfill_fixdates_');
  const man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`\nFIX-DATES REVERT from ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`  ${man.updates.length} role-date updates recorded  (applied ${man.created_at})`);
  console.log(`  Mode: ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}\n`);
  let restored = 0, kept = 0;
  for (const u of man.updates) {
    const c = roleCols(u.role);
    const guard = `WHERE cn=$1 AND machine_type_name=$2 AND process_code=$3
        AND COALESCE(sds_rev,'')=COALESCE($4,'') AND ${c.em_id}=$5 AND ${c.source}='backfill'
        AND ${c.at} = $6::timestamptz`;
    const params = [u.cn, u.machine, u.process_code, u.sds_rev, u.em_id, u.new_at];
    if (COMMIT) {
      const res = await engPool.query(
        `UPDATE ${T} SET ${c.at} = $7::timestamptz, updated_at = now() ${guard}`,
        [...params, u.old_at]);
      restored += res.rowCount; kept += (1 - res.rowCount);
    } else {
      const res = await engPool.query(`SELECT 1 FROM ${T} ${guard}`, params);
      restored += res.rowCount; kept += (1 - res.rowCount);
    }
  }
  console.log(`  dates ${COMMIT ? 'restored' : 'restorable'}          : ${restored}`);
  console.log(`  left as-is (changed since)  : ${kept}`);
  if (!COMMIT) console.log('\nDRY RUN — nothing written. Re-run with --fix-dates-revert --commit to apply.');
}

(async () => {
  try {
    if (FIXDATES_REVERT) await runFixDatesRevert();
    else if (FIXDATES) await runFixDates();
    else if (REVERT) await runRevert();
    else await runBackfill();
  } finally {
    await engPool.end().catch(() => {});
  }
  // buildCoverage (--rebuild) leaves maq/rodpc pools open; force a clean exit.
  process.exit(0);
})().catch(e => { console.error('ERROR:', e); process.exit(1); });
