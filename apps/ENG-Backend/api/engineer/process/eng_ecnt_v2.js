const { engPool } = require('../../../instance/eng_db');
const moment = require('moment');

// Helper to calculate the next ECR No (ECRYYMMxx)
const generateEcrNo = async () => {
    const prefix = `ECR${moment().format('YYMM')}`;
    const sql = `SELECT ecr_no FROM ecnt2_ecr WHERE ecr_no LIKE $1 ORDER BY ecr_no DESC LIMIT 1`;
    const result = await engPool.query(sql, [`${prefix}%`]);
    
    if (result.rows.length === 0) {
        return `${prefix}01`;
    }
    
    const lastNo = result.rows[0].ecr_no;
    const seq = parseInt(lastNo.slice(-2)) + 1;
    return `${prefix}${seq.toString().padStart(2, '0')}`;
};

// Stage Definition Lookup
const STAGE_META = {
    STAGE_1: { title: '1. ECR Initiation', type: 'STANDARD', picRole: 'Requester' },
    STAGE_2: { title: '2. Dept Mgr Review', type: 'DECISION', picRole: 'Dept Manager' },
    STAGE_2_R1: { title: '2-R1. Dept Mgr Clarification (Requester Rework)', type: 'RETURN_LOOP', picRole: 'Requester' },
    STAGE_3: { title: '3. Eng Dept Mgr ECR Review', type: 'DECISION', picRole: 'Eng. Dept Manager', defaultPic: 'TEERAPOL KANTAPOOM' },
    STAGE_3_R1: { title: '3-R1. Eng Mgr Clarification (Requester Rework)', type: 'RETURN_LOOP', picRole: 'Requester' },
    STAGE_4: { title: '4. ECN Creation & Impact Assessment', type: 'STANDARD', picRole: 'Eng. Assigned', defaultPic: 'NATHAPORN YAMMANUS' },
    STAGE_5: { title: '5. Eng Dept Mgr ECN Review', type: 'DECISION', picRole: 'Eng. Dept Manager', defaultPic: 'TEERAPOL KANTAPOOM' },
    STAGE_5_R1: { title: '5-R1. Eng Mgr ECN Clarification (Engineer Rework)', type: 'RETURN_LOOP', picRole: 'Eng. Assigned', defaultPic: 'NATHAPORN YAMMANUS' },
    STAGE_6: { title: '6. QC MSA Decision', type: 'DECISION', picRole: 'QC MSA', defaultPic: 'PATCHARAYADA WAIYABOON' },
    STAGE_7: { title: '7. QC FAI Decision', type: 'DECISION', picRole: 'QC FAI', defaultPic: 'PATCHARAYADA WAIYABOON' },
    STAGE_8: { title: '8. Eng Summary & Concern Setup', type: 'STANDARD', picRole: 'Eng. Assigned', defaultPic: 'NATHAPORN YAMMANUS' },
    STAGE_9: { title: '9. Concern Multi-Dept Sign-off', type: 'CONCERN_PARALLEL', picRole: 'Concern Departments' },
    STAGE_10: { title: '10. Official Close & ECN Effective', type: 'DECISION', picRole: 'Eng. Dept Manager', defaultPic: 'TEERAPOL KANTAPOOM' }
};

// Helper: Transition Stage History
const transitionStage = async (client, docType, docId, nextStageCode, actionTaken, actionBy, actionByName, notes = '', returnTarget = null) => {
    // 1. Complete any active stage
    const activeStageRes = await client.query(`
        SELECT id, started_at, stage_code FROM ecnt2_stage_history 
        WHERE document_type = $1 AND document_id = $2 AND status = 'ACTIVE' 
        ORDER BY id DESC LIMIT 1
    `, [docType, docId]);

    if (activeStageRes.rows.length > 0) {
        const active = activeStageRes.rows[0];
        const now = new Date();
        const start = new Date(active.started_at);
        const durationHours = Math.max(0.1, Number(((now - start) / (1000 * 60 * 60)).toFixed(2)));

        const finalStatus = actionTaken === 'REQUEST_MORE_DETAIL' ? 'RETURNED' : 'COMPLETED';

        await client.query(`
            UPDATE ecnt2_stage_history SET 
                completed_at = NOW(),
                duration_hours = $1,
                status = $2,
                action_taken = $3,
                action_by = $4,
                action_by_name = $5,
                notes = $6,
                return_target = $7
            WHERE id = $8
        `, [durationHours, finalStatus, actionTaken, actionBy, actionByName, notes, returnTarget, active.id]);
    }

    // 2. If next stage is defined, open new active stage
    if (nextStageCode && STAGE_META[nextStageCode]) {
        const meta = STAGE_META[nextStageCode];
        await client.query(`
            INSERT INTO ecnt2_stage_history (
                document_type, document_id, stage_code, stage_title, stage_type, 
                assigned_role, assigned_pic, started_at, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'ACTIVE')
        `, [
            docType, docId, nextStageCode, meta.title, meta.type,
            meta.picRole, meta.defaultPic || null
        ]);
    }
};

