/**
 * Activity Tracking Controller
 * 
 * Provides endpoints for:
 *   - Page visit tracking (fire-and-forget from frontend)
 *   - Session management (start, heartbeat, end)
 *   - Admin queries (logs, stats, per-user history)
 * 
 * Module is auto-detected from URL path — no code changes needed for new pages.
 */

const express = require('express');
const router = express.Router();
const { engPool } = require('../../instance/eng_db');

// ── Helpers ──────────────────────────────────────────────────────────────────

// Schema Auto-Migration for user_session_log
const initActivitySchema = async () => {
    try {
        await engPool.query(`
            ALTER TABLE user_session_log
                ADD COLUMN IF NOT EXISTS current_path VARCHAR(500),
                ADD COLUMN IF NOT EXISTS current_page_title VARCHAR(200),
                ADD COLUMN IF NOT EXISTS current_module VARCHAR(100);
        `);
    } catch (err) {
        console.error('[Activity] Schema init error:', err.message);
    }
};
initActivitySchema();

/**
 * Extract module name from a route path automatically.
 */
function extractModule(routePath) {
    if (!routePath || routePath === '/') return 'root';
    const match = routePath.match(/^\/eng\/([^/]+)/);
    if (match) return match[1];
    // Fallback: first segment after leading /
    const fallback = routePath.replace(/^\//, '').split('/')[0];
    return fallback || 'general';
}

/**
 * Map route path to human-readable Thai/English page title.
 */
function getReadablePageTitle(routePath) {
    if (!routePath || routePath === '/') return 'Sign In / Landing';
    if (routePath === '/home') return 'General Home';
    if (routePath === '/eng/home') return 'Engineer Home';
    if (routePath === '/user/settings') return 'User Settings';

    // MTC Engineer
    if (routePath.includes('/mtc_eng/sds-v2-admin')) return 'MTC: SDS V2 Admin';
    if (routePath.includes('/mtc_eng/sds-v2')) return 'MTC: SDS V2';
    if (routePath.includes('/mtc_eng/sds-template-config')) return 'MTC: SDS Template Config';
    if (routePath.includes('/mtc_eng/sds-coverage')) return 'MTC: SDS Coverage Report';
    if (routePath.includes('/mtc_eng/tooling-inspect-result-dashboard')) return 'MTC: Inspection Dashboard';
    if (routePath.includes('/mtc_eng/tooling-inspect')) return 'MTC: Tooling Inspection';
    if (routePath.includes('/mtc_eng/tooling-select-v2')) return 'MTC: Tooling Select V2';
    if (routePath.includes('/mtc_eng/tooling-management')) return 'MTC: Tool Inventory';
    if (routePath.includes('/mtc_eng/spec-process')) return 'MTC: Spec Process Management';
    if (routePath.includes('/mtc_eng/tool-request')) return 'MTC: Tool Request';
    if (routePath.includes('/mtc_eng/cn-enable')) return 'MTC: CN Enable';
    if (routePath.includes('/mtc_eng/cam')) return 'MTC: CAM Operations';
    if (routePath.startsWith('/eng/mtc_eng') || routePath.startsWith('/eng/mtc')) return 'MTC Engineer';

    // Process Engineer
    if (routePath.includes('/process_eng/ecnt_v2')) return 'Process: ECNT V2 Approval';
    if (routePath.includes('/process_eng/ecnt/dashboard')) return 'Process: ECNT Dashboard';
    if (routePath.includes('/process_eng/ecnt/tasks')) return 'Process: ECNT Tasks';
    if (routePath.includes('/process_eng/ecnt/history')) return 'Process: ECNT History';
    if (routePath.includes('/process_eng/tumble')) return 'Process: Tumble System';
    if (routePath.startsWith('/eng/process_eng')) return 'Process Engineer';

    // Kanban
    if (routePath.includes('/kanban/guide')) return 'Kanban: User Guide';
    if (routePath.startsWith('/eng/kanban')) return 'Kanban Board';

    // New Product Engineer & PDF Tools
    if (routePath.includes('/pdf_merger_tool')) return 'PDF Merger Tool';
    if (routePath.includes('/html-to-pdf')) return 'HTML to PDF Converter';
    if (routePath.includes('/compare_pdf')) return 'Compare PDF Tool';
    if (routePath.startsWith('/eng/newprod_eng')) return 'New Product Engineer';

    // Materials Engineer
    if (routePath.startsWith('/eng/materials_eng')) return 'Materials Engineer';

    // System Engineer
    if (routePath.includes('/system_eng/activity-dashboard')) return 'System: Activity Dashboard';
    if (routePath.includes('/system_eng/user_management')) return 'System: User Management';
    if (routePath.includes('/system_eng/tool/update-logs')) return 'System: Update Logs';
    if (routePath.includes('/system_eng/tool/gallery')) return 'System: Tool Gallery';
    if (routePath.includes('/system_eng/tool/pdf-to-image')) return 'System: PDF to Image';
    if (routePath.startsWith('/eng/system_eng')) return 'System Engineer';

    // Overall Engineer & Viewer
    if (routePath.includes('/overall_eng/eng-record') || routePath.includes('/viewer/eng-record')) return 'Overall: Engineer Record';
    if (routePath.startsWith('/eng/overall_eng')) return 'Overall Engineer';

    // General Tools & PDF Hub
    if (routePath.includes('/pdf-hub')) return 'PDF Hub';
    if (routePath.includes('/dwg_check')) return 'DWG Check Tool';
    if (routePath.includes('/fea_simulation')) return 'FEA Simulation';
    if (routePath.includes('/bushing_configurator')) return 'Bushing Configurator';
    if (routePath.includes('/template_tool')) return 'Template Tool';
    if (routePath.includes('/calculators')) return 'Engineering Calculators';
    if (routePath.includes('/3d_pdf')) return '3D PDF & CAD Viewer';

    // Fallback: format path prettily
    const parts = routePath.replace(/^\//, '').split('/').filter(Boolean);
    if (parts.length === 0) return 'Home';
    return parts.map(p => p.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' > ');
}

/**
 * Safely extract and sanitize client IP from request.
 * - Strips IPv6 zone IDs (e.g. %12, %eth0) which PostgreSQL inet doesn't support
 * - Converts IPv6-mapped IPv4 (::ffff:192.168.1.1) to plain IPv4
 */
function getClientIp(req) {
    let ip;
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        ip = forwarded.split(',')[0].trim();
    } else {
        ip = req.socket?.remoteAddress || req.ip || null;
    }

    if (!ip) return null;

    // Strip IPv6 zone ID suffix (e.g. "fe80::1%12" → "fe80::1")
    ip = ip.replace(/%[^%]*$/, '');

    // Convert IPv6-mapped IPv4 to plain IPv4 (e.g. "::ffff:192.168.1.1" → "192.168.1.1")
    if (ip.startsWith('::ffff:')) {
        ip = ip.slice(7);
    }

    return ip;
}

// ── Track Page Visit ─────────────────────────────────────────────────────────

/**
 * POST /api/activity/track
 * Body: { path, title, referrer, sessionId }
 * 
 * Fire-and-forget from frontend — always returns 200 quickly.
 */
router.post('/track', async (req, res) => {
    // Respond immediately so frontend isn't blocked
    res.json({ ok: true });

    try {
        const { path: pagePath, title, referrer, sessionId } = req.body;
        if (!pagePath) return;

        const user = req.user || {};
        const module = extractModule(pagePath);
        const ip = getClientIp(req);
        const ua = req.headers['user-agent'] || null;
        const cleanTitle = (title && title !== 'ENGINEER-RODEND') ? title : getReadablePageTitle(pagePath);

        await engPool.query(
            `INSERT INTO user_activity_log
                (empno, user_name, department, path, page_title, module, referrer_path, session_id, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::inet, $10)`,
            [
                user.empno || 'anonymous',
                user.name || null,
                user.department || null,
                pagePath,
                cleanTitle,
                module,
                referrer || null,
                sessionId || null,
                ip,
                ua
            ]
        );

        // Also update session's page count, last_active_at, and current page if session exists
        if (sessionId) {
            await engPool.query(
                `UPDATE user_session_log
                    SET total_pages_visited = total_pages_visited + 1,
                        last_active_at = NOW(),
                        current_path = $2,
                        current_page_title = $3,
                        current_module = $4
                  WHERE session_id = $1`,
                [sessionId, pagePath, cleanTitle, module]
            ).catch(() => {}); // Ignore if session doesn't exist yet
        }
    } catch (err) {
        console.error('[Activity] Track error:', err.message);
    }
});

// ── Session Management ───────────────────────────────────────────────────────

/**
 * POST /api/activity/session/start
 * Body: { sessionId }
 * 
 * Called after successful login or on tab initialization.
 * - Auto-retires stale sessions for this employee (>15 mins without activity)
 * - Upserts session by sessionId so F5 / page reloads don't duplicate rows
 */
router.post('/session/start', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

        const user = req.user || {};
        const ip = getClientIp(req);
        const ua = req.headers['user-agent'] || null;
        const empno = user.empno || 'anonymous';

        // 1. Auto-retire stale sessions for this employee (older than 15 min without heartbeat)
        if (empno !== 'anonymous') {
            await engPool.query(
                `UPDATE user_session_log
                    SET logout_at = COALESCE(last_active_at, NOW())
                  WHERE empno = $1 
                    AND session_id != $2 
                    AND logout_at IS NULL 
                    AND last_active_at < NOW() - INTERVAL '15 minutes'`,
                [empno, sessionId]
            ).catch(() => {});
        }

        // 2. Check if this session already exists (e.g. page refreshed F5 with same tab session ID)
        const existing = await engPool.query(
            `SELECT id FROM user_session_log WHERE session_id = $1`,
            [sessionId]
        );

        if (existing.rows.length > 0) {
            // Re-activate existing session
            await engPool.query(
                `UPDATE user_session_log
                    SET last_active_at = NOW(),
                        logout_at = NULL,
                        ip_address = COALESCE($2::inet, ip_address),
                        user_agent = COALESCE($3, user_agent)
                  WHERE session_id = $1`,
                [sessionId, ip, ua]
            );
        } else {
            // Insert new session
            await engPool.query(
                `INSERT INTO user_session_log
                    (empno, user_name, department, session_id, ip_address, user_agent, login_at, last_active_at)
                 VALUES ($1, $2, $3, $4, $5::inet, $6, NOW(), NOW())`,
                [empno, user.name || null, user.department || null, sessionId, ip, ua]
            );
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('[Activity] Session start error:', err.message);
        res.status(500).json({ error: 'Failed to start session' });
    }
});

