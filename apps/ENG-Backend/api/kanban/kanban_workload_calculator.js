const { engPool } = require('../../instance/eng_db');
const dayjs = require('dayjs');

/**
 * kanban_workload_calculator.js
 * Calculates the feasibility and estimated hours based on historical data.
 */

async function calculateProjectAverages(projectId) {
    // 1. Get all cards in the project
    // Find the first time each card entered 'In Progress' and 'Done'
    const query = `
        SELECT 
            c.id AS card_id,
            (
                SELECT a.created_at
                FROM kb_action a
                JOIN kb_list l ON l.id = (NULLIF(a.action_data->>'to_list_id', ''))::integer
                WHERE a.card_id = c.id AND a.action_type = 'card_moved'
                  AND (lower(l.name) LIKE '%in progress%' OR lower(l.name) LIKE '%working%' OR lower(l.name) LIKE '%กำลังทำ%')
                ORDER BY a.created_at ASC LIMIT 1
            ) AS in_progress_at,
            (
                SELECT a.created_at
                FROM kb_action a
                JOIN kb_list l ON l.id = (NULLIF(a.action_data->>'to_list_id', ''))::integer
                WHERE a.card_id = c.id AND a.action_type = 'card_moved'
                  AND (lower(l.name) LIKE '%done%' OR lower(l.name) LIKE '%completed%' OR lower(l.name) LIKE '%finish%' OR lower(l.name) LIKE '%เสร็จ%')
                ORDER BY a.created_at DESC LIMIT 1
            ) AS done_at
        FROM kb_card c
        JOIN kb_board b ON c.board_id = b.id
        WHERE b.project_id = $1
    `;
    
    const { rows } = await engPool.query(query, [projectId]);
    
    let completedTotalDays = 0;
    let completedCount = 0;
    
    let inProgressTotalDays = 0;
    let inProgressCount = 0;
    
    const now = dayjs();

    rows.forEach(row => {
        if (row.in_progress_at && row.done_at) {
            // Completed task
            const days = dayjs(row.done_at).diff(dayjs(row.in_progress_at), 'day', true);
            if (days >= 0) {
                completedTotalDays += days;
                completedCount++;
            }
        } else if (row.in_progress_at && !row.done_at) {
            // In Progress task
            const days = now.diff(dayjs(row.in_progress_at), 'day', true);
            if (days >= 0) {
                inProgressTotalDays += days;
                inProgressCount++;
            }
        }
    });

    const avgCompleted = completedCount > 0 ? (completedTotalDays / completedCount) : 0;
    const avgInProgress = inProgressCount > 0 ? (inProgressTotalDays / inProgressCount) : 0;
    
    // Not started average (A + B) / 2
    let avgNotStarted = (avgCompleted + avgInProgress) / 2;
    
    // Bounds for not started: [10, 30] days
    if (avgNotStarted < 10) avgNotStarted = 10;
    if (avgNotStarted > 30) avgNotStarted = 30;

    // Expected time (weighted 5:3:2)
    let expectedDays = ((avgCompleted * 5) + (avgInProgress * 3) + (avgNotStarted * 2)) / 10;
    
    // Project constraints: min 60 days (2 months), max 180 days (6 months)
    if (expectedDays < 60) expectedDays = 60;
    if (expectedDays > 180) expectedDays = 180;

    // Actual working time: 7.5% of expected days, converted to hours (assume 8 hours a day, so * 8)
    const actualWorkingHours = expectedDays * 8 * 0.075;
    
    return {
        avgCompleted,
        avgInProgress,
        avgNotStarted,
        expectedDays,
        actualWorkingHours,
        totalTasks: rows.length
    };
}

async function enhanceWorkloadDataWithFeasibility(workloadData) {
    const projectCache = {};
    const now = dayjs();

    for (const card of workloadData) {
        if (!card.project_id) continue;

        if (!projectCache[card.project_id]) {
            const { rows: pRows } = await engPool.query('SELECT created_at, null as due_date FROM kb_project WHERE id = $1', [card.project_id]); 
            projectCache[card.project_id] = {
                stats: await calculateProjectAverages(card.project_id),
                info: pRows[0] || {}
            };
        }

        const pData = projectCache[card.project_id];
        const stats = pData.stats;
        
        let targetDueDate = card.due_date || pData.info.due_date; 
        let isUnfeasible = false;
        let calculatedHours = parseFloat(card.estimated_hours) || 0;

        if (!card.due_date && !pData.info.due_date) {
            if (calculatedHours <= 0) {
                calculatedHours = stats.actualWorkingHours;
            }
        } else {
            if (calculatedHours <= 0) {
                calculatedHours = stats.actualWorkingHours;
            }
            
            const daysUntilDue = dayjs(targetDueDate).diff(now, 'day', true);
            const requiredDays = calculatedHours / 6;
            
            if (requiredDays > daysUntilDue) {
                const daysFromStart = dayjs(targetDueDate).diff(dayjs(card.card_created_at), 'day', true);
                const totalAvailableHours = daysFromStart * 8; 
                const hoursPerTask = totalAvailableHours / (stats.totalTasks || 1);
                
                if (hoursPerTask < 2) {
                    isUnfeasible = true;
                }
            }
        }

        // Apply task constraints: min 2 hours, max 42 hours (7 days * 6 hours/day)
        if (calculatedHours < 2) calculatedHours = 2;
        if (calculatedHours > 42) calculatedHours = 42;

        card.calculated_estimated_hours = Math.round(calculatedHours * 100) / 100;
        card.is_unfeasible = isUnfeasible;
        
        // Always enforce the clamped calculation
        card.estimated_hours = card.calculated_estimated_hours;

        // Dynamic Due Date Estimation
        if (!card.due_date) {
            card.is_estimated_due_date = true;
            // Determine how many days it takes based on 6 hours/day
            const daysToComplete = Math.ceil(card.estimated_hours / 6);
            card.due_date = dayjs(card.card_created_at).add(daysToComplete, 'day').format('YYYY-MM-DD');
        } else {
            card.is_estimated_due_date = false;
        }
    }

    return workloadData;
}

module.exports = {
    enhanceWorkloadDataWithFeasibility
};
