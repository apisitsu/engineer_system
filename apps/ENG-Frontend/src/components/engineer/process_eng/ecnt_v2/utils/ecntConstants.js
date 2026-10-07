// Master Stage Definitions, Role Mapping, and SLA Targets for ECNT V2

export const ECNT_STAGES = [
    {
        code: 'STAGE_1',
        title: '1. ECR Initiation',
        shortTitle: 'ECR Init',
        description: 'Requester submits change request and technical details (Blocks 1-2)',
        phase: 'ECR',
        type: 'STANDARD',
        picRole: 'Requester',
        picName: 'Requester',
        slaHours: 4,
        color: '#1890ff',
        bg: '#e6f7ff'
    },
    {
        code: 'STAGE_2',
        title: '2. Dept Mgr Review',
        shortTitle: 'Dept Mgr',
        description: 'Requester Department Manager technical & feasibility approval (Block 3)',
        phase: 'ECR',
        type: 'DECISION',
        picRole: 'Dept Manager',
        picName: 'Dept Manager',
        slaHours: 24,
        color: '#722ed1',
        bg: '#f9f0ff'
    },
    {
        code: 'STAGE_2_R1',
        title: '2-R1. Dept Mgr Clarification',
        shortTitle: 'Rework (Dept Mgr)',
        description: 'Returned to Requester for additional technical details / revisions',
        phase: 'REWORK',
        type: 'RETURN_LOOP',
        picRole: 'Requester',
        picName: 'Requester',
        slaHours: 48,
        color: '#fa8c16',
        bg: '#fff7e6'
    },
    {
        code: 'STAGE_2_RISK',
        title: '3. ECR Risk Assessment',
        shortTitle: 'Risk assessment',
        description: 'Lead Engineer (พี่โอ) reviews technical changes and conducts Risk Assessment',
        phase: 'ECR',
        type: 'DECISION',
        picRole: 'Eng. Assigned',
        picName: 'NATHAPORN YAMMANUS',
        slaHours: 24,
        color: '#13c2c2',
        bg: '#e6fffb'
    },
    {
        code: 'STAGE_3',
        title: '3. Eng Dept Mgr ECR Review',
        shortTitle: 'Eng Mgr ECR',
        description: 'Eng Dept Manager approval, ECR number assignment, and ECN issuance decision (Block 4)',
        phase: 'ECR',
        type: 'DECISION',
        picRole: 'Eng. Dept Manager',
        picName: 'TEERAPOL KANTAPOOM',
        slaHours: 24,
        color: '#13c2c2',
        bg: '#e6fffb'
    },
    {
        code: 'STAGE_3_R1',
        title: '3-R1. Eng Mgr Clarification',
        shortTitle: 'Rework (Eng Mgr)',
        description: 'Returned to Requester by Eng Dept Manager for revision',
        phase: 'REWORK',
        type: 'RETURN_LOOP',
        picRole: 'Requester',
        picName: 'Requester',
        slaHours: 48,
        color: '#fa541c',
        bg: '#fff2e8'
    },
    {
        code: 'STAGE_4',
        title: '4. ECN Creation & Impact Assessment',
        shortTitle: 'ECN Creation',
        description: 'Assigned Engineer establishes ECN, confirms drawing suspension, and completes 8-point impact assessment (Block 5)',
        phase: 'ECN',
        type: 'STANDARD',
        picRole: 'Eng. Assigned',
        picName: 'NATHAPORN YAMMANUS',
        slaHours: 48,
        color: '#2f54eb',
        bg: '#f0f5ff'
    },
    {
        code: 'STAGE_5',
        title: '5. Eng Dept Mgr ECN Review',
        shortTitle: 'Eng Mgr ECN',
        description: 'Eng Dept Manager reviews ECN scope, impact checklist, and authorizes document update (Block 6)',
        phase: 'ECN',
        type: 'DECISION',
        picRole: 'Eng. Dept Manager',
        picName: 'TEERAPOL KANTAPOOM',
        slaHours: 24,
        color: '#eb2f96',
        bg: '#fff0f6'
    },
    {
        code: 'STAGE_5_R1',
        title: '5-R1. Eng Mgr ECN Clarification',
        shortTitle: 'Rework (ECN Scope)',
        description: 'Returned to Assigned Engineer by Eng Dept Manager for revision',
        phase: 'REWORK',
        type: 'RETURN_LOOP',
        picRole: 'Eng. Assigned',
        picName: 'NATHAPORN YAMMANUS',
        slaHours: 24,
        color: '#d4380d',
        bg: '#fff2e8'
    },
    {
        code: 'STAGE_6',
        title: '6. QC MSA Decision',
        shortTitle: 'QC MSA',
        description: 'QC assesses Measurement Systems Analysis requirement with justification (Block 7)',
        phase: 'QC',
        type: 'DECISION',
        picRole: 'QC Decision for FAI',
        picName: 'PATCHARAYADA WAIYABOON',
        slaHours: 24,
        color: '#faad14',
        bg: '#fffbe6'
    },
    {
        code: 'STAGE_7',
        title: '7. QC FAI Decision',
        shortTitle: 'QC FAI',
        description: 'QC decides Full FAI, Delta FAI, or Not Required (Block 8)',
        phase: 'QC',
        type: 'DECISION',
        picRole: 'QC Decision for FAI',
        picName: 'PATCHARAYADA WAIYABOON',
        slaHours: 72,
        color: '#fa8c16',
        bg: '#fff7e6'
    },
    {
        code: 'STAGE_8',
        title: '8. Eng Summary & Concern Dispatch',
        shortTitle: 'Eng Summary',
        description: 'Assigned Engineer records FAI lot/results and defines department sign-off matrix (Block 9)',
        phase: 'ECN',
        type: 'STANDARD',
        picRole: 'Eng. Assigned',
        picName: 'NATHAPORN YAMMANUS',
        slaHours: 24,
        color: '#1890ff',
        bg: '#e6f7ff'
    },
    {
        code: 'STAGE_9',
        title: '9. Concern Multi-Dept Sign-off',
        shortTitle: 'Concern Ack',
        description: 'Parallel department sign-offs (PC, QA, QC, PD1, PD2, MC, MM) and Drawing Enable in Innovator (Block 10)',
        phase: 'CONCERN',
        type: 'CONCERN_PARALLEL',
        picRole: 'Concern Departments',
        picName: 'Multi-Department PICs',
        slaHours: 72,
        color: '#52c41a',
        bg: '#f6ffed'
    },
    {
        code: 'STAGE_10',
        title: '10. Official Close & ECN Effective',
        shortTitle: 'Effective',
        description: 'Final closure by Eng Dept Manager and release of official stamped PDF (Block 11)',
        phase: 'CLOSE',
        type: 'DECISION',
        picRole: 'Eng. Dept Manager',
        picName: 'TEERAPOL KANTAPOOM',
        slaHours: 24,
        color: '#389e0d',
        bg: '#f6ffed'
    }
];