/**
 * POST /api/activity/session/heartbeat
 * Body: { sessionId }
 * 
 * Called every 5 minutes (piggybacks on token check interval).
 */
router.post('/session/heartbeat', async (req, res) => {
    // Respond immediately
    res.json({ ok: true });

    try {
        const { sessionId } = req.body;
        if (!sessionId) return;

        await engPool.query(
            `UPDATE user_session_log
                SET last_active_at = NOW()
              WHERE session_id = $1 AND logout_at IS NULL`,
            [sessionId]
        );
    } catch (err) {
        console.error('[Activity] Heartbeat error:', err.message);
    }
});

/**
 * POST /api/activity/session/end
 * Body: { sessionId, empno }
 * 
 * Called on logout or browser beforeunload.
 */
router.post('/session/end', async (req, res) => {
    res.json({ ok: true });

    try {
        const { sessionId, empno } = req.body;
        if (!sessionId && !empno) return;

        if (sessionId) {
            await engPool.query(
                `UPDATE user_session_log
                    SET logout_at = NOW(), last_active_at = NOW()
                  WHERE session_id = $1 AND logout_at IS NULL`,
                [sessionId]
            );
        } else if (empno) {
            await engPool.query(
                `UPDATE user_session_log
                    SET logout_at = NOW(), last_active_at = NOW()
                  WHERE empno = $1 AND logout_at IS NULL`,
                [empno]
            );
        }
    } catch (err) {
        console.error('[Activity] Session end error:', err.message);
    }
});

