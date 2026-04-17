/**
 * kanban_acl.js
 * Consolidated Access Control Layer for the Kanban module.
 *
 * All permission helpers live here — project, board, and card levels.
 * AD  (Super Admin)   → God mode, bypasses everything including private projects.
 * MGR / COORD         → Full access on PUBLIC projects; requires membership on PRIVATE.
 * Owner / Editor / Viewer → entity-level roles with cascading semantics.
 */
const { engPool } = require('../../instance/eng_db');

// ═══════════════════════════════════════════════════════════════════
//  1. MEMBERSHIP QUERIES (shared low-level)
// ═══════════════════════════════════════════════════════════════════

const getProjectMembership = async (projectId, uCode) => {
    const { rows } = await engPool.query(
        'SELECT * FROM kb_project_membership WHERE project_id=$1 AND u_code=$2',
        [projectId, uCode]
    );
    return rows[0] || null;
};

const getBoardMembership = async (boardId, uCode) => {
    const { rows } = await engPool.query(
        'SELECT * FROM kb_board_membership WHERE board_id=$1 AND u_code=$2',
        [boardId, uCode]
    );
    return rows[0] || null;
};

const getCardMembership = async (cardId, uCode) => {
    const { rows } = await engPool.query(
        'SELECT * FROM kb_card_membership WHERE card_id=$1 AND u_code=$2',
        [cardId, uCode]
    );
    return rows[0] || null;
};

const isProjectMember = async (projectId, uCode) => {
    const { rows } = await engPool.query(
        'SELECT id FROM kb_project_membership WHERE project_id=$1 AND u_code=$2',
        [projectId, uCode]
    );
    return rows.length > 0;
};

// ═══════════════════════════════════════════════════════════════════
//  2. GLOBAL ROLE CHECKS  (AD separated from MGR/COORD)
// ═══════════════════════════════════════════════════════════════════

/**
 * Is the user a Super Admin (AD)?
 * AD = God mode → bypasses ALL privacy and membership checks.
 */
const isSuperAdmin = async (req) => {
    // console.log(`isSuperAdmin :`, req.user);
    const jwtRole = req.user?.role;
    const jwtDept = req.user?.department; // The JWT payload maps it to 'department'
    if (jwtDept && jwtDept.toUpperCase() === 'AD') return true;
    if (jwtRole && jwtRole.toUpperCase() === 'AD') return true;
    console.log(`isSuperAdmin :`, jwtDept, jwtRole);
    // Fallback: query DB
    const uCode = req.user?.empno; // The JWT payload maps u_code to 'empno', not 'id'
    if (!uCode) return false;
    try {
        const { rows } = await engPool.query(
            'SELECT u_department, u_role FROM m_user_profile WHERE u_code = $1', [uCode]
        );
        if (!rows[0]) return false;
        const dept = (rows[0].u_department || '').toUpperCase();
        const role = (rows[0].u_role || '').toUpperCase();
        return dept === 'AD' || role === 'AD';
    } catch {
        return false;
    }
};

/**
 * Is the user a Manager or Coordinator (MGR / COORD)?
 * In PUBLIC projects: full access (same as AD).
 * In PRIVATE projects: must be an explicit member first.
 */
const isManagerOrCoord = async (req) => {
    const jwtRole = req.user?.role;
    const jwtDept = req.user?.department;
    if (jwtDept && jwtDept.toUpperCase() === 'AD') return false; // AD is handled separately
    if (jwtRole && ['MGR', 'COORD'].includes(jwtRole.toUpperCase())) return true;

    // Fallback: query DB
    const uCode = req.user?.empno;
    if (!uCode) return false;
    try {
        const { rows } = await engPool.query(
            'SELECT u_department, u_role FROM m_user_profile WHERE u_code = $1', [uCode]
        );
        if (!rows[0]) return false;
        const role = (rows[0].u_role || '').toUpperCase();
        return ['MGR', 'COORD'].includes(role);
    } catch {
        return false;
    }
};

/**
 * Legacy compatibility: canSeeAllProjects
 * Returns true if user has elevated visibility (AD, MGR, or COORD).
 * For listing / filtering non-private projects.
 */
const canSeeAllProjects = async (req) => {
    // console.log(`canSeeAllProjects :`, req.user);
    // console.log(`canSeeAllProjects :`, (await isSuperAdmin(req)) || (await isManagerOrCoord(req)));
    return (await isSuperAdmin(req)) || (await isManagerOrCoord(req));
};

