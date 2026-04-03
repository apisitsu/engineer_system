const nodemailer = require('nodemailer');
const { pool } = require('../db/pool');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

async function getEmailConfig(stage) {
  const { rows } = await pool.query(
    'SELECT emails FROM email_config WHERE stage = $1',
    [stage]
  );

  if (!rows[0]?.emails) return [];
  return rows[0].emails.split(',').map(e => e.trim()).filter(e => e);
}

async function sendEmail({ to, cc, subject, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Email not configured, skipping send');
    return { success: false, message: 'Email not configured' };
  }

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      html
    };

    if (cc && cc.length > 0) {
      mailOptions.cc = Array.isArray(cc) ? cc.join(',') : cc;
    }

    await getTransporter().sendMail(mailOptions);
    console.log(`Email sent to: ${mailOptions.to}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, message: error.message };
  }
}

async function sendNewRequestEmail(request) {
  const recipients = await getEmailConfig('ENG_CHECK');
  const ccRecipients = await getEmailConfig('CC_ENG_CHECK');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const html = `
    <h2>New Drawing Request</h2>
    <p><strong>Request Item:</strong> ${request.requestItem}</p>
    <p><strong>Requester:</strong> ${request.requester}</p>
    <p><strong>Department:</strong> ${request.department}</p>
    <p><strong>Type:</strong> ${request.typeOfRequest}</p>
    <p><strong>Title:</strong> ${request.title}</p>
    <p><strong>Detail:</strong> ${request.detail}</p>
    <hr>
    <p>Please review and approve this request:</p>
    <p>
      <a href="${frontendUrl}?action=eng-check&id=${request.id}"
         style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">
        Click here to review
      </a>
    </p>
  `;

  if (recipients.length === 0) {
    console.log('No recipients configured for ENG_CHECK');
    return;
  }

  await sendEmail({
    to: recipients,
    cc: ccRecipients,
    subject: `[New Request] ${request.requestItem} - ${request.title}`,
    html
  });
}

async function sendWorkflowEmail(type, request, stageData) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const templates = {
    'eng-check-approved': {
      configKey: 'DRAFTMAN',
      ccKey: 'CC_DRAFTMAN',
      subject: `[Approved] ${request.requestItem} - Ready for Draft`,
      html: `
        <h2>Request Approved - Ready for Drafting</h2>
        <p><strong>Request Item:</strong> ${request.requestItem}</p>
        <p><strong>Request No:</strong> ${request.requestNo || 'N/A'}</p>
        <p><strong>Type:</strong> ${request.typeOfRequest}</p>
        <p>This request has been approved and is ready for drafting.</p>
        <p>
          <a href="${frontendUrl}?action=draft-man&id=${request.id}"
             style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">
            Start Drafting
          </a>
        </p>
      `
    },
    'eng-check-denied': {
      toEmail: request.requesterEmail,
      subject: `[Denied] ${request.requestItem} - ${request.title}`,
      html: `
        <div style="background:#FFEBEE; padding:20px; border-left:5px solid #F44336; margin-bottom:20px;">
          <h2 style="color:#C62828; margin:0;">Request Denied at Eng Check</h2>
        </div>
        <p><strong>Request Item:</strong> ${request.requestItem}</p>
        <p><strong>Title:</strong> ${request.title}</p>
        <p><strong>Type:</strong> ${request.typeOfRequest}</p>
        <p><strong>Reason:</strong> ${stageData?.comment || 'No comment provided'}</p>
        <hr>
        <p>Your drawing request has been denied at the Engineering Check stage.</p>
        <p style="color:#666; font-size:12px;">Thank you for using the ROD END Drawing Request System.</p>
      `
    },
    'draft-completed': {
      configKey: 'DWG_CHECK',
      ccKey: 'CC_DWG_CHECK',
      subject: `[Draft Complete] ${request.requestItem} - Ready for DWG Check`,
      html: `
        <h2>Draft Work Completed</h2>
        <p><strong>Request Item:</strong> ${request.requestItem}</p>
        <p><strong>Draftman:</strong> ${stageData?.draftmanName || 'N/A'}</p>
        <p>The drafting work has been completed and is ready for DWG Check.</p>
        <p>
          <a href="${frontendUrl}?action=dwg-check&id=${request.id}"
             style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">
            Review Drawing
          </a>
        </p>
      `
    },
    'dwg-check-approved': {
      configKey: 'ENG_REVIEW',
      ccKey: 'CC_ENG_REVIEW',
      subject: `[DWG Approved] ${request.requestItem} - Ready for Eng Review`,
      html: `
        <h2>DWG Check Approved</h2>
        <p><strong>Request Item:</strong> ${request.requestItem}</p>
        <p>The drawing has been checked and approved. Please proceed with Engineering Review.</p>
        <p>
          <a href="${frontendUrl}?action=eng-review&id=${request.id}"
             style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">
            Start Review
          </a>
        </p>
      `
    },
    'eng-review-completed': {
      configKey: 'ENG_APPROVE',
      ccKey: 'CC_ENG_APPROVE',
      subject: `[Review Complete] ${request.requestItem} - Ready for Final Approval`,
      html: `
        <h2>Engineering Review Completed</h2>
        <p><strong>Request Item:</strong> ${request.requestItem}</p>
        <p><strong>Drawing No:</strong> ${stageData?.drawingNo || 'N/A'}</p>
        <p>The engineering review is complete. Please proceed with final approval.</p>
        <p>
          <a href="${frontendUrl}?action=eng-approve&id=${request.id}"
             style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">
            Approve Now
          </a>
        </p>
      `
    },
    'dwg-check-denied': {
      configKey: 'DRAFTMAN',
      ccKey: 'CC_DRAFTMAN',
      subject: `[DWG Returned] ${request.requestItem} - Revision Required`,
      html: `
        <h2>Drawing Returned for Revision</h2>
        <p><strong>Request Item:</strong> ${request.requestItem}</p>
        <p><strong>Request No:</strong> ${request.requestNo || 'N/A'}</p>
        <p>The drawing has been returned and requires revision. Please update and resubmit.</p>
        <p>
          <a href="${frontendUrl}?action=draft-man&id=${request.id}"
             style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">
            Revise Drawing
          </a>
        </p>
      `
    },
    'eng-approve-completed': {
      configKey: 'ENG_INFORM',
      ccKey: 'CC_ENG_INFORM',
      subject: `[Approved] ${request.requestItem} - Ready for Eng Inform`,
      html: `
        <h2>Request Approved - Ready for Eng Inform</h2>
        <p><strong>Request Item:</strong> ${request.requestItem}</p>
        <p><strong>Request No:</strong> ${request.requestNo || 'N/A'}</p>
        <p>This request has been approved and is ready for final notification to the requester.</p>
        <p>
          <a href="${frontendUrl}?action=eng-inform&id=${request.id}"
             style="display:inline-block; padding:12px 24px; background:#4285F4; color:white; text-decoration:none; border-radius:6px;">
            Inform Requester
          </a>
        </p>
      `
    },
    'request-denied-final': {
      toEmail: request.requesterEmail,
      subject: `[Denied] ${request.requestItem} - ${request.title}`,
      html: `
        <div style="background:#FFEBEE; padding:20px; border-left:5px solid #F44336; margin-bottom:20px;">
          <h2 style="color:#C62828; margin:0;">Request Denied</h2>
        </div>
        <p><strong>Request Item:</strong> ${request.requestItem}</p>
        <p><strong>Title:</strong> ${request.title}</p>
        <p>Your drawing request has been denied at the final approval stage.</p>
        <hr>
        <p style="color:#666; font-size:12px;">Thank you for using the ROD END Drawing Request System.</p>
      `
    },
    'request-completed': {
      toEmail: request.requesterEmail,
      configKey: 'ENG_INFORM',
      ccKey: 'CC_ENG_INFORM',
      subject: `[Completed] ${request.requestItem} - ${request.title}`,
      html: `
        <div style="background: linear-gradient(135deg, #2E7D32, #4CAF50); padding: 24px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
          <h2 style="color: #fff; margin: 0; font-size: 20px;">Request Completed</h2>
        </div>
        <div style="border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; width: 140px; color: #555;">Request Item</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${request.requestItem}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Request No.</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${request.requestNo || '-'}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Title</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${request.title}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Type</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${request.typeOfRequest}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Drawing No.</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${stageData?.engReview?.drawingNo || '-'}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">No. of DWG</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${stageData?.engReview?.noOfDwg || '-'}</td></tr>
            ${stageData?.cost ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Cost</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${stageData.cost}</td></tr>` : ''}
            ${stageData?.evidence ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Evidence</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${stageData.evidence}</td></tr>` : ''}
          </table>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color:#666; font-size:12px;">Thank you for using the ROD END Drawing Request System.</p>
        </div>
      `
    }
  };

  const template = templates[type];
  if (!template) {
    console.log(`Unknown email type: ${type}`);
    return;
  }

  let recipients = [];
  if (template.toEmail) {
    recipients.push(template.toEmail);
  }
  if (template.configKey) {
    const configEmails = await getEmailConfig(template.configKey);
    recipients = recipients.concat(configEmails);
  }
  recipients = [...new Set(recipients.map(e => e.toLowerCase()))];

  let ccRecipients = template.ccKey ? await getEmailConfig(template.ccKey) : [];

  if (recipients.length === 0) {
    console.log(`No recipients configured for ${type}`);
    return;
  }

  await sendEmail({
    to: recipients,
    cc: ccRecipients,
    subject: template.subject,
    html: template.html
  });
}

module.exports = {
  sendEmail,
  getEmailConfig,
  sendNewRequestEmail,
  sendWorkflowEmail
};
