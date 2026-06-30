const { engPool } = require('../../instance/eng_db');

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