// ==========================================
// Stage-Based Authority & Permission Guard
// ==========================================
const checkWorkflowPermission = async (clientOrPool, docType, docId, blockNumber, user, extra = {}) => {
    if (!user) return { authorized: false, reason: "Authentication is required to perform this action." };

    const role = (user.role || user.u_role || '').toUpperCase();
    const dept = (user.department || user.u_department || '').toUpperCase();
    const empno = (user.empno || user.u_code || '').toLowerCase();
    const name = (user.name || user.u_name || '').toLowerCase();

    try {
        // 1. Fetch system_admins config
        const adminConfig = await clientOrPool.query(`SELECT value FROM ecnt2_system_config WHERE key = 'system_admins'`);
        const systemAdmins = (adminConfig.rows[0]?.value || ["admin", "eng_mgr"]).map(a => String(a).toLowerCase());

        // Super Admin / System Admin override
        if (role === 'AD' || dept === 'AD' || systemAdmins.includes(empno)) {
            return { authorized: true, roleLabel: 'System Administrator' };
        }

        // 2. Fetch stage_assignees config
        const assigneesConfig = await clientOrPool.query(`SELECT value FROM ecnt2_system_config WHERE key = 'stage_assignees'`);
        const stageAssignees = assigneesConfig.rows[0]?.value || {};

        if (docType === 'ECR') {
            const ecrRes = await clientOrPool.query(`SELECT * FROM ecnt2_ecr WHERE id = $1`, [docId]);
            if (ecrRes.rows.length === 0) return { authorized: false, reason: "ECR document not found." };
            const ecr = ecrRes.rows[0];

            // Block 1 & Return Loops (STAGE_2_R1, STAGE_3_R1): Only Requester can revise/resubmit
            if (blockNumber === 1 || ecr.process_status === 'Require More Detail' || (ecr.current_stage_code || '').includes('_R')) {
                const isRequester = (ecr.request_by || '').toLowerCase() === empno || (ecr.request_by_name || '').toLowerCase() === name;
                if (isRequester) return { authorized: true, roleLabel: 'Requester' };
                return { authorized: false, reason: `Only the requester (${ecr.request_by_name || ecr.request_by}) is authorized to revise or resubmit this ECR.` };
            }

            // Block 3: Dept Mgr Review
            if (blockNumber === 3) {
                const configuredDeptMgr = stageAssignees?.dept_mgr_mapping?.[ecr.department];
                const isConfiguredMgr = configuredDeptMgr && (configuredDeptMgr.emp_no || '').toLowerCase() === empno;
                const isDeptMgrRole = dept === (ecr.department || '').toUpperCase() && (role === 'MGR' || role === 'MANAGER');
                if (isConfiguredMgr || isDeptMgrRole) return { authorized: true, roleLabel: 'Department Manager' };
                return { authorized: false, reason: `Only the Department Manager for ${ecr.department} is authorized to approve Block 3.` };
            }

            // Block 4: Eng Dept Mgr ECR Review & PIC Assignment
            if (blockNumber === 4) {
                const configuredEngMgr = stageAssignees?.eng_mgr;
                const isConfiguredEngMgr = configuredEngMgr && (configuredEngMgr.emp_no || '').toLowerCase() === empno;
                const isEngMgrRole = dept === 'ENG' && (role === 'MGR' || role === 'MANAGER');
                if (isConfiguredEngMgr || isEngMgrRole) return { authorized: true, roleLabel: 'Engineering Department Manager' };
                return { authorized: false, reason: "Only the Engineering Department Manager is authorized to review Block 4 and assign the lead engineer." };
            }
        } else if (docType === 'ECN') {
            const ecnRes = await clientOrPool.query(`SELECT * FROM ecnt2_ecn WHERE id = $1`, [docId]);
            if (ecnRes.rows.length === 0) return { authorized: false, reason: "ECN document not found." };
            const ecn = ecnRes.rows[0];

            // Block 5: ECN Creation & Return Loop Rework (STAGE_5_R1)
            if (blockNumber === 5) {
                const isAssignedEng = (ecn.engineer_assigned || '').toLowerCase() === empno || 
                                      (ecn.engineer_assigned || '').toLowerCase() === name || 
                                      dept === 'ENG';
                if (isAssignedEng) return { authorized: true, roleLabel: 'Assigned Engineer' };
                return { authorized: false, reason: `Only the assigned engineer (${ecn.engineer_assigned}) is authorized to formulate or revise this ECN.` };
            }

            // Block 6: Eng Dept Mgr Approve ECN
            if (blockNumber === 6) {
                const configuredEngMgr = stageAssignees?.eng_mgr;
                const isConfiguredEngMgr = configuredEngMgr && (configuredEngMgr.emp_no || '').toLowerCase() === empno;
                const isEngMgrRole = dept === 'ENG' && (role === 'MGR' || role === 'MANAGER');
                if (isConfiguredEngMgr || isEngMgrRole) return { authorized: true, roleLabel: 'Engineering Department Manager' };
                return { authorized: false, reason: "Only the Engineering Department Manager is authorized to approve Block 6." };
            }

            // Block 7 & 8: QC MSA & FAI Decisions
            if (blockNumber === 7 || blockNumber === 8) {
                const configuredQcPic = stageAssignees?.default_qc_pic;
                const isConfiguredQc = configuredQcPic && (configuredQcPic.emp_no || '').toLowerCase() === empno;
                const isQcRole = dept === 'QC' || role === 'QC';
                if (isConfiguredQc || isQcRole) return { authorized: true, roleLabel: 'Quality Control (QC) Evaluator' };
                return { authorized: false, reason: "Only Quality Control (QC) personnel are authorized to submit MSA and FAI decisions." };
            }

            // Block 9: Engineer Summary & Concern Setup
            if (blockNumber === 9) {
                const isAssignedEng = (ecn.engineer_assigned || '').toLowerCase() === empno || 
                                      (ecn.engineer_assigned || '').toLowerCase() === name || 
                                      dept === 'ENG';
                if (isAssignedEng) return { authorized: true, roleLabel: 'Assigned Engineer' };
                return { authorized: false, reason: `Only the assigned engineer (${ecn.engineer_assigned}) is authorized to configure concern department tasks.` };
            }

            // Block 10: Concern Multi-Dept Sign-off
            if (blockNumber === 10) {
                const taskId = extra.task_id;
                if (!taskId) return { authorized: false, reason: "task_id is required for Block 10 concern sign-off." };
                const taskRes = await clientOrPool.query(`SELECT * FROM ecnt2_concern_task WHERE id = $1 AND ecn_id = $2`, [taskId, docId]);
                if (taskRes.rows.length === 0) return { authorized: false, reason: "Concern task not found." };
                const task = taskRes.rows[0];
                const taskDept = (task.dept_code || '').toUpperCase();

                const isTaskDeptUser = dept === taskDept || role === taskDept || (task.pic_emp_no && task.pic_emp_no.toLowerCase() === empno);
                if (isTaskDeptUser) return { authorized: true, roleLabel: `${taskDept} Sign-off PIC` };
                return { authorized: false, reason: `Only personnel from department ${taskDept} are authorized to sign off task #${taskId}.` };
            }

            // Block 11: Official Close & ECN Effective
            if (blockNumber === 11) {
                const configuredEngMgr = stageAssignees?.eng_mgr;
                const isConfiguredEngMgr = configuredEngMgr && (configuredEngMgr.emp_no || '').toLowerCase() === empno;
                const isEngMgrRole = dept === 'ENG' && (role === 'MGR' || role === 'MANAGER');
                const isTopExecutive = role === 'TOP' || role === 'EXECUTIVE';
                if (isConfiguredEngMgr || isEngMgrRole || isTopExecutive) return { authorized: true, roleLabel: 'Plant Executive / Engineering Manager' };
                return { authorized: false, reason: "Only the Engineering Department Manager or Plant Executive can officially close this ECN." };
            }
        }
    } catch (err) {
        console.error("checkWorkflowPermission error:", err);
    }

    return { authorized: true, roleLabel: 'Authorized' };
};

// ==========================================
// ECR (Blocks 1-4)
// ==========================================

