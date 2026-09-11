/**
 * Export to CSV — generates a tabular list of all differences with statuses.
 * Includes UTF-8 BOM for seamless Microsoft Excel compatibility.
 */

/**
 * @param {Array<{id, type, status, page, bbox, description, textOld, textNew}>} diffs
 * @param {string} baseName
 * @param {string} compareName
 */
export function exportToCsv(diffs, baseName, compareName) {
  const headers = ['#', 'Page', 'Type', 'Description', 'Status', 'Original Text', 'New Text', 'X', 'Y', 'Width', 'Height'];
  const rows = diffs.map((d, i) => [
    i + 1,
    d.page,
    d.type,
    `"${(d.description || '').replace(/"/g, '""')}"`,
    d.status,
    `"${(d.textOld || '').replace(/"/g, '""')}"`,
    `"${(d.textNew || '').replace(/"/g, '""')}"`,
    Math.round(d.bbox?.x || 0),
    Math.round(d.bbox?.y || 0),
    Math.round(d.bbox?.width || 0),
    Math.round(d.bbox?.height || 0),
  ]);

  // Summary counts
  const pending = diffs.filter(d => d.status === 'pending').length;
  const resolved = diffs.filter(d => d.status === 'resolved').length;
  const ignored = diffs.filter(d => d.status === 'ignored').length;
  const progressPercent = diffs.length > 0 ? Math.round((resolved / diffs.length) * 100) : 100;

  let csv = `PDF Comparison Report\n`;
  csv += `Base File:,"${baseName}"\n`;
  csv += `Compare File:,"${compareName}"\n`;
  csv += `Export Date:,"${new Date().toLocaleString()}"\n`;
  csv += `Total Differences:,${diffs.length}\n`;
  csv += `Pending:,${pending}\n`;
  csv += `Resolved:,${resolved}\n`;
  csv += `Ignored:,${ignored}\n`;
  csv += `Review Progress:,${progressPercent}%\n`;
  csv += `\n`;
  csv += headers.join(',') + '\n';
  csv += rows.map(r => r.join(',')).join('\n');

  // Prepend \uFEFF (UTF-8 BOM) so Excel renders Thai and Unicode symbols correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
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

