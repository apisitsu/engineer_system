const { engPool } = require('../../instance/eng_db');
const { spawn, exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const execPromise = util.promisify(exec);

const TRIGGER_EXPIRY_MINUTES = 5;

exports.getUpdateLogs = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 100;

        // Auto-expire stale TRIGGERED records
        // If the latest log is TRIGGERED and older than TRIGGER_EXPIRY_MINUTES, mark it as ERROR
        try {
            const staleCheck = await engPool.query(
                `SELECT id, action_type, executed_at FROM system_update_logs
                 ORDER BY executed_at DESC LIMIT 1`
            );
            if (staleCheck.rows.length > 0) {
                const latest = staleCheck.rows[0];
                if (latest.action_type === 'TRIGGERED') {
                    const ageMs = Date.now() - new Date(latest.executed_at).getTime();
                    if (ageMs > TRIGGER_EXPIRY_MINUTES * 60 * 1000) {
                        await engPool.query(
                            `INSERT INTO system_update_logs (action_type, description, triggered_by)
                             VALUES ($1, $2, $3)`,
                            ['ERROR', `Update trigger timed out after ${TRIGGER_EXPIRY_MINUTES} minutes — script may not have executed`, 'system']
                        );
                        console.log('[UpdateLog] Auto-expired stale TRIGGERED record (id:', latest.id, ')');
                    }
                }
            }
        } catch (expireErr) {
            console.error('[UpdateLog] Error checking stale triggers:', expireErr.message);
        }

        const result = await engPool.query(
            'SELECT * FROM system_update_logs ORDER BY executed_at DESC LIMIT $1',
            [limit]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[ERROR] Error fetching update logs:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch update logs' });
    }
};

exports.triggerUpdate = async (req, res) => {
    try {
        const scriptPath = path.resolve(__dirname, '../../../../auto_update_and_run.cmd');
        const cwdPath = path.resolve(__dirname, '../../../../');

        // Validate script exists
        if (!fs.existsSync(scriptPath)) {
            console.error('[UpdateLog] Script not found:', scriptPath);
            return res.status(500).json({ success: false, message: `Update script not found: ${scriptPath}` });
        }

        // Pre-log to DB so the user always sees that a trigger happened
        try {
            let commitMsg = 'Manual trigger';
            try {
                const { stdout: logOut } = await execPromise('git log origin/main -n 1 --pretty=format:"%s"', { cwd: cwdPath });
                commitMsg = logOut.trim();
            } catch (e) {}

            await engPool.query(
                'INSERT INTO system_update_logs (action_type, description, triggered_by, commit_message) VALUES ($1, $2, $3, $4)',
                ['TRIGGERED', `Manual trigger by user ${req.user?.empno || 'unknown'}`, req.user?.empno || 'unknown', commitMsg]
            );
        } catch (logErr) {
            console.error('[UpdateLog] Failed to pre-log trigger:', logErr.message);
        }

        // Spawn the batch file in a fully detached window.
        // Uses PowerShell Start-Process to create a new independent window 
        // that survives when the batch file kills port 2005 (this Node.js server).
        const child = spawn('powershell.exe', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
            `Start-Process -FilePath '${scriptPath}' -WorkingDirectory '${cwdPath}'`
        ], {
            detached: true,
            stdio: 'ignore',
            cwd: cwdPath
        });

        child.on('error', (err) => {
            console.error('[UpdateLog] Failed to spawn update process:', err);
        });

        child.unref();

        console.log('[UpdateLog] Update triggered by', req.user?.empno, '- script:', scriptPath);
        res.json({ success: true, message: 'Update process started successfully. Server will restart shortly.' });
    } catch (err) {
        console.error('[ERROR] Error triggering update:', err);
        res.status(500).json({ success: false, message: 'Failed to trigger update' });
    }
};

exports.checkUpdates = async (req, res) => {
    try {
        const cwdPath = path.resolve(__dirname, '../../../../');
        
        // Fetch latest from origin
        await execPromise('git fetch origin main', { cwd: cwdPath });
        
        // Get hashes
        const { stdout: localHashRaw } = await execPromise('git rev-parse HEAD', { cwd: cwdPath });
        const { stdout: remoteHashRaw } = await execPromise('git rev-parse origin/main', { cwd: cwdPath });
        
        const localHash = localHashRaw.trim();
        const remoteHash = remoteHashRaw.trim();
        
        let hasUpdate = localHash !== remoteHash;
        
        let commitsBehind = 0;
        let latestCommitMessage = '';
        let latestCommitAuthor = '';
        let latestCommitDate = '';
        
        if (hasUpdate) {
            const { stdout: logOut } = await execPromise('git log HEAD..origin/main --pretty=format:"%H|%an|%ad|%s" --date=iso-strict -n 1', { cwd: cwdPath });
            if (logOut) {
                const parts = logOut.trim().split('|');
                if (parts.length >= 4) {
                    latestCommitAuthor = parts[1];
                    latestCommitDate = parts[2];
                    latestCommitMessage = parts.slice(3).join('|');
                }
            }
            const { stdout: countOut } = await execPromise('git rev-list --count HEAD..origin/main', { cwd: cwdPath });
            commitsBehind = parseInt(countOut.trim(), 10) || 0;
            hasUpdate = commitsBehind > 0;
        }
        
        res.json({
            success: true,
            hasUpdate,
            localHash,
            remoteHash,
            commitsBehind,
            latestCommitMessage,
            latestCommitAuthor,
            latestCommitDate
        });
    } catch (err) {
        console.error('[ERROR] Error checking updates:', err);
        res.status(500).json({ success: false, message: 'Failed to check updates' });
    }
};
