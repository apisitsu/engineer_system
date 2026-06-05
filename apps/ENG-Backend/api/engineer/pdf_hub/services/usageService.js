/**
 * usageService.js — Business logic for PDF usage logging and analytics.
 *
 * Tracks document views, edits, and exports for paper-saving cost calculation.
 */
const { engPool } = require('../../../../instance/eng_db');

/**
 * Record a PDF usage event.
 */
async function logUsage({ filename, empno, user_name, total_pages, action_type, details }) {
    await engPool.query(
        `INSERT INTO tt_pdf_usage_logs (filename, empno, user_name, total_pages, action_type, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [filename, empno, user_name || '', total_pages || 1, action_type || 'unknown', details || null]
    );
}

/**
 * Fetch recent usage history (last 100 entries).
 */
async function getUsageHistory() {
    const result = await engPool.query(
        `SELECT id, filename, empno, user_name, total_pages, action_type, details, created_at
         FROM tt_pdf_usage_logs
         ORDER BY created_at DESC
         LIMIT 100`
    );
    return result.rows;
}

/**
 * Aggregate usage statistics for the dashboard.
 *
 * @param {Object} filters - { year, month } (optional)
 * @returns {{ totalDocs, totalPagesSaved, totalSavings, chartData }}
 */
async function getUsageStats({ year, month } = {}) {
    let dateFilter = '';
    let params = [];

    if (year && month) {
        dateFilter = 'AND EXTRACT(YEAR FROM created_at) = $1::numeric AND EXTRACT(MONTH FROM created_at) = $2::numeric';
        params = [year, month];
    } else if (year) {
        dateFilter = 'AND EXTRACT(YEAR FROM created_at) = $1::numeric';
        params = [year];
    }

    const statsResult = await engPool.query(
        `SELECT 
            COUNT(*) as total_docs,
            SUM(total_pages) as total_pages,
            SUM(CASE WHEN action_type = 'view' THEN total_pages * 0.10 ELSE total_pages * 0.50 END) as total_savings
         FROM tt_pdf_usage_logs
         WHERE 1=1 ${dateFilter}`,
        params
    );

    const chartResult = await engPool.query(
        `SELECT 
            TO_CHAR(created_at, 'YYYY-MM') as month,
            SUM(CASE WHEN action_type = 'view' THEN total_pages ELSE 0 END) as view_pages,
            SUM(CASE WHEN action_type != 'view' THEN total_pages ELSE 0 END) as action_pages
         FROM tt_pdf_usage_logs
         WHERE 1=1 ${dateFilter}
         GROUP BY TO_CHAR(created_at, 'YYYY-MM')
         ORDER BY month ASC`,
        params
    );

    return {
        totalDocs: parseInt(statsResult.rows[0].total_docs) || 0,
        totalPagesSaved: parseInt(statsResult.rows[0].total_pages) || 0,
        totalSavings: parseFloat(statsResult.rows[0].total_savings) || 0.0,
        chartData: chartResult.rows,
    };
}

module.exports = { logUsage, getUsageHistory, getUsageStats };
