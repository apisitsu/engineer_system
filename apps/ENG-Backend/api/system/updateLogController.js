const { engPool } = require('../../instance/eng_db');
const { spawn } = require('child_process');
const path = require('path');

exports.getUpdateLogs = async (req, res) => {
    console.log('[DEBUG] getUpdateLogs called by user:', req.user?.empno);
    try {
        const limit = parseInt(req.query.limit, 10) || 100;
        const result = await engPool.query(
            'SELECT * FROM system_update_logs ORDER BY executed_at DESC LIMIT $1',
            [limit]
        );
        console.log('[DEBUG] getUpdateLogs fetched rows:', result.rows.length);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[ERROR] Error fetching update logs:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch update logs' });
    }
};

exports.triggerUpdate = async (req, res) => {
    try {
        console.log('[DEBUG] triggerUpdate called by user:', req.user?.empno);
        const scriptPath = path.resolve(__dirname, '../../../../auto_update_and_run.cmd');
        const cwdPath = path.resolve(__dirname, '../../../../');
        
        // Spawn the batch file detached so it can kill the node process without getting killed itself
        const child = spawn('cmd.exe', ['/c', scriptPath], {
            detached: true,
            stdio: 'ignore',
            cwd: cwdPath
        });
        
        child.unref();

        res.json({ success: true, message: 'Update process started successfully. Server will restart shortly.' });
    } catch (err) {
        console.error('[ERROR] Error triggering update:', err);
        res.status(500).json({ success: false, message: 'Failed to trigger update' });
    }
};
