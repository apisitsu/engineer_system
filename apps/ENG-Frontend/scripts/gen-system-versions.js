/**
 * Generates src/constance/mtc_version_dates.json — the real "last updated" date
 * per MTC system. Run automatically by `predev`/`prestart`/`prebuild`.
 *
 * Date resolution per system:
 *   1. If the system's files have UNCOMMITTED changes (staged or unstaged) → TODAY.
 *      This makes the badge update *before* a git commit — the moment you edit a
 *      system its date reflects the work-in-progress, not the last release.
 *   2. Otherwise → the date of the latest git commit that touched those files.
 *   3. No git (shallow clone / not a repo) → null (badge uses the manual `updated`).
 *
 * Version NUMBERS stay manual in mtc_constance.js → MTC_VERSIONS; only the dates
 * are derived here.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..'); // → EngineerSystem root

// system key (sidebar key) → repo-relative paths whose latest commit = its date
const SYSTEMS = {
  'tool-request': [
    'apps/ENG-Frontend/src/components/engineer/mtc_eng/general_dwg_req',
    'apps/ENG-Backend/api/engineer/mtc/controllers/toolRequestController.js',
  ],
  'tooling-inspect': [
    'apps/ENG-Frontend/src/components/engineer/mtc_eng/tooling_inspect/tooling_inspect.jsx',
    'apps/ENG-Backend/api/engineer/mtc/mtcController.js',
  ],
  'tooling-select': [
    'apps/ENG-Frontend/src/components/engineer/mtc_eng/tooling_select',
    'apps/ENG-Backend/api/engineer/mtc/services/searchService.js',
    'apps/ENG-Backend/api/engineer/mtc/services/FormulaService.js',
  ],
  'sds-v2': [
    'apps/ENG-Frontend/src/components/engineer/mtc_eng/sds/SdsV2Page.jsx',
    'apps/ENG-Frontend/src/components/engineer/mtc_eng/sds/SdsTemplateConfigPage.jsx',
    'apps/ENG-Frontend/src/components/engineer/mtc_eng/sds/SdsBlankTemplateGrid.jsx',
    'apps/ENG-Backend/api/engineer/mtc/controllers/sdsV2HeadlessController.js',
    'apps/ENG-Backend/api/engineer/mtc/controllers/sdsV2AdminController.js',
  ],
  'tooling-result-dashboard': [
    'apps/ENG-Frontend/src/components/engineer/mtc_eng/tooling_inspect/InspectionResultDashboard.jsx',
  ],
  'sds-coverage-report': [
    'apps/ENG-Frontend/src/components/engineer/mtc_eng/sds/SdsCoverageDashboard.jsx',
    'apps/ENG-Backend/api/engineer/mtc/controllers/sdsV2ReportController.js',
  ],
};

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; // local YYYY-MM-DD
}

// True when any of `paths` has staged or unstaged changes (incl. new/untracked files).
function hasUncommittedChanges(paths) {
  try {
    const args = paths.map((p) => `"${p}"`).join(' ');
    const out = execSync(
      `git -C "${repoRoot}" status --porcelain -- ${args}`,
      { encoding: 'utf8' }
    ).trim();
    return out.length > 0;
  } catch (_) {
    return false; // no git → treat as clean, fall through to lastCommitDate (also null)
  }
}

function lastCommitDate(paths) {
  try {
    const args = paths.map((p) => `"${p}"`).join(' ');
    const out = execSync(
      `git -C "${repoRoot}" log -1 --format=%cd --date=format:%Y-%m-%d -- ${args}`,
      { encoding: 'utf8' }
    ).trim();
    return out || null;
  } catch (_) {
    return null; // no git / shallow clone → badge falls back to manual `updated`
  }
}

const dates = {};
for (const [key, paths] of Object.entries(SYSTEMS)) {
  // Uncommitted work → today (updates the badge before you commit); else last commit date.
  dates[key] = hasUncommittedChanges(paths) ? todayStr() : lastCommitDate(paths);
}

const outPath = path.join(__dirname, '../src/constance/mtc_version_dates.json');
fs.writeFileSync(outPath, JSON.stringify(dates, null, 2) + '\n');
console.log('[gen-system-versions] wrote', path.relative(repoRoot, outPath));
console.log(dates);
