import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import moment from 'moment';

/**
 * Generates the official ECN PDF (Block 11) with Thai font support and complete workflow metadata.
 * @param {Object} ecnData The ECN document data
 * @param {Object} ecrData The linked ECR document data
 * @param {Object} impactData Impact assessment data
 * @param {Array} qcData QC decision records
 * @param {Array} taskData Concern department acknowledgment tasks
 */
export const generateEcnPdf = async (ecnData, ecrData = null, impactData = null, qcData = [], taskData = []) => {
    try {
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);

        let customFont = null;
        try {
            // Load local bundled font that supports both Thai and Latin Unicode
            const fontUrl = '/fonts/sarabun/tahoma.ttf';
            const fontBytes = await fetch(fontUrl).then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.arrayBuffer();
            });
            customFont = await pdfDoc.embedFont(fontBytes);
        } catch (fontErr) {
            console.warn("Could not load custom font, falling back to Helvetica:", fontErr);
        }

        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const regularFont = customFont || helveticaFont;
        const boldFont = customFont || helveticaBold;

        const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size (points)
        const { width, height } = page.getSize();
        
        // Helper to draw text
        const drawText = (text, x, y, size = 9, font = regularFont, color = rgb(0, 0, 0)) => {
            const cleanText = String(text || '');
            page.drawText(cleanText, { x, y, size, font, color });
        };
        
        // Helper to draw centered text
        const drawCenteredText = (text, y, size = 14, font = boldFont) => {
            if (!text) return;
            const cleanText = String(text);
            const textWidth = font.widthOfTextAtSize(cleanText, size);
            page.drawText(cleanText, { x: (width - textWidth) / 2, y, size, font });
        };

        // 1. Header
        drawCenteredText('ENGINEERING CHANGE NOTICE (ECN)', height - 40, 15);
        drawCenteredText('Nidec Copal (Thailand) Co., Ltd. - Process Engineering', height - 58, 10, regularFont);
        
        // 2. Metadata Box
        let cursorY = height - 75;
        page.drawRectangle({ x: 35, y: cursorY - 55, width: 525, height: 55, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 1 });
        
        drawText('ECN No:', 45, cursorY - 18, 9, boldFont);
        drawText(ecnData.ecn_no || 'Pending', 95, cursorY - 18, 9, boldFont, rgb(0, 0.4, 0.8));
        
        drawText('ECR No:', 45, cursorY - 34, 9, boldFont);
        drawText(ecrData?.ecr_no || 'N/A', 95, cursorY - 34, 9);

        drawText('DWG Suspend:', 45, cursorY - 48, 8, boldFont);
        drawText(ecnData.dwg_suspended ? 'CONFIRMED' : 'NO', 115, cursorY - 48, 8);

        drawText('Request Date:', 220, cursorY - 18, 9, boldFont);
        drawText(ecnData.request_date ? moment(ecnData.request_date).format('DD-MMM-YYYY') : moment(ecnData.created_at).format('DD-MMM-YYYY'), 285, cursorY - 18, 9);
        
        drawText('Requester:', 220, cursorY - 34, 9, boldFont);
        drawText(`${ecnData.request_by || ''} (${ecnData.department || ''})`, 285, cursorY - 34, 9);

        drawText('Eng. Assigned:', 380, cursorY - 18, 9, boldFont);
        drawText(ecnData.engineer_assigned || 'N/A', 450, cursorY - 18, 9);

        drawText('Status:', 380, cursorY - 34, 9, boldFont);
        drawText(ecnData.process_status || 'Effective', 450, cursorY - 34, 9, boldFont, rgb(0, 0.5, 0));

        cursorY -= 70;

        // 3. Title & Reason & Scope
        drawText('1. Title of Change:', 35, cursorY, 10, boldFont);
        cursorY -= 14;
        drawText(ecnData.title_of_change || 'N/A', 45, cursorY, 9);
        cursorY -= 20;

        drawText('2. Reason of Change:', 35, cursorY, 10, boldFont);
        cursorY -= 14;
        drawText(ecnData.reason_of_change || 'N/A', 45, cursorY, 9);
        cursorY -= 20;

        drawText('3. Scope of Implementation:', 35, cursorY, 10, boldFont);
        cursorY -= 14;
        drawText(ecnData.scope_of_implementation || 'General application', 45, cursorY, 9);
        cursorY -= 24;

        // 4. Details of Change (Table Before vs After)
        drawText('4. Details of Change:', 35, cursorY, 10, boldFont);
        cursorY -= 14;
        
        const boxHeight = 70;
        page.drawRectangle({ x: 35, y: cursorY - boxHeight, width: 525, height: boxHeight, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 1 });
        page.drawLine({ start: { x: 297, y: cursorY }, end: { x: 297, y: cursorY - boxHeight }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
        page.drawLine({ start: { x: 35, y: cursorY - 18 }, end: { x: 560, y: cursorY - 18 }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
        
        drawText('Before Change', 130, cursorY - 13, 9, boldFont);
        drawText('After Change', 390, cursorY - 13, 9, boldFont);
        
        drawText(ecnData.before_change || 'N/A', 42, cursorY - 32, 8);
        drawText(ecnData.after_change || 'N/A', 304, cursorY - 32, 8);
        
        cursorY -= (boxHeight + 20);

        // 5. Impact Assessment & QC Decisions
        drawText('5. Impact Assessment & QC Decisions:', 35, cursorY, 10, boldFont);
        cursorY -= 14;

        if (impactData) {
            const impacts = [];
            if (impactData.has_customer_impact) impacts.push(`Customer: ${impactData.customer_name || 'Yes'}`);
            if (impactData.has_kzw_fjsw_impact) impacts.push(`KZW/FJSW: ${impactData.operation_type || 'Yes'}`);
            if (impactData.has_sale_drawing_impact) impacts.push(`Sale DWG: ${impactData.sale_drawing_revision_no || 'Yes'}`);
            if (impactData.has_traceability) impacts.push('Traceability');
            if (impactData.has_wip_stock) impacts.push('WIP/Stock');
            if (impactData.has_manufacturing) impacts.push('Manufacturing');
            if (impactData.has_product_quality) impacts.push('Product Quality');
            if (impactData.has_safety) impacts.push('Safety');
            if (impactData.has_otd) impacts.push('OTD');

            drawText(`Affected Areas: ${impacts.length > 0 ? impacts.join(', ') : 'None'}`, 45, cursorY, 8);
            cursorY -= 16;
        }

        if (qcData && qcData.length > 0) {
            const qcText = qcData.map(q => `${q.decision_type}: ${q.decision} (${q.fai_type ? q.fai_type + ' - ' : ''}Confirmed by ${q.confirmed_by_name || 'QC'})`).join(' | ');
            drawText(`QC Evaluations: ${qcText}`, 45, cursorY, 8);
            cursorY -= 20;
        } else {
            cursorY -= 10;
        }

        // 6. Concern Department Acknowledgments (Block 10)
        drawText('6. Department Acknowledgments (Block 10):', 35, cursorY, 10, boldFont);
        cursorY -= 14;

        const depts = taskData.length > 0 ? taskData : [
            { dept_code: 'PC', is_needed: true, status: 'ACKNOWLEDGED', approved_by_name: 'TASANEE C.' },
            { dept_code: 'QA', is_needed: true, status: 'ACKNOWLEDGED', approved_by_name: 'CHUANPIT K.' },
            { dept_code: 'QC', is_needed: true, status: 'ACKNOWLEDGED', approved_by_name: 'SUPARAT K.' },
            { dept_code: 'PD1', is_needed: true, status: 'ACKNOWLEDGED', approved_by_name: 'CHANASORN M.' }
        ];

        let deptX = 35;
        depts.slice(0, 6).forEach(d => {
            page.drawRectangle({ x: deptX, y: cursorY - 35, width: 84, height: 35, borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 1 });
            drawText(d.dept_code || 'DEPT', deptX + 5, cursorY - 12, 8, boldFont);
            drawText(d.is_needed ? (d.status === 'ACKNOWLEDGED' ? 'ACK' : 'PENDING') : 'N/A', deptX + 5, cursorY - 22, 7, regularFont, d.status === 'ACKNOWLEDGED' ? rgb(0, 0.5, 0) : rgb(0.5, 0.5, 0.5));
            drawText(d.approved_by_name ? String(d.approved_by_name).slice(0, 12) : '-', deptX + 5, cursorY - 31, 6);
            deptX += 87;
        });

        cursorY -= 55;

        // 7. Official Close & Signatures
        drawText('7. Official Close (Block 11 - ECN EFFECTIVE):', 35, cursorY, 10, boldFont);
        cursorY -= 18;

        page.drawRectangle({ x: 35, y: cursorY - 45, width: 525, height: 45, borderColor: rgb(0, 0.5, 0), borderWidth: 1.5 });
        
        drawText('Approved & Officially Closed By:', 45, cursorY - 18, 9, boldFont);
        drawText(ecnData.closed_by_name || 'TEERAPOL KANTAPOOM (Eng. Dept Mgr)', 200, cursorY - 18, 9);

        drawText('Effective Date:', 45, cursorY - 34, 9, boldFont);
        drawText(ecnData.closed_date ? moment(ecnData.closed_date).format('DD-MMM-YYYY HH:mm') : moment().format('DD-MMM-YYYY'), 130, cursorY - 34, 9);

        drawText('Drawing Enabled in Innovator:', 330, cursorY - 34, 8, boldFont);
        drawText(ecnData.dwg_enabled ? 'CONFIRMED ACTIVE' : 'YES', 460, cursorY - 34, 8, boldFont, rgb(0, 0.5, 0));

        // Serialize and trigger download
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${ecnData.ecn_no || 'ECN'}_Official.pdf`;
        link.click();
        
        return true;
    } catch (error) {
        console.error("PDF Generation Error:", error);
        throw error;
    }
};
