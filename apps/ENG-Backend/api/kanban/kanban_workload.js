/**
 * kanban_workload.js
 * Kanban API for Workload Dashboards
 * Supports: date range filtering, project filtering, per-user filtering
 */
const { engPool } = require('../../instance/eng_db');
const { isSuperAdmin, canSeeAllProjects } = require('./kanban_acl');
const { enhanceWorkloadDataWithFeasibility } = require('./kanban_workload_calculator');

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

        // Privacy Filter
        // Privacy Filter
        if (isAdmin) {
            // Admins see all
        } else if (seeAll) {
            // Managers/Coords: (Public OR Member)
            conditions.push(`(p.is_private IS NOT TRUE OR LOWER($${paramIdx}) = ANY(pm.members))`);
            params.push(requestingUCode);
            paramIdx++;
        } else {
            // Regular User: MUST be a member of the project
            conditions.push(`(LOWER($${paramIdx}) = ANY(pm.members))`);
            params.push(requestingUCode);
            paramIdx++;
        }

        // Exclude cards in archive/trash lists
        conditions.push("(l.list_type IS NULL OR l.list_type NOT IN ('archive', 'trash'))");

        // Date range filter
        if (week_start && week_start !== 'null' && week_end && week_end !== 'null') {
            conditions.push(`(c.due_date IS NULL OR (c.due_date >= $${paramIdx}::date AND c.due_date < ($${paramIdx + 1}::date + interval '1 day')))`);
            params.push(week_start, week_end);
            paramIdx += 2;
        }

        // Project filter
        if (project_id && project_id !== 'null' && project_id !== 'undefined') {
            conditions.push(`p.id = $${paramIdx}`);
            params.push(parseInt(project_id, 10));
            paramIdx++;
        }

        const whereClause = 'WHERE ' + conditions.join(' AND ');

        const query = `
            WITH CardMembers AS (
                SELECT card_id, ARRAY_AGG(LOWER(u_code)) as members, COUNT(u_code) as member_count
                FROM kb_card_membership
                GROUP BY card_id
            ),
            ProjectMembers AS (
                SELECT project_id, ARRAY_AGG(LOWER(u_code)) as members, COUNT(u_code) as member_count
                FROM kb_project_membership
                GROUP BY project_id
            )
            SELECT 
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
                p.name AS project_name,
                COALESCE(cm.members, ARRAY[]::text[]) AS card_members,
                COALESCE(cm.member_count, 0) AS card_member_count,
                COALESCE(pm.members, ARRAY[]::text[]) AS project_members,
                COALESCE(pm.member_count, 0) AS project_member_count
            FROM kb_card c
            LEFT JOIN kb_list l ON l.id = c.list_id
            LEFT JOIN kb_board b ON b.id = c.board_id
            LEFT JOIN kb_project p ON p.id = b.project_id
            LEFT JOIN CardMembers cm ON cm.card_id = c.id
            LEFT JOIN ProjectMembers pm ON pm.project_id = p.id
            ${whereClause}
            ORDER BY c.due_date ASC NULLS LAST
        `;

        const { rows: workloadDataRaw } = await engPool.query(query, params);

        // Pass the raw data to be enhanced by the calculator (which will assign estimated due dates)

        // Apply Feasibility and Expected Hours Algorithm
        const enhancedCards = await enhanceWorkloadDataWithFeasibility(workloadDataRaw);

        // Group data by user
        const userWorkloadsArr = [];
        const userMap = new Map();

        // Need user profile info since we removed it from JOIN
        const { rows: usersRaw } = await engPool.query('SELECT u_code, u_name, u_nickname, profile_img_b64 FROM m_user_profile');
        const userProfiles = {};
        usersRaw.forEach(u => userProfiles[(u.u_code || '').toLowerCase()] = u);

        enhancedCards.forEach(card => {
            // Determine who gets this card
            let targetUsers = [];
            let divisor = 1;
            let allocatedHours = parseFloat(card.estimated_hours) || 0;

            if (card.card_member_count > 0 && Array.isArray(card.card_members)) {
                targetUsers = card.card_members;
                divisor = card.card_member_count;
                allocatedHours = allocatedHours / divisor;
            } else if (card.project_member_count > 0 && Array.isArray(card.project_members)) {
                targetUsers = card.project_members;
                divisor = card.project_member_count;
                // Rule: If unassigned to specific card, use 50% and divide by project members
                allocatedHours = (allocatedHours * 0.5) / divisor;
            }

            if (!Array.isArray(targetUsers)) targetUsers = [];

            targetUsers.forEach(u_code => {
                const uCodeKey = (u_code || '').toLowerCase();
                
                // If specific user filter is requested, skip others
                if (u_code && req.query.u_code && req.query.u_code !== 'null' && req.query.u_code !== 'undefined') {
                    if (uCodeKey !== req.query.u_code.toLowerCase()) return;
                }

                if (!userMap.has(uCodeKey)) {
                    const prof = userProfiles[uCodeKey] || {};
                    const newUser = {
                        u_code: u_code,
                        u_name: prof.u_name || u_code,
                        u_nickname: prof.u_nickname || '',
                        profile_img_b64: prof.profile_img_b64 || null,
                        total_estimated_hours: 0,
                        cards: []
                    };
                    userMap.set(uCodeKey, newUser);
                    userWorkloadsArr.push(newUser);
                }

                const userEntry = userMap.get(uCodeKey);
                userEntry.total_estimated_hours += allocatedHours;

                userEntry.cards.push({
                    card_id: card.card_id,
                    card_name: card.card_name,
                    estimated_hours: allocatedHours.toFixed(2),
                    due_date: card.due_date,
                    is_estimated_due_date: card.is_estimated_due_date || false,
                    card_created_at: card.card_created_at,
                    list_id: card.list_id,
                    list_name: card.list_name || 'No List',
                    list_type: card.list_type || 'active',
                    board_id: card.board_id,
                    board_name: card.board_name || 'No Board',
                    project_id: card.project_id,
                    project_name: card.project_name || 'No Project',
                    is_unfeasible: card.is_unfeasible || false
                });
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
