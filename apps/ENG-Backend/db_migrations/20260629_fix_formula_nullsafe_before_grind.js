'use strict';
/**
 * Wrap NULL-unsafe before-grind references in tooling_formula with the canonical
 * self/sibling guard so a NULL od_bf/id_bf (≈62% of spec rows) can no longer
 * collapse a formula to ~0 and select the wrong tool.
 *
 * Surfaced by tests/mtc/toolingFormulaNullSafety.test.js once it could reach the
 * live DB (2026-06-29). 10 rows on ACTIVE machines KS-400B1 (id 7) and
 * KS-400B5 (id 10) referenced odBf_max/idBf_min/odBf_min/idBf_max without a guard.
 *
 * Fix pattern (canonical, see .claude/rules/formula-reference.md §3):
 *   bare  odBf_max            →  if(odBf>0, odBf_max, odAft_max)
 *   bare  idBf_min            →  if(idBf>0, idBf_min, idAft_min)
 * Behaviour is IDENTICAL when before-grind data exists; it only falls back to the
 * after-grind sibling when the before-grind dim is NULL/0 (the bug case). This is
 * NULL safety only — it does NOT decide whether before-grind is the correct design
 * variable (PILOT PIN / CHUCK JAW still pending DWG confirmation per the audit memo).
 *
 * Idempotent: each row is updated only while it still holds the exact unsafe
 * expression, so re-running (or running after a manual edit) is a no-op.
 *
 * Run: node db_migrations/20260629_fix_formula_nullsafe_before_grind.js
 */
const { engPool } = require('../instance/eng_db');

// id → { from (current unsafe expr), to (NULL-safe expr) }
const FIXES = [
  { id: 411, from: 'floor(odBf_max / 6)',
             to:   'floor(if(odBf>0, odBf_max, odAft_max) / 6)' },
  { id: 498, from: 'idBf_min - 1',
             to:   'if(idBf>0, idBf_min, idAft_min) - 1' },
  { id: 500, from: 'idBf_min - 1',
             to:   'if(idBf>0, idBf_min, idAft_min) - 1' },
  { id: 501, from: 'idBf_min - 1.5',
             to:   'if(idBf>0, idBf_min, idAft_min) - 1.5' },
  { id: 502, from: 'idBf_min - 2',
             to:   'if(idBf>0, idBf_min, idAft_min) - 2' },
  { id: 734, from: 'if(isIDtoOD, idAft_max, idBf_max) + 0.5',
             to:   'if(isIDtoOD, idAft_max, if(idBf>0, idBf_max, idAft_max)) + 0.5' },
  { id: 737, from: 'if(isIDtoOD, idAft_min, idBf_min) - 0.03',
             to:   'if(isIDtoOD, idAft_min, if(idBf>0, idBf_min, idAft_min)) - 0.03' },
  { id: 729, from: '(idBf_max + idBf_min) / 2',
             to:   '(if(idBf>0, idBf_max, idAft_max) + if(idBf>0, idBf_min, idAft_min)) / 2' },
  { id: 730, from: '(odBf_max + odBf_min) / 2',
             to:   '(if(odBf>0, odBf_max, odAft_max) + if(odBf>0, odBf_min, odAft_min)) / 2' },
  { id: 732, from: 'if(isIDtoOD, idAft_max, idBf_max) + 0.5',
             to:   'if(isIDtoOD, idAft_max, if(idBf>0, idBf_max, idAft_max)) + 0.5' },
];

(async () => {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    let changed = 0, skipped = 0;
    for (const f of FIXES) {
      const r = await client.query(
        `UPDATE tooling_formula SET formula_expr = $1
          WHERE id = $2 AND formula_expr = $3`,
        [f.to, f.id, f.from]
      );
      if (r.rowCount) { changed++; console.log(`  fixed id=${f.id}: ${f.from}  →  ${f.to}`); }
      else { skipped++; console.log(`  skip  id=${f.id}: not in expected unsafe state (already fixed?)`); }
    }
    await client.query('COMMIT');
    console.log(`\nDone. ${changed} row(s) updated, ${skipped} skipped.`);
    if (changed > 0) {
      // The running backend serves formulas from the in-memory tsv2ConfigCache snapshot
      // (TTL 60s). This standalone script CANNOT flush that other process's cache, so the
      // new formulas are NOT live until the snapshot refreshes. Make that loud so the fix
      // isn't silently shadowed by stale cache.
      console.log('\n' + '='.repeat(72));
      console.log('  ⚠  CACHE: the backend caches formulas in tsv2ConfigCache (60s TTL).');
      console.log('     New formulas go live automatically within ~60s. For an IMMEDIATE');
      console.log('     effect, save any row in the T-Select admin UI (flushes the cache)');
      console.log('     or restart the backend. Until then, search serves the OLD formulas.');
      console.log('='.repeat(72));
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await engPool.end();
  }
})();