// ── Admin Queries ────────────────────────────────────────────────────────────

/**
 * GET /api/activity/logs
 * Query: ?page=1&limit=50&empno=&module=&dateFrom=&dateTo=
 * 
 * Returns paginated activity logs for admin dashboard.
 */
router.get('/logs', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (req.query.empno) {
            conditions.push(`empno = $${paramIdx++}`);
            params.push(req.query.empno);
        }
        if (req.query.module) {
            conditions.push(`module = $${paramIdx++}`);
            params.push(req.query.module);
        }
        if (req.query.dateFrom) {
            conditions.push(`created_at >= $${paramIdx++}::timestamptz`);
            params.push(req.query.dateFrom);
        }
        if (req.query.dateTo) {
            conditions.push(`created_at <= $${paramIdx++}::timestamptz`);
            params.push(req.query.dateTo + 'T23:59:59');
        }

        const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        // Count
        const countResult = await engPool.query(
            `SELECT COUNT(*) as total FROM user_activity_log ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total);

        // Data
        const dataResult = await engPool.query(
            `SELECT id, empno, user_name, department, path, page_title, module,
                    referrer_path, session_id, ip_address, created_at
               FROM user_activity_log
               ${whereClause}
              ORDER BY created_at DESC
              LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        res.json({
            result: 'true',
            data: dataResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('[Activity] Logs query error:', err.message);
        res.status(500).json({ result: 'false', error: err.message });
    }
});

/**
 * GET /api/activity/stats
 * Query: ?dateFrom=&dateTo=
 * 
 * Returns aggregated statistics for the admin dashboard.
 */
router.get('/stats', async (req, res) => {
    try {
        const dateFrom = req.query.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const dateTo = req.query.dateTo || new Date().toISOString().slice(0, 10);

        // 1. Total page views
        const totalViewsResult = await engPool.query(
            `SELECT COUNT(*) as total FROM user_activity_log
             WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
            [dateFrom, dateTo + 'T23:59:59']
        );

        // 2. Unique users
        const uniqueUsersResult = await engPool.query(
            `SELECT COUNT(DISTINCT empno) as total FROM user_activity_log
             WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
            [dateFrom, dateTo + 'T23:59:59']
        );

        // 3. Page views by module (top 20)
        const byModuleResult = await engPool.query(
            `SELECT module, COUNT(*) as views, COUNT(DISTINCT empno) as unique_users
               FROM user_activity_log
              WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
              GROUP BY module
              ORDER BY views DESC
              LIMIT 20`,
            [dateFrom, dateTo + 'T23:59:59']
        );

        // 4. Page views by day
        const byDayResult = await engPool.query(
            `SELECT DATE(created_at AT TIME ZONE 'Asia/Bangkok') as date,
                    COUNT(*) as views,
                    COUNT(DISTINCT empno) as unique_users
               FROM user_activity_log
              WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
              GROUP BY DATE(created_at AT TIME ZONE 'Asia/Bangkok')
              ORDER BY date`,
            [dateFrom, dateTo + 'T23:59:59']
        );

        // 5. Top pages
        const topPagesResult = await engPool.query(
            `SELECT path, page_title, COUNT(*) as views, COUNT(DISTINCT empno) as unique_users
               FROM user_activity_log
              WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
              GROUP BY path, page_title
              ORDER BY views DESC
              LIMIT 20`,
            [dateFrom, dateTo + 'T23:59:59']
        );

        // 6. Top users
        const topUsersResult = await engPool.query(
            `SELECT empno, user_name, department, COUNT(*) as views,
                    COUNT(DISTINCT module) as modules_used
               FROM user_activity_log
              WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
              GROUP BY empno, user_name, department
              ORDER BY views DESC
              LIMIT 20`,
            [dateFrom, dateTo + 'T23:59:59']
        );

        // 7. Active sessions (sessions with no logout in last 30 min)
        const activeSessionsResult = await engPool.query(
            `SELECT COUNT(*) as total FROM user_session_log
             WHERE logout_at IS NULL
               AND last_active_at >= NOW() - INTERVAL '30 minutes'`
        );

        // 8. Today's sessions
        const todaySessionsResult = await engPool.query(
            `SELECT COUNT(*) as total FROM user_session_log
             WHERE DATE(login_at AT TIME ZONE 'Asia/Bangkok') = CURRENT_DATE`
        );

        res.json({
            result: 'true',
            data: {
                totalViews: parseInt(totalViewsResult.rows[0].total),
                uniqueUsers: parseInt(uniqueUsersResult.rows[0].total),
                activeSessions: parseInt(activeSessionsResult.rows[0].total),
                todaySessions: parseInt(todaySessionsResult.rows[0].total),
                byModule: byModuleResult.rows,
                byDay: byDayResult.rows,
                topPages: topPagesResult.rows,
                topUsers: topUsersResult.rows
            }
        });
    } catch (err) {
        console.error('[Activity] Stats query error:', err.message);
        res.status(500).json({ result: 'false', error: err.message });
    }
});

/**
 * GET /api/activity/user/:empno
 * Query: ?page=1&limit=50&dateFrom=&dateTo=
 * 
 * Returns activity history for a specific user.
 */
router.get('/user/:empno', async (req, res) => {
    try {
        const { empno } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const conditions = ['empno = $1'];
        const params = [empno];
        let paramIdx = 2;

        if (req.query.dateFrom) {
            conditions.push(`created_at >= $${paramIdx++}::timestamptz`);
            params.push(req.query.dateFrom);
        }
        if (req.query.dateTo) {
            conditions.push(`created_at <= $${paramIdx++}::timestamptz`);
            params.push(req.query.dateTo + 'T23:59:59');
        }

        const whereClause = 'WHERE ' + conditions.join(' AND ');

        const countResult = await engPool.query(
            `SELECT COUNT(*) as total FROM user_activity_log ${whereClause}`,
            params
        );

        const dataResult = await engPool.query(
            `SELECT id, empno, user_name, department, path, page_title, module,
                    session_id, created_at
               FROM user_activity_log
               ${whereClause}
              ORDER BY created_at DESC
              LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        // Session summary for this user
        const sessionsResult = await engPool.query(
            `SELECT id, login_at, last_active_at, logout_at, session_id,
                    total_pages_visited, ip_address
               FROM user_session_log
              WHERE empno = $1
              ORDER BY login_at DESC
              LIMIT 20`,
            [empno]
        );

        res.json({
            result: 'true',
            data: dataResult.rows,
            sessions: sessionsResult.rows,
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].total),
                totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
            }
        });
    } catch (err) {
        console.error('[Activity] User query error:', err.message);
        res.status(500).json({ result: 'false', error: err.message });
    }
});

/**
 * GET /api/activity/sessions
 * Query: ?active=true&page=1&limit=50
 * 
 * Returns session list for admin view.
 */
router.get('/sessions', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;
        const activeOnly = req.query.active === 'true';

        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (activeOnly) {
            conditions.push(`logout_at IS NULL`);
            conditions.push(`last_active_at >= NOW() - INTERVAL '30 minutes'`);
        }

        const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const countResult = await engPool.query(
            `SELECT COUNT(*) as total FROM user_session_log ${whereClause}`,
            params
        );

        const dataResult = await engPool.query(
            `SELECT id, empno, user_name, department, login_at, last_active_at,
                    logout_at, session_id, ip_address, total_pages_visited
               FROM user_session_log
               ${whereClause}
              ORDER BY login_at DESC
              LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        res.json({
            result: 'true',
            data: dataResult.rows,
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].total),
                totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
            }
        });
    } catch (err) {
        console.error('[Activity] Sessions query error:', err.message);
        res.status(500).json({ result: 'false', error: err.message });
    }
});

