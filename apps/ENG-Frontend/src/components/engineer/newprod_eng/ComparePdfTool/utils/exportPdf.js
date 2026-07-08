/**
 * Export to PDF — generates a multi-page PDF report with difference summaries.
 */
import { jsPDF } from 'jspdf';

/**
 * @param {Array} diffs - all diff items with statuses
 * @param {Map} results - comparison results per page
 * @param {object} fileInfo - { baseName, compareName }
 */
export async function exportToPdf(diffs, results, fileInfo) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // ── Title Page ──
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PDF Comparison Report', pageWidth / 2, 40, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Base File: ${fileInfo.baseName}`, margin, 60);
  doc.text(`Compare File: ${fileInfo.compareName}`, margin, 68);
  doc.text(`Date: ${new Date().toLocaleString()}`, margin, 76);

  // Summary
  const pending = diffs.filter(d => d.status === 'pending').length;
  const resolved = diffs.filter(d => d.status === 'resolved').length;
  const ignored = diffs.filter(d => d.status === 'ignored').length;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, 96);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Differences: ${diffs.length}`, margin, 106);
  doc.text(`Pending: ${pending}`, margin, 114);
  doc.text(`Resolved: ${resolved}`, margin, 122);
  doc.text(`Ignored: ${ignored}`, margin, 130);

  // Progress
  const progressPercent = diffs.length > 0
    ? Math.round((resolved / diffs.length) * 100)
    : 100;
  doc.text(`Review Progress: ${progressPercent}%`, margin, 138);

  // ── Difference Details ──
  if (diffs.length > 0) {
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Difference Details', margin, 20);

    let y = 35;

    // Table header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    doc.text('#', margin + 2, y);
    doc.text('Page', margin + 12, y);
    doc.text('Type', margin + 28, y);
    doc.text('Description', margin + 52, y);
    doc.text('Status', margin + 145, y);
    y += 8;

    doc.setFont('helvetica', 'normal');

    for (let i = 0; i < diffs.length; i++) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      const diff = diffs[i];
      const desc = (diff.description || '').substring(0, 60);

      // Alternate row background
      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, y - 4, contentWidth, 6, 'F');
      }

      doc.text(`${i + 1}`, margin + 2, y);
      doc.text(`${diff.page}`, margin + 12, y);
      doc.text(diff.type, margin + 28, y);
      doc.text(desc, margin + 52, y);

      // Status with color
      const statusColor = {
        pending: [245, 158, 11],
        resolved: [16, 185, 129],
        ignored: [107, 114, 128],
      };
      const color = statusColor[diff.status] || [0, 0, 0];
      doc.setTextColor(...color);
      doc.text(diff.status.toUpperCase(), margin + 145, y);
      doc.setTextColor(0, 0, 0);

      y += 6;
    }
  }

  // Save
  doc.save(`comparison_report_${Date.now()}.pdf`);
}
