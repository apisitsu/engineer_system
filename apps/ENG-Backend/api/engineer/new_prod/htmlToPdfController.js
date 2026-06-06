const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { engPool } = require('../../../instance/eng_db');
const { spawn } = require('child_process');

const UPLOAD_DIR = path.join(__dirname, '../../../../uploads/html_to_pdf');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const pythonScriptPath = path.join(__dirname, 'html_to_pdf.py');

// Function to cleanup old jobs if user exceeds 20 files
const cleanupOldJobs = async (user_id) => {
    try {
        const res = await engPool.query(`
            SELECT id, input_file_path, output_pdf_path 
            FROM newprod_html_to_pdf_jobs 
            WHERE user_id = $1 AND (input_file_path IS NOT NULL OR output_pdf_path IS NOT NULL)
            ORDER BY created_at DESC 
            OFFSET 20
        `, [user_id]);

        if (res.rows.length > 0) {
            const idsToUpdate = res.rows.map(row => row.id);

            // Delete physical files
            res.rows.forEach(row => {
                if (row.input_file_path && fs.existsSync(row.input_file_path)) {
                    try { fs.unlinkSync(row.input_file_path); } catch (e) { console.error(e); }
                }
                if (row.output_pdf_path && fs.existsSync(row.output_pdf_path)) {
                    try { fs.unlinkSync(row.output_pdf_path); } catch (e) { console.error(e); }
                }
            });

            // Update DB to mark files as deleted
            await engPool.query(`
                UPDATE newprod_html_to_pdf_jobs 
                SET input_file_path = NULL, 
                    output_pdf_path = NULL, 
                    condition = 'Expired',
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ANY($1::int[])
            `, [idsToUpdate]);

            console.log(`Cleaned up physical files for ${idsToUpdate.length} old jobs for user ${user_id}`);
        }
    } catch (err) {
        console.error('Error in cleanupOldJobs:', err);
    }
};

const extractDataField = (html, fieldName) => {
    const regex = new RegExp(`data-field="${fieldName}"[^>]*>`, 'i');
    const match = html.match(regex);
    if (match) {
        const tag = match[0];
        if (tag.includes('value=')) {
            const valMatch = tag.match(/value=["']([^"']*)["']/i);
            if (valMatch) return valMatch[1].trim();
        }
        const innerTextRegex = new RegExp(`data-field="${fieldName}"[^>]*>([^<]*)<`, 'i');
        const innerMatch = html.match(innerTextRegex);
        if (innerMatch) return innerMatch[1].trim();
    }
    return null;
};

