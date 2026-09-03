import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import moment from 'moment';

/**
 * Generates the official ECN PDF (Block 11)
 * @param {Object} ecnData The ECN document data
 * @param {Object} ecrData The linked ECR document data
 */
export const generateEcnPdf = async (ecnData, ecrData) => {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size (points)
        
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const { width, height } = page.getSize();
        
        // Helper to draw text
        const drawText = (text, x, y, size = 10, font = helveticaFont, color = rgb(0, 0, 0)) => {
            page.drawText(text || '', { x, y, size, font, color });
        };
        
        // Helper to draw centered text
        const drawCenteredText = (text, y, size = 12, font = helveticaBold) => {
            if (!text) return;
            const textWidth = font.widthOfTextAtSize(text, size);
            page.drawText(text, { x: (width - textWidth) / 2, y, size, font });
        };

        // Draw Header
        drawCenteredText('ENGINEERING CHANGE NOTICE (ECN)', height - 50, 16);
        drawCenteredText('Nidec Copal (Thailand) Co., Ltd.', height - 70, 12);
        
        // Draw Metadata Box
        page.drawRectangle({ x: 40, y: height - 160, width: 515, height: 60, borderColor: rgb(0,0,0), borderWidth: 1 });
        
        drawText('ECN No:', 50, height - 120, 10, helveticaBold);
        drawText(ecnData.ecn_no || 'N/A', 100, height - 120);
        
        drawText('ECR No:', 50, height - 140, 10, helveticaBold);
        drawText(ecrData?.ecr_no || 'N/A', 100, height - 140);
        
        drawText('Date:', 350, height - 120, 10, helveticaBold);
        drawText(moment(ecnData.created_at).format('DD-MMM-YYYY'), 400, height - 120);
        
        drawText('Requester:', 350, height - 140, 10, helveticaBold);
        drawText(ecnData.request_by_name || 'N/A', 415, height - 140);

        // Body Content
        let cursorY = height - 190;
        
        drawText('1. Title of Change:', 40, cursorY, 12, helveticaBold);
        cursorY -= 20;
        drawText(ecnData.title_of_change || 'N/A', 60, cursorY, 10);
        cursorY -= 30;
        
        drawText('2. Reason of Change:', 40, cursorY, 12, helveticaBold);
        cursorY -= 20;
        drawText(ecnData.reason_of_change || 'N/A', 60, cursorY, 10);
        cursorY -= 30;
        
        drawText('3. Scope of Implementation:', 40, cursorY, 12, helveticaBold);
        cursorY -= 20;
        drawText(ecnData.scope_of_implementation || 'N/A', 60, cursorY, 10);
        cursorY -= 30;
        
        // Changes Table Header
        drawText('4. Details of Change:', 40, cursorY, 12, helveticaBold);
        cursorY -= 20;
        
        // Table Outline
        page.drawRectangle({ x: 40, y: cursorY - 100, width: 515, height: 100, borderColor: rgb(0,0,0), borderWidth: 1 });
        page.drawLine({ start: { x: 297, y: cursorY }, end: { x: 297, y: cursorY - 100 }, thickness: 1, color: rgb(0,0,0) });
        page.drawLine({ start: { x: 40, y: cursorY - 20 }, end: { x: 555, y: cursorY - 20 }, thickness: 1, color: rgb(0,0,0) });
        
        drawText('Before Change', 120, cursorY - 15, 10, helveticaBold);
        drawText('After Change', 400, cursorY - 15, 10, helveticaBold);
        
        drawText(ecnData.before_change || 'N/A', 45, cursorY - 40, 10);
        drawText(ecnData.after_change || 'N/A', 302, cursorY - 40, 10);
        
        cursorY -= 140;

        // Signatures (Block 11 Close)
        drawText('Official Status:', 40, cursorY, 12, helveticaBold);
        drawText(ecnData.process_status || 'N/A', 130, cursorY, 12, helveticaBold, rgb(0, 0.5, 0));
        
        cursorY -= 40;
        drawText('Closed By:', 40, cursorY, 10, helveticaBold);
        drawText(ecnData.closed_by_name || 'Pending', 100, cursorY, 10);
        
        drawText('Closed Date:', 350, cursorY, 10, helveticaBold);
        drawText(ecnData.closed_date ? moment(ecnData.closed_date).format('DD-MMM-YYYY HH:mm') : 'Pending', 420, cursorY, 10);

        // Serialize and trigger download
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${ecnData.ecn_no || 'ECN'}.pdf`;
        link.click();
        
        return true;
    } catch (error) {
        console.error("PDF Generation Error:", error);
        throw error;
    }
};
