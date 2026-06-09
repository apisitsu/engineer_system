/**
 * pdfConverterController.js — HTTP handler for PDF-to-Image conversion.
 *
 * Server-side rendering of PDF pages to images using pdfjs-dist + canvas.
 * Moved from the standalone pdfConverter.js to fit the modular architecture.
 *
 * Route: POST /api/engineer/pdf-hub/pdf-to-image
 */
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');
const { v4: uuidv4 } = require('uuid');

// --- Destination for uploads and generated images ---
const UPLOAD_DIR = path.join(__dirname, '../../../../files/pdf_uploads');
const OUTPUT_DIR = path.join(__dirname, '../../../../public/generated/pdf_to_image');

// Ensure directories exist
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(OUTPUT_DIR);

// --- Multer setup for file uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({ storage });

/**
 * Parse page range string (e.g., "1, 3, 5-7") into an array of 0-indexed page numbers.
 */
function parsePages(pageStr, totalPages) {
    if (!pageStr || !pageStr.trim()) {
        return Array.from({ length: totalPages }, (_, i) => i);
    }

    const pagesToConvert = new Set();
    const parts = pageStr.replace(/\s/g, '').split(',');

    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                    pagesToConvert.add(i - 1);
                }
            }
        } else {
            const page = Number(part);
            if (!isNaN(page)) {
                pagesToConvert.add(page - 1);
            }
        }
    }

    return [...pagesToConvert].filter(p => p >= 0 && p < totalPages).sort((a, b) => a - b);
}

/**
 * POST handler: Convert PDF pages to images.
 */
async function convertPdfToImage(req, res) {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No PDF file uploaded.' });
    }

    const { pages: pageStr = '', format = 'jpg' } = req.body;
    const pdfPath = req.file.path;

    try {
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const pdfDoc = await getDocument({
            data,
            cMapUrl: './node_modules/pdfjs-dist/cmaps/',
            cMapPacked: true,
            fontExtraUrl: './node_modules/pdfjs-dist/standard_fonts/',
        }).promise;

        const totalPages = pdfDoc.numPages;
        const pagesToConvert = parsePages(pageStr, totalPages);

        if (pagesToConvert.length === 0) {
            fs.unlinkSync(pdfPath);
            return res.status(400).json({ success: false, message: 'Invalid page numbers or range specified.' });
        }

        // Create a unique folder for this conversion job
        const jobFolder = uuidv4();
        const jobOutputDir = path.join(OUTPUT_DIR, jobFolder);
        await fs.ensureDir(jobOutputDir);

        const outputImageUrls = [];
        const baseName = path.parse(req.file.originalname).name;

        for (const pageNum of pagesToConvert) {
            const page = await pdfDoc.getPage(pageNum + 1);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');

            await page.render({ canvasContext: context, viewport }).promise;

            const fileExtension = format.toLowerCase() === 'png' ? 'png' : 'jpg';
            const outputFileName = `${baseName}_page_${pageNum + 1}.${fileExtension}`;
            const outputFilePath = path.join(jobOutputDir, outputFileName);

            const out = fs.createWriteStream(outputFilePath);
            const stream = (fileExtension === 'png')
                ? canvas.createPNGStream()
                : canvas.createJPEGStream({ quality: 0.9 });
            stream.pipe(out);

            await new Promise((resolve, reject) => {
                out.on('finish', resolve);
                out.on('error', reject);
            });

            const imageUrl = `/generated/pdf_to_image/${jobFolder}/${outputFileName}`;
            outputImageUrls.push(imageUrl);
        }

        res.json({ success: true, images: outputImageUrls });
    } catch (error) {
        console.error('PDF conversion error:', error);
        res.status(500).json({ success: false, message: 'An error occurred during conversion.', error: error.message });
    } finally {
        if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
        }
    }
}

module.exports = {
    uploadMiddleware: upload.single('pdf'),
    convertPdfToImage,
};
