/**
 * mockData.js
 * 
 * Centralized mock data for the Kanban User Guide.
 * Every guide component imports from here to ensure consistency.
 * Data mirrors the production schema to build muscle-memory in the user.
 */

// ─── USERS ──────────────────────────────────────────────────────────
export const MOCK_USERS = [
    { u_code: 'LE131', u_name: 'Pongsakorn L.', u_nickname: 'Boss', dept: 'AD', profile_img_b64: null },
    { u_code: 'JD042', u_name: 'John Doe', u_nickname: 'JD', dept: 'ENG', profile_img_b64: null },
    { u_code: 'AS073', u_name: 'Alice Smith', u_nickname: 'Ali', dept: 'ENG', profile_img_b64: null },
    { u_code: 'BW019', u_name: 'Bob Wilson', u_nickname: 'Bob', dept: 'QA', profile_img_b64: null },
    { u_code: 'MK088', u_name: 'Maria Kim', u_nickname: 'MK', dept: 'ENG', profile_img_b64: null },
    { u_code: 'TR055', u_name: 'Tom Rogers', u_nickname: 'TR', dept: 'PROD', profile_img_b64: null },
];

// ─── LABELS ─────────────────────────────────────────────────────────
export const MOCK_LABELS = [
    { id: 1, name: 'Critical', color: '#ef5350' },
    { id: 2, name: 'Design', color: '#42a5f5' },
    { id: 3, name: 'Review', color: '#66bb6a' },
    { id: 4, name: 'Bug', color: '#ff7043' },
    { id: 5, name: 'Enhancement', color: '#ab47bc' },
    { id: 6, name: 'Documentation', color: '#26c6da' },
    { id: 7, name: 'Testing', color: '#ffa726' },
    { id: 8, name: 'Blocked', color: '#8d6e63' },
];

export const LABEL_PALETTE = [
    '#ef5350', '#ec407a', '#ab47bc', '#7e57c2', '#5c6bc0',
    '#42a5f5', '#29b6f6', '#26c6da', '#26a69a', '#66bb6a',
    '#9ccc65', '#d4e157', '#ffee58', '#ffca28', '#ffa726',
    '#ff7043', '#8d6e63', '#78909c', '#546e7a', '#37474f',
];

// ─── PROJECTS ───────────────────────────────────────────────────────
export const MOCK_PROJECTS = [
    {
        id: 1, name: 'Swage Tool Redesign', description: 'Complete redesign of the swage assembly tooling for next-gen bearings.',
        status: 'active', is_private: false, is_favorite: true, role: 'owner',
        icon: 'rocket', background_value: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        board_count: 4, created_at: '2026-04-01T08:00:00Z',
    },
    {
        id: 2, name: 'Tumble Process Optimization', description: 'FEA simulation and process parameter optimization.',
        status: 'active', is_private: true, is_favorite: false, role: 'owner',
        icon: 'flash', background_value: 'linear-gradient(135deg,#0ea5e9,#3b82f6)',
        board_count: 2, created_at: '2026-04-10T09:00:00Z',
    },
    {
        id: 3, name: 'ECR System Migration', description: 'Migrate legacy ECR workflows to the new digital platform.',
        status: 'active', is_private: false, is_favorite: false, role: 'editor',
        icon: 'globe', background_value: 'linear-gradient(135deg,#10b981,#059669)',
        board_count: 3, created_at: '2026-03-15T07:30:00Z',
    },
    {
        id: 4, name: 'Quality Dashboard v2', description: 'Upgrade the QA monitoring dashboard with real-time metrics.',
        status: 'waiting', is_private: false, is_favorite: false, role: 'editor',
        icon: 'chart', background_value: 'linear-gradient(135deg,#f59e0b,#ef4444)',
        board_count: 1, created_at: '2026-04-20T10:00:00Z',
    },
    {
        id: 5, name: 'Bearing Test Rig', description: 'Mechanical design for high-speed bearing test fixture.',
        status: 'completed', is_private: false, is_favorite: true, role: 'owner',
        icon: 'construct', background_value: 'linear-gradient(135deg,#475569,#1e293b)',
        board_count: 2, created_at: '2025-12-01T08:00:00Z',
    },
    {
        id: 6, name: 'Confidential R&D', description: 'Next-generation material research (restricted access).',
        status: 'suspended', is_private: true, is_favorite: false, role: 'viewer',
        icon: 'shield', background_value: 'linear-gradient(135deg,#ec4899,#f43f5e)',
        board_count: 1, created_at: '2026-01-15T08:00:00Z',
    },
];