/**
 * GET /api/activity/modules
 * Returns distinct module list for filter dropdowns.
 */
/**
 * GET /api/activity/users-presence
 * Query: ?department=&status=&search=
 * 
 * Returns all registered users from m_user_profile with real-time status:
 *   - online (active within 15 min and not logged out)
 *   - idle (last active 15-60 min ago and not logged out)
 *   - offline (logged out or inactive > 60 min)
 * Along with current page, last login, active tabs count, etc.
 */
router.get('/users-presence', async (req, res) => {
    try {
        const { department, status, search } = req.query;

        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (department && department !== 'ALL') {
            conditions.push(`u.u_department = $${paramIdx++}`);
            params.push(department);
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            conditions.push(`(u.u_code ILIKE $${paramIdx} OR u.u_name ILIKE $${paramIdx} OR u.u_nickname ILIKE $${paramIdx})`);
            params.push(term);
            paramIdx++;
        }

        const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const sql = `
            SELECT 
                u.u_code AS empno,
                u.u_name,
                u.u_nickname,
                u.u_department AS department,
                u.role,
                u.profile_img_b64,
                u.u_status,
                -- Latest session details
                s.id AS session_id_pk,
                s.session_id,
                s.login_at,
                s.last_active_at,
                s.logout_at,
                s.ip_address,
                s.user_agent,
                s.total_pages_visited,
                s.current_path,
                s.current_page_title,
                s.current_module,
                -- Count of concurrent active tabs/sessions in last 15 min
                COALESCE(act.active_session_count, 0) AS active_tab_count,
                -- Latest activity fallback
                latest_act.path AS latest_activity_path,
                latest_act.page_title AS latest_activity_title,
                latest_act.module AS latest_activity_module,
                latest_act.created_at AS latest_activity_time
            FROM m_user_profile u
            LEFT JOIN LATERAL (
                SELECT * FROM user_session_log
                WHERE empno = u.u_code
                ORDER BY login_at DESC
                LIMIT 1
            ) s ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS active_session_count
                FROM user_session_log
                WHERE empno = u.u_code
                  AND logout_at IS NULL
                  AND last_active_at >= NOW() - INTERVAL '15 minutes'
            ) act ON true
            LEFT JOIN LATERAL (
                SELECT path, page_title, module, created_at
                FROM user_activity_log
                WHERE empno = u.u_code
                ORDER BY created_at DESC
                LIMIT 1
            ) latest_act ON true
            ${whereClause}
            ORDER BY 
                CASE 
                    WHEN s.logout_at IS NULL AND s.last_active_at >= NOW() - INTERVAL '15 minutes' THEN 1
                    WHEN s.logout_at IS NULL AND s.last_active_at >= NOW() - INTERVAL '60 minutes' THEN 2
                    ELSE 3
                END ASC,
                COALESCE(s.last_active_at, s.login_at) DESC NULLS LAST,
                u.u_code ASC
        `;

        const result = await engPool.query(sql, params);

        const now = Date.now();
        let onlineCount = 0;
        let idleCount = 0;
        let offlineCount = 0;
        let totalActiveTabs = 0;

        const users = result.rows.map(row => {
            const hasSession = !!row.session_id;
            const lastActiveMs = row.last_active_at ? new Date(row.last_active_at).getTime() : null;
            const isLoggedOut = !!row.logout_at;
            const activeTabs = parseInt(row.active_tab_count, 10) || 0;
            totalActiveTabs += activeTabs;

            let userStatus = 'offline';
            if (hasSession && !isLoggedOut && lastActiveMs) {
                const diffMin = (now - lastActiveMs) / (60 * 1000);
                if (diffMin <= 15) {
                    userStatus = 'online';
                    onlineCount++;
                } else if (diffMin <= 60) {
                    userStatus = 'idle';
                    idleCount++;
                } else {
                    userStatus = 'offline';
                    offlineCount++;
                }
            } else {
                userStatus = 'offline';
                offlineCount++;
            }

            const currentPath = row.current_path || row.latest_activity_path || null;
            const currentTitle = row.current_page_title || row.latest_activity_title || (currentPath ? getReadablePageTitle(currentPath) : null);
            const currentModule = row.current_module || row.latest_activity_module || (currentPath ? extractModule(currentPath) : null);

            return {
                empno: row.empno,
                userName: row.u_name,
                nickname: row.u_nickname,
                department: row.department,
                role: row.role,
                profileImg: row.profile_img_b64,
                status: userStatus,
                activeTabs: userStatus === 'online' ? Math.max(1, activeTabs) : activeTabs,
                currentPage: {
                    path: currentPath,
                    title: currentTitle,
                    module: currentModule,
                    time: row.latest_activity_time || row.last_active_at
                },
                lastLoginAt: row.login_at,
                lastActiveAt: row.last_active_at,
                logoutAt: row.logout_at,
                totalPagesVisited: parseInt(row.total_pages_visited, 10) || 0,
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                sessionId: row.session_id
            };
        });

        // Filter by computed status if requested
        const filteredUsers = status && status !== 'ALL'
            ? users.filter(u => u.status === status.toLowerCase())
            : users;

        res.json({
            result: 'true',
            data: filteredUsers,
            summary: {
                totalUsers: users.length,
                onlineCount,
                idleCount,
                offlineCount,
                totalActiveTabs
            }
        });
    } catch (err) {
        console.error('[Activity] Users presence error:', err.message);
        res.status(500).json({ result: 'false', error: err.message });
    }
});

