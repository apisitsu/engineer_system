/**
 * kanban_settings.js
 * API for global Kanban Admin Settings
 */
const { engPool } = require('../../instance/eng_db');

// Middleware สำหรับเช็คสิทธิ์ Admin
const checkAdminRole = (req, res, next) => {
    // Check if the user is a super admin based on isSuperAdmin logic from kanban_acl if needed, 
    // or rely on req.user.role if it's set. 
    // Let's import kanban_acl's isSuperAdmin for robust check.
    const { isSuperAdmin } = require('./kanban_acl');
    isSuperAdmin(req).then(isAdmin => {
        if (!isAdmin) {
            return res.status(403).json({ error: 'Access Denied. System Admin role required.' });
        }
        next();
    }).catch(err => {
        console.error('Admin check error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    });
};

// GET /api/kanban/settings
const GetSettings = async (req, res) => {
    try {
        const { rows } = await engPool.query('SELECT * FROM kb_system_settings ORDER BY category, setting_key');
        res.json({ data: rows });
    } catch (err) {
        console.error('GetSettings Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/kanban/settings
const UpdateSettings = async (req, res) => {
    const { settings } = req.body; // Expects: { settings: [{ key: '...', value: '...' }] }
    if (!Array.isArray(settings)) return res.status(400).json({ error: 'Invalid payload format' });

    const client = await engPool.connect();
    try {
        await client.query('BEGIN');
        for (const item of settings) {
            await client.query(
                'UPDATE kb_system_settings SET setting_value = $1 WHERE setting_key = $2',
                [String(item.value), item.key]
            );
        }
        await client.query('COMMIT');
        res.json({ message: 'Settings updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('UpdateSettings Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

module.exports = {
    checkAdminRole,
    GetSettings,
    UpdateSettings
};