// ─── BOARDS ─────────────────────────────────────────────────────────
export const MOCK_BOARDS = [
    { id: 101, name: 'Phase 1: Design & FEA', priority: 'HIGH', status: 'active', due_date: '2026-06-30', background: 'linear-gradient(135deg,#667eea,#764ba2)', allow_add_card: true },
    { id: 102, name: 'Phase 2: Prototyping', priority: 'MEDIUM', status: 'active', due_date: '2026-08-15', background: '#0079bf', allow_add_card: true },
    { id: 103, name: 'Testing & Validation', priority: 'LOW', status: 'pool', due_date: null, background: '#519839', allow_add_card: true },
    { id: 104, name: 'Documentation', priority: 'MEDIUM', status: 'finished', due_date: '2026-05-01', background: '#d29034', allow_add_card: false },
];

// ─── BOARD GROUPS ───────────────────────────────────────────────────
export const MOCK_BOARD_GROUPS = [
    { id: 201, name: 'Design Phase', board_ids: [101, 102] },
    { id: 202, name: 'Validation', board_ids: [103] },
];

// ─── LISTS ──────────────────────────────────────────────────────────
export const MOCK_LISTS = [
    { id: 301, name: 'Backlog', position: 65536, board_id: 101 },
    { id: 302, name: 'In Progress', position: 131072, board_id: 101 },
    { id: 303, name: 'Review', position: 196608, board_id: 101 },
    { id: 304, name: 'Done', position: 262144, board_id: 101 },
];

