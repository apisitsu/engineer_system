/**
 * Export to CSV — generates a tabular list of all differences with statuses.
 */

/**
 * @param {Array<{id, type, status, page, bbox, description}>} diffs
 * @param {string} baseName
 * @param {string} compareName
 */
export function exportToCsv(diffs, baseName, compareName) {
  const headers = ['ID', 'Page', 'Type', 'Description', 'Status', 'X', 'Y', 'Width', 'Height'];
  const rows = diffs.map((d, i) => [
    i + 1,
    d.page,
    d.type,
    `"${(d.description || '').replace(/"/g, '""')}"`,
    d.status,
    Math.round(d.bbox.x),
    Math.round(d.bbox.y),
    Math.round(d.bbox.width),
    Math.round(d.bbox.height),
  ]);

  // Summary
  const pending = diffs.filter(d => d.status === 'pending').length;
  const resolved = diffs.filter(d => d.status === 'resolved').length;
  const ignored = diffs.filter(d => d.status === 'ignored').length;

  let csv = `PDF Comparison Report\n`;
  csv += `Base File:,"${baseName}"\n`;
  csv += `Compare File:,"${compareName}"\n`;
  csv += `Date:,"${new Date().toLocaleString()}"\n`;
  csv += `Total Differences:,${diffs.length}\n`;
  csv += `Pending:,${pending}\n`;
  csv += `Resolved:,${resolved}\n`;
  csv += `Ignored:,${ignored}\n`;
  csv += `\n`;
  csv += headers.join(',') + '\n';
  csv += rows.map(r => r.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `comparison_report_${Date.now()}.csv`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
