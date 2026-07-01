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

/**
 * Extract module name from a route path automatically.
 * Examples:
 *   /eng/mtc_eng/sds-v2        → mtc_eng
 *   /eng/kanban/proj1/board1   → kanban
 *   /eng/process_eng/ecnt/dashboard → process_eng
 *   /eng/home                  → home
 *   /home                      → home
 *   /user/settings             → user
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
 * Safely extract client IP from request.
 */
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress || req.ip || null;
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

        await engPool.query(
            `INSERT INTO user_activity_log
                (empno, user_name, department, path, page_title, module, referrer_path, session_id, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::inet, $10)`,
            [
                user.empno || 'anonymous',
                user.name || null,
                user.department || null,
                pagePath,
                title || null,
                module,
                referrer || null,
                sessionId || null,
                ip,
                ua
            ]
        );

        // Also update session's page count + last_active_at if session exists
        if (sessionId) {
            await engPool.query(
                `UPDATE user_session_log
                    SET total_pages_visited = total_pages_visited + 1,
                        last_active_at = NOW()
                  WHERE session_id = $1`,
                [sessionId]
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
 * Called after successful login from frontend.
 */
router.post('/session/start', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

        const user = req.user || {};
        const ip = getClientIp(req);
        const ua = req.headers['user-agent'] || null;

        await engPool.query(
            `INSERT INTO user_session_log
                (empno, user_name, department, session_id, ip_address, user_agent, login_at, last_active_at)
             VALUES ($1, $2, $3, $4, $5::inet, $6, NOW(), NOW())
             ON CONFLICT DO NOTHING`,
            [
                user.empno || 'anonymous',
                user.name || null,
                user.department || null,
                sessionId,
                ip,
                ua
            ]
        );

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
 * Body: { sessionId }
 * 
 * Called on logout or browser beforeunload.
 */
router.post('/session/end', async (req, res) => {
    res.json({ ok: true });

    try {
        const { sessionId } = req.body;
        if (!sessionId) return;

        await engPool.query(
            `UPDATE user_session_log
                SET logout_at = NOW(), last_active_at = NOW()
              WHERE session_id = $1 AND logout_at IS NULL`,
            [sessionId]
        );
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
