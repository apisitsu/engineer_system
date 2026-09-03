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

// ==========================================
// ECR (Blocks 1-4)
// ==========================================

const createEcr = async (req, res) => {
    const data = req.body;
    try {
        const sql = `
            INSERT INTO ecnt2_ecr (
                ref_coc_no, request_by, request_by_name, department, 
                status_type, objective, objective_other,
                is_drawing, is_tooling, is_program, is_usage,
                title_of_change, reason_of_change,
                dwg_part_no, dwg_cn, dwg_revision, dwg_reason_of_change, dwg_before_change, dwg_after_change,
                tool_current_no, tool_current_usage, tool_new_no, tool_new_usage,
                prog_before_change, prog_condition_before, prog_after_change, prog_condition_after,
                usage_setup_no, usage_part_no, usage_cn, usage_process, usage_program_no, usage_mc_no, usage_cycle_time_before, usage_cycle_time_after, usage_before_change, usage_after_change,
                process_status, current_block
            ) VALUES (
                $1, $2, $3, $4, 
                $5, $6, $7, 
                $8, $9, $10, $11, 
                $12, $13,
                $14, $15, $16, $17, $18, $19,
                $20, $21, $22, $23,
                $24, $25, $26, $27,
                $28, $29, $30, $31, $32, $33, $34, $35, $36, $37,
                'Pending Dept Mgr', 3
            ) RETURNING id
        `;
        
        const params = [
            data.ref_coc_no || null, data.request_by, data.request_by_name, data.department,
            data.status_type || 'PERMANENT', data.objective, data.objective_other,
            !!data.is_drawing, !!data.is_tooling, !!data.is_program, !!data.is_usage,
            data.title_of_change, data.reason_of_change,
            data.dwg_part_no, data.dwg_cn, data.dwg_revision, data.dwg_reason_of_change, data.dwg_before_change, data.dwg_after_change,
            data.tool_current_no, data.tool_current_usage, data.tool_new_no, data.tool_new_usage,
            data.prog_before_change, data.prog_condition_before, data.prog_after_change, data.prog_condition_after,
            data.usage_setup_no, data.usage_part_no, data.usage_cn, data.usage_process, data.usage_program_no, data.usage_mc_no, data.usage_cycle_time_before, data.usage_cycle_time_after, data.usage_before_change, data.usage_after_change
        ];

        const result = await engPool.query(sql, params);
        const newId = result.rows[0].id;
        
        res.json({ message: "ECR Created Successfully", id: newId });
    } catch (err) {
        console.error("createEcr Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const getEcrList = async (req, res) => {
    try {
        const result = await engPool.query(`SELECT * FROM ecnt2_ecr ORDER BY created_at DESC`);
        res.json({ data: result.rows });
    } catch (err) {
        console.error("getEcrList Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const getEcrById = async (req, res) => {
    const { id } = req.params;
    try {
        const ecrResult = await engPool.query(`SELECT * FROM ecnt2_ecr WHERE id = $1`, [id]);
        if (ecrResult.rows.length === 0) return res.status(404).json({ message: "ECR Not Found" });
        
        const logResult = await engPool.query(`SELECT * FROM ecnt2_approval_log WHERE document_type = 'ECR' AND document_id = $1 ORDER BY created_at ASC`, [id]);
        
        res.json({
            data: ecrResult.rows[0],
            logs: logResult.rows
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
        
        let nextStatus = 'Draft';
        let currentBlock = block_number;
        
        if (action === 'DENY') {
            nextStatus = 'Denied';
        } else if (action === 'REQUEST_MORE_DETAIL') {
            nextStatus = 'Require More Detail';
            currentBlock = 1;
        } else if (action === 'APPROVE') {
            if (block_number === 3) {
                nextStatus = 'Pending Eng Mgr';
                currentBlock = 4;
            } else if (block_number === 4) {
                // Determine ECN Issue or ECR Only based on action_role payload details
                const isIssueEcn = req.body.details?.is_issue_ecn;
                nextStatus = isIssueEcn ? 'Issued ECN' : 'ECR Only Closed';
                
                // Auto-generate ECR No if it doesn't have one
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
            id, block_number, `Block ${block_number}`, action, action_by, action_by_name, action_role, comment, deny_reason, request_to_requester, req.body.details ? JSON.stringify(req.body.details) : null
        ]);
        
        // Update document state
        await client.query(`UPDATE ecnt2_ecr SET process_status = $1, current_block = $2, updated_at = NOW() WHERE id = $3`, [nextStatus, currentBlock, id]);
        
        // Trigger Email Notification (Mock implementation for Phase 4)
        await client.query(`
            INSERT INTO ecnt2_notification (document_type, document_id, block_number, email_type, subject, body)
            VALUES ('ECR', $1, $2, $3, $4, $5)
        `, [id, currentBlock, 'STATUS_UPDATE', `ECR Action: ${action} - New Status: ${nextStatus}`, `ECR has moved to block ${currentBlock}`]);

        await client.query('COMMIT');
        res.json({ message: "Action successful", next_status: nextStatus });
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
        
        const sqlEcn = `
            INSERT INTO ecnt2_ecn (
                ecn_no, ecr_id, request_by, request_date, department, engineer_assigned,
                title_of_change, reason_of_change, scope_of_implementation, before_change, after_change,
                dwg_suspended, related_models, current_block, process_status
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                $12, $13, 6, 'Pending Eng Mgr ECN'
            ) RETURNING id
        `;
        
        const resultEcn = await client.query(sqlEcn, [
            data.ecn_no, data.ecr_id, data.request_by, data.request_date, data.department, data.engineer_assigned,
            data.title_of_change, data.reason_of_change, data.scope_of_implementation, data.before_change, data.after_change,
            !!data.dwg_suspended, JSON.stringify(data.related_models || [])
        ]);
        
        const newEcnId = resultEcn.rows[0].id;
        
        // Insert Impact Assessment
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
                    has_otd, otd_details
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
                )
            `;
            await client.query(sqlImpact, [
                newEcnId,
                !!imp.has_customer_impact, imp.customer_name, imp.m4_request_doc_no, imp.customer_notification_date, imp.customer_change_notice_date, imp.customer_approved_date,
                !!imp.has_kzw_fjsw_impact, imp.operation_type, imp.kzw_notification_date, imp.kzw_dcn_ecn_doc_no, imp.kzw_doc_received_date,
                !!imp.has_sale_drawing_impact, imp.sale_drawing_revision_no, imp.sale_drawing_finish_date,
                !!imp.has_traceability, imp.traceability_details ? JSON.stringify(imp.traceability_details) : null,
                !!imp.has_wip_stock, imp.wip_stock_details ? JSON.stringify(imp.wip_stock_details) : null,
                !!imp.has_outsourcing, imp.outsourcing_details ? JSON.stringify(imp.outsourcing_details) : null,
                !!imp.has_unit_price, imp.unit_price_details ? JSON.stringify(imp.unit_price_details) : null,
                !!imp.has_manufacturing, imp.manufacturing_details ? JSON.stringify(imp.manufacturing_details) : null,
                !!imp.has_product_quality, imp.product_quality_details ? JSON.stringify(imp.product_quality_details) : null,
                !!imp.has_safety, imp.safety_details ? JSON.stringify(imp.safety_details) : null,
                !!imp.has_otd, imp.otd_details ? JSON.stringify(imp.otd_details) : null
            ]);
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
        const result = await engPool.query(`SELECT * FROM ecnt2_ecn ORDER BY created_at DESC`);
        res.json({ data: result.rows });
    } catch (err) {
        console.error("getEcnList Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};

const getEcnById = async (req, res) => {
    const { id } = req.params;
    try {
        const ecnResult = await engPool.query(`SELECT * FROM ecnt2_ecn WHERE id = $1`, [id]);
        if (ecnResult.rows.length === 0) return res.status(404).json({ message: "ECN Not Found" });
        
        const impactResult = await engPool.query(`SELECT * FROM ecnt2_impact_assessment WHERE ecn_id = $1`, [id]);
        const qcResult = await engPool.query(`SELECT * FROM ecnt2_qc_decision WHERE ecn_id = $1`, [id]);
        const faiResult = await engPool.query(`SELECT * FROM ecnt2_fai_summary WHERE ecn_id = $1`, [id]);
        const taskResult = await engPool.query(`SELECT * FROM ecnt2_concern_task WHERE ecn_id = $1`, [id]);
        const logResult = await engPool.query(`SELECT * FROM ecnt2_approval_log WHERE document_type = 'ECN' AND document_id = $1 ORDER BY created_at ASC`, [id]);
        
        res.json({
            data: ecnResult.rows[0],
            impact: impactResult.rows[0] || null,
            qc: qcResult.rows,
            fai: faiResult.rows[0] || null,
            tasks: taskResult.rows,
            logs: logResult.rows
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
        
        let nextStatus = 'Pending Eng Mgr ECN';
        let currentBlock = block_number;
        
        // Block 6 (Eng Mgr Approve ECN)
        if (block_number === 6) {
            if (action === 'APPROVE') {
                nextStatus = 'Pending QC MSA';
                currentBlock = 7;
            } else if (action === 'REQUEST_MORE_DETAIL') {
                nextStatus = 'Require More Detail';
                currentBlock = 5;
            }
        }
        // Block 7 (QC MSA)
        else if (block_number === 7 && action === 'APPROVE') {
            nextStatus = 'Pending QC FAI';
            currentBlock = 8;
            
            await client.query(`
                INSERT INTO ecnt2_qc_decision (ecn_id, decision_type, decision, reason, confirmed_by, confirmed_by_name, confirmed_date)
                VALUES ($1, 'MSA', $2, $3, $4, $5, NOW())
            `, [id, req.body.details?.decision, req.body.details?.reason, action_by, action_by_name]);
        }
        // Block 8 (QC FAI)
        else if (block_number === 8 && action === 'APPROVE') {
            nextStatus = 'Pending Eng Summary';
            currentBlock = 9;
            
            await client.query(`
                INSERT INTO ecnt2_qc_decision (ecn_id, decision_type, decision, fai_type, reason, confirmed_by, confirmed_by_name, confirmed_date)
                VALUES ($1, 'FAI', $2, $3, $4, $5, $6, NOW())
            `, [id, req.body.details?.decision, req.body.details?.fai_type, req.body.details?.reason, action_by, action_by_name]);
        }
        // Block 9 (Eng Summary)
        else if (block_number === 9 && action === 'APPROVE') {
            nextStatus = 'Pending Concern Approval';
            currentBlock = 10;
            
            const summary = req.body.details;
            await client.query(`
                INSERT INTO ecnt2_fai_summary (ecn_id, fai_approved_confirmed, fai_lot_no, summary_result, stakeholder_comment, confirmed_by, confirmed_by_name, confirmed_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [id, summary?.fai_approved_confirmed, summary?.fai_lot_no, summary?.summary_result, summary?.stakeholder_comment, action_by, action_by_name]);
            
            // Generate Tasks for Block 10
            if (summary?.tasks) {
                for (const dept of summary.tasks) {
                    await client.query(`
                        INSERT INTO ecnt2_concern_task (ecn_id, dept_code, dept_label, is_needed, status)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [id, dept.dept_code, dept.dept_label, dept.is_needed, dept.is_needed ? 'PENDING' : 'NOT_NEEDED']);
                }
            }
        }
        // Block 10 (Multi-Dept Acknowledge)
        else if (block_number === 10 && action === 'ACKNOWLEDGE') {
            const taskId = req.body.details?.task_id;
            await client.query(`
                UPDATE ecnt2_concern_task SET status = 'ACKNOWLEDGED', approved_by = $1, approved_by_name = $2, approved_date = NOW()
                WHERE id = $3
            `, [action_by, action_by_name, taskId]);
            
            // Check if all needed tasks are acknowledged
            const tasks = await client.query(`SELECT status FROM ecnt2_concern_task WHERE ecn_id = $1 AND is_needed = TRUE`, [id]);
            const allAck = tasks.rows.every(t => t.status === 'ACKNOWLEDGED');
            
            if (allAck) {
                nextStatus = 'Pending Official Close';
                currentBlock = 11;
                
                // DWG Enable update if sent
                if (req.body.details?.dwg_enabled !== undefined) {
                    await client.query(`UPDATE ecnt2_ecn SET dwg_enabled = $1 WHERE id = $2`, [req.body.details?.dwg_enabled, id]);
                }
            } else {
                // Stay in Block 10
                nextStatus = 'Pending Concern Approval';
                currentBlock = 10;
            }
        }
        // Block 11 (Official Close)
        else if (block_number === 11 && action === 'CLOSE') {
            nextStatus = 'ECN Effective';
            currentBlock = 11;
            
            await client.query(`
                UPDATE ecnt2_ecn SET closed_by = $1, closed_by_name = $2, closed_date = NOW()
                WHERE id = $3
            `, [action_by, action_by_name, id]);
        }
        
        // Log action
        await client.query(`
            INSERT INTO ecnt2_approval_log (document_type, document_id, block_number, step_label, action, action_by, action_by_name, action_role, comment, deny_reason, request_to_requester, details)
            VALUES ('ECN', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            id, block_number, `Block ${block_number}`, action, action_by, action_by_name, action_role, comment, deny_reason, request_to_requester, req.body.details ? JSON.stringify(req.body.details) : null
        ]);
        
        await client.query(`UPDATE ecnt2_ecn SET process_status = $1, current_block = $2, updated_at = NOW() WHERE id = $3`, [nextStatus, currentBlock, id]);
        
        // Trigger Email Notification (Mock implementation for Phase 4)
        await client.query(`
            INSERT INTO ecnt2_notification (document_type, document_id, block_number, email_type, subject, body)
            VALUES ('ECN', $1, $2, $3, $4, $5)
        `, [id, currentBlock, 'STATUS_UPDATE', `ECN Action: ${action} - New Status: ${nextStatus}`, `ECN has moved to block ${currentBlock}`]);

        await client.query('COMMIT');
        res.json({ message: "Action successful", next_status: nextStatus });
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
// Attachments
// ==========================================

const saveAttachment = async (req, res) => {
    const { document_id, document_type, block_number, field_name, file_name, file_url, drive_file_id, mime_type, file_type, file_size } = req.body;
    try {
        const url = file_url || (drive_file_id ? `https://drive.google.com/file/d/${drive_file_id}/view` : '');
        const type = file_type || mime_type || '';
        const uploadedBy = req.user?.empno || req.user?.name || req.body.uploaded_by || 'System';

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
            url,
            type,
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

module.exports = {
    createEcr,
    getEcrList,
    getEcrById,
    actionEcr,
    createEcn,
    getEcnList,
    getEcnById,
    actionEcn,
    getMasterPic,
    saveAttachment,
    getAttachments,
    deleteAttachment
};
