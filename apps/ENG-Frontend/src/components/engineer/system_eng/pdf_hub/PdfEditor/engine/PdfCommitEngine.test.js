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

            const resultBytes = await commitAllToPdf(mockPdfBytes, pageAnnotations);
            expect(resultBytes).toBeInstanceOf(Uint8Array);
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
