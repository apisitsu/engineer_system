/**
 * Email Template Renderer for Tool Request Workflow
 * Generates HTML email content for workflow notifications
 */

const fs = require('fs');
const path = require('path');

// Cache template in memory
let emailTemplateCache = null;

/**
 * Load email template from file
 */
const loadTemplate = () => {
  if (emailTemplateCache) {
    return emailTemplateCache;
  }

  const templatePath = path.join(__dirname, 'workflow_notification.html');
  
  try {
    const template = fs.readFileSync(templatePath, 'utf-8');
    emailTemplateCache = template;
    return template;
  } catch (error) {
    console.error('❌ Failed to load email template:', error.message);
    // Return inline template as fallback
    return getFallbackTemplate();
  }
};

/**
 * Fallback template if file not found
 */
const getFallbackTemplate = () => {
  return `
    <div style="border-left:5px solid {{COLOR}};padding:16px;background:#f9f9f9;margin-bottom:16px;">
      <h2 style="color:{{COLOR}};margin:0 0 8px">{{TITLE}}</h2>
    </div>
    <p><strong>Request Item:</strong> {{REQUEST_ITEM}}</p>
    <p><strong>Requester:</strong> {{REQUESTER}}</p>
    <p><strong>Department:</strong> {{DEPARTMENT}}</p>
    <p><strong>Type:</strong> {{TYPE_OF_REQUEST}}</p>
    <p><strong>Title:</strong> {{TITLE}}</p>
    {{EXTRA_HTML}}
    {{#COMMENT}}<p><strong>Comment:</strong> {{COMMENT}}</p>{{/COMMENT}}
    <p><strong>Action by:</strong> {{ACTION_BY}}</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:16px 0">
    <p style="color:#888;font-size:12px">Tool Drawing Request System — ENG</p>
  `;
};

/**
 * Render email with template
 * @param {Object} options - Email data
 * @returns {string} Rendered HTML
 */
