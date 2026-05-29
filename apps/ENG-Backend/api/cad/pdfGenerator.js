/**
 * PDF Generator — Puppeteer-based PDF engine
 * Captures the React DrawingBoard layout and exports as high-quality A4 PDF.
 * 
 * Strategy:
 *   1. Primary: Launch headless Chromium, navigate to drawing page, capture PDF
 *   2. Fallback: If WebGL/Three.js fails, use viewport image from CATIA + pdf-lib composite
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Output directory for PDFs
const PDF_OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'output', 'cad_pdfs');

/**
 * Generate a PDF from the React DrawingBoard page
 * 
 * @param {string} jobId - The BullMQ job ID
 * @param {string} frontendUrl - Optional custom frontend URL
 * @returns {Object} { pdfPath, pdfBuffer }
 */
async function generatePdf(jobId, frontendUrl) {
  // Ensure output directory exists
  if (!fs.existsSync(PDF_OUTPUT_DIR)) {
    fs.mkdirSync(PDF_OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(PDF_OUTPUT_DIR, `drawing_${jobId}.pdf`);
  const pageUrl = frontendUrl || `http://localhost:3000/drawing/${jobId}`;

  console.log(`[PDF Generator] Generating PDF for job ${jobId}`);
  console.log(`[PDF Generator] URL: ${pageUrl}`);

  let browser = null;

  try {
    // Launch headless Chromium with WebGL support
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-webgl',
        '--use-gl=angle',              // Use ANGLE for WebGL in headless
        '--enable-gpu-rasterization',
        '--disable-dev-shm-usage',
        '--disable-web-security',       // Allow local file access
        '--window-size=1190,842'        // A4 landscape at 96dpi
      ],
      defaultViewport: {
        width: 1190,     // A4 landscape width in px (297mm at 96dpi ~= 1123px, adjusted)
        height: 842,     // A4 landscape height in px (210mm at 96dpi ~= 794px, adjusted)
        deviceScaleFactor: 2  // 2x for high-quality rendering
      }
    });

    const page = await browser.newPage();

    // Set print media type to trigger @media print styles
    await page.emulateMediaType('print');

    // Navigate to the drawing page
    await page.goto(pageUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for critical elements to load
    try {
      // Wait for the 3D model to finish loading
      await page.waitForSelector('[data-model-loaded="true"]', { timeout: 30000 });
      console.log('[PDF Generator] 3D model loaded');
    } catch (e) {
      console.warn('[PDF Generator] 3D model selector not found, continuing...');
    }

    try {
      // Wait for XML metadata to render
      await page.waitForSelector('[data-xml-loaded="true"]', { timeout: 10000 });
      console.log('[PDF Generator] XML data loaded');
    } catch (e) {
      console.warn('[PDF Generator] XML data selector not found, continuing...');
    }

    // Additional wait for Three.js rendering to stabilize
    await page.waitForTimeout(3000);

    // Inject print-ready class to body
    await page.evaluate(() => {
      document.body.classList.add('print-mode');
    });

    // Hide non-print elements
    await page.evaluate(() => {
      // Remove toolbar buttons, scrollbars, navigation etc.
      const hideSelectors = [
        '.viewer-toolbar',
        '.ant-btn',
        '.ant-layout-sider',
        '.no-print',
        '[data-no-print]'
      ];
      hideSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.style.display = 'none';
        });
      });
    });

    // Generate PDF — A4 landscape
    const pdfBuffer = await page.pdf({
      path: outputPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      },
      scale: 1
    });

    console.log(`[PDF Generator] PDF saved: ${outputPath} (${pdfBuffer.length} bytes)`);

    return {
      pdfPath: outputPath,
      pdfBuffer,
      size: pdfBuffer.length
    };

  } catch (error) {
    console.error('[PDF Generator] Primary generation failed:', error.message);

    // Fallback: Try screenshot-based approach
    try {
      return await generatePdfFallback(jobId, browser);
    } catch (fallbackError) {
      throw new Error(`PDF generation failed: ${error.message}. Fallback also failed: ${fallbackError.message}`);
    }

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Fallback PDF generation using viewport image from CATIA + pdf-lib
 * Used when WebGL rendering fails in headless Chromium
 */
async function generatePdfFallback(jobId) {
  console.log('[PDF Generator] Using fallback: CATIA viewport image + pdf-lib');

  const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

  const outputPath = path.join(PDF_OUTPUT_DIR, `drawing_${jobId}.pdf`);
  const cadOutputDir = path.resolve(__dirname, '..', '..', 'output', 'cad_results');

  // Find viewport image from CATIA export
  const viewportFiles = fs.readdirSync(cadOutputDir)
    .filter(f => f.includes(jobId) && f.endsWith('_viewport.png'));

  const pdfDoc = await PDFDocument.create();

  // A4 landscape dimensions in points (1 point = 1/72 inch)
  const pageWidth = 841.89;  // 297mm
  const pageHeight = 595.28; // 210mm

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Draw border
  page.drawRectangle({
    x: 10,
    y: 10,
    width: pageWidth - 20,
    height: pageHeight - 20,
    borderColor: rgb(0, 0, 0),
    borderWidth: 2
  });

  // If we have a viewport image, embed it
  if (viewportFiles.length > 0) {
    const imgPath = path.join(cadOutputDir, viewportFiles[0]);
    const imgBytes = fs.readFileSync(imgPath);
    const img = await pdfDoc.embedPng(imgBytes);

    // Scale image to fit the drawing area (leaving space for title block)
    const drawingAreaWidth = pageWidth - 40;
    const drawingAreaHeight = pageHeight - 140;  // Reserve 120pt for title block
    const imgScale = Math.min(
      drawingAreaWidth / img.width,
      drawingAreaHeight / img.height
    );

    page.drawImage(img, {
      x: 20 + (drawingAreaWidth - img.width * imgScale) / 2,
      y: 130 + (drawingAreaHeight - img.height * imgScale) / 2,
      width: img.width * imgScale,
      height: img.height * imgScale
    });
  }

  // Draw title block placeholder
  const titleBlockY = 20;
  const titleBlockHeight = 100;
  page.drawRectangle({
    x: pageWidth - 310,
    y: titleBlockY,
    width: 300,
    height: titleBlockHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1
  });

  // Title block text
  const fontSize = 8;
  page.drawText(`Job ID: ${jobId}`, {
    x: pageWidth - 300,
    y: titleBlockY + titleBlockHeight - 15,
    size: fontSize,
    font
  });
  page.drawText(`Generated: ${new Date().toISOString().split('T')[0]}`, {
    x: pageWidth - 300,
    y: titleBlockY + titleBlockHeight - 30,
    size: fontSize,
    font
  });
  page.drawText('Drawing Size: A4', {
    x: pageWidth - 300,
    y: titleBlockY + titleBlockHeight - 45,
    size: fontSize,
    font
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);

  console.log(`[PDF Generator] Fallback PDF saved: ${outputPath}`);

  return {
    pdfPath: outputPath,
    pdfBuffer: Buffer.from(pdfBytes),
    size: pdfBytes.length,
    fallback: true
  };
}

module.exports = { generatePdf };
