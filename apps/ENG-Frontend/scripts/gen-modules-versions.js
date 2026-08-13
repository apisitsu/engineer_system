/**
 * Generates src/constance/modules_version_dates.json — the real "last updated" date
 * per general system module. Run automatically by `predev`/`prestart`/`prebuild`.
 *
 * Date resolution per system:
 *   1. If the system's files have UNCOMMITTED changes (staged or unstaged) → TODAY.
 *      This makes the version update *before* a git commit.
 *   2. Otherwise → the date of the latest git commit that touched those files.
 *   3. No git (shallow clone / not a repo) → null
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..'); // → EngineerSystem root

// system key → repo-relative paths whose latest commit = its date
const SYSTEMS = {
  'kanban': [
    'apps/ENG-Frontend/src/components/engineer/kanban',
  ],
  'pdf-hub': [
    'apps/ENG-Frontend/src/components/engineer/system_eng/pdf_hub',
  ],
  'activity': [
    'apps/ENG-Frontend/src/components/engineer/system_eng/activity',
  ],
  'tool-management': [
    'apps/ENG-Frontend/src/components/engineer/system_eng/tool',
  ],
  'newprod-eng': [
    'apps/ENG-Frontend/src/components/engineer/newprod_eng',
  ],
  'user-management': [
    'apps/ENG-Frontend/src/components/engineer/system_eng/user_management',
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
    return false;
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
    return null;
  }
}

const dates = {};
for (const [key, paths] of Object.entries(SYSTEMS)) {
  dates[key] = hasUncommittedChanges(paths) ? todayStr() : lastCommitDate(paths);
}

const outPath = path.join(__dirname, '../src/constance/modules_version_dates.json');
fs.writeFileSync(outPath, JSON.stringify(dates, null, 2) + '\n');
console.log('[gen-modules-versions] wrote', path.relative(repoRoot, outPath));
console.log(dates);