export const STAGE_MAP = ECNT_STAGES.reduce((acc, s) => {
    acc[s.code] = s;
    return acc;
}, {});

// Concern Departments List (Block 10)
export const CONCERN_DEPTS = [
    { dept_code: 'PC', dept_label: 'PC (Production Control)', pic_name: 'TASANEE CHUDUANG', color: '#1890ff' },
    { dept_code: 'QA', dept_label: 'QA (Quality Assurance)', pic_name: 'CHUANPIT KHATTIYA', color: '#722ed1' },
    { dept_code: 'QC', dept_label: 'QC (Quality Control)', pic_name: 'SUPARAT KATSANUK', color: '#fa8c16' },
    { dept_code: 'PD1', dept_label: 'Production #1', pic_name: 'CHANASORN MEEPRO', color: '#13c2c2' },
    { dept_code: 'PD2', dept_label: 'Production #2', pic_name: 'WATCHARIYA ROEKARAM', color: '#eb2f96' },
    { dept_code: 'MC', dept_label: 'MC (Material Control)', pic_name: 'PUSSADEE ROIKEAW', color: '#52c41a' },
    { dept_code: 'MM', dept_label: 'MM (Maintenance)', pic_name: 'Sarunyu Chokchaikasemsuk', color: '#faad14' },
];

// Discussion Categories
export const DISCUSSION_CATEGORIES = [
    { key: 'GENERAL', label: 'General Remark', color: 'default' },
    { key: 'QUESTION', label: 'Technical Question', color: 'blue' },
    { key: 'CLARIFICATION', label: 'Clarification Request', color: 'orange' },
    { key: 'REVISION_RESPONSE', label: 'Revision Response', color: 'green' },
    { key: 'ISSUE', label: 'Problem / Deficiency', color: 'red' },
];
