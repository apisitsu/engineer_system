/**
 * Email Template Renderer for Tool Request Workflow
 * Generates HTML email content for workflow notifications
 */

const fs = require('fs');
const path = require('path');

let emailTemplateCache = null;

const loadTemplate = () => {
  if (emailTemplateCache) return emailTemplateCache;
  const templatePath = path.join(__dirname, 'workflow_notification.html');
  try {
    emailTemplateCache = fs.readFileSync(templatePath, 'utf-8');
    return emailTemplateCache;
  } catch (error) {
    console.error('❌ Failed to load email template:', error.message);
    return getFallbackTemplate();
  }
};

const getFallbackTemplate = () => `
  <div style="border-left:5px solid {{COLOR}};padding:16px;background:#f9f9f9">
    <h2 style="color:{{COLOR}}">{{EMAIL_TITLE}}</h2>
  </div>
  <p><strong>Request Item:</strong> {{REQUEST_ITEM}}</p>
  <p><strong>Requester:</strong> {{REQUESTER}}</p>
  <p><strong>Department:</strong> {{DEPARTMENT}}</p>
  <p><strong>Type:</strong> {{TYPE_OF_REQUEST}}</p>
  <p><strong>Title:</strong> {{TITLE}}</p>
  {{EXTRA_CONTENT}}
  <p><strong>Comment:</strong> {{COMMENT}}</p>
  <p><strong>Action by:</strong> {{ACTION_BY}}</p>
  <hr style="border:none;border-top:1px solid #ddd">
  <p style="color:#888;font-size:12px">General DWG Request System — MTC Engineering</p>
`;

/**
 * Process Mustache-style conditional blocks: {{#KEY}}content{{/KEY}}
 * Shows content if vars[KEY] is truthy, removes block otherwise.
 * Must be called BEFORE replacing {{VAR}} placeholders.
 */
function processConditionalBlocks(html, vars) {
  return html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return vars[key] ? content : '';
  });
}

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

  // Stage-specific extra content
  let extraHtml = '';
  if (stage === 'eng_check' && extra.request_no) {
    extraHtml += `<p><strong>Request No. Assigned:</strong> ${extra.request_no}</p>`;
  }
  if (stage === 'draft_man' && extra.dwg_file_paths?.length > 0) {
    extraHtml += `<p><strong>Drawing Files:</strong> ${extra.dwg_file_names?.join(', ') || extra.dwg_file_paths.join(', ')}</p>`;
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
    extraHtml += `<p><strong>Final Decision:</strong> ${isApprove ? '✅ Approved' : '❌ Denied — Need more work'}</p>`;
  }
  if (stage === 'eng_inform') {
    extraHtml += `
      <p><strong>Cost:</strong> ${extra.cost || 'N/A'}</p>
      <p><strong>Evidence:</strong> ${extra.evidence || '-'}</p>
      <p><strong>Notes:</strong> ${extra.inform_note || '-'}</p>
    `;
    if (extra.attached_file_paths?.length > 0) {
      const baseUrl = process.env.SERVER_URL || 'http://localhost:2005';
      const links = extra.attached_file_paths.map((p, i) => {
        const name = extra.attached_file_names?.[i] || p.split('/').pop();
        return `<a href="${baseUrl}${p}" target="_blank" rel="noopener">${name}</a>`;
      }).join(' ');
      extraHtml += `<div class="file-links"><strong>Attached Files:</strong><br>${links}</div>`;
    }
  }

  const nextStages = {
    eng_check: { stage: 'Draft Man', team: 'Draft Man' },
    draft_man: { stage: 'DWG Check', team: 'DWG Check' },
    dwg_check: { stage: 'Eng Review', team: 'Engineering Review' },
    eng_review: { stage: 'Eng Approve', team: 'Engineering Approval' },
    eng_approve: { stage: 'Eng Inform', team: 'Engineering' },
    eng_inform: null,
  };
  const nextStageInfo = nextStages[stage];

  const dueDate = request.req_due_date
    ? new Date(request.req_due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  // All template variable values — used for both conditional blocks and placeholder substitution
  const vars = {
    COLOR: color,
    EMAIL_TITLE: title,
    STATUS: request.status || '',
    REQUEST_ITEM: request.request_item || '-',
    REQUEST_NO: request.req_no || '-',
    REQUESTER: request.requester || '-',
    DEPARTMENT: request.department || '-',
    TYPE_OF_REQUEST: request.type_of_request || '-',
    TITLE: request.title || '-',
    DUE_DATE: dueDate,
    EXTRA_CONTENT: extraHtml,
    COMMENT: extra.comment || '',
    IS_DENY: !isApprove ? 'deny' : '',
    ACTION_BY: actionBy || 'System',
    ACTION_DATE: new Date(actionDate).toLocaleString('en-GB'),
    NEXT_STAGE: (nextStageInfo && isApprove) ? nextStageInfo.stage : '',
    NEXT_TEAM: (nextStageInfo && isApprove) ? nextStageInfo.team : '',
  };

  // Step 1: Process {{#KEY}}...{{/KEY}} blocks — two passes to handle nested blocks
  // (e.g. {{#IS_DENY}} nested inside {{#COMMENT}})
  let html = processConditionalBlocks(processConditionalBlocks(template, vars), vars);

  // Step 2: Replace all remaining {{VAR}} placeholders
  Object.entries(vars).forEach(([key, value]) => {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  });

  return html;
};