// ═══════════════════════════════════════════════════════════════════
//  3. PROJECT-LEVEL CHECKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Can the user ACCESS a specific project?
 *   AD          → always (even private)
 *   MGR/COORD   → public projects always; private only if member
 *   Regular     → only if member
 */
const canAccessProject = async (req, projectId) => {
    // console.log(`canAccessProject :`, req.user);
    const uCode = req.user?.empno; // Fix: req.user.empno instead of req.user.id
    if (!uCode) return false;

    // Check project existence + privacy
    const { rows } = await engPool.query(
        'SELECT is_private FROM kb_project WHERE id = $1', [projectId]
    );
    if (!rows[0]) return false;
    const isPrivate = rows[0].is_private;

    // AD → always
    if (await isSuperAdmin(req)) return true;

    // Check membership
    const isMember = await isProjectMember(projectId, uCode);

    // Private project: only members + AD (already returned above)
    if (isPrivate) return isMember;

    // Public project: MGR/COORD can access without membership
    if (await isManagerOrCoord(req)) return true;

    return isMember;
};

/**
 * Can the user MANAGE a project (settings, members, delete)?
 *   AD            → always
 *   Public:  Owner, MGR/COORD
 *   Private: Owner ONLY (MGR/COORD blocked unless they ARE the owner)
 */
const canManageProject = async (req, projectId) => {
    const uCode = req.user?.empno;
    if (!uCode) return false;

    // 1. AD → always
    if (await isSuperAdmin(req)) return true;

    // 2. Check project privacy
    const { rows: projRows } = await engPool.query(
        'SELECT is_private FROM kb_project WHERE id = $1', [projectId]
    );
    if (!projRows[0]) return false;
    const isPrivate = projRows[0].is_private;

    // 3. Project Owner check
    const membership = await getProjectMembership(projectId, uCode);
    const isOwner = membership?.role === 'owner';
    if (isOwner) return true;

    // 4. MGR/COORD — only for PUBLIC projects
    if (!isPrivate && (await isManagerOrCoord(req))) return true;

    return false;
};

// ═══════════════════════════════════════════════════════════════════
//  4. BOARD-LEVEL CHECKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Can the user MANAGE a board (members, delete, settings)?
 * (Note: maps to frontend canManageBoardMembers)
 *   AD → always
 *   Public:  Project Owner, MGR/COORD, Board Owner
 *   Private: Project Owner, Board Owner, MGR/COORD (only if project member)
 */
const canManageBoard = async (req, boardId) => {
    const uCode = req.user?.empno;
    if (!uCode) return false;

    // Fetch board → project
    const { rows: [board] } = await engPool.query(
        'SELECT project_id FROM kb_board WHERE id=$1', [boardId]
    );
    if (!board) return false;

    // Delegate to project-level manage (handles AD, Owner, MGR/COORD + privacy)
    if (await canManageProject(req, board.project_id)) return true;

    // Board Owner
    const boardMbr = await getBoardMembership(boardId, uCode);
    if (boardMbr?.role === 'owner') return true;

    // Private project: MGR/COORD can manage board IF they are a project member
    const { rows: projRows } = await engPool.query(
        'SELECT is_private FROM kb_project WHERE id=$1', [board.project_id]
    );
    const isPrivate = projRows[0]?.is_private;
    if (isPrivate && (await isManagerOrCoord(req))) {
        return await isProjectMember(board.project_id, uCode);
    }

    return false;
};

/**
 * Can the user EDIT board content (lists, settings, and structure)?
 * (Note: maps to frontend canEditBoard and canManageBoardStructure)
 *   canManageBoard OR board editor
 *   Public:  also any project editor/member
 *   Private: only explicit board editor (or manage-level)
 */
const canEditBoard = async (req, boardId) => {
    const uCode = req.user?.empno;
    if (!uCode) return false;

    // 1. Board owner/editor (explicit membership)
    const boardMbr = await getBoardMembership(boardId, uCode);
    if (boardMbr && ['owner', 'editor'].includes(boardMbr.role)) return true;

    // 2. Fetch board → project
    const { rows: [board] } = await engPool.query(
        'SELECT project_id, is_private FROM kb_board WHERE id=$1', [boardId]
    );
    if (!board) return false;

    // 3. Project-level manage (handles AD, Owner, MGR/COORD + privacy)
    if (await canManageProject(req, board.project_id)) return true;

    // 4. For PUBLIC boards: any project member with editor+ role can edit
    if (!board.is_private) {
        const projMbr = await getProjectMembership(board.project_id, uCode);
        if (projMbr && ['owner', 'editor'].includes(projMbr.role)) return true;

        // MGR/COORD on public project can always edit
        if (await isManagerOrCoord(req)) return true;
    }

    return false;
};