const createEcr = async (req, res) => {
    const data = req.body;
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        const requestBy = req.user?.empno || data.request_by || 'Unknown';
        const requestByName = req.user?.name || data.request_by_name || 'Unknown';
        const department = req.user?.department || data.department || 'ENG';

        // Auto generate ecr_no after block 1 finish (per Excel requirement)
        const ecrNo = await generateEcrNo();

        const sql = `
            INSERT INTO ecnt2_ecr (
                ecr_no, ref_coc_no, request_by, request_by_name, department, 
                status_type, objective, objective_other,
                is_drawing, is_tooling, is_program, is_usage,
                customer_name, project_code,
                title_of_change, reason_of_change,
                dwg_part_no, dwg_cn, dwg_revision, dwg_reason_of_change, dwg_before_change, dwg_after_change,
                tool_current_no, tool_current_usage, tool_new_no, tool_new_usage,
                prog_before_change, prog_condition_before, prog_after_change, prog_condition_after,
                usage_setup_no, usage_part_no, usage_cn, usage_process, usage_program_no, usage_mc_no, usage_cycle_time_before, usage_cycle_time_after, usage_before_change, usage_after_change,
                process_status, current_block, current_stage_code
            ) VALUES (
                $1, $2, $3, $4, $5, 
                $6, $7, $8, 
                $9, $10, $11, $12, 
                $13, $14,
                $15, $16,
                $17, $18, $19, $20, $21, $22,
                $23, $24, $25, $26,
                $27, $28, $29, $30,
                $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
                'Pending Dept Mgr', 3, 'STAGE_2'
            ) RETURNING id, ecr_no
        `;
        
        const params = [
            ecrNo,
            data.ref_coc_no || null, requestBy, requestByName, department,
            data.status_type || 'PERMANENT', data.objective, data.objective_other,
            !!data.is_drawing, !!data.is_tooling, !!data.is_program, !!data.is_usage,
            data.customer_name || null, data.project_code || null,
            data.title_of_change, data.reason_of_change,
            data.dwg_part_no, data.dwg_cn, data.dwg_revision, data.dwg_reason_of_change, data.dwg_before_change, data.dwg_after_change,
            data.tool_current_no, data.tool_current_usage, data.tool_new_no, data.tool_new_usage,
            data.prog_before_change, data.prog_condition_before, data.prog_after_change, data.prog_condition_after,
            data.usage_setup_no, data.usage_part_no, data.usage_cn, data.usage_process, data.usage_program_no, data.usage_mc_no, data.usage_cycle_time_before, data.usage_cycle_time_after, data.usage_before_change, data.usage_after_change
        ];

        const result = await client.query(sql, params);
        const newId = result.rows[0].id;
        
        // Log initial creation
        await client.query(`
            INSERT INTO ecnt2_approval_log (document_type, document_id, block_number, step_label, action, action_by, action_by_name, action_role, comment)
            VALUES ('ECR', $1, 1, 'Block 1 & 2: ECR Request', 'SUBMIT', $2, $3, 'Requester', 'Initiated ECR Request')
        `, [newId, requestBy, requestByName]);

        // Stage history: Stage 1 (instant) -> Stage 2 (active)
        await client.query(`
            INSERT INTO ecnt2_stage_history (
                document_type, document_id, stage_code, stage_title, stage_type, 
                assigned_role, assigned_dept, assigned_pic, started_at, completed_at, duration_hours, status, action_taken, action_by, action_by_name
            ) VALUES (
                'ECR', $1, 'STAGE_1', '1. ECR Initiation', 'STANDARD', 
                'Requester', $2, $3, NOW(), NOW(), 0.1, 'COMPLETED', 'SUBMIT', $4, $3
            )
        `, [newId, department, requestByName, requestBy]);

        await client.query(`
            INSERT INTO ecnt2_stage_history (
                document_type, document_id, stage_code, stage_title, stage_type, 
                assigned_role, assigned_dept, started_at, status
            ) VALUES (
                'ECR', $1, 'STAGE_2', '2. Dept Mgr Review', 'DECISION', 
                'Dept Manager', $2, NOW(), 'ACTIVE'
            )
        `, [newId, department]);

        // Insert field attachments if provided
        if (data.attachments && Array.isArray(data.attachments)) {
            for (const att of data.attachments) {
                await client.query(`
                    INSERT INTO ecnt2_attachment (
                        document_type, document_id, block_number, field_name,
                        file_name, file_url, file_type, file_size, uploaded_by
                    ) VALUES ('ECR', $1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    newId, att.block_number || 2, att.field_name || null,
                    att.file_name, att.file_url, att.file_type || '', att.file_size || null,
                    requestByName
                ]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: "ECR Created Successfully", id: newId, ecr_no: result.rows[0].ecr_no });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("createEcr Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

const resubmitEcr = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        // Permission check: Only requester or admin can resubmit ECR
        const perm = await checkWorkflowPermission(client, 'ECR', id, 1, req.user);
        if (!perm.authorized) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: perm.reason });
        }

        const actionBy = req.user?.empno || data.request_by || 'Unknown';
        const actionByName = req.user?.name || data.request_by_name || 'Unknown';

        // 1. Fetch existing ECR to compute field diffs for audit trail
        const oldEcrRes = await client.query(`SELECT * FROM ecnt2_ecr WHERE id = $1`, [id]);
        if (oldEcrRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "ECR Not Found" });
        }
        const old = oldEcrRes.rows[0];

        // Track changes
        const auditFields = [
            'dwg_part_no', 'dwg_cn', 'dwg_revision', 'dwg_reason_of_change', 'dwg_before_change', 'dwg_after_change',
            'tool_current_no', 'tool_current_usage', 'tool_new_no', 'tool_new_usage',
            'prog_before_change', 'prog_condition_before', 'prog_after_change', 'prog_condition_after',
            'usage_setup_no', 'usage_part_no', 'usage_cn', 'usage_process', 'usage_program_no', 'usage_mc_no',
            'usage_cycle_time_before', 'usage_cycle_time_after', 'usage_before_change', 'usage_after_change',
            'title_of_change', 'reason_of_change', 'objective'
        ];

        for (const f of auditFields) {
            const oldVal = old[f] !== undefined && old[f] !== null ? String(old[f]).trim() : '';
            const newVal = data[f] !== undefined && data[f] !== null ? String(data[f]).trim() : '';
            if (oldVal !== newVal && (oldVal || newVal)) {
                await client.query(`
                    INSERT INTO ecnt2_field_audit (document_type, document_id, stage_code, field_name, old_value, new_value, modified_by, modified_by_name)
                    VALUES ('ECR', $1, $2, $3, $4, $5, $6, $7)
                `, [id, old.current_stage_code || 'STAGE_2_R1', f, oldVal, newVal, actionBy, actionByName]);
            }
        }

        const nextBlock = old.current_stage_code === 'STAGE_3_R1' ? 4 : 3;
        const nextStatus = old.current_stage_code === 'STAGE_3_R1' ? 'Pending Eng Mgr' : 'Pending Dept Mgr';
        const nextStage = old.current_stage_code === 'STAGE_3_R1' ? 'STAGE_3' : 'STAGE_2';

        const sql = `
            UPDATE ecnt2_ecr SET
                ref_coc_no = $1, status_type = $2, objective = $3, objective_other = $4,
                is_drawing = $5, is_tooling = $6, is_program = $7, is_usage = $8,
                customer_name = $9, project_code = $10,
                title_of_change = $11, reason_of_change = $12,
                dwg_part_no = $13, dwg_cn = $14, dwg_revision = $15, dwg_reason_of_change = $16, dwg_before_change = $17, dwg_after_change = $18,
                tool_current_no = $19, tool_current_usage = $20, tool_new_no = $21, tool_new_usage = $22,
                prog_before_change = $23, prog_condition_before = $24, prog_after_change = $25, prog_condition_after = $26,
                usage_setup_no = $27, usage_part_no = $28, usage_cn = $29, usage_process = $30, usage_program_no = $31, usage_mc_no = $32, usage_cycle_time_before = $33, usage_cycle_time_after = $34, usage_before_change = $35, usage_after_change = $36,
                process_status = $37, current_block = $38, current_stage_code = $39,
                updated_at = NOW()
            WHERE id = $40 RETURNING *
        `;

        const params = [
            data.ref_coc_no || null, data.status_type || 'PERMANENT', data.objective, data.objective_other,
            !!data.is_drawing, !!data.is_tooling, !!data.is_program, !!data.is_usage,
            data.customer_name || null, data.project_code || null,
            data.title_of_change, data.reason_of_change,
            data.dwg_part_no, data.dwg_cn, data.dwg_revision, data.dwg_reason_of_change, data.dwg_before_change, data.dwg_after_change,
            data.tool_current_no, data.tool_current_usage, data.tool_new_no, data.tool_new_usage,
            data.prog_before_change, data.prog_condition_before, data.prog_after_change, data.prog_condition_after,
            data.usage_setup_no, data.usage_part_no, data.usage_cn, data.usage_process, data.usage_program_no, data.usage_mc_no, data.usage_cycle_time_before, data.usage_cycle_time_after, data.usage_before_change, data.usage_after_change,
            nextStatus, nextBlock, nextStage,
            id
        ];

        const result = await client.query(sql, params);

        // Complete the return stage and transition back to review stage
        await transitionStage(client, 'ECR', id, nextStage, 'RESUBMIT', actionBy, actionByName, data.comment || 'Updated details after Request More Detail');

        // Log resubmit
        await client.query(`
            INSERT INTO ecnt2_approval_log (document_type, document_id, block_number, step_label, action, action_by, action_by_name, action_role, comment)
            VALUES ('ECR', $1, 1, 'Block 1 & 2: Resubmit ECR', 'RESUBMIT', $2, $3, 'Requester', $4)
        `, [id, actionBy, actionByName, data.comment || 'Updated details after Request More Detail']);

        // Post automatic response in discussion
        await client.query(`
            INSERT INTO ecnt2_discussion (
                document_type, document_id, stage_key, category, 
                author_empno, author_name, author_dept, author_role, message
            ) VALUES ('ECR', $1, $2, 'REVISION_RESPONSE', $3, $4, $5, 'Requester', $6)
        `, [id, nextStage, actionBy, actionByName, old.department || 'ENG', data.comment || 'Requester resubmitted updated specifications and documentation.']);

        // Insert field attachments if provided
        if (data.attachments && Array.isArray(data.attachments)) {
            for (const att of data.attachments) {
                if (!att.id) {
                    await client.query(`
                        INSERT INTO ecnt2_attachment (
                            document_type, document_id, block_number, field_name,
                            file_name, file_url, file_type, file_size, uploaded_by
                        ) VALUES ('ECR', $1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        id, att.block_number || 2, att.field_name || null,
                        att.file_name, att.file_url, att.file_type || '', att.file_size || null,
                        actionByName
                    ]);
                }
            }
        }

        await client.query('COMMIT');
        res.json({ message: "ECR Resubmitted Successfully", data: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("resubmitEcr Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

const getEcrList = async (req, res) => {
    try {
        const result = await engPool.query(`
            SELECT e.*, 
                   (SELECT id FROM ecnt2_ecn WHERE ecr_id = e.id LIMIT 1) as linked_ecn_id,
                   (SELECT count(*) FROM ecnt2_discussion WHERE document_type = 'ECR' AND document_id = e.id) as discussion_count
            FROM ecnt2_ecr e 
            ORDER BY e.created_at DESC
        `);
        res.json({ data: result.rows });
    } catch (err) {
        console.error("getEcrList Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const getEcrById = async (req, res) => {
    const { id } = req.params;
    try {
        const ecrResult = await engPool.query(`
            SELECT e.*, 
                   (SELECT id FROM ecnt2_ecn WHERE ecr_id = e.id LIMIT 1) as linked_ecn_id
            FROM ecnt2_ecr e 
            WHERE e.id = $1
        `, [id]);
        if (ecrResult.rows.length === 0) return res.status(404).json({ message: "ECR Not Found" });
        
        const logResult = await engPool.query(`SELECT * FROM ecnt2_approval_log WHERE document_type = 'ECR' AND document_id = $1 ORDER BY created_at ASC`, [id]);
        const attachmentResult = await engPool.query(`SELECT * FROM ecnt2_attachment WHERE document_type = 'ECR' AND document_id = $1 ORDER BY created_at ASC`, [id]);
        const stageResult = await engPool.query(`SELECT * FROM ecnt2_stage_history WHERE document_type = 'ECR' AND document_id = $1 ORDER BY started_at ASC`, [id]);
        const auditResult = await engPool.query(`SELECT * FROM ecnt2_field_audit WHERE document_type = 'ECR' AND document_id = $1 ORDER BY modified_at DESC`, [id]);

        res.json({
            data: ecrResult.rows[0],
            logs: logResult.rows,
            attachments: attachmentResult.rows,
            stageHistory: stageResult.rows,
            fieldAudits: auditResult.rows
        });
    } catch (err) {
        console.error("getEcrById Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// Handles Block 3 (Dept Mgr) & Block 4 (Eng Mgr)
const actionEcr = async (req, res) => {
    const { id } = req.params;
    const { block_number, action, action_by, action_by_name, action_role, comment, deny_reason, request_to_requester, assigned_to } = req.body;
    
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        // Permission check: Validate stage ownership
        const perm = await checkWorkflowPermission(client, 'ECR', id, block_number, req.user, { assigned_to });
        if (!perm.authorized) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: perm.reason });
        }
        
        const userEmpno = req.user?.empno || action_by || 'Unknown';
        const userName = req.user?.name || action_by_name || 'Unknown';
        const userRole = perm.roleLabel || req.user?.role || action_role || 'Approver';
        
        let nextStatus = 'Draft';
        let currentBlock = block_number;
        let nextStageCode = null;
        
        if (action === 'DENY') {
            nextStatus = 'Denied';
            nextStageCode = null;
            await transitionStage(client, 'ECR', id, null, 'DENY', userEmpno, userName, deny_reason || comment);
        } else if (action === 'REQUEST_MORE_DETAIL') {
            nextStatus = 'Require More Detail';
            currentBlock = 1;
            nextStageCode = block_number === 4 ? 'STAGE_3_R1' : 'STAGE_2_R1';

            // Transition stage to the explicit Return Loop stage
            await transitionStage(client, 'ECR', id, nextStageCode, 'REQUEST_MORE_DETAIL', userEmpno, userName, request_to_requester || comment, nextStageCode);

            // Automatically post a clarification request into discussions
            await client.query(`
                INSERT INTO ecnt2_discussion (
                    document_type, document_id, stage_key, category, 
                    author_empno, author_name, author_dept, author_role, message
                ) VALUES ('ECR', $1, $2, 'CLARIFICATION', $3, $4, $5, $6, $7)
            `, [
                id, nextStageCode, userEmpno, userName, 
                req.user?.department || 'ENG', userRole,
                request_to_requester || comment || 'Clarification / additional details requested.'
            ]);

            // Increment revision counter
            await client.query(`UPDATE ecnt2_ecr SET revision_count = COALESCE(revision_count, 0) + 1 WHERE id = $1`, [id]);

        } else if (action === 'APPROVE') {
            if (block_number === 3) {
                nextStatus = 'Pending Eng Mgr';
                currentBlock = 4;
                nextStageCode = 'STAGE_3';
                await transitionStage(client, 'ECR', id, nextStageCode, 'APPROVE', userEmpno, userName, comment);
            } else if (block_number === 4) {
                const isIssueEcn = req.body.details?.is_issue_ecn;
                nextStatus = isIssueEcn ? 'Issued ECN' : 'ECR Only Closed';
                nextStageCode = isIssueEcn ? 'STAGE_4' : null;
                
                await transitionStage(client, 'ECR', id, nextStageCode, 'APPROVE', userEmpno, userName, comment);

                // Auto-generate ECR No if missing
                const ecrCheck = await client.query('SELECT ecr_no FROM ecnt2_ecr WHERE id = $1', [id]);
                if (!ecrCheck.rows[0].ecr_no) {
                    const newEcrNo = await generateEcrNo();
                    await client.query('UPDATE ecnt2_ecr SET ecr_no = $1 WHERE id = $2', [newEcrNo, id]);
                }
                
                if (assigned_to) {
                    await client.query('UPDATE ecnt2_ecr SET assigned_to = $1 WHERE id = $2', [assigned_to, id]);
                }
            }
        }
        
        // Log action
        await client.query(`
            INSERT INTO ecnt2_approval_log (document_type, document_id, block_number, step_label, action, action_by, action_by_name, action_role, comment, deny_reason, request_to_requester, details)
            VALUES ('ECR', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            id, block_number, `Block ${block_number}`, action, userEmpno, userName, userRole, comment, deny_reason, request_to_requester, req.body.details ? JSON.stringify(req.body.details) : null
        ]);
        
        // Update document state
        await client.query(`
            UPDATE ecnt2_ecr SET 
                process_status = $1, 
                current_block = $2, 
                current_stage_code = $3, 
                updated_at = NOW() 
            WHERE id = $4
        `, [nextStatus, currentBlock, nextStageCode || 'CLOSED_ECR', id]);
        
        // Notification record
        await client.query(`
            INSERT INTO ecnt2_notification (document_type, document_id, block_number, email_type, subject, body)
            VALUES ('ECR', $1, $2, $3, $4, $5)
        `, [id, currentBlock, 'STATUS_UPDATE', `ECR Action: ${action} - New Status: ${nextStatus}`, `ECR has moved to ${nextStageCode || 'Complete'}`]);

        await client.query('COMMIT');
        res.json({ message: "Action successful", next_status: nextStatus, next_stage: nextStageCode });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("actionEcr Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

// ==========================================
// ECN (Blocks 5-11)
// ==========================================

const createEcn = async (req, res) => {
    const data = req.body;
    const client = await engPool.connect();
    
    try {
        await client.query('BEGIN');

        // Fetch linked ECR data
        const ecrResult = await client.query('SELECT * FROM ecnt2_ecr WHERE id = $1', [data.ecr_id]);
        if (ecrResult.rows.length === 0) {
            throw new Error(`Linked ECR with ID ${data.ecr_id} not found.`);
        }
        const ecr = ecrResult.rows[0];

        // Permission check: Only assigned engineer, ENG department, or Admin can formulate ECN
        const userRole = (req.user?.role || '').toUpperCase();
        const userDept = (req.user?.department || '').toUpperCase();
        const userEmpno = (req.user?.empno || '').toLowerCase();
        const userName = (req.user?.name || '').toLowerCase();

        const adminConfig = await client.query(`SELECT value FROM ecnt2_system_config WHERE key = 'system_admins'`);
        const systemAdmins = (adminConfig.rows[0]?.value || ["admin", "eng_mgr"]).map(a => String(a).toLowerCase());
        const isAdmin = userRole === 'AD' || userDept === 'AD' || systemAdmins.includes(userEmpno);

        const isAssigned = (ecr.assigned_to || '').toLowerCase() === userEmpno || 
                           (ecr.assigned_to || '').toLowerCase() === userName || 
                           userDept === 'ENG';

        if (!isAdmin && !isAssigned) {
            await client.query('ROLLBACK');
            return res.status(403).json({ 
                error: `Access Denied: Only the assigned engineer (${ecr.assigned_to || 'Assigned PIC'}) or Engineering department can formulate this ECN.` 
            });
        }

        const engineerAssigned = data.engineer_assigned || req.user?.empno || ecr.assigned_to || 'NATHAPORN YAMMANUS';
        
        const sqlEcn = `
            INSERT INTO ecnt2_ecn (
                ecn_no, ecr_id, request_by, request_date, department, engineer_assigned,
                title_of_change, reason_of_change, scope_of_implementation, before_change, after_change,
                dwg_suspended, related_models, current_block, process_status, current_stage_code
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                $12, $13, 6, 'Pending Eng Mgr ECN', 'STAGE_5'
            ) RETURNING id
        `;
        
        const resultEcn = await client.query(sqlEcn, [
            data.ecn_no, data.ecr_id, ecr.request_by, ecr.request_date, ecr.department, engineerAssigned,
            data.title_of_change || ecr.title_of_change, data.reason_of_change || ecr.reason_of_change, 
            data.scope_of_implementation || null, data.before_change || null, data.after_change || null,
            !!data.dwg_suspended, JSON.stringify(data.related_models || [])
        ]);
        
        const newEcnId = resultEcn.rows[0].id;
        
        // Insert Impact Assessment (Block 5)
        if (data.impact) {
            const imp = data.impact;
            const sqlImpact = `
                INSERT INTO ecnt2_impact_assessment (
                    ecn_id,
                    has_customer_impact, customer_name, m4_request_doc_no, customer_notification_date, customer_change_notice_date, customer_approved_date,
                    has_kzw_fjsw_impact, operation_type, kzw_notification_date, kzw_dcn_ecn_doc_no, kzw_doc_received_date,
                    has_sale_drawing_impact, sale_drawing_revision_no, sale_drawing_finish_date,
                    has_traceability, traceability_details,
                    has_wip_stock, wip_stock_details,
                    has_outsourcing, outsourcing_details,
                    has_unit_price, unit_price_details,
                    has_manufacturing, manufacturing_details,
                    has_product_quality, product_quality_details,
                    has_safety, safety_details,
                    has_otd, otd_details,
                    confirmed_by, confirmed_date
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, NOW()
                )
            `;
            await client.query(sqlImpact, [
                newEcnId,
                !!imp.has_customer_impact, imp.customer_name || null, imp.m4_request_doc_no || null, 
                imp.customer_notification_date ? new Date(imp.customer_notification_date) : null, 
                imp.customer_change_notice_date ? new Date(imp.customer_change_notice_date) : null, 
                imp.customer_approved_date ? new Date(imp.customer_approved_date) : null,
                !!imp.has_kzw_fjsw_impact, imp.operation_type || null, 
                imp.kzw_notification_date ? new Date(imp.kzw_notification_date) : null, 
                imp.kzw_dcn_ecn_doc_no || null, 
                imp.kzw_doc_received_date ? new Date(imp.kzw_doc_received_date) : null,
                !!imp.has_sale_drawing_impact, imp.sale_drawing_revision_no || null, 
                imp.sale_drawing_finish_date ? new Date(imp.sale_drawing_finish_date) : null,
                !!imp.has_traceability, imp.traceability_details ? JSON.stringify(imp.traceability_details) : null,
                !!imp.has_wip_stock, imp.wip_stock_details ? JSON.stringify(imp.wip_stock_details) : null,
                !!imp.has_outsourcing, imp.outsourcing_details ? JSON.stringify(imp.outsourcing_details) : null,
                !!imp.has_unit_price, imp.unit_price_details ? JSON.stringify(imp.unit_price_details) : null,
                !!imp.has_manufacturing, imp.manufacturing_details ? JSON.stringify(imp.manufacturing_details) : null,
                !!imp.has_product_quality, imp.product_quality_details ? JSON.stringify(imp.product_quality_details) : null,
                !!imp.has_safety, imp.safety_details ? JSON.stringify(imp.safety_details) : null,
                !!imp.has_otd, imp.otd_details ? JSON.stringify(imp.otd_details) : null,
                engineerAssigned
            ]);
        }

        // Complete Stage 4 (ECN Creation) and open Stage 5 (Eng Mgr Review)
        await client.query(`
            INSERT INTO ecnt2_stage_history (
                document_type, document_id, stage_code, stage_title, stage_type, 
                assigned_role, assigned_pic, started_at, completed_at, duration_hours, status, action_taken, action_by, action_by_name
            ) VALUES (
                'ECN', $1, 'STAGE_4', '4. ECN Creation & Impact Assessment', 'STANDARD', 
                'Eng. Assigned', $2, NOW(), NOW(), 0.1, 'COMPLETED', 'SUBMIT', $3, $4
            )
        `, [newEcnId, engineerAssigned, req.user?.empno || engineerAssigned, req.user?.name || engineerAssigned]);

        await client.query(`
            INSERT INTO ecnt2_stage_history (
                document_type, document_id, stage_code, stage_title, stage_type, 
                assigned_role, assigned_pic, started_at, status
            ) VALUES (
                'ECN', $1, 'STAGE_5', '5. Eng Dept Mgr ECN Review', 'DECISION', 
                'Eng. Dept Manager', 'TEERAPOL KANTAPOOM', NOW(), 'ACTIVE'
            )
        `, [newEcnId]);

        // Log action for Block 5
        await client.query(`
            INSERT INTO ecnt2_approval_log (document_type, document_id, block_number, step_label, action, action_by, action_by_name, action_role, comment)
            VALUES ('ECN', $1, 5, 'Block 5: Engineer Assigned (ECN Creation)', 'SUBMIT', $2, $3, 'Eng. Assigned', 'Created ECN with Impact Assessment')
        `, [newEcnId, req.user?.empno || engineerAssigned, req.user?.name || engineerAssigned]);

        // Insert field attachments if provided
        if (data.attachments && Array.isArray(data.attachments)) {
            for (const att of data.attachments) {
                await client.query(`
                    INSERT INTO ecnt2_attachment (
                        document_type, document_id, block_number, field_name,
                        file_name, file_url, file_type, file_size, uploaded_by
                    ) VALUES ('ECN', $1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    newEcnId, att.block_number || 5, att.field_name || null,
                    att.file_name, att.file_url, att.file_type || '', att.file_size || null,
                    req.user?.name || engineerAssigned
                ]);
            }
        }
        
        await client.query('COMMIT');
        res.json({ message: "ECN Created Successfully", id: newEcnId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("createEcn Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

const getEcnList = async (req, res) => {
    try {
        const result = await engPool.query(`
            SELECT e.*, ecr.ecr_no,
                   (SELECT count(*) FROM ecnt2_discussion WHERE document_type = 'ECN' AND document_id = e.id) as discussion_count
            FROM ecnt2_ecn e
            LEFT JOIN ecnt2_ecr ecr ON e.ecr_id = ecr.id
            ORDER BY e.created_at DESC
        `);
        res.json({ data: result.rows });
    } catch (err) {
        console.error("getEcnList Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const getEcnById = async (req, res) => {
    const { id } = req.params;
    try {
        const ecnResult = await engPool.query(`
            SELECT e.*, ecr.ecr_no, ecr.customer_name as ecr_customer, ecr.project_code as ecr_project
            FROM ecnt2_ecn e
            LEFT JOIN ecnt2_ecr ecr ON e.ecr_id = ecr.id
            WHERE e.id = $1
        `, [id]);
        if (ecnResult.rows.length === 0) return res.status(404).json({ message: "ECN Not Found" });
        
        const impactResult = await engPool.query(`SELECT * FROM ecnt2_impact_assessment WHERE ecn_id = $1`, [id]);
        const qcResult = await engPool.query(`SELECT * FROM ecnt2_qc_decision WHERE ecn_id = $1 ORDER BY id ASC`, [id]);
        const faiResult = await engPool.query(`SELECT * FROM ecnt2_fai_summary WHERE ecn_id = $1`, [id]);
        const taskResult = await engPool.query(`SELECT * FROM ecnt2_concern_task WHERE ecn_id = $1 ORDER BY id ASC`, [id]);
        const logResult = await engPool.query(`SELECT * FROM ecnt2_approval_log WHERE document_type = 'ECN' AND document_id = $1 ORDER BY created_at ASC`, [id]);
        const attachmentResult = await engPool.query(`SELECT * FROM ecnt2_attachment WHERE document_type = 'ECN' AND document_id = $1 ORDER BY created_at ASC`, [id]);
        const stageResult = await engPool.query(`SELECT * FROM ecnt2_stage_history WHERE document_type = 'ECN' AND document_id = $1 ORDER BY started_at ASC`, [id]);
        const auditResult = await engPool.query(`SELECT * FROM ecnt2_field_audit WHERE document_type = 'ECN' AND document_id = $1 ORDER BY modified_at DESC`, [id]);
        
        res.json({
            data: ecnResult.rows[0],
            impact: impactResult.rows[0] || null,
            qc: qcResult.rows,
            fai: faiResult.rows[0] || null,
            tasks: taskResult.rows,
            logs: logResult.rows,
            attachments: attachmentResult.rows,
            stageHistory: stageResult.rows,
            fieldAudits: auditResult.rows
        });
    } catch (err) {
        console.error("getEcnById Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const actionEcn = async (req, res) => {
    const { id } = req.params;
    const { block_number, action, action_by, action_by_name, action_role, comment, deny_reason, request_to_requester } = req.body;
    
    const client = await engPool.connect();
    try {
        await client.query('BEGIN');

        // Permission check: Validate stage ownership
        const perm = await checkWorkflowPermission(client, 'ECN', id, block_number, req.user, { task_id: req.body.task_id });
        if (!perm.authorized) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: perm.reason });
        }
        
        const userEmpno = req.user?.empno || action_by || 'Unknown';
        const userName = req.user?.name || action_by_name || 'Unknown';
        const userRole = perm.roleLabel || req.user?.role || action_role || 'Approver';
        
        let nextStatus = 'Pending Eng Mgr ECN';
        let currentBlock = block_number;
        let nextStageCode = 'STAGE_5';
        
        // Block 6 (Eng Mgr Approve ECN)
        if (block_number === 6) {
            if (action === 'APPROVE') {
                nextStatus = 'Pending QC MSA';
                currentBlock = 7;
                nextStageCode = 'STAGE_6';
                await transitionStage(client, 'ECN', id, nextStageCode, 'APPROVE', userEmpno, userName, comment);
            } else if (action === 'REQUEST_MORE_DETAIL') {
                nextStatus = 'Require More Detail';
                currentBlock = 5;
                nextStageCode = 'STAGE_5_R1';

                await transitionStage(client, 'ECN', id, nextStageCode, 'REQUEST_MORE_DETAIL', userEmpno, userName, request_to_requester || comment, nextStageCode);

                // Auto post clarification in discussion
                await client.query(`
                    INSERT INTO ecnt2_discussion (
                        document_type, document_id, stage_key, category, 
                        author_empno, author_name, author_dept, author_role, message
                    ) VALUES ('ECN', $1, $2, 'CLARIFICATION', $3, $4, $5, $6, $7)
                `, [
                    id, nextStageCode, userEmpno, userName, 
                    req.user?.department || 'ENG', userRole,
                    request_to_requester || comment || 'ECN Clarification requested by Eng Dept Manager.'
                ]);

                await client.query(`UPDATE ecnt2_ecn SET revision_count = COALESCE(revision_count, 0) + 1 WHERE id = $1`, [id]);
            }
        }
        // Block 7 (QC MSA)
        else if (block_number === 7 && action === 'APPROVE') {
            nextStatus = 'Pending QC FAI';
            currentBlock = 8;
            nextStageCode = 'STAGE_7';
            
            await client.query(`
                INSERT INTO ecnt2_qc_decision (ecn_id, decision_type, decision, reason, confirmed_by, confirmed_by_name, confirmed_date)
                VALUES ($1, 'MSA', $2, $3, $4, $5, NOW())
            `, [id, req.body.details?.decision || 'NOT_REQUIRE', req.body.details?.reason || '', userEmpno, userName]);

            await transitionStage(client, 'ECN', id, nextStageCode, 'APPROVE', userEmpno, userName, comment || `MSA: ${req.body.details?.decision}`);
        }
        // Block 8 (QC FAI)
        else if (block_number === 8 && action === 'APPROVE') {
            nextStatus = 'Pending Eng Summary';
            currentBlock = 9;
            nextStageCode = 'STAGE_8';
            
            await client.query(`
                INSERT INTO ecnt2_qc_decision (ecn_id, decision_type, decision, fai_type, reason, confirmed_by, confirmed_by_name, confirmed_date)
                VALUES ($1, 'FAI', $2, $3, $4, $5, $6, NOW())
            `, [id, req.body.details?.decision || 'NOT_REQUIRE', req.body.details?.fai_type || null, req.body.details?.reason || '', userEmpno, userName]);

            await transitionStage(client, 'ECN', id, nextStageCode, 'APPROVE', userEmpno, userName, comment || `FAI: ${req.body.details?.decision}`);
        }
        // Block 9 (Eng Summary & Task Setup)
        else if (block_number === 9 && action === 'APPROVE') {
            nextStatus = 'Pending Concern Approval';
            currentBlock = 10;
            nextStageCode = 'STAGE_9';
            
            const summary = req.body.details;
            await client.query(`
                INSERT INTO ecnt2_fai_summary (ecn_id, fai_approved_confirmed, fai_lot_no, summary_result, stakeholder_comment, confirmed_by, confirmed_by_name, confirmed_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [id, !!summary?.fai_approved_confirmed, summary?.fai_lot_no || '', summary?.summary_result || '', summary?.stakeholder_comment || '', userEmpno, userName]);
            
            // Delete old tasks if re-configuring
            await client.query(`DELETE FROM ecnt2_concern_task WHERE ecn_id = $1`, [id]);

            // Generate Tasks for Block 10
            if (summary?.tasks && Array.isArray(summary.tasks)) {
                for (const dept of summary.tasks) {
                    await client.query(`
                        INSERT INTO ecnt2_concern_task (ecn_id, dept_code, dept_label, is_needed, status)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [id, dept.dept_code, dept.dept_label, !!dept.is_needed, dept.is_needed ? 'PENDING' : 'NOT_NEEDED']);
                }
            }

            await transitionStage(client, 'ECN', id, nextStageCode, 'APPROVE', userEmpno, userName, comment || 'Configured concern tasks');
        }
        // Block 10 (Multi-Dept Acknowledge)
        else if (block_number === 10 && action === 'ACKNOWLEDGE') {
            const taskId = req.body.details?.task_id;
            if (taskId) {
                await client.query(`
                    UPDATE ecnt2_concern_task SET status = 'ACKNOWLEDGED', approved_by = $1, approved_by_name = $2, approved_date = NOW()
                    WHERE id = $3 AND ecn_id = $4
                `, [userEmpno, userName, taskId, id]);
            }
            
            // DWG Enable update if provided
            if (req.body.details?.dwg_enabled !== undefined) {
                await client.query(`UPDATE ecnt2_ecn SET dwg_enabled = $1 WHERE id = $2`, [req.body.details?.dwg_enabled, id]);
            }

            // Check if all needed tasks are acknowledged
            const tasks = await client.query(`SELECT status FROM ecnt2_concern_task WHERE ecn_id = $1 AND is_needed = TRUE`, [id]);
            const allAck = tasks.rows.length > 0 && tasks.rows.every(t => t.status === 'ACKNOWLEDGED');
            
            if (allAck) {
                nextStatus = 'Pending Official Close';
                currentBlock = 11;
                nextStageCode = 'STAGE_10';
                await transitionStage(client, 'ECN', id, nextStageCode, 'ACKNOWLEDGE_ALL', userEmpno, userName, 'All concern tasks acknowledged');
            } else {
                nextStatus = 'Pending Concern Approval';
                currentBlock = 10;
                nextStageCode = 'STAGE_9';
            }
        }
        // Block 11 (Official Close)
        else if (block_number === 11 && (action === 'CLOSE' || action === 'APPROVE')) {
            nextStatus = 'ECN Effective';
            currentBlock = 11;
            nextStageCode = 'STAGE_10';
            
            await client.query(`
                UPDATE ecnt2_ecn SET closed_by = $1, closed_by_name = $2, closed_date = NOW(), process_status = $3, current_block = $4, current_stage_code = $5, updated_at = NOW()
                WHERE id = $6
            `, [userEmpno, userName, nextStatus, currentBlock, nextStageCode, id]);

            await transitionStage(client, 'ECN', id, nextStageCode, 'CLOSE', userEmpno, userName, comment || 'Officially closed & effective');
        }
        
        // Log action
        await client.query(`
            INSERT INTO ecnt2_approval_log (document_type, document_id, block_number, step_label, action, action_by, action_by_name, action_role, comment, deny_reason, request_to_requester, details)
            VALUES ('ECN', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            id, block_number, `Block ${block_number}`, action, userEmpno, userName, userRole, comment, deny_reason, request_to_requester, req.body.details ? JSON.stringify(req.body.details) : null
        ]);
        
        await client.query(`
            UPDATE ecnt2_ecn SET 
                process_status = $1, 
                current_block = $2, 
                current_stage_code = $3, 
                updated_at = NOW() 
            WHERE id = $4
        `, [nextStatus, currentBlock, nextStageCode, id]);
        
        // Trigger Email Notification
        await client.query(`
            INSERT INTO ecnt2_notification (document_type, document_id, block_number, email_type, subject, body)
            VALUES ('ECN', $1, $2, $3, $4, $5)
        `, [id, currentBlock, 'STATUS_UPDATE', `ECN Action: ${action} - New Status: ${nextStatus}`, `ECN moved to ${nextStageCode}`]);

        await client.query('COMMIT');
        res.json({ message: "Action successful", next_status: nextStatus, next_stage: nextStageCode });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("actionEcn Error:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

const getMasterPic = async (req, res) => {
    try {
        const result = await engPool.query(`SELECT * FROM ecnt2_master_pic ORDER BY id ASC`);
        res.json({ data: result.rows });
    } catch (err) {
        console.error("getMasterPic Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// Threaded Discussions & Problem Investigation
// ==========================================

const getDiscussions = async (req, res) => {
    const { docType, docId } = req.params;
    try {
        const result = await engPool.query(`
            SELECT * FROM ecnt2_discussion 
            WHERE document_type = $1 AND document_id = $2 
            ORDER BY created_at ASC
        `, [docType, docId]);
        res.json({ data: result.rows });
    } catch (err) {
        console.error("getDiscussions Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const postDiscussion = async (req, res) => {
    const { document_type, document_id, stage_key, category, message, attachments, parent_id } = req.body;
    try {
        const authorEmpno = req.user?.empno || req.body.author_empno || 'Unknown';
        const authorName = req.user?.name || req.body.author_name || 'User';
        const authorDept = req.user?.department || req.body.author_dept || 'ENG';
        const authorRole = req.user?.role || req.body.author_role || 'Staff';

        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Message content cannot be empty." });
        }

        const sql = `
            INSERT INTO ecnt2_discussion (
                document_type, document_id, stage_key, category,
                author_empno, author_name, author_dept, author_role,
                message, attachments, parent_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;
        const params = [
            document_type, document_id, stage_key || null, category || 'GENERAL',
            authorEmpno, authorName, authorDept, authorRole,
            message.trim(), JSON.stringify(attachments || []), parent_id || null
        ];

        const result = await engPool.query(sql, params);
        res.json({ message: "Comment posted successfully", data: result.rows[0] });
    } catch (err) {
        console.error("postDiscussion Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// Stage History & Gantt Summary
// ==========================================

const getStageHistory = async (req, res) => {
    const { docType, docId } = req.params;
    try {
        const result = await engPool.query(`
            SELECT * FROM ecnt2_stage_history 
            WHERE document_type = $1 AND document_id = $2 
            ORDER BY started_at ASC, id ASC
        `, [docType, docId]);
        res.json({ data: result.rows });
    } catch (err) {
        console.error("getStageHistory Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const getGanttSummary = async (req, res) => {
    try {
        // Aggregate active documents with their full stage timelines
        const ecrRows = await engPool.query(`
            SELECT e.id, e.ecr_no as doc_no, 'ECR' as doc_type, e.title_of_change, e.process_status, e.current_stage_code, e.created_at, e.updated_at,
                   json_agg(s.* ORDER BY s.started_at ASC, s.id ASC) as stages
            FROM ecnt2_ecr e
            LEFT JOIN ecnt2_stage_history s ON s.document_type = 'ECR' AND s.document_id = e.id
            GROUP BY e.id, e.ecr_no, e.title_of_change, e.process_status, e.current_stage_code, e.created_at, e.updated_at
            ORDER BY e.created_at DESC
            LIMIT 30
        `);

        const ecnRows = await engPool.query(`
            SELECT e.id, e.ecn_no as doc_no, 'ECN' as doc_type, e.title_of_change, e.process_status, e.current_stage_code, e.created_at, e.updated_at,
                   json_agg(s.* ORDER BY s.started_at ASC, s.id ASC) as stages
            FROM ecnt2_ecn e
            LEFT JOIN ecnt2_stage_history s ON s.document_type = 'ECN' AND s.document_id = e.id
            GROUP BY e.id, e.ecn_no, e.title_of_change, e.process_status, e.current_stage_code, e.created_at, e.updated_at
            ORDER BY e.created_at DESC
            LIMIT 30
        `);

        res.json({
            ecrTimeline: ecrRows.rows,
            ecnTimeline: ecnRows.rows
        });
    } catch (err) {
        console.error("getGanttSummary Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const getAuditTrail = async (req, res) => {
    const { docType, docId } = req.params;
    try {
        const [logs, audits] = await Promise.all([
            engPool.query(`SELECT * FROM ecnt2_approval_log WHERE document_type = $1 AND document_id = $2 ORDER BY created_at DESC`, [docType, docId]),
            engPool.query(`SELECT * FROM ecnt2_field_audit WHERE document_type = $1 AND document_id = $2 ORDER BY modified_at DESC`, [docType, docId])
        ]);

        res.json({
            logs: logs.rows,
            fieldAudits: audits.rows
        });
    } catch (err) {
        console.error("getAuditTrail Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// My Tasks Queue
// ==========================================

const getMyTasks = async (req, res) => {
    try {
        const user = req.user || {};
        const empno = user.empno || '';
        const dept = (user.department || '').toUpperCase();
        const role = (user.role || '').toUpperCase();

        const ecrResult = await engPool.query(`
            SELECT *, 'ECR' as doc_type FROM ecnt2_ecr 
            WHERE (current_block = 1 AND process_status = 'Require More Detail' AND (request_by = $1 OR $1 = ''))
               OR (current_block = 3 AND process_status = 'Pending Dept Mgr' AND (department = $2 OR $3 IN ('AD', 'MANAGER', 'ADMIN')))
               OR (current_block = 4 AND process_status = 'Pending Eng Mgr' AND ($2 = 'ENG' OR $3 IN ('AD', 'MANAGER', 'ADMIN')))
            ORDER BY updated_at DESC
        `, [empno, dept, role]);

        const ecnResult = await engPool.query(`
            SELECT e.*, 'ECN' as doc_type, ecr.ecr_no,
                   t.id as task_id, t.dept_code as pending_dept
            FROM ecnt2_ecn e
            LEFT JOIN ecnt2_ecr ecr ON e.ecr_id = ecr.id
            LEFT JOIN ecnt2_concern_task t ON e.id = t.ecn_id AND t.is_needed = TRUE AND t.status = 'PENDING'
            WHERE (e.current_block = 5 AND e.process_status = 'Require More Detail' AND (e.engineer_assigned = $1 OR $2 = 'ENG' OR $3 = 'AD'))
               OR (e.current_block = 6 AND e.process_status = 'Pending Eng Mgr ECN' AND ($2 = 'ENG' OR $3 IN ('AD', 'MANAGER', 'ADMIN')))
               OR (e.current_block IN (7, 8) AND ($2 = 'QC' OR $3 IN ('AD', 'MANAGER', 'ADMIN')))
               OR (e.current_block = 9 AND (e.engineer_assigned = $1 OR $2 = 'ENG' OR $3 = 'AD'))
               OR (e.current_block = 10 AND (t.dept_code = $2 OR $3 = 'AD'))
               OR (e.current_block = 11 AND e.process_status = 'Pending Official Close' AND ($2 = 'ENG' OR $3 IN ('AD', 'MANAGER', 'ADMIN')))
            ORDER BY e.updated_at DESC
        `, [empno, dept, role]);

        res.json({
            ecrTasks: ecrResult.rows,
            ecnTasks: ecnResult.rows
        });
    } catch (err) {
        console.error("getMyTasks Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// Attachments
// ==========================================

const saveAttachment = async (req, res) => {
    const { document_id, document_type, block_number, field_name, file_name, file_url, file_type, file_size } = req.body;
    try {
        const uploadedBy = req.user?.name || req.user?.empno || req.body.uploaded_by || 'System';

        const sql = `
            INSERT INTO ecnt2_attachment (
                document_type, document_id, block_number, field_name,
                file_name, file_url, file_type, file_size, uploaded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        const params = [
            document_type,
            document_id,
            block_number || null,
            field_name || null,
            file_name,
            file_url,
            file_type || '',
            file_size || null,
            uploadedBy
        ];

        const result = await engPool.query(sql, params);
        res.json({ message: "Attachment saved successfully", data: result.rows[0] });
    } catch (err) {
        console.error("saveAttachment Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const getAttachments = async (req, res) => {
    const { type, id } = req.params;
    try {
        const result = await engPool.query(
            `SELECT * FROM ecnt2_attachment WHERE document_type = $1 AND document_id = $2 ORDER BY created_at DESC`,
            [type, id]
        );
        res.json({ data: result.rows });
    } catch (err) {
        console.error("getAttachments Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const deleteAttachment = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await engPool.query(`DELETE FROM ecnt2_attachment WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Attachment not found" });
        }
        res.json({ message: "Attachment deleted successfully" });
    } catch (err) {
        console.error("deleteAttachment Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// ==========================================
// Dynamic System Settings & Configurations
// ==========================================

const getEcntConfig = async (req, res) => {
    try {
        const result = await engPool.query(`SELECT key, value, description, updated_by, updated_at FROM ecnt2_system_config`);
        const configMap = {};
        result.rows.forEach(r => {
            configMap[r.key] = r.value;
        });
        res.json({ success: true, data: configMap, meta: result.rows });
    } catch (err) {
        console.error("getEcntConfig Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const updateEcntConfig = async (req, res) => {
    const userRole = (req.user?.role || req.user?.u_role || '').toUpperCase();
    const userDept = (req.user?.department || req.user?.u_department || '').toUpperCase();
    const empno = (req.user?.empno || req.user?.u_code || '').toLowerCase();
    const position = (req.user?.position || '').toLowerCase();

    try {
        // Fetch current system_admins
        const adminConfig = await engPool.query(`SELECT value FROM ecnt2_system_config WHERE key = 'system_admins'`);
        const adminsList = (adminConfig.rows[0]?.value || ["admin", "eng_mgr"]).map(a => String(a).toLowerCase());

        const isAuthorized = 
            userRole === 'AD' || 
            userDept === 'AD' || 
            (userDept === 'ENG' && (userRole === 'MGR' || position.includes('coord') || position.includes('mgr'))) ||
            adminsList.includes(empno);

        if (!isAuthorized) {
            return res.status(403).json({ 
                error: "Access Denied: Only ECNT Admins, System Admins, or ENG Managers/Coordinators can modify system configurations." 
            });
        }

        const key = req.body.key || req.body.config_key;
        const value = req.body.value !== undefined ? req.body.value : req.body.config_value;
        const description = req.body.description || req.body.config_description;
        if (!key || value === undefined) {
            return res.status(400).json({ error: "key and value are required" });
        }

        await engPool.query(`
            INSERT INTO ecnt2_system_config (key, value, description, updated_by, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                description = COALESCE(EXCLUDED.description, ecnt2_system_config.description),
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
        `, [key, JSON.stringify(value), description || null, empno || req.user?.name || 'ADMIN']);

        res.json({ success: true, message: `Configuration '${key}' updated successfully` });
    } catch (err) {
        console.error("updateEcntConfig Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Fetch registered users from m_user_profile for stage PIC & Manager assignment,
 * explicitly excluding any user whose nickname is 'Admin'.
 */
const getUserCandidates = async (req, res) => {
    try {
        const result = await engPool.query(`
            SELECT u_code, u_name, u_nickname, u_department, role, position, section, gmail_email
            FROM m_user_profile
            WHERE LOWER(COALESCE(u_nickname, '')) != 'admin'
            ORDER BY u_department ASC, role ASC, u_name ASC
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("getUserCandidates Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createEcr,
    resubmitEcr,
    getEcrList,
    getEcrById,
    actionEcr,
    createEcn,
    getEcnList,
    getEcnById,
    actionEcn,
    getMasterPic,
    getMyTasks,
    saveAttachment,
    getAttachments,
    deleteAttachment,
    getDiscussions,
    postDiscussion,
    getStageHistory,
    getGanttSummary,
    getAuditTrail,
    getEcntConfig,
    updateEcntConfig,
    getUserCandidates
};

