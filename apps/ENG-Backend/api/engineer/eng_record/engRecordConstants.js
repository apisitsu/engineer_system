// ============================================================
// Engineer Record Constants
// ============================================================

const TABLE = {
    RECORD: 'engr_record',
    MONTHLY_SUMMARY: 'engr_monthly_summary',
    SYNC_LOG: 'engr_sync_log',
};

const CASE_TYPES = [
    'Request Drawing',
    'Judgment Spec',
    'Request change DWG/Traveler',
    'DWG/Traveler Problem',
    'Special',
];

// Whitelist of allowed columns for dynamic filtering (prevents SQL injection)
const ALLOWED_FILTER_COLUMNS = {
    record_no: 'record_no',
    request_date: 'request_date',
    request_by: 'request_by',
    lot_no: 'lot_no',
    cn: 'cn',
    pn: 'pn',
    plant: 'plant',
    case_type: 'case_type',
    spec_problem: 'spec_problem',
    judge_revise: 'judge_revise',
    reason: 'reason',
    judgment_by: 'judgment_by',
    finish_date: 'finish_date',
    plan_start_date: 'plan_start_date',
    remark: 'remark',
    responsible: 'responsible',
    confirm_codi: 'confirm_codi',
    comment: 'comment',
    ts_flag: 'ts_flag',
    created_at: 'created_at',
};

const ALLOWED_SORT_COLUMNS = {
    record_no: 'record_no',
    request_date: 'request_date',
    lot_no: 'lot_no',
    cn: 'cn',
    pn: 'pn',
    case_type: 'case_type',
    finish_date: 'finish_date',
    responsible: 'responsible',
    judgment_by: 'judgment_by',
    created_at: 'created_at',
    updated_at: 'updated_at',
};

const ALLOWED_OPS = {
    '>': '>',
    '<': '<',
    '=': '=',
    '>=': '>=',
    '<=': '<=',
    'IS NULL': 'IS NULL',
    'IS NOT NULL': 'IS NOT NULL',
};

// Excel column mapping (0-indexed to DB column)
const EXCEL_COL_MAP = {
    0: 'record_no',
    1: 'request_date',
    // 2: month (derived, skip)
    3: 'request_by',
    4: 'lot_no',
    5: 'cn',
    6: 'pn',
    7: 'plant',
    8: 'case_type',
    9: 'spec_problem',
    10: 'judge_revise',
    11: 'reason',
    12: 'judgment_by',
    13: 'finish_date',
    // 14: waiting_time (computed, skip)
    // 15: finished_time (computed, skip)
    // 16: overtime (computed, skip)
    17: 'plan_start_date',
    18: 'remark',
    19: 'responsible',
    20: 'confirm_codi',
    21: 'comment',
    // 22: timestamp (skip)
    23: 'ts_flag',
};

// RBAC Permissions
const PERMISSIONS = {
    // PC/MC: Submit (Create) + Read-only (Track)
    SUBMITTER: ['PC/MC'],
    // Engineers: Full CRUD on judge/revise fields
    ENGINEER: ['ENG'],
    // Admin/Manager: Full access
    ADMIN: ['AD', 'MGR', 'COORD'],
};

// ─── Quick-Action Templates (migrated from VBA UserForm2) ──

