/**
 * ═══════════════════════════════════════════════════════════════════════
 * Code.gs — Google Apps Script Web App for Kanban Drive Attachments
 * ═══════════════════════════════════════════════════════════════════════
 *
 * DEPLOYMENT INSTRUCTIONS:
 * ─────────────────────────
 * 1. Go to https://script.google.com → New Project
 * 2. Name the project: "Kanban Drive Attachments"
 * 3. Paste this entire script into Code.gs
 * 4. Set ROOT_FOLDER_ID below to your Google Drive shared folder ID
 * 5. Click Deploy → New Deployment
 *    - Type: Web App
 *    - Execute as: Me (your @minebea.co.th account)
 *    - Who has access: Anyone within your organization
 * 6. Click Deploy → Copy the Web App URL
 * 7. Paste the URL into frontend constance.js as GAS_DRIVE_URL
 *
 * SUPPORTED ACTIONS (via JSON payload in form POST body):
 * ─────────────────────────────────────────────────────────
 *  action: "upload"  (default) → Upload file to Drive
 *  action: "delete"            → Trash file from Drive
 *
 * COMMUNICATION:
 * ──────────────
 *  Frontend sends: hidden form POST with `payload` field (JSON string)
 *  GAS responds:   HTML page that uses window.parent.postMessage() to
 *                  send the result back to the calling page.
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── CONFIGURATION ────────────────────────────────────────────────────
const ROOT_FOLDER_ID = '1HNyV8OEfciFPPJdDXHTadLz9R39f2X3_';

// ─── MAIN ENTRY POINT ─────────────────────────────────────────────────
function doPost(e) {
  try {
    // Support both raw JSON body and form-encoded payload field
    var raw;
    if (e.parameter && e.parameter.payload) {
      raw = e.parameter.payload;
    } else if (e.postData && e.postData.contents) {
      raw = e.postData.contents;
    } else {
      return postMessageResponse({ success: false, error: 'No payload received' });
    }

    var payload = JSON.parse(raw);
    var action = (payload.action || 'upload').toLowerCase();

    switch (action) {
      case 'upload':
        return handleUpload(payload);
      case 'delete':
        return handleDelete(payload);
      default:
        return postMessageResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return postMessageResponse({ success: false, error: err.message, stack: err.stack });
  }
}

// ─── UPLOAD HANDLER ───────────────────────────────────────────────────
/**
 * Expects payload:
 *   { fileName, mimeType, base64Data, projectId, boardId, cardId }
 *
 * Folder hierarchy:
 *   [ROOT] / [projectId] / [boardId] / [cardId] / file
 */
function handleUpload(payload) {
  var fileName   = payload.fileName;
  var mimeType   = payload.mimeType;
  var base64Data = payload.base64Data;
  var projectId  = payload.projectId;
  var boardId    = payload.boardId;
  var cardId     = payload.cardId;

  // Validate required fields
  if (!fileName)   return postMessageResponse({ success: false, error: 'Missing fileName' });
  if (!base64Data) return postMessageResponse({ success: false, error: 'Missing base64Data' });
  if (!projectId)  return postMessageResponse({ success: false, error: 'Missing projectId' });
  if (!boardId)    return postMessageResponse({ success: false, error: 'Missing boardId' });
  if (!cardId)     return postMessageResponse({ success: false, error: 'Missing cardId' });

  // Navigate / create folder hierarchy
  var rootFolder    = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var projectFolder = getOrCreateFolder(rootFolder, String(projectId));
  var boardFolder   = getOrCreateFolder(projectFolder, String(boardId));
  var cardFolder    = getOrCreateFolder(boardFolder, String(cardId));

  // Decode base64 → Blob → File
  var decodedBytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decodedBytes, mimeType || 'application/octet-stream', fileName);
  var file = cardFolder.createFile(blob);

  // Build folder path string for DB storage
  var folderPath = '/' + [projectId, boardId, cardId].join('/');

  return postMessageResponse({
    success: true,
    fileId: file.getId(),
    fileName: file.getName(),
    mimeType: file.getMimeType(),
    fileSize: file.getSize(),
    folderPath: folderPath,
    webViewLink: file.getUrl(),
    webContentLink: 'https://drive.google.com/uc?id=' + file.getId() + '&export=download'
  });
}

// ─── DELETE HANDLER ───────────────────────────────────────────────────
/**
 * Expects payload:
 *   { action: "delete", fileId: "<Google Drive File ID>" }
 *
 * Moves the file to Trash (recoverable for 30 days).
 */
function handleDelete(payload) {
  var fileId = payload.fileId;

  if (!fileId) return postMessageResponse({ success: false, error: 'Missing fileId' });

  try {
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return postMessageResponse({ success: true, fileId: fileId, trashed: true });
  } catch (err) {
    // File may already be deleted or ID is invalid
    return postMessageResponse({
      success: false,
      error: 'Failed to trash file: ' + err.message,
      fileId: fileId
    });
  }
}

// ─── HELPER: Get or Create Subfolder ──────────────────────────────────
/**
 * Searches for a child folder by name within parentFolder.
 * Creates it if it doesn't exist.
 */
function getOrCreateFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

// ─── HELPER: postMessage Response ────────────────────────────────────
/**
 * Returns an HTML page that sends the result back to the main window
 * via postMessage. GAS serves HTML inside a sandboxed iframe, so we use
 * window.top.postMessage to reach our React application.
 *
 * The response data includes a `_gasUploadResponse: true` flag so the
 * frontend message handler can identify it.
 */
function postMessageResponse(data) {
  data._gasUploadResponse = true;
  var jsonStr = JSON.stringify(data);

  var html = '<!DOCTYPE html><html><head><script>'
    + 'var d = ' + jsonStr + ';'
    + 'function send(w) { try { w.postMessage(d, "*"); return true; } catch(e) { return false; } }'
    // First try opener (if opened as Popup), then try top (if embedded as Iframe)
    + 'send(window.top.opener) || send(window.top) || send(window.parent);'
    + 'if (window.top.opener) { window.close(); }' // Auto close if it is a popup
    + '</script></head><body>OK</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('GAS Response')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─── doGet: Auth ping / health check ─────────────────────────────────
/**
 * Simple GET handler for pre-authorization.
 * Loading this URL via GET in a browser establishes Google auth session.
 */
function doGet(e) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;">'
    + '<h2>✅ Kanban Drive Attachments</h2>'
    + '<p>Google Apps Script is authorized and ready for uploads.</p>'
    + '<p>คุณสามารถปิดหน้านี้และกลับไปใช้งาน Kanban ได้เลย</p>'
    + '</body></html>'
  ).setTitle('GAS Ready');
}

// ─── TEST FUNCTION (for Script Editor debugging) ─────────────────────
/**
 * Run this directly in the Script Editor to verify folder creation works.
 */
function testFolderCreation() {
  var root = DriveApp.getFolderById(ROOT_FOLDER_ID);
  var testFolder = getOrCreateFolder(root, '_test_project');
  var subFolder = getOrCreateFolder(testFolder, '_test_board');
  Logger.log('Test folder created: ' + subFolder.getUrl());
  testFolder.setTrashed(true);
}
