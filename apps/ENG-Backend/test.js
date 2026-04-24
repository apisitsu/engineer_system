const { engPool } = require('./instance/eng_db');

async function test() {
    try {
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
                c.estimated_hours,
                c.due_date,
                c.created_at AS card_created_at,
                COALESCE(cm.members, '{}') AS card_members,
                COALESCE(cm.member_count, 0) AS card_member_count,
                COALESCE(pm.members, '{}') AS project_members,
                COALESCE(pm.member_count, 0) AS project_member_count
            FROM kb_card c
            LEFT JOIN kb_list l ON l.id = c.list_id
            LEFT JOIN kb_board b ON b.id = c.board_id
            LEFT JOIN kb_project p ON p.id = b.project_id
            LEFT JOIN CardMembers cm ON cm.card_id = c.id
            LEFT JOIN ProjectMembers pm ON pm.project_id = p.id
            WHERE c.is_closed IS NOT TRUE 
              AND (l.list_type IS NULL OR l.list_type NOT IN ('archive', 'trash'))
              AND ('le131' = ANY(pm.members))
        `;
        const { rows } = await engPool.query(query);
        console.log('Returned rows:', rows.length);
        if (rows.length > 0) {
            console.log(rows[0]);
        }
    } catch (e) {
        console.error(e);
    } finally {
        engPool.end();
    }
}
test();
