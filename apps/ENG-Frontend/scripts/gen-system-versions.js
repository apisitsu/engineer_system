/**
 * Generates src/constance/mtc_version_dates.json — the real "last updated" date
 * per MTC system, taken from the latest git commit that touched that system's
 * source files (frontend + backend). Run automatically by `prestart`/`prebuild`.
 *
 * Version NUMBERS stay manual in mtc_constance.js → MTC_VERSIONS; only the dates
 * are derived here. Falls back to null (badge then uses the manual `updated`).
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
for (const [key, paths] of Object.entries(SYSTEMS)) dates[key] = lastCommitDate(paths);

const outPath = path.join(__dirname, '../src/constance/mtc_version_dates.json');
fs.writeFileSync(outPath, JSON.stringify(dates, null, 2) + '\n');
console.log('[gen-system-versions] wrote', path.relative(repoRoot, outPath));
console.log(dates);
