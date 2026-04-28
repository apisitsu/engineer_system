/**
 * kanban_issue.js
 * Kanban Card Issues API — CRUD
 * Route prefix: /api/kanban/
 */
const { engPool } = require('../../instance/eng_db');

// Import the proper helper from kanban_card
const { canEditCard, canViewCard } = require('./kanban_card');

/** Auth guard: returns null + sends 401 if unauthenticated */
const getAuthUser = (req, res) => {
    const uCode = req.user?.empno;
    if (!uCode) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return uCode;
};

// GET /api/kanban/cards/:cardId/issues
const getCardIssues = async (req, res) => {
    const { cardId } = req.params;
    try {
        if (!(await canViewCard(req, cardId))) {
            return res.status(403).json({ error: 'Access denied: Cannot view issues for this private card' });
        }
        const { rows } = await engPool.query(
            'SELECT * FROM kb_card_issue WHERE card_id = $1 ORDER BY created_at ASC',
            [cardId]
        );
        res.json({ data: rows });
    } catch (err) {
        console.error('Error in getCardIssues:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/kanban/cards/:cardId/issues
const createCardIssue = async (req, res) => {
    const { cardId } = req.params;
    const uCode = getAuthUser(req, res); if (!uCode) return;
    const { problem_detail, solution_detail } = req.body;

    if (!problem_detail) {
        return res.status(400).json({ error: 'problem_detail is required' });
    }

    try {
        const { rows: [card] } = await engPool.query('SELECT board_id FROM kb_card WHERE id = $1', [cardId]);
        if (!card) {
            return res.status(404).json({ error: 'Card not found' });
        }

        // Optional: Check permissions
        if (!(await canEditCard(req, cardId))) {
            return res.status(403).json({ error: 'Editor permission required to add issues' });
        }

        const { rows: [newIssue] } = await engPool.query(`
            INSERT INTO kb_card_issue (card_id, creator_u_code, problem_detail, solution_detail)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `, [cardId, uCode, problem_detail, solution_detail || null]);

        res.status(201).json({ data: newIssue });
    } catch (err) {
        console.error('Error in createCardIssue:', err);
        res.status(500).json({ error: err.message });
    }
};

// PATCH /api/kanban/issues/:issueId
const updateCardIssue = async (req, res) => {
    const { issueId } = req.params;
    const uCode = getAuthUser(req, res); if (!uCode) return;
    const { problem_detail, solution_detail } = req.body;

    try {
        const { rows: [issue] } = await engPool.query('SELECT * FROM kb_card_issue WHERE id = $1', [issueId]);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        const { rows: [card] } = await engPool.query('SELECT board_id FROM kb_card WHERE id = $1', [issue.card_id]);
        if (!card) {
            return res.status(404).json({ error: 'Associated card not found' });
        }

        // Optional: Check permissions
        if (!(await canEditCard(req, issue.card_id))) {
            return res.status(403).json({ error: 'Editor permission required to update issues' });
        }

        const { rows: [updatedIssue] } = await engPool.query(`
            UPDATE kb_card_issue
            SET 
                problem_detail = COALESCE($1, problem_detail),
                solution_detail = COALESCE($2, solution_detail),
                updated_at = NOW()
            WHERE id = $3
            RETURNING *;
        `, [problem_detail, solution_detail, issueId]);

        res.json({ data: updatedIssue });
    } catch (err) {
        console.error('Error in updateCardIssue:', err);
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/kanban/issues/:issueId
const deleteCardIssue = async (req, res) => {
    const { issueId } = req.params;
    const uCode = getAuthUser(req, res); if (!uCode) return;

    try {
        const { rows: [issue] } = await engPool.query('SELECT * FROM kb_card_issue WHERE id = $1', [issueId]);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        const { rows: [card] } = await engPool.query('SELECT board_id FROM kb_card WHERE id = $1', [issue.card_id]);
        if (!card) {
            // This case should be rare, but good to handle
            return res.status(404).json({ error: 'Associated card not found' });
        }

        // Optional: Check permissions
        if (!(await canEditCard(req, issue.card_id))) {
            return res.status(403).json({ error: 'Editor permission required to delete issues' });
        }

        await engPool.query('DELETE FROM kb_card_issue WHERE id = $1', [issueId]);

        res.json({ message: 'Issue deleted successfully' });
    } catch (err) {
        console.error('Error in deleteCardIssue:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getCardIssues,
    createCardIssue,
    updateCardIssue,
    deleteCardIssue,
};