const QUICK_TEMPLATES = [
    {
        id: 'no_drawing',
        label: 'No Drawing',
        icon: 'FileUnknownOutlined',
        color: '#1677ff',
        case_type: 'Request Drawing',
        request_by: 'PC/MC',
        spec_problem: 'No drawing',
        judge_revise: 'Please up Drawing To Innovator',
        reason: 'Innovator is no Drawing',
        description: 'DWG ไม่มีใน Innovator → ขอ Upload',
    },
    {
        id: 'change_arbor',
        label: 'Change Arbor',
        icon: 'SwapOutlined',
        color: '#fa8c16',
        case_type: 'Request change DWG/Traveler',
        request_by: 'MFG',
        spec_problem: null, // Previously fetched from ARBOR REQUEST.xlsb
        judge_revise: 'Revise by hand',
        reason: 'Production request with test result',
        description: 'เปลี่ยน Arbor (เดิมดึงจาก ARBOR REQUEST file)',
        needs_manual_input: ['spec_problem'],
    },
    {
        id: 'no_cutoff_spec',
        label: 'No Cut-off Spec',
        icon: 'ScissorOutlined',
        color: '#f5222d',
        case_type: 'DWG/Traveler Problem',
        request_by: 'PC/MC',
        spec_problem: 'No cut off spec',
        judge_revise: null, // Calculated from head_dia and total_length
        reason: 'RM21101',
        description: 'ไม่มี Cut-off Spec → คำนวณ D1 Length',
        has_calculator: true,
        calculator_fields: [
            { name: 'head_dia', label: 'Head Dia of Body', type: 'number' },
            { name: 'total_length', label: 'Total Length', type: 'number' },
        ],
    },
    {
        id: 'hardness_reject',
        label: 'Hardness Reject',
        icon: 'ExperimentOutlined',
        color: '#722ed1',
        case_type: 'Judgment Spec',
        request_by: 'QA',
        spec_problem: null, // Previously fetched from REJECT HEAT TREATMENT.xlsm
        judge_revise: null,
        reason: null,
        description: 'Hardness Reject จาก QA (เดิมดึงจาก QA Report)',
        needs_manual_input: ['spec_problem', 'reason'],
    },
    {
        id: 'laser_marking',
        label: 'Laser Marking',
        icon: 'HighlightOutlined',
        color: '#13c2c2',
        case_type: 'Request change DWG/Traveler',
        request_by: 'MFG',
        spec_problem: 'Marking',
        judge_revise: 'Revise by hand',
        reason: 'MFG need to change Electro marking to Laser marking',
        description: 'เปลี่ยน Electro marking → Laser marking',
    },
    {
        id: 'milling_problem',
        label: 'Milling Problem',
        icon: 'ToolOutlined',
        color: '#eb2f96',
        case_type: 'Request change DWG/Traveler',
        request_by: 'MFG',
        spec_problem: null, // Previously fetched from Milling problem checking.xlsm
        judge_revise: null,
        reason: null,
        description: 'ปัญหา Milling (เดิมดึงจาก Milling Checking file)',
        needs_manual_input: ['spec_problem', 'judge_revise', 'reason'],
    },
    {
        id: 'add_drill_hole',
        label: 'Add Drill Hole',
        icon: 'PlusCircleOutlined',
        color: '#52c41a',
        case_type: 'Request change DWG/Traveler',
        request_by: 'PC/MC',
        spec_problem: 'Add 0421 Drill hole process',
        judge_revise: 'Revise by hand',
        reason: 'No tube material available',
        description: 'เพิ่ม Process Drill Hole 0421',
    },
    {
        id: 'remove_drill_hole',
        label: 'Remove Drill Hole',
        icon: 'MinusCircleOutlined',
        color: '#ff4d4f',
        case_type: 'Request change DWG/Traveler',
        request_by: 'PC/MC',
        spec_problem: 'Remove Drill hole process',
        judge_revise: 'Revise by hand',
        reason: 'Tube material',
        description: 'ลบ Process Drill Hole',
    },
    {
        id: 'revise_inner_205',
        label: 'Revise Inner 205',
        icon: 'EditOutlined',
        color: '#faad14',
        case_type: 'Special',
        request_by: 'MFG',
        spec_problem: "Mat'l problem can't control total width by bolt M/C",
        judge_revise: 'Revise dimension to 17.00(+0.05/-0.05)',
        reason: 'Bolt M/C chuck at neck area',
        description: 'ปัญหา Material ควบคุม Total Width ไม่ได้',
    },
    {
        id: 'revise_inner_215',
        label: 'Revise Inner 215',
        icon: 'EditOutlined',
        color: '#a0d911',
        case_type: 'Special',
        request_by: 'MFG',
        spec_problem: 'Production request separate process drawing',
        judge_revise: 'Revise lot no. on ME10',
        reason: null,
        description: 'ขอแยก Process Drawing',
    },
    {
        id: 'accept_keyway',
        label: 'Accept Keyway',
        icon: 'SafetyCertificateOutlined',
        color: '#2f54eb',
        case_type: 'Special',
        request_by: 'MFG',
        spec_problem: null, // Previously fetched from Keyway R problem checking test.xlsm
        judge_revise: 'Special Accept',
        reason: null,
        description: 'Accept Keyway (เดิมดึงจาก Keyway Checking file)',
        needs_manual_input: ['spec_problem', 'reason'],
    },
    {
        id: 'part_reject',
        label: 'Part Reject',
        icon: 'CloseCircleOutlined',
        color: '#cf1322',
        case_type: 'Judgment Spec',
        request_by: 'QC',
        spec_problem: null,
        judge_revise: null,
        reason: null,
        description: 'QC Part Reject → กรอกรายละเอียดเอง',
        needs_manual_input: ['spec_problem', 'judge_revise', 'reason'],
    },
];

// ─── TS Flag (Due-Status Tags from Finished Macro) ─────────

const TS_FLAG = {
    ALRD_PASS_DUE: 'ALRD PASS DUE',
    ON_DUE: 'ON DUE',
    PASS_DUE: 'PASS DUE',
    FAST: "You're so fast! :D",
    SLOW: 'Too sad :(',
};

module.exports = {
    TABLE,
    CASE_TYPES,
    ALLOWED_FILTER_COLUMNS,
    ALLOWED_SORT_COLUMNS,
    ALLOWED_OPS,
    EXCEL_COL_MAP,
    PERMISSIONS,
    QUICK_TEMPLATES,
    TS_FLAG,
};