const renderEmail = (options) => {
  const {
    stage,
    decision,
    request,
    extra = {},
    actionBy,
    actionDate = new Date().toISOString(),
  } = options;

  const template = loadTemplate();
  
  // Determine colors and titles based on decision
  const isApprove = decision === 'approve' || decision === 'submit';
  const color = isApprove ? '#4CAF50' : '#F44336';
  const stageLabels = {
    eng_check: 'Eng Check',
    draft_man: 'Draft Man',
    dwg_check: 'DWG Check',
    eng_review: 'Eng Review',
    eng_approve: 'Eng Approve',
    eng_inform: 'Eng Inform',
  };
  const stageLabel = stageLabels[stage] || stage;
  
  const title = isApprove
    ? `[${stageLabel} ✅] ${request.request_item} — ${request.title}`
    : `[${stageLabel} ❌ Denied] ${request.request_item} — ${request.title}`;

  // Build extra content HTML
  let extraHtml = '';
  
  if (stage === 'eng_check' && extra.request_no) {
    extraHtml += `<p><strong>Request No. Assigned:</strong> ${extra.request_no}</p>`;
  }
  
  if (stage === 'draft_man' && extra.dwg_files) {
    extraHtml += `<p><strong>Drawing Files:</strong> ${extra.dwg_files}</p>`;
  }
  
  if (stage === 'dwg_check') {
    extraHtml += `<p><strong>Decision:</strong> ${isApprove ? '✅ Approved — Drawing is correct' : '❌ Denied — Need revision'}</p>`;
  }
  
  if (stage === 'eng_review') {
    extraHtml += `
      <p><strong>Drawing No:</strong> ${extra.drawing_no || '-'}</p>
      <p><strong>No. of Dwg:</strong> ${extra.no_of_dwg || '-'}</p>
      <p><strong>Section:</strong> ${extra.section || '-'}</p>
    `;
  }
  
  if (stage === 'eng_approve') {
    extraHtml += `<p><strong>Final Decision:</strong> ${isApprove ? '✅ Approved — Request is completed' : '❌ Denied — Need more work'}</p>`;
  }
  
  if (stage === 'eng_inform') {
    extraHtml += `
      <p><strong>Cost:</strong> ${extra.cost || 'N/A'}</p>
      <p><strong>Evidence:</strong> ${extra.evidence || '-'}</p>
      <p><strong>Notes:</strong> ${extra.inform_note || '-'}</p>
    `;
    
    // Add file links if available
    if (extra.attached_file_paths?.length > 0) {
      const baseUrl = process.env.SERVER_URL || 'http://localhost:2005';
      const fileLinks = extra.attached_file_paths.map((p, i) => {
        const fileName = extra.attached_file_names?.[i] || p.split('/').pop();
        return `<a href="${baseUrl}${p}" target="_blank" rel="noopener">${fileName}</a>`;
      }).join(' ');
      extraHtml += `
        <div class="file-links">
          <strong>Attached Drawing Files:</strong><br>
          ${fileLinks}
        </div>
      `;
    }
  }

  // Next stage info
  const nextStages = {
    eng_check: { stage: 'Draft Man', team: 'Draft Man' },
    draft_man: { stage: 'DWG Check', team: 'DWG Check' },
    dwg_check: { stage: 'Eng Review', team: 'Engineering Review' },
    eng_review: { stage: 'Eng Approve', team: 'Engineering Approval' },
    eng_approve: { stage: 'Eng Inform', team: 'Engineering' },
    eng_inform: null,
  };
  
  const nextStageInfo = nextStages[stage];
  let nextStageHtml = '';
  if (nextStageInfo && isApprove) {
    nextStageHtml = `
      <div class="action-section">
        <strong>Next Stage:</strong> ${nextStageInfo.stage}<br>
        <em>This request will be forwarded to the ${nextStageInfo.team} team for further processing.</em>
      </div>
    `;
  }

  // Replace placeholders
  let html = template
    .replace(/{{COLOR}}/g, color)
    .replace(/{{TITLE}}/g, title)
    .replace(/{{STATUS}}/g, request.status)
    .replace(/{{REQUEST_ITEM}}/g, request.request_item || '-')
    .replace(/{{REQUEST_NO}}/g, request.req_no || '-')
    .replace(/{{REQUESTER}}/g, request.requester || '-')
    .replace(/{{DEPARTMENT}}/g, request.department || '-')
    .replace(/{{TYPE_OF_REQUEST}}/g, request.type_of_request || '-')
    .replace(/{{TITLE}}/g, request.title || '-')
    .replace(/{{DUE_DATE}}/g, request.req_due_date ? new Date(request.req_due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
    .replace(/{{EXTRA_CONTENT}}/g, extraHtml)
    .replace(/{{COMMENT}}/g, extra.comment || '')
    .replace(/{{IS_DENY}}/g, !isApprove ? 'deny' : '')
    .replace(/{{ACTION_BY}}/g, actionBy || 'System')
    .replace(/{{ACTION_DATE}}/g, new Date(actionDate).toLocaleString('en-GB'))
    .replace(/{{NEXT_STAGE}}/g, nextStageInfo ? nextStageInfo.stage : '')
    .replace(/{{NEXT_TEAM}}/g, nextStageInfo ? nextStageInfo.team : '');

  // Remove conditional blocks if not applicable
  html = html.replace(/{{#DUE_DATE}}.*?{{\/DUE_DATE}}/s, request.req_due_date ? html.match(/{{#DUE_DATE}}(.*?){{\/DUE_DATE}}/s)?.[1] || '' : '');
  
  return html;
};

/**
 * Generate email subject
 */
const generateSubject = (stage, decision, request) => {
  const isApprove = decision === 'approve' || decision === 'submit';
  const stageLabels = {
    eng_check: 'Eng Check',
    draft_man: 'Draft Man',
    dwg_check: 'DWG Check',
    eng_review: 'Eng Review',
    eng_approve: 'Eng Approve',
    eng_inform: 'Eng Inform',
  };
  
  const icon = isApprove ? '✅' : '❌';
  const stageLabel = stageLabels[stage] || stage;
  const status = request.status || 'Updated';
  
  return `[Tool Request] ${icon} ${stageLabel} — ${status} — ${request.request_item}`;
};

module.exports = {
  renderEmail,
  generateSubject,
  loadTemplate,
};
