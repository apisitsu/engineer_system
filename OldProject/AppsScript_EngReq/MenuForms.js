/**
 * ================================================================
 * MENU FORM FUNCTIONS
 * ================================================================
 * Functions to open forms from the menu
 * Opens Web App URL in new tab instead of modal dialog
 */

/**
 * Get Web App URL
 */
function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Show Web App URL to user
 */
function showWebAppLink(page, title) {
  const url = getWebAppUrl();
  const pageUrl = page ? `${url}?page=${page}` : url;

  const html = HtmlService.createHtmlOutput(`
    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
      <h2>${title}</h2>
      <p>Click the link below to open:</p>
      <p><a href="${pageUrl}" target="_blank" style="font-size: 16px; color: #4285F4;">${pageUrl}</a></p>
      <br>
      <button onclick="google.script.host.close()" style="padding: 10px 20px; cursor: pointer;">Close</button>
    </div>
  `)
  .setWidth(500)
  .setHeight(200);

  SpreadsheetApp.getUi().showModalDialog(html, title);
}

/**
 * Open New Request Form
 */
function openNewRequestForm() {
  showWebAppLink('new-request', 'New Drawing Request');
}

/**
 * Open Eng Check Form
 */
function openEngCheckForm() {
  showWebAppLink('eng-check', 'Engineering Check');
}

/**
 * Open Draft Man Form
 */
function openDraftManForm() {
  showWebAppLink('draft-man', 'Draft Man');
}

/**
 * Open DWG Check Form
 */
function openDWGCheckForm() {
  showWebAppLink('dwg-check', 'DWG Check');
}

/**
 * Open Eng Review Form
 */
function openEngReviewForm() {
  showWebAppLink('eng-review', 'Engineering Review');
}

/**
 * Open Eng Approve Form
 */
function openEngApproveForm() {
  showWebAppLink('eng-approve', 'Engineering Approval');
}

/**
 * Open Eng Inform Form
 */
function openEngInformForm() {
  showWebAppLink('eng-inform', 'Engineering Inform');
}

/**
 * Open Dashboard
 */
function openDashboard() {
  showWebAppLink('dashboard', 'Dashboard');
}

/**
 * Initialize Sheets wrapper
 */
function initializeSheets() {
  initializeAllSheets();
}