// ─── CARDS ──────────────────────────────────────────────────────────
export const MOCK_CARDS = {
    301: [
        {
            id: 401, name: 'Define material specifications for inner race',
            description: 'Research 17-4PH stainless steel properties for the inner race component.',
            priority: 'high', due_date: '2026-05-20', list_id: 301,
            labels: [{ id: 1, name: 'Critical', color: '#ef5350' }],
            assignees: ['JD042', 'AS073'],
            comment_count: 3, attachment_count: 2,
            total_tasks: 5, completed_tasks: 2,
            is_private: false, is_suspended: false,
            parent_id: null, total_children_count: 2, completed_children_count: 1,
            created_at: '2026-04-15T09:00:00Z', list_changed_at: '2026-04-28T14:00:00Z',
            action_in_progress_at: null, action_done_at: null,
            estimated_hours: 8, memo: 'Coordinate with QA for material cert.',
            problem_detail: null, solution_detail: null, issue_count: 0,
        },
        {
            id: 402, name: 'Create 3D CAD model — outer housing',
            description: null, priority: 'medium', due_date: '2026-05-25', list_id: 301,
            labels: [{ id: 2, name: 'Design', color: '#42a5f5' }],
            assignees: ['MK088'],
            comment_count: 0, attachment_count: 0,
            total_tasks: 0, completed_tasks: 0,
            is_private: false, is_suspended: false,
            parent_id: 401, total_children_count: 0, completed_children_count: 0,
            created_at: '2026-04-18T10:00:00Z', list_changed_at: '2026-04-18T10:00:00Z',
            action_in_progress_at: null, action_done_at: null,
            estimated_hours: 16, memo: null,
            problem_detail: null, solution_detail: null, issue_count: 0,
        },
    ],
    302: [
        {
            id: 403, name: 'Run FEA simulation for swage press force',
            description: 'Use Ansys to simulate radial compression forces at 12,000 lbf.',
            priority: 'high', due_date: '2026-05-15', list_id: 302,
            labels: [{ id: 1, name: 'Critical', color: '#ef5350' }, { id: 2, name: 'Design', color: '#42a5f5' }],
            assignees: ['LE131', 'JD042'],
            comment_count: 7, attachment_count: 4,
            total_tasks: 8, completed_tasks: 5,
            is_private: false, is_suspended: false,
            parent_id: null, total_children_count: 0, completed_children_count: 0,
            created_at: '2026-04-10T08:00:00Z', list_changed_at: '2026-05-01T10:30:00Z',
            action_in_progress_at: '2026-05-01T10:30:00Z', action_done_at: null,
            estimated_hours: 24, memo: 'Use non-linear contact elements for die/race interface.',
            problem_detail: 'Convergence failure at step 15 — mesh too coarse at contact zone.',
            solution_detail: 'Refined mesh to 0.5mm element size at contact region.',
            issue_count: 1,
        },
    ],
    303: [
        {
            id: 404, name: 'Peer review: bearing clearance calculations',
            description: 'Cross-check radial clearance values against AS9100 spec.',
            priority: 'medium', due_date: null, list_id: 303,
            labels: [{ id: 3, name: 'Review', color: '#66bb6a' }],
            assignees: ['BW019'],
            comment_count: 2, attachment_count: 1,
            total_tasks: 3, completed_tasks: 3,
            is_private: false, is_suspended: false,
            parent_id: null, total_children_count: 0, completed_children_count: 0,
            created_at: '2026-04-20T11:00:00Z', list_changed_at: '2026-05-03T09:00:00Z',
            action_in_progress_at: '2026-04-25T08:00:00Z', action_done_at: null,
            estimated_hours: 4, memo: null,
            problem_detail: null, solution_detail: null, issue_count: 0,
        },
    ],
    304: [
        {
            id: 405, name: 'Submit material PO for 440C ball stock',
            description: 'Purchase order submitted and confirmed.',
            priority: 'low', due_date: '2026-04-30', list_id: 304,
            labels: [],
            assignees: ['TR055'],
            comment_count: 1, attachment_count: 1,
            total_tasks: 2, completed_tasks: 2,
            is_private: false, is_suspended: false,
            parent_id: null, total_children_count: 0, completed_children_count: 0,
            created_at: '2026-04-05T07:00:00Z', list_changed_at: '2026-04-28T16:00:00Z',
            action_in_progress_at: '2026-04-10T09:00:00Z', action_done_at: '2026-04-28T16:00:00Z',
            estimated_hours: 2, memo: null,
            problem_detail: null, solution_detail: null, issue_count: 0,
        },
    ],
};

// A single suspended card for demonstration
export const MOCK_SUSPENDED_CARD = {
    id: 410, name: 'Fixture calibration (SUSPENDED)',
    description: 'Calibration paused pending equipment availability.',
    priority: 'medium', due_date: '2026-06-01', list_id: 302,
    labels: [{ id: 8, name: 'Blocked', color: '#8d6e63' }],
    assignees: ['AS073'],
    comment_count: 0, attachment_count: 0,
    total_tasks: 0, completed_tasks: 0,
    is_private: false, is_suspended: true,
    suspended_reason: 'Waiting for calibrated load cell from vendor.',
    parent_id: null, total_children_count: 0, completed_children_count: 0,
    created_at: '2026-04-22T08:00:00Z', list_changed_at: '2026-04-25T11:00:00Z',
    action_in_progress_at: '2026-04-25T11:00:00Z', action_done_at: null,
    estimated_hours: 6, memo: null,
};

// ─── TASK LISTS (CHECKLISTS) ────────────────────────────────────────
export const MOCK_TASK_LISTS = [
    {
        id: 501, name: 'Pre-Analysis Checklist', card_id: 403, position: 1,
        tasks: [
            { id: 601, name: 'Verify material properties in database', is_completed: true, position: 1 },
            { id: 602, name: 'Define boundary conditions', is_completed: true, position: 2 },
            { id: 603, name: 'Create mesh convergence study', is_completed: true, position: 3 },
            { id: 604, name: 'Setup contact pairs', is_completed: false, position: 4 },
            { id: 605, name: 'Run initial linear solve', is_completed: false, position: 5 },
        ],
    },
    {
        id: 502, name: 'Post-Analysis Review', card_id: 403, position: 2,
        tasks: [
            { id: 606, name: 'Validate stress distribution', is_completed: true, position: 1 },
            { id: 607, name: 'Check deformation limits', is_completed: true, position: 2 },
            { id: 608, name: 'Generate report with screenshots', is_completed: false, position: 3 },
        ],
    },
];