const uploadJob = async (req, res) => {
    try {
        console.log("--- New HTML to PDF Upload Request ---");
        console.log("req.body:", req.body);
        console.log("req.files:", req.files ? Object.keys(req.files) : 'none');

        if (!req.files || !req.files.file) {
            console.error("No file found in req.files");
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const uploadedFile = req.files.file;
        const user_id = req.user?.empno || req.body.empno || 'Unknown';
        const originalName = uploadedFile.name.replace('.html', '').replace('.HTML', '');

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const newFilename = 'file-' + uniqueSuffix + path.extname(uploadedFile.name);
        const inputFilePath = path.join(UPLOAD_DIR, newFilename);

        console.log(`Saving file ${uploadedFile.name} to ${inputFilePath}`);

        // Save the file
        await uploadedFile.mv(inputFilePath);

        // Extract metadata from HTML
        let dwgNo = originalName;
        let dwgRev = '---';
        try {
            const htmlContent = fs.readFileSync(inputFilePath, 'utf8');
            const extractedDwgNo = extractDataField(htmlContent, 'DWGNO');
            const extractedRev = extractDataField(htmlContent, 'DWGREV');
            if (extractedDwgNo) dwgNo = extractedDwgNo;
            if (extractedRev) dwgRev = extractedRev;
            console.log(`Extracted metadata -> DWGNO: ${dwgNo}, REV: ${dwgRev}`);
        } catch (e) {
            console.error('Error extracting metadata from HTML', e);
        }

        const insertResult = await engPool.query(
            `INSERT INTO newprod_html_to_pdf_jobs 
             (user_id, cn, rev, source, status, condition, input_file_path) 
             VALUES ($1, $2, $3, 'MANUAL', 'Running SmartExchange', '-', $4) RETURNING id`,
            [user_id, dwgNo, dwgRev, inputFilePath]
        );

        const jobId = insertResult.rows[0].id;
        console.log(`Job created in DB with ID: ${jobId}`);

        // Trigger background job
        runHtmlToPdfBackground(jobId, inputFilePath, originalName);

        // Trigger cleanup async
        cleanupOldJobs(user_id);

        res.json({ success: true, jobId, message: 'Job started' });
    } catch (err) {
        console.error('Error during uploadJob:', err);
        res.status(500).json({ error: err.message || 'Server error' });
    }
};

const runHtmlToPdfBackground = (jobId, inputFilePath, originalName) => {
    console.log(`Starting background Python process for Job ID ${jobId}`);

    // the python script generates a file named `<input_file_path_without_ext>_output.pdf`
    const parsedPath = path.parse(inputFilePath);
    const expectedOutputPdf = path.join(parsedPath.dir, `${parsedPath.name}_output.pdf`);

    // run python
    const pyProcess = spawn('python', [pythonScriptPath, '-i', inputFilePath]);

    let outputLog = '';

    pyProcess.stdout.on('data', (data) => {
        outputLog += data.toString();
        // optionally log to console
        console.log(`[Python Job ${jobId}]: ${data.toString().trim()}`);
    });

    pyProcess.stderr.on('data', (data) => {
        outputLog += data.toString();
        console.error(`[Python Job ${jobId} ERROR]: ${data.toString().trim()}`);
    });

    pyProcess.on('error', async (err) => {
        console.error(`[Python Job ${jobId} ERROR EVENT]:`, err);
        try {
            await engPool.query(
                `UPDATE newprod_html_to_pdf_jobs SET status = 'Error', error = $1, condition = 'Failed', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [`Process error: ${err.message}`, jobId]
            );
        } catch (dbErr) {
            console.error('Error updating job status on process error:', dbErr);
        }
    });

    pyProcess.on('close', async (code) => {
        console.log(`Python process for Job ID ${jobId} exited with code ${code}`);
        try {
            if (code === 0 && fs.existsSync(expectedOutputPdf)) {
                await engPool.query(
                    `UPDATE newprod_html_to_pdf_jobs SET status = 'Done', condition = 'Revised', output_pdf_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                    [expectedOutputPdf, jobId]
                );
            } else {
                await engPool.query(
                    `UPDATE newprod_html_to_pdf_jobs SET status = 'Failed', error = $1, condition = 'Failed', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                    [`Process exited with code ${code}. Check logs.`, jobId]
                );
            }
        } catch (err) {
            console.error('Error updating job status:', err);
        }
    });
};

const getJobs = async (req, res) => {
    const { user_id } = req.query;
    try {
        let query = `SELECT id, user_id, cn, rev, source, status, condition, error, created_at, updated_at FROM newprod_html_to_pdf_jobs`;
        let params = [];
        if (user_id) {
            query += ` WHERE user_id = $1`;
            params.push(user_id);
        }
        query += ` ORDER BY created_at DESC LIMIT 100`;

        const result = await engPool.query(query, params);
        res.json({ jobs: result.rows });
    } catch (err) {
        console.error('Error fetching jobs:', err);
        res.status(500).json({ error: 'Database error' });
    }
};

const downloadPdf = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await engPool.query(`SELECT output_pdf_path, cn, rev FROM newprod_html_to_pdf_jobs WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const { output_pdf_path, cn, rev } = result.rows[0];
        if (!output_pdf_path || !fs.existsSync(output_pdf_path)) {
            return res.status(404).json({ error: 'PDF file not found or not ready yet' });
        }

        const downloadFileName = `${cn}_${rev}.pdf`;
        res.download(output_pdf_path, downloadFileName);
    } catch (err) {
        console.error('Error downloading PDF:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const downloadHtml = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await engPool.query(`SELECT input_file_path, cn FROM newprod_html_to_pdf_jobs WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const { input_file_path, cn } = result.rows[0];
        if (!input_file_path || !fs.existsSync(input_file_path)) {
            return res.status(404).json({ error: 'HTML file not found' });
        }

        res.download(input_file_path, `${cn}.HTML`);
    } catch (err) {
        console.error('Error downloading HTML:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const deleteJob = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await engPool.query(`SELECT input_file_path, output_pdf_path FROM newprod_html_to_pdf_jobs WHERE id = $1`, [id]);
        if (result.rows.length > 0) {
            const row = result.rows[0];
            if (row.input_file_path && fs.existsSync(row.input_file_path)) fs.unlinkSync(row.input_file_path);
            if (row.output_pdf_path && fs.existsSync(row.output_pdf_path)) fs.unlinkSync(row.output_pdf_path);
        }
        await engPool.query(`DELETE FROM newprod_html_to_pdf_jobs WHERE id = $1`, [id]);
        res.json({ success: true, message: 'Job deleted' });
    } catch (err) {
        console.error('Error deleting job:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const deleteAllJobs = async (req, res) => {
    try {
        if (fs.existsSync(UPLOAD_DIR)) {
            const files = fs.readdirSync(UPLOAD_DIR);
            for (const file of files) {
                try { fs.unlinkSync(path.join(UPLOAD_DIR, file)); } catch (e) { }
            }
        }
        await engPool.query(`TRUNCATE TABLE newprod_html_to_pdf_jobs`);
        res.json({ success: true, message: 'All jobs and files deleted' });
    } catch (err) {
        console.error('Error deleting all jobs:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

const reworkJob = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await engPool.query(`SELECT input_file_path, cn FROM newprod_html_to_pdf_jobs WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });

        const { input_file_path, cn } = result.rows[0];
        if (!input_file_path || !fs.existsSync(input_file_path)) {
            return res.status(404).json({ error: 'Source HTML file missing, cannot rework' });
        }

        await engPool.query(
            `UPDATE newprod_html_to_pdf_jobs SET status = 'Running SmartExchange', error = NULL, condition = '-', output_pdf_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [id]
        );

        runHtmlToPdfBackground(id, input_file_path, cn);
        res.json({ success: true, message: 'Job restarted' });
    } catch (err) {
        console.error('Error reworking job:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    uploadJob,
    getJobs,
    downloadPdf,
    downloadHtml,
    deleteJob,
    deleteAllJobs,
    reworkJob
};
