/**
 * draftController.js — HTTP controller for PDF auto-save draft endpoints.
 */
const fs = require('fs');
const draftService = require('../services/draftService');

/**
 * GET /draft — Check if a user has pending temporary drafts
 */
async function checkDraft(req, res) {
    try {
        const empno = req.query.empno || req.user?.empNo || req.user?.empno;
        if (!empno) {
            return res.status(400).json({ result: 'false', message: 'empno is required' });
        }

        const drafts = await draftService.listDrafts(empno);
        const hasDraft = drafts && drafts.length > 0;

        res.json({
            result: 'true',
            hasDraft,
            count: drafts.length,
            drafts: drafts.map(d => ({
                id: d.id,
                empno: d.empno,
                filename: d.filename,
                original_filename: d.original_filename,
                file_size: d.file_size,
                project_data: d.project_data,
                updated_at: d.updated_at
            })),
            draft: hasDraft ? {
                id: drafts[0].id,
                empno: drafts[0].empno,
                filename: drafts[0].filename,
                original_filename: drafts[0].original_filename,
                file_size: drafts[0].file_size,
                project_data: drafts[0].project_data,
                updated_at: drafts[0].updated_at
            } : null
        });
    } catch (err) {
        console.error('[DraftController] checkDraft error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * POST /draft — Save / update a temporary draft PDF
 */
async function saveDraft(req, res) {
    try {
        const empno = req.body.empno || req.user?.empNo || req.user?.empno;
        const filename = req.body.filename || req.file?.originalname || 'draft.pdf';
        const originalFilename = req.body.original_filename || req.body.originalFilename || filename;
        const projectData = req.body.project_data || req.body.projectData || null;

        if (!empno) {
            return res.status(400).json({ result: 'false', message: 'empno is required' });
        }

        let fileBuffer = null;
        if (req.file) {
            fileBuffer = fs.readFileSync(req.file.path);
            // Delete temp upload file created by multer
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {}
        } else if (req.body.fileBase64) {
            fileBuffer = Buffer.from(req.body.fileBase64, 'base64');
        } else {
            return res.status(400).json({ result: 'false', message: 'PDF file or fileBase64 is required' });
        }

        const saved = await draftService.saveDraft({
            empno,
            filename,
            originalFilename,
            buffer: fileBuffer,
            projectData
        });

        res.json({
            result: 'true',
            message: 'Draft auto-saved successfully',
            draft: saved
        });
    } catch (err) {
        console.error('[DraftController] saveDraft error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * POST /draft/annotations — Lightweight delta update of annotations JSON (~1ms)
 */
async function updateAnnotations(req, res) {
    try {
        const empno = req.body.empno || req.user?.empNo || req.user?.empno;
        const filename = req.body.filename || null;
        const projectData = req.body.project_data || req.body.projectData;

        if (!empno) {
            return res.status(400).json({ result: 'false', message: 'empno is required' });
        }

        const result = await draftService.updateDraftAnnotations({ empno, filename, projectData });
        if (!result.updated) {
            return res.status(404).json({ result: 'false', message: 'No active draft found. Please save base PDF first.' });
        }

        res.json({
            result: 'true',
            message: 'Draft annotations updated successfully',
            updated_at: result.updated_at
        });
    } catch (err) {
        console.error('[DraftController] updateAnnotations error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * GET /draft/download — Download / stream the temporary draft PDF
 * (Assembles with latest project_data if available)
 */
async function downloadDraft(req, res) {
    try {
        const empno = req.query.empno || req.user?.empNo || req.user?.empno;
        const filename = req.query.filename || null;

        if (!empno) {
            return res.status(400).json({ result: 'false', message: 'empno is required' });
        }

        const result = await draftService.getAssembledDraftPdf(empno, filename);
        if (!result) {
            return res.status(404).json({ result: 'false', message: 'Draft not found' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
        if (result.projectData && Buffer.byteLength(result.projectData, 'utf8') < 4000) {
            res.setHeader('X-Eng-Project-Data', Buffer.from(result.projectData, 'utf8').toString('base64'));
        }
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Eng-Project-Data');

        if (result.type === 'buffer') {
            res.send(result.buffer);
        } else {
            fs.createReadStream(result.filePath).pipe(res);
        }
    } catch (err) {
        console.error('[DraftController] downloadDraft error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

/**
 * DELETE /draft — Delete temporary draft(s) from server & SQLite DB
 */
async function deleteDraft(req, res) {
    try {
        const empno = req.query.empno || req.body.empno || req.user?.empNo || req.user?.empno;
        const filename = req.query.filename || req.body.filename || null;

        if (!empno) {
            return res.status(400).json({ result: 'false', message: 'empno is required' });
        }

        await draftService.deleteDraft(empno, filename);
        res.json({ result: 'true', message: 'Draft deleted successfully' });
    } catch (err) {
        console.error('[DraftController] deleteDraft error:', err.message);
        res.status(500).json({ result: 'false', message: err.message });
    }
}

module.exports = {
    checkDraft,
    saveDraft,
    updateAnnotations,
    downloadDraft,
    deleteDraft
};