// ─── COMMENTS ───────────────────────────────────────────────────────
export const MOCK_COMMENTS = [
    { id: 701, card_id: 403, u_code: 'JD042', text: 'Mesh refinement improved convergence. Proceeding with non-linear run.', created_at: '2026-05-02T14:30:00Z' },
    { id: 702, card_id: 403, u_code: 'LE131', text: '@JD042 Great work. Please share the stress contour plots when ready.', created_at: '2026-05-02T15:10:00Z' },
    { id: 703, card_id: 403, u_code: 'AS073', text: 'I can help with the boundary condition validation. Adding myself to the card.', created_at: '2026-05-03T09:00:00Z' },
];

// ─── ATTACHMENTS ────────────────────────────────────────────────────
export const MOCK_ATTACHMENTS = [
    { id: 801, card_id: 403, file_name: 'FEA_Results_v3.pdf', file_type: 'application/pdf', file_size: 2457600, created_at: '2026-05-02T16:00:00Z', u_code: 'JD042' },
    { id: 802, card_id: 403, file_name: 'stress_contour.png', file_type: 'image/png', file_size: 891200, created_at: '2026-05-02T16:05:00Z', u_code: 'JD042' },
    { id: 803, card_id: 403, file_name: 'material_cert_17-4PH.xlsx', file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file_size: 45000, created_at: '2026-04-20T10:00:00Z', u_code: 'LE131' },
    { id: 804, card_id: 403, link_url: 'H:\\Engineering\\Swage\\FEA_Model_v3.wbpj', link_name: 'Ansys Model (Network Drive)', file_type: 'link', created_at: '2026-05-03T08:00:00Z', u_code: 'LE131' },
];

// ─── NOTIFICATIONS ──────────────────────────────────────────────────
export const MOCK_NOTIFICATIONS = [
    { id: 901, notif_type: 'mentionInComment', actor_u_code: 'JD042', card_id: 403, is_read: false, created_at: '2026-05-05T14:30:00Z', notif_data: { text: '@LE131 Mesh convergence analysis attached.' } },
    { id: 902, notif_type: 'addMemberToCard', actor_u_code: 'AS073', card_id: 403, is_read: false, created_at: '2026-05-05T09:00:00Z', notif_data: null },
    { id: 903, notif_type: 'commentCard', actor_u_code: 'BW019', card_id: 404, is_read: true, created_at: '2026-05-04T16:00:00Z', notif_data: { text: 'Clearance values verified. Approved.' } },
    { id: 904, notif_type: 'mentionInComment', actor_u_code: 'MK088', card_id: 402, is_read: true, created_at: '2026-05-03T11:00:00Z', notif_data: { text: '@LE131 Outer housing CAD model in progress.' } },
];

// ─── ISSUES ─────────────────────────────────────────────────────────
export const MOCK_ISSUES = [
    {
        id: 1001, card_id: 403,
        problem_detail: 'Convergence failure at step 15 — mesh too coarse at contact zone.',
        solution_detail: 'Refined mesh to 0.5mm element size at contact region. Re-ran with augmented Lagrangian contact.',
        status: 'resolved', created_at: '2026-05-01T15:00:00Z', u_code: 'JD042',
    },
];

// ─── ACTIVITY LOG ───────────────────────────────────────────────────
export const MOCK_ACTIVITY = [
    { id: 1101, card_id: 403, action: 'moved_card', details: 'Moved from "Backlog" to "In Progress"', u_code: 'LE131', created_at: '2026-05-01T10:30:00Z' },
    { id: 1102, card_id: 403, action: 'added_member', details: 'Added JD042 to card', u_code: 'LE131', created_at: '2026-04-28T14:00:00Z' },
    { id: 1103, card_id: 403, action: 'set_due_date', details: 'Set due date to May 15, 2026', u_code: 'LE131', created_at: '2026-04-20T10:30:00Z' },
    { id: 1104, card_id: 403, action: 'created_card', details: 'Card created', u_code: 'LE131', created_at: '2026-04-10T08:00:00Z' },
];

