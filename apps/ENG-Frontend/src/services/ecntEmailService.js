import { GAS_WEBAPP_URL } from '../constance/constance';

/**
 * Enterprise Email Dispatcher via Google Apps Script (Frontend to GAS)
 * 
 * Bypasses corporate firewall by having the browser client execute direct
 * GET/POST requests to Google Apps Script Web App.
 */

export const buildDocumentDeepLink = (docType, docId, view = 'workspace', stageCode = '') => {
    const origin = window.location.origin;
    const params = new URLSearchParams({
        docType: docType || 'ECR',
        id: String(docId),
        view: view || 'workspace'
    });
    if (stageCode) {
        params.append('stage', stageCode);
    }
    return `${origin}/eng/process_eng/ecnt_v2?${params.toString()}`;
};

export const sendGasEmail = async (gasUrl, payload) => {
    const endpoint = gasUrl || GAS_WEBAPP_URL;
    if (!endpoint) {
        console.warn("[ecntEmailService] No GAS WebApp URL provided. Skipping email dispatch.");
        return { success: false, reason: "NO_GAS_URL" };
    }

    try {
        // Preferred: POST via fetch with no-cors mode to avoid CORS blocking
        await fetch(endpoint, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log("[ecntEmailService] Email dispatched via fetch(POST):", payload.subject || payload.doc_no);
        return { success: true };
    } catch (err) {
        console.warn("[ecntEmailService] POST failed, falling back to silent iframe GET:", err.message);
        // Fallback: Silent iframe with URLSearchParams
        try {
            const queryParams = new URLSearchParams();
            Object.entries(payload).forEach(([k, v]) => {
                if (v !== undefined && v !== null) {
                    queryParams.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
                }
            });
            queryParams.append('t', Date.now());

            const iframe = document.createElement('iframe');
            iframe.src = `${endpoint}?${queryParams.toString()}`;
            iframe.style.cssText = 'display:none;position:absolute;left:-9999px;width:0;height:0;';
            iframe.title = 'ecnt-gas-email';
            document.body.appendChild(iframe);

            setTimeout(() => {
                try { document.body.removeChild(iframe); } catch(e) {}
            }, 8000);

            return { success: true, mode: 'iframe_fallback' };
        } catch (iframeErr) {
            console.error("[ecntEmailService] All dispatch methods failed:", iframeErr);
            return { success: false, error: iframeErr.message };
        }
    }
};

/**
 * High-level ECNT Stage Workflow Notification Trigger
 */
export const dispatchStageWorkflowEmail = async ({
    stageCode,
    docData,
    documentType = 'ECR',
    actionTaken = 'SUBMIT',
    comment = '',
    assignedPicName = '',
    customRecipients = '',
    systemConfig = null
}) => {
    if (!docData) return;

    const emailSettings = systemConfig?.email_settings || { enabled: true };
    if (emailSettings.enabled === false) {
        console.log("[ecntEmailService] Email notifications are globally disabled in ECNT settings.");
        return;
    }

    const gasUrl = emailSettings.gas_webapp_url || GAS_WEBAPP_URL;
    const docId = docData.id;
    const docNo = documentType === 'ECR' ? (docData.ecr_no || `ECR #${docId}`) : (docData.ecn_no || `ECN #${docId}`);
    const directUrl = buildDocumentDeepLink(documentType, docId, 'workspace', stageCode);

    // Resolve recipients based on stage and config
    let recipients = customRecipients;
    let stageTitle = stageCode;
    let actionRequired = "Please review this document in the ECNT system.";
    let isRework = false;

    const deptMgrMapping = systemConfig?.stage_assignees?.dept_mgr_mapping || {};
    const defaultEngMgr = systemConfig?.stage_assignees?.eng_mgr || {};
    const leadEngRisk = systemConfig?.stage_assignees?.lead_engineer_risk || {};
    const defaultLeadEng = systemConfig?.stage_assignees?.default_lead_engineer || {};
    const defaultQcPic = systemConfig?.stage_assignees?.default_qc_pic || {};
    const qcMsaPic = systemConfig?.stage_assignees?.qc_msa_pic || defaultQcPic;
    const qcFaiPic = systemConfig?.stage_assignees?.qc_fai_pic || defaultQcPic;

    switch (stageCode) {
        case 'STAGE_2': // Dept Mgr Review
            stageTitle = '2. Dept Mgr Review';
            actionRequired = `Department Manager (${docData.department || 'Originating Dept'}) is requested to review and approve Block 3.`;
            if (!recipients) {
                const deptMgr = deptMgrMapping[docData.department];
                recipients = deptMgr?.email || 'eng.mgr@minebea.co.th';
            }
            break;

        case 'STAGE_2_R1': // Dept Mgr Requested More Detail
        case 'STAGE_3_R1': // Eng Mgr Requested More Detail
        case 'STAGE_5_R1': // Eng Mgr ECN Rework
            isRework = true;
            stageTitle = `${stageCode}: Clarification & Rework`;
            actionRequired = `Reviewer requested revision / additional details. Please update the requested fields and resubmit.`;
            if (!recipients) {
                recipients = docData.request_by_email || `${docData.request_by_emp_no || docData.request_by}@minebea.co.th`;
            }
            break;

        case 'STAGE_2_RISK': // ECR Risk Assessment
            stageTitle = '3. ECR Risk Assessment';
            actionRequired = `Lead Engineer (${leadEngRisk.name || 'Assigned Lead Engineer'}) is requested to review technical changes and conduct Risk Assessment.`;
            if (!recipients) {
                recipients = leadEngRisk.email || docData.assigned_to_email || 'nathaporn.y@minebea.co.th';
            }
            break;

        case 'STAGE_3': // Eng Mgr Review & Assignment
            stageTitle = '3. Eng Dept Mgr Assignment';
            actionRequired = 'Engineering Manager is requested to review feasibility and assign an Engineer to formulate the ECN.';
            if (!recipients) {
                recipients = defaultEngMgr.email || 'teerapol.k@minebea.co.th';
            }
            break;

        case 'STAGE_4': // Engineer Assigned ECN Formulation
            stageTitle = '4. ECN Formulation & Impact Assessment';
            actionRequired = `Assigned Engineer (${assignedPicName || docData.engineer_assigned_name || defaultLeadEng.name || 'Engineer'}) is requested to establish ECN and complete impact assessment.`;
            if (!recipients) {
                recipients = docData.engineer_assigned_email || defaultLeadEng.email || 'nathaporn.y@minebea.co.th';
            }
            break;

        case 'STAGE_5': // Eng Dept Mgr ECN Review
            stageTitle = '5. Eng Dept Mgr ECN Review';
            actionRequired = 'Engineering Manager is requested to review ECN scope, impact checklist, and authorize document update.';
            if (!recipients) {
                recipients = defaultEngMgr.email || 'teerapol.k@minebea.co.th';
            }
            break;

        case 'STAGE_6': // QC MSA Decision
            stageTitle = '6. QC MSA Decision';
            actionRequired = 'QC Team is requested to evaluate Measurement Systems Analysis (MSA) requirement with justification.';
            if (!recipients) {
                recipients = qcMsaPic.email || defaultQcPic.email || 'patcharayada.w@minebea.co.th';
            }
            break;

        case 'STAGE_7': // QC FAI Decision
            stageTitle = '7. QC FAI Decision';
            actionRequired = 'QC Team is requested to decide Full FAI, Delta FAI, or Not Required (Block 8).';
            if (!recipients) {
                recipients = qcFaiPic.email || defaultQcPic.email || 'patcharayada.w@minebea.co.th';
            }
            break;

        case 'STAGE_8': // Eng Summary & Concern Dispatch
            stageTitle = '8. Eng Summary & Concern Dispatch';
            actionRequired = 'Lead Engineer is requested to record FAI lot/results and define the department sign-off matrix (Block 9).';
            if (!recipients) {
                recipients = docData.engineer_assigned_email || defaultLeadEng.email || 'nathaporn.y@minebea.co.th';
            }
            break;

        case 'STAGE_9': // Concern Department Sign-offs
            stageTitle = '9. Concern Dept Sign-offs';
            actionRequired = 'Concerned Departments are requested to evaluate the change impact and provide sign-offs.';
            if (!recipients) {
                const concernDepts = systemConfig?.concern_depts || [];
                recipients = concernDepts.map(d => d.email).filter(Boolean).join(',');
            }
            break;

        case 'STAGE_10': // Final Close & Release
            stageTitle = '10. Effective & Closed';
            actionRequired = 'The Engineering Change Notice (ECN) has been approved and is now officially effective across all departments.';
            if (!recipients) {
                recipients = [
                    docData.request_by_email,
                    defaultEngMgr.email,
                    defaultQcPic.email
                ].filter(Boolean).join(',');
            }
            break;

        default:
            stageTitle = stageCode;
            actionRequired = `Status changed to ${docData.process_status || stageCode}`;
            break;
    }

    if (!recipients) {
        recipients = 'nanthiwa.k@minebea.co.th';
    }

    const payload = {
        funct: 'sendEcntEmail',
        recipients,
        doc_type: documentType,
        doc_no: docNo,
        doc_id: docId,
        title: docData.title_of_change || docData.title || 'N/A',
        customer: docData.customer_name || 'N/A',
        department: docData.department || 'ENG',
        requester: docData.request_by_name || 'Requester',
        stage_title: stageTitle,
        action_required: actionRequired,
        notes: comment || '',
        direct_url: directUrl,
        priority: docData.priority || 'NORMAL',
        is_rework: isRework
    };

    return await sendGasEmail(gasUrl, payload);
};