// ═══════════════════════════════════════════════════════════════════
//  5. CARD-LEVEL CHECKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Does the user have board-level override for card operations?
 * (Board Owner, or project-level manage)
 */
const hasBoardLevelOverride = async (req, boardId) => {
    const uCode = req.user?.empno;
    if (!uCode) return false;

    const boardMbr = await getBoardMembership(boardId, uCode);
    if (boardMbr?.role === 'owner') return true;

    const { rows: [board] } = await engPool.query(
        'SELECT project_id FROM kb_board WHERE id=$1', [boardId]
    );
    if (!board) return false;
    return await canManageProject(req, board.project_id);
};

/**
 * Can the user MANAGE a card (delete, assign members)?
 *   Card Owner + board-level override
 */
const canManageCard = async (req, cardId) => {
    const uCode = req.user?.empno;
    if (!uCode) return false;

    const { rows: [card] } = await engPool.query(
        'SELECT board_id, is_private FROM kb_card WHERE id=$1', [cardId]
    );
    if (!card) return false;

    // Card Owner
    const cardMbr = await getCardMembership(cardId, uCode);
    if (cardMbr?.role === 'owner') return true;

    // Board-level override
    return await hasBoardLevelOverride(req, card.board_id);
};

/**
 * Can the user EDIT a card (content, status)?
 *   Any card member (regardless of role) OR any board member OR board-level override (AD/MGR/COORD/Board Owner)
 */
const canEditCard = async (req, cardId) => {
    const uCode = req.user?.empno;
    if (!uCode) return false;

    const { rows: [card] } = await engPool.query(
        'SELECT board_id, is_private FROM kb_card WHERE id=$1', [cardId]
    );
    if (!card) return false;

    // Any explicit card member can edit
    const cardMbr = await getCardMembership(cardId, uCode);
    if (cardMbr) return true;

    // Check if the user has permission to edit the board (covers board editors, project editors, etc.)
    return await canEditBoard(req, card.board_id);
};

/**
 * Can the user VIEW a card?
 *   Non-private cards: everyone with project access
 *   Private cards: explicit card member or board-level override
 */
const canViewCard = async (req, cardId) => {
    const uCode = req.user?.empno;
    if (!uCode) return false;

    const { rows: [card] } = await engPool.query(
        'SELECT c.board_id, c.is_private, b.project_id FROM kb_card c JOIN kb_board b ON b.id = c.board_id WHERE c.id=$1', [cardId]
    );
    if (!card) return false;

    // Board-level override (AD, Project Owner, Board Owner)
    if (await hasBoardLevelOverride(req, card.board_id)) return true;

    // Explicit card member
    const cardMbr = await getCardMembership(cardId, uCode);
    if (cardMbr) return true;

    // If private card, must be explicit member or have override (checked above)
    if (card.is_private) return false;

    // Non-private card → visible to anyone with PROJECT access
    return await canAccessProject(req, card.project_id);
};

/**
 * Can the user VIEW a board?
 *   Non-private boards: everyone with project access
 *   Private boards: explicit board member or project-level override
 */
const canViewBoard = async (req, boardId) => {
    const uCode = req.user?.empno;
    if (!uCode) return false;

    const { rows: [board] } = await engPool.query('SELECT project_id, is_private FROM kb_board WHERE id=$1', [boardId]);
    if (!board) return false;

    const mbr = await getBoardMembership(boardId, uCode);
    if (mbr) return true;

    if (await canManageProject(req, board.project_id)) return true;

    if (board.is_private) return false;

    return await canAccessProject(req, board.project_id);
};

// ═══════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    // Membership queries
    getProjectMembership,
    getBoardMembership,
    getCardMembership,
    isProjectMember,

    // Global role checks (SEPARATED)
    isSuperAdmin,       // AD only — God mode
    isManagerOrCoord,   // MGR/COORD — conditional on project privacy
    canSeeAllProjects,  // Legacy: AD + MGR + COORD (for project listing)

    // Project-level
    canAccessProject,
    canManageProject,

    // Board-level
    canManageBoard,
    canEditBoard,
    canViewBoard,

    // Card-level
    hasBoardLevelOverride,
    canManageCard,
    canEditCard,
    canViewCard,
};