/**
 * Build the payload shape the GAS_EMAIL_WEBAPP "sendTemplateEmail" endpoint expects
 * (funct/recipients/app_name/subject/message/theme_color/details/action_url/
 * action_button_text — see test_mail.html's getPayload()). Unlike renderEmail(),
 * this does not render HTML itself — the Apps Script template does that — so the
 * per-stage extras become flat "details" rows instead of extraHtml.
 *
 * Delivery must happen from a signed-in browser, not this backend: an anonymous
 * server-side POST/GET to a script.google.com webapp is blocked by the Workspace
 * admin (same restriction documented for GAS_TI_CSV_URL). Callers attach this
 * payload to their API response and the frontend fires the actual request.
 */
const buildTemplateEmailPayload = (options) => {
  const {
    stage,
    decision,
    request,
    extra = {},
    actionBy,
    recipients,
  } = options;

  const isApprove = decision === 'approve' || decision === 'submit';
  const themeColor = isApprove ? '#4CAF50' : '#F44336';

  const stageLabels = {
    eng_check: 'Eng Check',
    draft_man: 'Draft Man',
    dwg_check: 'DWG Check',
    eng_review: 'Eng Review',
    eng_approve: 'Eng Approve',
    eng_inform: 'Eng Inform',
  };
  const stageLabel = stageLabels[stage] || stage;

  const subject = isApprove
    ? `[${stageLabel} ✅] ${request.request_item} — ${request.title}`
    : `[${stageLabel} ❌ Denied] ${request.request_item} — ${request.title}`;

  const message = isApprove
    ? `${actionBy || 'System'} submitted/approved the "${stageLabel}" step of this General DWG Request.`
    : `${actionBy || 'System'} denied the "${stageLabel}" step of this General DWG Request.`;

  const dueDate = request.req_due_date
    ? new Date(request.req_due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-';

  const details = {
    'Request No.': request.req_no || request.request_item || '-',
    Requester: request.requester || '-',
    Department: request.department || '-',
    Type: request.type_of_request || '-',
    Title: request.title || '-',
    'Due Date': dueDate,
  };

  // Stage-specific extra rows — mirrors renderEmail()'s per-stage extraHtml above.
  if (stage === 'eng_check' && extra.request_no) {
    details['Request No. Assigned'] = extra.request_no;
  }
  if (stage === 'draft_man' && extra.dwg_file_names?.length > 0) {
    details['Drawing Files'] = extra.dwg_file_names.join(', ');
  }
  if (stage === 'dwg_check') {
    details['Decision'] = isApprove ? 'Approved — Drawing is correct' : 'Denied — Need revision';
  }
  if (stage === 'eng_review') {
    details['Drawing No'] = extra.drawing_no || '-';
    details['No. of Dwg'] = extra.no_of_dwg || '-';
    details['Section'] = extra.section || '-';
  }
  if (stage === 'eng_approve') {
    details['Final Decision'] = isApprove ? 'Approved' : 'Denied — Need more work';
  }
  if (stage === 'eng_inform') {
    details['Cost'] = extra.cost || 'N/A';
    details['Evidence'] = extra.evidence || '-';
    details['Notes'] = extra.inform_note || '-';
  }
  if (extra.comment) details['Comment'] = extra.comment;

  // A relative link is useless inside an email (nothing for it to resolve
  // against), unlike the Kanban deep links this mirrors — those are clicked
  // inside the app itself. Only emit action_url once FRONTEND_BASE_URL is set.
  const base = (process.env.FRONTEND_BASE_URL || '').replace(/\/+$/, '');
  const actionUrl = (base && request.id) ? `${base}/eng/mtc_eng/tool-request?id=${request.id}` : '';

  return {
    funct: 'sendTemplateEmail',
    recipients: Array.isArray(recipients) ? recipients.join(',') : recipients,
    app_name: 'General DWG Request',
    subject,
    message,
    theme_color: themeColor,
    details,
    action_url: actionUrl,
    action_button_text: 'View Request',
  };
};

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
  return `[Tool Request] ${icon} ${stageLabel} — ${request.request_item}`;
};

module.exports = { renderEmail, generateSubject, loadTemplate, buildTemplateEmailPayload };
