/**
 * kanban_workload.js
 * Kanban API for Workload Dashboards
 * Supports: date range filtering, project filtering, per-user filtering
 */
const { engPool } = require('../../instance/eng_db');
const { isSuperAdmin, canSeeAllProjects } = require('./kanban_acl');

/**
 * GET /api/kanban/workload/team-workload
 * Query params:
 *   - week_start (ISO date, optional)
 *   - week_end   (ISO date, optional)
 *   - project_id (optional, filter by project)
 *   - u_code     (optional, filter by specific user)
 */
const GetTeamWorkload = async (req, res) => {
    try {
        // Self-healing migration: Ensure the column exists
        try {
            await engPool.query(`
                ALTER TABLE kb_card 
                ADD COLUMN IF NOT EXISTS estimated_hours Numeric(5,2) DEFAULT 0;
            `);
        } catch (migErr) {
            // Silently ignore – column likely already exists
        }

        const requestingUCode = req.user?.empno;
        if (!requestingUCode) return res.status(401).json({ error: 'Unauthorized' });

        const { week_start, week_end, project_id, u_code } = req.query;

        const isAdmin = await isSuperAdmin(req);
        const seeAll = !isAdmin && await canSeeAllProjects(req);

        // Build WHERE conditions dynamically
        const conditions = ['(c.is_closed IS NOT TRUE)'];
        const params = [];
        let paramIdx = 1;

        // Privacy Filter:
        // - Admins see everything.
        // - Managers/Coords see all non-private + private projects they are in.
        // - Regular users see only projects they are members of.
        // Using LOWER() for u_code to be safe with case sensitivity.
        
        if (isAdmin) {
            // Admins see all
        } else if (seeAll) {
            // Managers/Coords: (Public OR Member)
            conditions.push(`(p.is_private IS NOT TRUE OR EXISTS (
                SELECT 1 FROM kb_project_membership pm_priv 
                WHERE pm_priv.project_id = p.id AND LOWER(pm_priv.u_code) = LOWER($${paramIdx})
            ))`);
            params.push(requestingUCode);
            paramIdx++;
        } else {
            // Regular User: MUST be a member of the project
            conditions.push(`EXISTS (
                SELECT 1 FROM kb_project_membership pm_priv 
                WHERE pm_priv.project_id = p.id AND LOWER(pm_priv.u_code) = LOWER($${paramIdx})
            )`);
            params.push(requestingUCode);
            paramIdx++;
        }

        // Exclude cards in archive/trash lists
        conditions.push("(l.list_type IS NULL OR l.list_type NOT IN ('archive', 'trash'))");

        // Date range filter (ONLY if explicitly provided)
        if (week_start && week_start !== 'null' && week_end && week_end !== 'null') {
            conditions.push(`(c.due_date IS NULL OR (c.due_date >= $${paramIdx}::date AND c.due_date < ($${paramIdx + 1}::date + interval '1 day')))`);
            params.push(week_start, week_end);
            paramIdx += 2;
        }

        // Project filter (ONLY if explicitly provided)
        if (project_id && project_id !== 'null' && project_id !== 'undefined') {
            conditions.push(`p.id = $${paramIdx}`);
            params.push(parseInt(project_id, 10));
            paramIdx++;
        }

        // User filter (Team view drill-down or specific user lookup)
        if (u_code && u_code !== 'null' && u_code !== 'undefined') {
            conditions.push(`LOWER(cm.u_code) = LOWER($${paramIdx})`);
            params.push(u_code);
            paramIdx++;
        }

        const whereClause = 'WHERE ' + conditions.join(' AND ');

        const query = `
            SELECT 
                cm.u_code AS user_code,
                u.u_name,
                u.u_nickname,
                u.profile_img_b64,
                c.id AS card_id,
                c.name AS card_name,
                COALESCE(c.estimated_hours, 0) AS estimated_hours,
                c.due_date,
                c.created_at AS card_created_at,
                l.id AS list_id,
                l.name AS list_name,
                l.list_type,
                b.id AS board_id,
                b.name AS board_name,
                p.id AS project_id,
                p.name AS project_name
            FROM kb_card c
            INNER JOIN kb_card_membership cm ON cm.card_id = c.id
            LEFT JOIN m_user_profile u ON u.u_code = cm.u_code
            LEFT JOIN kb_list l ON l.id = c.list_id
            LEFT JOIN kb_board b ON b.id = c.board_id
            LEFT JOIN kb_project p ON p.id = b.project_id
            ${whereClause}
            ORDER BY cm.u_code ASC, c.due_date ASC NULLS LAST
        `;

        // Debug log (remove or comment out later)
        // console.log('Workload Query Params:', params);

        const { rows: workloadData } = await engPool.query(query, params);

        // Group data by user
        const userWorkloadsArr = [];
        const userMap = new Map();

        workloadData.forEach(row => {
            const uCodeKey = (row.user_code || '').toLowerCase();
            if (!userMap.has(uCodeKey)) {
                const newUser = {
                    u_code: row.user_code,
                    u_name: row.u_name || row.user_code,
                    u_nickname: row.u_nickname || '',
                    profile_img_b64: row.profile_img_b64 || null,
                    total_estimated_hours: 0,
                    cards: []
                };
                userMap.set(uCodeKey, newUser);
                userWorkloadsArr.push(newUser);
            }

            const userEntry = userMap.get(uCodeKey);
            const estHours = parseFloat(row.estimated_hours) || 0;
            userEntry.total_estimated_hours += estHours;

            userEntry.cards.push({
                card_id: row.card_id,
                card_name: row.card_name,
                estimated_hours: estHours,
                due_date: row.due_date,
                card_created_at: row.card_created_at,
                list_id: row.list_id,
                list_name: row.list_name || 'No List',
                list_type: row.list_type || 'active',
                board_id: row.board_id,
                board_name: row.board_name || 'No Board',
                project_id: row.project_id,
                project_name: row.project_name || 'No Project'
            });
        });

        // Round total hours
        userWorkloadsArr.forEach(u => {
            u.total_estimated_hours = Math.round(u.total_estimated_hours * 100) / 100;
        });

        res.json({ data: userWorkloadsArr });
    } catch (err) {
        console.error('GetTeamWorkload error:', err);
        res.status(500).json({
            error: err.message,
            stack: err.stack,
            hint: 'Check if estimated_hours column exists on kb_card table.'
        });
    }
};

module.exports = {
    GetTeamWorkload
};