// ─── TEMPLATES ──────────────────────────────────────────────────────
export const MOCK_CARD_TEMPLATES = [
    { id: 1201, name: 'Standard Engineering Task', description: 'Pre-configured card with design checklist', created_by: 'LE131', created_at: '2026-03-01T08:00:00Z' },
    { id: 1202, name: 'Bug Report Template', description: 'Card template for QA issue tracking', created_by: 'BW019', created_at: '2026-03-15T09:00:00Z' },
];

export const MOCK_CHECKLIST_TEMPLATES = [
    { id: 1301, name: 'FEA Pre-Analysis Checklist', items_count: 8, created_by: 'LE131' },
    { id: 1302, name: 'Design Review Checklist', items_count: 12, created_by: 'JD042' },
];

export const MOCK_LABEL_TEMPLATES = [
    { id: 1401, name: 'Engineering Standard Labels', labels_count: 6, created_by: 'LE131' },
];

// ─── BOARD MEMBERS ──────────────────────────────────────────────────
export const MOCK_BOARD_MEMBERS = [
    { u_code: 'LE131', role: 'owner' },
    { u_code: 'JD042', role: 'editor' },
    { u_code: 'AS073', role: 'editor' },
    { u_code: 'BW019', role: 'viewer' },
];

export const MOCK_PROJECT_MANAGERS = [
    { u_code: 'LE131', role: 'owner' },
    { u_code: 'JD042', role: 'editor' },
    { u_code: 'MK088', role: 'editor' },
    { u_code: 'TR055', role: 'viewer' },
];

// ─── RBAC MATRIX ────────────────────────────────────────────────────
export const RBAC_MATRIX = [
    { action: 'View Board', owner: true, editor: true, viewer: true },
    { action: 'Create Card', owner: true, editor: true, viewer: false },
    { action: 'Edit Card', owner: true, editor: true, viewer: false },
    { action: 'Move Card', owner: true, editor: true, viewer: false },
    { action: 'Delete Card', owner: true, editor: false, viewer: false },
    { action: 'Create List', owner: true, editor: true, viewer: false },
    { action: 'Delete List', owner: true, editor: false, viewer: false },
    { action: 'Manage Board Members', owner: true, editor: false, viewer: false },
    { action: 'Board Settings', owner: true, editor: false, viewer: false },
    { action: 'Archive Card', owner: true, editor: true, viewer: false },
    { action: 'Suspend Card', owner: true, editor: false, viewer: false },
    { action: 'Set Privacy (Card)', owner: true, editor: false, viewer: false },
    { action: 'Manage Labels', owner: true, editor: true, viewer: false },
    { action: 'Set Estimated Hours', owner: true, editor: true, viewer: false },
    { action: 'Comment', owner: true, editor: true, viewer: true },
    { action: 'Join Card', owner: true, editor: true, viewer: true },
    { action: 'Manage Templates', owner: true, editor: false, viewer: false },
    { action: 'Delete Project', owner: true, editor: false, viewer: false },
];

// ─── PRIORITY CONFIG ────────────────────────────────────────────────
export const PRIORITY_CONFIG = {
    LOW:    { label: 'Low',    emoji: '🟢', color: '#52c41a', bg: '#e6f7ff', border: '#91d5ff' },
    MEDIUM: { label: 'Medium', emoji: '🔵', color: '#1677ff', bg: '#fff7e6', border: '#ffd591' },
    HIGH:   { label: 'High',   emoji: '🟠', color: '#fa8c16', bg: '#fff1f0', border: '#ffa39e' },
    URGENT: { label: 'Urgent', emoji: '🔴', color: '#f5222d', bg: '#fff1f0', border: '#ffa39e' },
};

// ─── SYSTEM SETTINGS ────────────────────────────────────────────────
export const MOCK_SYSTEM_SETTINGS = [
    { setting_key: 'enable_list_card_limit', setting_value: 'true' },
    { setting_key: 'default_list_card_limit', setting_value: '10' },
];
