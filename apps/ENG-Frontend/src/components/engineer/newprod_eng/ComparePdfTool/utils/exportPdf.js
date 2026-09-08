/**
 * Export to PDF — generates a comprehensive PDF report with difference summaries,
 * full Thai/Unicode support, and visual diff snapshots.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * @param {Array} diffs - all diff items with statuses
 * @param {Map} results - comparison results per page
 * @param {object} fileInfo - { baseName, compareName, baseDoc, compareDoc }
 */
export async function exportToPdf(diffs, results, fileInfo) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // ── Load Thai & Unicode Font (tahoma.ttf) ──
  let customFont = null;
  try {
    const fontBytes = await fetch('/fonts/sarabun/tahoma.ttf').then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    });
    customFont = await pdfDoc.embedFont(fontBytes);
  } catch (err) {
    console.warn('Could not load tahoma.ttf, falling back to Helvetica:', err);
  }

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const regularFont = customFont || helvetica;
  const boldFont = customFont || helveticaBold;

  const PAGE_WIDTH = 595.28; // A4 points
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 40;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  // ── Page 1: Cover & Summary ──
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 60;

  // Header Banner
  page.drawRectangle({
    x: MARGIN,
    y: y - 10,
    width: CONTENT_WIDTH,
    height: 48,
    color: rgb(0.06, 0.08, 0.12),
  });

  page.drawText('PDF Comparison & Review Report', {
    x: MARGIN + 16,
    y: y + 8,
    size: 20,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  y -= 45;

  // Document Metadata Block
  page.drawRectangle({
    x: MARGIN,
    y: y - 65,
    width: CONTENT_WIDTH,
    height: 75,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  page.drawText(`Base Document (Rev 1): ${fileInfo.baseName || 'base.pdf'}`, {
    x: MARGIN + 12,
    y: y - 12,
    size: 11,
    font: regularFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`Compare Document (Rev 2): ${fileInfo.compareName || 'compare.pdf'}`, {
    x: MARGIN + 12,
    y: y - 30,
    size: 11,
    font: regularFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText(`Generated: ${new Date().toLocaleString()}`, {
    x: MARGIN + 12,
    y: y - 48,
    size: 10,
    font: regularFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  y -= 95;

  // Summary Metrics
  const pending = diffs.filter(d => d.status === 'pending').length;
  const resolved = diffs.filter(d => d.status === 'resolved').length;
  const ignored = diffs.filter(d => d.status === 'ignored').length;
  const progressPercent = diffs.length > 0 ? Math.round((resolved / diffs.length) * 100) : 100;

  page.drawText('Executive Summary', {
    x: MARGIN,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  y -= 15;

  // 5 Status Metric Cards
  const cardWidth = (CONTENT_WIDTH - 32) / 5;
  const metrics = [
    { label: 'Total Diffs', val: `${diffs.length}`, color: rgb(0.39, 0.4, 0.95), bg: rgb(0.94, 0.95, 1) },
    { label: 'Pending', val: `${pending}`, color: rgb(0.96, 0.62, 0.04), bg: rgb(1, 0.98, 0.9) },
    { label: 'Resolved', val: `${resolved}`, color: rgb(0.06, 0.72, 0.5), bg: rgb(0.9, 0.98, 0.94) },
    { label: 'Ignored', val: `${ignored}`, color: rgb(0.45, 0.5, 0.55), bg: rgb(0.95, 0.95, 0.96) },
    { label: 'Review Rate', val: `${progressPercent}%`, color: rgb(0.1, 0.6, 0.9), bg: rgb(0.92, 0.97, 1) },
  ];

  metrics.forEach((m, idx) => {
    const cx = MARGIN + idx * (cardWidth + 8);
    page.drawRectangle({
      x: cx,
      y: y - 45,
      width: cardWidth,
      height: 48,
      color: m.bg,
      borderColor: m.color,
      borderWidth: 1,
    });
    page.drawText(m.label, {
      x: cx + 8,
      y: y - 16,
      size: 9,
      font: regularFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(m.val, {
      x: cx + 8,
      y: y - 36,
      size: 16,
      font: boldFont,
      color: m.color,
    });
  });

  y -= 70;

  // ── Table of Differences ──
  page.drawText('Detailed Differences Breakdown', {
    x: MARGIN,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  y -= 15;

  // Table Header
  const colX = {
    idx: MARGIN + 4,
    page: MARGIN + 28,
    type: MARGIN + 68,
    desc: MARGIN + 140,
    status: MARGIN + CONTENT_WIDTH - 65,
  };

  const drawTableHeader = (p, currentY) => {
    p.drawRectangle({
      x: MARGIN,
      y: currentY - 14,
      width: CONTENT_WIDTH,
      height: 18,
      color: rgb(0.2, 0.24, 0.3),
    });
    p.drawText('#', { x: colX.idx, y: currentY - 10, size: 9, font: boldFont, color: rgb(1, 1, 1) });
    p.drawText('Page', { x: colX.page, y: currentY - 10, size: 9, font: boldFont, color: rgb(1, 1, 1) });
    p.drawText('Type', { x: colX.type, y: currentY - 10, size: 9, font: boldFont, color: rgb(1, 1, 1) });
    p.drawText('Description', { x: colX.desc, y: currentY - 10, size: 9, font: boldFont, color: rgb(1, 1, 1) });
    p.drawText('Status', { x: colX.status, y: currentY - 10, size: 9, font: boldFont, color: rgb(1, 1, 1) });
  };

  drawTableHeader(page, y);
  y -= 22;

  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i];

    if (y < 50) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - 50;
      drawTableHeader(page, y);
      y -= 22;
    }

    const rowBg = i % 2 === 0 ? rgb(0.98, 0.98, 0.99) : rgb(1, 1, 1);
    page.drawRectangle({
      x: MARGIN,
      y: y - 10,
      width: CONTENT_WIDTH,
      height: 16,
      color: rowBg,
    });

    const statusColors = {
      pending: rgb(0.96, 0.62, 0.04),
      resolved: rgb(0.06, 0.72, 0.5),
      ignored: rgb(0.45, 0.5, 0.55),
    };

    const descStr = (diff.description || '').length > 65
      ? `${(diff.description || '').substring(0, 62)}...`
      : (diff.description || '');

    page.drawText(`${i + 1}`, { x: colX.idx, y: y - 6, size: 8, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(`P.${diff.page}`, { x: colX.page, y: y - 6, size: 8, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(diff.type || 'diff', { x: colX.type, y: y - 6, size: 8, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(descStr, { x: colX.desc, y: y - 6, size: 8, font: regularFont, color: rgb(0.1, 0.1, 0.1) });
    page.drawText((diff.status || 'pending').toUpperCase(), {
      x: colX.status,
      y: y - 6,
      size: 8,
      font: boldFont,
      color: statusColors[diff.status] || rgb(0.2, 0.2, 0.2),
    });

    y -= 18;
  }

  // ── Visual Snapshots (for pages that have diffs) ──
  const targetDoc = fileInfo.compareDoc || fileInfo.baseDoc;
  if (targetDoc) {
    const diffPages = Array.from(new Set(diffs.map(d => d.page))).slice(0, 10); // cap to first 10 diff pages

    for (const pageNum of diffPages) {
      try {
        const pageDiffs = diffs.filter(d => d.page === pageNum);
        const pObj = await targetDoc.getPage(pageNum);
        const vp = pObj.getViewport({ scale: 1.0 });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await pObj.render({ canvasContext: ctx, viewport: vp }).promise;

        // Draw red bounding box overlays on the snapshot
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';

        for (const d of pageDiffs) {
          if (d.bbox) {
            ctx.fillRect(d.bbox.x, d.bbox.y, d.bbox.width, d.bbox.height);
            ctx.strokeRect(d.bbox.x, d.bbox.y, d.bbox.width, d.bbox.height);
          }
        }

        const dataUrl = canvas.toDataURL('image/png');
        const imgBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
        const embeddedImg = await pdfDoc.embedPng(imgBytes);

        // Cleanup canvas
        canvas.width = 0;
        canvas.height = 0;

        // Add Snapshot Page
        const snapPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        snapPage.drawText(`Visual Differences: Page ${pageNum} (${pageDiffs.length} issues)`, {
          x: MARGIN,
          y: PAGE_HEIGHT - 40,
          size: 14,
          font: boldFont,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Fit image nicely on the page
        const maxImgW = CONTENT_WIDTH;
        const maxImgH = PAGE_HEIGHT - 80;
        const scaleW = maxImgW / embeddedImg.width;
        const scaleH = maxImgH / embeddedImg.height;
        const fitScale = Math.min(scaleW, scaleH);

        const drawW = embeddedImg.width * fitScale;
        const drawH = embeddedImg.height * fitScale;
        const drawX = MARGIN + (CONTENT_WIDTH - drawW) / 2;
        const drawY = PAGE_HEIGHT - 60 - drawH;

        snapPage.drawImage(embeddedImg, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });

        snapPage.drawRectangle({
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
          borderColor: rgb(0.8, 0.8, 0.8),
          borderWidth: 1,
        });
      } catch (err) {
        console.warn(`Could not render snapshot for page ${pageNum}:`, err);
      }
    }
  }

  // ── Download Generated PDF ──
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comparison_report_${Date.now()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

