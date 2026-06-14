import React from 'react';
import { MTC_VERSIONS } from '../../../constance/mtc_constance';
// Real per-system last-updated dates, generated from git by scripts/gen-system-versions.js.
import VERSION_DATES from '../../../constance/mtc_version_dates.json';

/**
 * Inline "v{version} · updated {date}" label shown in a system's page header.
 * `system` = the sidebar item key (see MTC_VERSIONS). Version is manual; the
 * date is the latest git commit touching that system (falls back to the manual
 * `updated` if git data is unavailable). `dark` tunes the colour for dashboards.
 */
export const SystemVersionBadge = ({ system, dark = false, style }) => {
  const info = MTC_VERSIONS[system];
  if (!info) return null;
  const updated = VERSION_DATES[system] || info.updated;
  const sub = dark ? 'rgba(255,255,255,0.55)' : '#8c8c8c';
  return (
    <span
      style={{
        marginLeft: 10, fontSize: 12, fontWeight: 500, color: sub,
        whiteSpace: 'nowrap', verticalAlign: 'middle', ...style,
      }}
    >
      <span style={{ fontWeight: 700 }}>v{info.version}</span>
      {updated ? ` · updated ${updated}` : ''}
    </span>
  );
};

export default SystemVersionBadge;
