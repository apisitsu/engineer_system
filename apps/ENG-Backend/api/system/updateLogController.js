const { engPool } = require('../../instance/eng_db');
const { spawn, exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const execPromise = util.promisify(exec);

const TRIGGER_EXPIRY_MINUTES = 5;
let lastCachedLog = '';

exports.getUpdateLogs = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);

        // Auto-expire stale TRIGGERED records
        // If the latest log is TRIGGERED and older than TRIGGER_EXPIRY_MINUTES, update it to ERROR
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
                            `UPDATE system_update_logs 
                             SET action_type = 'ERROR', 
                                 description = $1
                             WHERE id = $2 AND action_type = 'TRIGGERED'`,
                            [`Update trigger timed out after ${TRIGGER_EXPIRY_MINUTES} minutes — script may not have executed`, latest.id]
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
        const scriptPath = path.resolve(__dirname, '../../../../auto_update_and_run.ps1');
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
                const { stdout: logOut } = await execPromise('git log origin/main -n 1 --pretty=format:"%s"', { 
                    cwd: cwdPath,
                    timeout: 5000 
                });
                if (logOut) commitMsg = logOut.trim();
            } catch (e) {}

            await engPool.query(
                'INSERT INTO system_update_logs (action_type, description, triggered_by, commit_message) VALUES ($1, $2, $3, $4)',
                ['TRIGGERED', `Manual trigger by user ${req.user?.empno || 'unknown'}`, req.user?.empno || 'unknown', commitMsg]
            );
        } catch (logErr) {
            console.error('[UpdateLog] Failed to pre-log trigger:', logErr.message);
        }

        // Uses cmd.exe /c start with explicit window title to reliably create a new independent window 
        // that survives when the script kills port 2005 (this Node.js server).
        const child = spawn('cmd.exe', [
            '/c', 'start', 'EngineerSystem Auto Update', 'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath
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
        const execOptions = {
            cwd: cwdPath,
            timeout: 15000,
            env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: '0',
                GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=10'
            }
        };

        // Fetch latest from origin (graceful fallback if offline or unreachable)
        let fetchFailed = false;
        try {
            await execPromise('git -c core.askpass= -c connect.timeout=10 fetch origin main', execOptions);
        } catch (fetchErr) {
            fetchFailed = true;
            console.warn('[UpdateLog] Warning: git fetch origin main failed or timed out:', fetchErr.message);
        }

        // Resolve target local branch ref (main, with fallback to HEAD)
        let localRef = 'main';
        try {
            await execPromise('git rev-parse --verify main', { cwd: cwdPath, timeout: 5000 });
        } catch (e) {
            localRef = 'HEAD';
        }

        // Get hashes
        const { stdout: localHashRaw } = await execPromise(`git rev-parse ${localRef}`, { cwd: cwdPath, timeout: 5000 });
        let remoteHashRaw = '';
        try {
            const remoteRes = await execPromise('git rev-parse origin/main', { cwd: cwdPath, timeout: 5000 });
            remoteHashRaw = remoteRes.stdout;
        } catch (e) {}

        const localHash = localHashRaw.trim();
        const remoteHash = remoteHashRaw.trim();

        let hasUpdate = Boolean(remoteHash && localHash !== remoteHash);

        let commitsBehind = 0;
        let latestCommitMessage = '';
        let latestCommitAuthor = '';
        let latestCommitDate = '';

        if (hasUpdate) {
            try {
                const { stdout: logOut } = await execPromise(`git log ${localRef}..origin/main --pretty=format:"%H|%an|%ad|%s" --date=iso-strict -n 1`, { cwd: cwdPath, timeout: 5000 });
                if (logOut) {
                    const parts = logOut.trim().split('|');
                    if (parts.length >= 4) {
                        latestCommitAuthor = parts[1];
                        latestCommitDate = parts[2];
                        latestCommitMessage = parts.slice(3).join('|');
                    }
                }
            } catch (e) {}

            try {
                const { stdout: countOut } = await execPromise(`git rev-list --count ${localRef}..origin/main`, { cwd: cwdPath, timeout: 5000 });
                commitsBehind = parseInt(countOut.trim(), 10) || 0;
                hasUpdate = commitsBehind > 0;
            } catch (e) {}
        }

        res.json({
            success: true,
            hasUpdate,
            localHash,
            remoteHash,
            commitsBehind,
            latestCommitMessage,
            latestCommitAuthor,
            latestCommitDate,
            fetchFailed
        });
    } catch (err) {
        console.error('[ERROR] Error checking updates:', err);
        res.status(500).json({ success: false, message: 'Failed to check updates' });
    }
};

exports.getUpdateProgress = async (req, res) => {
    try {
        const logPath = path.resolve(__dirname, '../../../../update_progress_live.log');
        if (fs.existsSync(logPath)) {
            try {
                const content = fs.readFileSync(logPath, 'utf8');
                lastCachedLog = content;
                return res.json({ success: true, log: content });
            } catch (readErr) {
                // On Windows, if PowerShell Start-Transcript is actively writing, handle file contention gracefully
                if (readErr.code === 'EBUSY' || readErr.code === 'EPERM') {
                    return res.json({
                        success: true,
                        log: lastCachedLog ? `${lastCachedLog}\n[Streaming in progress...]` : 'Updating in progress...'
                    });
                }
                throw readErr;
            }
        } else {
            res.json({ success: true, log: 'Waiting for update process to start...' });
        }
    } catch (err) {
        console.error('[ERROR] Error reading update log:', err);
        // Fall back gracefully rather than crashing with 500 to preserve UI polling
        res.json({ success: true, log: lastCachedLog || 'Reading update progress...' });
    }
};
