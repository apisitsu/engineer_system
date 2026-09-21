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
    const defaultQcPic = systemConfig?.stage_assignees?.default_qc_pic || {};

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
                recipients = docData.request_by_email || `${docData.request_by_emp_no}@minebea.co.th`;
            }
            break;

        case 'STAGE_3': // Eng Mgr Review & Assignment
            stageTitle = '3. Eng Dept Mgr Assignment';
            actionRequired = 'Engineering Manager is requested to review feasibility and assign an Engineer to formulate the ECN.';
            if (!recipients) {
                recipients = defaultEngMgr.email || 'eng.mgr@minebea.co.th';
            }
            break;

        case 'STAGE_4': // Engineer Assigned ECN Formulation
            stageTitle = '4. ECN Formulation';
            actionRequired = `Assigned Engineer (${assignedPicName || docData.engineer_assigned_name || 'Engineer'}) has been assigned to create ECN and Impact Assessment.`;
            if (!recipients) {
                recipients = docData.engineer_assigned_email || `${docData.engineer_assigned}@minebea.co.th`;
            }
            break;

        case 'STAGE_7': // QC MSA & FAI Evaluation
            stageTitle = '7. QC MSA & FAI Evaluation';
            actionRequired = 'QC Team is requested to evaluate Measurement System Analysis (MSA) and First Article Inspection (FAI).';
            if (!recipients) {
                recipients = defaultQcPic.email || 'qc.pic@minebea.co.th';
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