/**
 * GET /api/activity/user-timeline
 * Query: ?empno=LE131
 * 
 * Returns detailed timeline for user drawer:
 *   - todayActivities: list of pages visited today
 *   - recentSessions: last 10 login sessions
 */
router.get('/user-timeline', async (req, res) => {
    try {
        const { empno } = req.query;
        if (!empno) return res.status(400).json({ error: 'empno required' });

        // 1. Today's activities
        const todayRes = await engPool.query(
            `SELECT id, path, page_title, module, created_at, ip_address
               FROM user_activity_log
              WHERE empno = $1
                AND created_at >= CURRENT_DATE AT TIME ZONE 'Asia/Bangkok'
              ORDER BY created_at DESC
              LIMIT 100`,
            [empno]
        );

        // 2. Recent sessions (last 10)
        const sessionsRes = await engPool.query(
            `SELECT id, session_id, login_at, last_active_at, logout_at,
                    total_pages_visited, ip_address, user_agent, current_page_title
               FROM user_session_log
              WHERE empno = $1
              ORDER BY login_at DESC
              LIMIT 10`,
            [empno]
        );

        // 3. User basic info
        const userRes = await engPool.query(
            `SELECT u_code, u_name, u_nickname, u_department, role, profile_img_b64
               FROM m_user_profile
              WHERE u_code = $1`,
            [empno]
        );

        res.json({
            result: 'true',
            data: {
                user: userRes.rows[0] || null,
                todayActivities: todayRes.rows.map(r => ({
                    ...r,
                    friendly_title: r.page_title && r.page_title !== 'ENGINEER-RODEND' ? r.page_title : getReadablePageTitle(r.path)
                })),
                recentSessions: sessionsRes.rows
            }
        });
    } catch (err) {
        console.error('[Activity] User timeline error:', err.message);
        res.status(500).json({ result: 'false', error: err.message });
    }
});

/**
 * GET /api/activity/modules
 * Returns distinct module list for filter dropdowns.
 */
router.get('/modules', async (req, res) => {
    try {
        const result = await engPool.query(
            `SELECT DISTINCT module, COUNT(*) as views
               FROM user_activity_log
              WHERE module IS NOT NULL
              GROUP BY module
              ORDER BY views DESC`
        );
        res.json({ result: 'true', data: result.rows });
    } catch (err) {
        res.status(500).json({ result: 'false', error: err.message });
    }
});

module.exports = router;


