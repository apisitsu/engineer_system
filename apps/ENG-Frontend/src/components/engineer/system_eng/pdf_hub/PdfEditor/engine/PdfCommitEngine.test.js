import { PDFDocument } from 'pdf-lib';
// eslint-disable-next-line no-unused-vars
import { commitAllToPdf, exportPageToImage, mergePdfFiles } from './PdfCommitEngine';

describe('PdfCommitEngine', () => {
    let mockPdfBytes;

    beforeAll(async () => {
        // Create a dummy PDF to act as pdfBytes
        const doc = await PDFDocument.create();
        doc.addPage([612, 792]);
        mockPdfBytes = await doc.save();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('commitAllToPdf', () => {
        it('should correctly process Fabric v6 PascalCase types', async () => {
            const pageAnnotations = {
                '1': {
                    _canvasWidth: 800,
                    _canvasHeight: 600,
                    objects: [
                        { type: 'Rect', left: 10, top: 10, width: 100, height: 50, fill: '#ff0000', stroke: '#00ff00' },
                        { type: 'Line', left: 20, top: 20, x1: 0, y1: 0, x2: 100, y2: 100, stroke: '#0000ff', strokeWidth: 2 },
                        { type: 'Ellipse', left: 50, top: 50, rx: 20, ry: 10, fill: '#ffff00' },
                        { type: 'Textbox', left: 10, top: 10, width: 100, height: 20, text: 'Hello', fontSize: 16, fill: '#000000', backgroundColor: '#fff3cd' }
                    ]
                }
            };

            const resultBytes = await commitAllToPdf(mockPdfBytes, pageAnnotations);
            expect(resultBytes).toBeInstanceOf(Uint8Array);

            const modifiedDoc = await PDFDocument.load(resultBytes);
            const pages = modifiedDoc.getPages();
            expect(pages.length).toBeGreaterThan(0);
        });

        it('should wrap long text when textLines is missing in Textbox', async () => {
            const pageAnnotations = {
                '1': {
                    _canvasWidth: 800,
                    _canvasHeight: 600,
                    objects: [
                        {
                            type: 'Textbox',
                            left: 50,
                            top: 50,
                            width: 150,
                            height: 80,
                            text: 'This is a long sentence that should automatically wrap into multiple lines when committed to PDF',
                            fontSize: 14,
                            fill: '#333333'
                        }
                    ]
                }
            };

            const resultBytes = await commitAllToPdf(mockPdfBytes, pageAnnotations);
            expect(resultBytes).toBeInstanceOf(Uint8Array);
            expect(resultBytes.length).toBeGreaterThan(0);
        });

        it('should correctly render multi-line Textbox with pre-computed textLines', async () => {
            const pageAnnotations = {
                '1': {
                    _canvasWidth: 800,
                    _canvasHeight: 600,
                    objects: [
                        {
                            type: 'Textbox',
                            left: 50,
                            top: 50,
                            width: 150,
                            height: 60,
                            text: 'Line 1 Line 2 Line 3',
                            textLines: ['Line 1', 'Line 2', 'Line 3'],
                            fontSize: 14,
                            fill: '#000000'
                        }
                    ]
                }
            };

            const resultBytes = await commitAllToPdf(mockPdfBytes, pageAnnotations);
            expect(resultBytes).toBeInstanceOf(Uint8Array);
            const doc = await PDFDocument.load(resultBytes);
            expect(doc.getPageCount()).toBe(1);
        });

        it('should safely handle missing objects or unknown types', async () => {
            const pageAnnotations = {
                '1': {
                    _canvasWidth: 800,
                    _canvasHeight: 600,
                    objects: [
                        { type: 'UnknownShape', left: 10, top: 10 },
                        null,
                        undefined
                    ]
                },
                '2': {} // No objects array
            };

        });

        it('should preserve page rotation (e.g. 90 deg) and not destructively reset dimensions', async () => {
            const { degrees } = await import('pdf-lib');
            const rotDoc = await PDFDocument.create();
            const rotPage = rotDoc.addPage([400, 600]);
            rotPage.setRotation(degrees(90));
            const rotPdfBytes = await rotDoc.save();

            const pageAnnotations = {
                '1': {
                    _canvasWidth: 600,
                    _canvasHeight: 400,
                    objects: [
                        { type: 'Rect', left: 20, top: 20, width: 100, height: 50, fill: '#ff0000' },
                        { 
                            type: 'path', 
                            left: 50, 
                            top: 50, 
                            pathOffset: { x: 25, y: 25 },
                            scaleX: 1, 
                            scaleY: 1, 
                            stroke: '#000000', 
                            strokeWidth: 2,
                            path: [['M', 0, 0], ['L', 50, 50]] 
                        }
                    ]
                }
            };

            const resultBytes = await commitAllToPdf(rotPdfBytes, pageAnnotations);
            const savedDoc = await PDFDocument.load(resultBytes);
            const page = savedDoc.getPage(0);
            expect(page.getRotation().angle).toBe(90);
            expect(page.getWidth()).toBe(400);
            expect(page.getHeight()).toBe(600);
        });

        it('should efficiently handle 100+ tiled watermark text objects using document font caching', async () => {
            // Generate 120 tiled watermark objects to simulate full-page repeat mode
            const tiledObjects = [];
            for (let i = 0; i < 120; i++) {
                tiledObjects.push({
                    type: 'text',
                    text: 'CONFIDENTIAL 2026-09-21',
                    left: (i % 10) * 80,
                    top: Math.floor(i / 10) * 60,
                    fontSize: 24,
                    fill: '#ff0000',
                    opacity: 0.15,
                    angle: -45,
                    originX: 'center',
                    originY: 'center',
                    customData: { type: 'watermark', tiled: true }
                });
            }

            const pageAnnotations = {
                '1': {
                    _canvasWidth: 800,
                    _canvasHeight: 720,
                    objects: tiledObjects
                }
            };

            const startTime = Date.now();
            const resultBytes = await commitAllToPdf(mockPdfBytes, pageAnnotations);
            const elapsed = Date.now() - startTime;

            expect(resultBytes).toBeInstanceOf(Uint8Array);
            expect(elapsed).toBeLessThan(5000); // Must be fast via font cache (<5s)

            const verifiedDoc = await PDFDocument.load(resultBytes);
            expect(verifiedDoc.getPageCount()).toBe(1);
        });

        it('should safely guard against NaN or undefined coordinates and dimensions', async () => {
            const pageAnnotations = {
                '1': {
                    _canvasWidth: 0, // Zero or invalid canvas dimension
                    _canvasHeight: 0,
                    objects: [
                        {
                            type: 'text',
                            text: 'CORRUPTED COORDS',
                            left: NaN,
                            top: undefined,
                            fontSize: NaN,
                            originX: 'center',
                            fill: { r: 255, g: 0, b: 0 } // Object instead of hex string
                        },
                        {
                            type: 'Rect',
                            left: undefined,
                            top: NaN,
                            width: NaN,
                            height: undefined,
                            fill: '#0000ff'
                        }
                    ]
                }
            };

            // Must NOT throw or corrupt the PDF stream
            const resultBytes = await commitAllToPdf(mockPdfBytes, pageAnnotations);
            expect(resultBytes).toBeInstanceOf(Uint8Array);

            // Output PDF must load cleanly without syntax errors
            const cleanDoc = await PDFDocument.load(resultBytes);
            expect(cleanDoc.getPageCount()).toBe(1);
        });

        it('should consistently commit watermarks across multi-page documents with different aspect ratios', async () => {
            const multiDoc = await PDFDocument.create();
            multiDoc.addPage([595.28, 841.89]); // Page 1: Portrait A4
            multiDoc.addPage([841.89, 595.28]); // Page 2: Landscape A4
            const multiPdfBytes = await multiDoc.save();

            const pageAnnotations = {
                '1': {
                    _canvasWidth: 803.6, // Rendered on screen at zoom 1.35
                    _canvasHeight: 1136.5,
                    objects: [
                        {
                            type: 'text',
                            text: 'INTERNAL ONLY',
                            left: 401.8,
                            top: 568.25,
                            fontSize: 48, // Unscaled 48pt font matching Shape Properties & Watermark Manager
                            scaleX: 1.35, // Visual scale carried on canvas
                            scaleY: 1.35,
                            originX: 'center',
                            originY: 'center',
                            fill: '#000000',
                            customData: { type: 'watermark' }
                        }
                    ]
                },
                '2': {
                    _canvasWidth: 841.89, // Unrendered page (unzoomed landscape)
                    _canvasHeight: 595.28,
                    objects: [
                        {
                            type: 'text',
                            text: 'INTERNAL ONLY',
                            width: 300,
                            height: 57.6,
                            left: 420.945,
                            top: 297.64,
                            fontSize: 48, // 48 on unzoomed canvas
                            originX: 'center',
                            originY: 'center',
                            fill: '#000000',
                            customData: { type: 'watermark' }
                        }
                    ]
                }
            };

            const resultBytes = await commitAllToPdf(multiPdfBytes, pageAnnotations);
            expect(resultBytes).toBeInstanceOf(Uint8Array);

            const verifiedDoc = await PDFDocument.load(resultBytes);
            expect(verifiedDoc.getPageCount()).toBe(2);
            expect(verifiedDoc.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
            expect(verifiedDoc.getPage(1).getWidth()).toBeCloseTo(841.89, 1);
        });

        it('should correctly commit underlay watermarks and resolve dynamic {PAGE} of {TOTAL_PAGES} tags', async () => {
            const doc = await PDFDocument.create();
            doc.addPage([595.28, 841.89]);
            doc.addPage([595.28, 841.89]);
            const twoPageBytes = await doc.save();

            const pageAnnotations = {
                '1': {
                    _canvasWidth: 595.28,
                    _canvasHeight: 841.89,
                    objects: [
                        {
                            type: 'text',
                            text: 'Page {PAGE} of {TOTAL_PAGES}',
                            left: 297.64,
                            top: 820,
                            fontSize: 12,
                            fill: '#000000',
                            customData: { type: 'watermark', layer: 'underlay' }
                        },
                        {
                            type: 'Rect',
                            left: 100,
                            top: 100,
                            width: 200,
                            height: 100,
                            fill: '#00ff00'
                        }
                    ]
                },
                '2': {
                    _canvasWidth: 595.28,
                    _canvasHeight: 841.89,
                    objects: [
                        {
                            type: 'text',
                            text: 'Page {PAGE} of {TOTAL_PAGES}',
                            left: 297.64,
                            top: 820,
                            fontSize: 12,
                            fill: '#000000',
                            customData: { type: 'watermark', layer: 'underlay' }
                        }
                    ]
                }
            };

            const committedBytes = await commitAllToPdf(twoPageBytes, pageAnnotations);
            expect(committedBytes).toBeInstanceOf(Uint8Array);
            const verified = await PDFDocument.load(committedBytes);
            expect(verified.getPageCount()).toBe(2);
        });
    });

    describe('wrapTextToWidth', () => {
        it('should wrap text according to measured width', async () => {
            const { wrapTextToWidth } = await import('./PdfCommitEngine');
            const mockFont = {
                widthOfTextAtSize: (str, size) => str.length * (size * 0.5)
            };

            const text = 'Quick brown fox jumps over the lazy dog';
            // Each char is 5 units wide with size 10. Max width 60 means ~12 chars max per line.
            const lines = wrapTextToWidth(text, mockFont, 10, 60);
            expect(lines.length).toBeGreaterThan(1);
            lines.forEach(l => {
                expect(mockFont.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(60);
            });
        });
    });

    describe('mergePdfFiles', () => {
        it('should merge multiple PDF array buffers', async () => {
            const doc1 = await PDFDocument.create();
            doc1.addPage([100, 100]);
            const bytes1 = await doc1.save();

            const doc2 = await PDFDocument.create();
            doc2.addPage([200, 200]);
            const bytes2 = await doc2.save();

            const mergedBytes = await mergePdfFiles([bytes1, bytes2]);
            expect(mergedBytes).toBeInstanceOf(Uint8Array);

            const mergedDoc = await PDFDocument.load(mergedBytes);
            expect(mergedDoc.getPageCount()).toBe(2);
        });
    });
});
