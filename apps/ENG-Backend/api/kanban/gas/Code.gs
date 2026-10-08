/**
 * ═══════════════════════════════════════════════════════════════════════
 * Code.gs — Universal Google Apps Script Web App for Drive Attachments
 * Supporting:
 *   1. Kanban Drive Attachments (Legacy)
 *   2. ECNT (ECR / ECN) Factory Engineering Attachments (New)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ROOT FOLDERS:
 *  - KANBAN: 1HNyV8OEfciFPPJdDXHTadLz9R39f2X3_
 *  - ECNT:   1NKhFV81KnUKrjCLae1sFrwj2xZeVKOD5 (https://drive.google.com/drive/folders/1NKhFV81KnUKrjCLae1sFrwj2xZeVKOD5)
 *
 * SUPPORTED ACTIONS:
 *  - action: "upload"       → Uploads file to Drive (Auto detects Kanban vs ECNT)
 *  - action: "delete"       → Trashes file by fileId
 *  - action: "sync_folder"  → Renames ecr folder to ecr_ecnt folder upon ECN issuance
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── CONFIGURATION ────────────────────────────────────────────────────
const KANBAN_ROOT_FOLDER_ID = '1HNyV8OEfciFPPJdDXHTadLz9R39f2X3_';
const ECNT_ROOT_FOLDER_ID   = '1NKhFV81KnUKrjCLae1sFrwj2xZeVKOD5';

// ─── MAIN ENTRY POINT ─────────────────────────────────────────────────
function doPost(e) {
  var isForm = false;
  try {
    var raw = '';

    // 1. Check e.parameter.payload (small form submissions)
    if (e && e.parameter && e.parameter.payload) {
      raw = e.parameter.payload;
      isForm = true;
    }
    // 2. Check e.postData.contents (large form submissions & direct POST)
    else if (e && e.postData && e.postData.contents) {
      raw = e.postData.contents;
      if (typeof raw === 'string') {
        raw = raw.trim();
        var pIdx = raw.indexOf('payload=');
        if (pIdx !== -1) {
          isForm = true;
          var sub = raw.substring(pIdx + 8);
          var nextAmp = sub.indexOf('&');
          if (nextAmp !== -1) sub = sub.substring(0, nextAmp);
          try {
            raw = decodeURIComponent(sub.replace(/\+/g, ' '));
          } catch (e1) {
            try { raw = unescape(sub.replace(/\+/g, ' ')); } catch (e2) { raw = sub; }
          }
        } else if (raw.indexOf('%7B') === 0 || raw.indexOf('%7b') === 0) {
          isForm = true;
          try {
            raw = decodeURIComponent(raw.replace(/\+/g, ' '));
          } catch (e1) {
            try { raw = unescape(raw.replace(/\+/g, ' ')); } catch (e2) {}
          }
        } else if (e.postData.type && e.postData.type.indexOf('form') !== -1) {
          isForm = true;
        }
      }
    } else {
      return jsonOrHtml({ success: false, message: '', error: 'No payload received' }, isForm);
    }

    // Defensive check: If raw is still URL encoded (e.g. starts with %7B)
    if (typeof raw === 'string' && (raw.indexOf('%7B') === 0 || raw.indexOf('%7b') === 0)) {
      isForm = true;
      try {
        raw = decodeURIComponent(raw.replace(/\+/g, ' '));
      } catch (e3) {
        try { raw = unescape(raw.replace(/\+/g, ' ')); } catch (e4) {}
      }
    }

    if (!raw) {
      return jsonOrHtml({ success: false, message: '', error: 'Empty payload after extraction' }, isForm);
    }

    var payload = (typeof raw === 'object') ? raw : JSON.parse(raw);
    var action = (payload.action || 'upload').toLowerCase();

    switch (action) {
      case 'upload':
        return routeUpload(payload, isForm);
      case 'delete':
        return handleDelete(payload, isForm);
      case 'sync_folder':
      case 'rename_folder':
        return handleSyncFolder(payload, isForm);
      default:
        return jsonOrHtml({ success: false, message: '', error: 'Unknown action: ' + action }, isForm);
    }
  } catch (err) {
    return jsonOrHtml({ success: false, message: '', error: err.message || err.toString(), stack: err.stack }, isForm);
  }
}

// ─── ROUTER: UPLOAD ───────────────────────────────────────────────────
function routeUpload(payload, isForm) {
  // Check if this is an ECNT upload request
  var isEcnt = payload.system === 'ecnt' || Boolean(payload.ecrNo || payload.ecnNo);

  if (isEcnt) {
    return handleEcntUpload(payload, isForm);
  } else {
    return handleKanbanUpload(payload, isForm);
  }
}

// ─── ECNT UPLOAD HANDLER ──────────────────────────────────────────────
/**
 * Expects payload:
 *   {
 *     system: "ecnt",
 *     fileName, mimeType, base64Data,
 *     ecrNo, ecnNo, blockNumber, fieldName
 *   }
 *
 * Folder hierarchy:
 *   [ECNT_ROOT] / [ecrNo] (or [ecrNo]_[ecnNo]) / file
 */
function handleEcntUpload(payload, isForm) {
  var fileName   = payload.fileName;
  var mimeType   = payload.mimeType;
  var base64Data = payload.base64Data;
  var ecrNo      = (payload.ecrNo || '').trim();
  var ecnNo      = (payload.ecnNo || '').trim();

  if (!fileName)   return jsonOrHtml({ success: false, error: 'Missing fileName' }, isForm);
  if (!base64Data) return jsonOrHtml({ success: false, error: 'Missing base64Data' }, isForm);
  if (!ecrNo && !ecnNo) return jsonOrHtml({ success: false, error: 'Missing ecrNo or ecnNo' }, isForm);

  var rootFolder = DriveApp.getFolderById(ECNT_ROOT_FOLDER_ID);
  var targetFolder = getOrCreateEcntTargetFolder(rootFolder, ecrNo, ecnNo);

  // Decode base64 → Blob → File
  var decodedBytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decodedBytes, mimeType || 'application/octet-stream', fileName);
  var file = targetFolder.createFile(blob);

  var folderPath = '/' + targetFolder.getName();

  return jsonOrHtml({
    success: true,
    system: 'ecnt',
    fileId: file.getId(),
    fileName: file.getName(),
    mimeType: file.getMimeType(),
    fileSize: file.getSize(),
    folderId: targetFolder.getId(),
    folderName: targetFolder.getName(),
    folderPath: folderPath,
    folderUrl: targetFolder.getUrl(),
    webViewLink: file.getUrl(),
    webContentLink: 'https://drive.google.com/uc?id=' + file.getId() + '&export=download'
  }, isForm);
}

// ─── ECNT FOLDER RESOLVER & AUTO-RENAMER ──────────────────────────────
/**
 * Finds or creates the folder for ECNT:
 * - If ecrNo only: creates or reuses 'ecrxxxxxx'
 * - If both ecrNo and ecnNo:
 *     1. If 'ecrxxxxxx_ecntxxxxxx' exists -> use it
 *     2. If 'ecrxxxxxx' exists -> RENAME to 'ecrxxxxxx_ecntxxxxxx' and use it
 *     3. Otherwise -> create 'ecrxxxxxx_ecntxxxxxx'
 */
function getOrCreateEcntTargetFolder(rootFolder, ecrNo, ecnNo) {
  var targetName = buildEcntFolderName(ecrNo, ecnNo);

  // 1. Try finding exact target name first
  var exactFolders = rootFolder.getFoldersByName(targetName);
  if (exactFolders.hasNext()) {
    return exactFolders.next();
  }

  // 2. If we have ecnNo and ecrNo, check if an old ecrNo folder exists to RENAME
  if (ecrNo && ecnNo) {
    var ecrOnlyFolders = rootFolder.getFoldersByName(ecrNo);
    if (ecrOnlyFolders.hasNext()) {
      var folderToRename = ecrOnlyFolders.next();
      folderToRename.setName(targetName);
      return folderToRename;
    }
  }

  // 3. Not found -> create new folder
  return rootFolder.createFolder(targetName);
}

function buildEcntFolderName(ecrNo, ecnNo) {
  var cleanEcr = (ecrNo || '').trim();
  var cleanEcn = (ecnNo || '').trim();

  if (cleanEcr && cleanEcn) {
    return cleanEcr + '_' + cleanEcn;
  }
  return cleanEcr || cleanEcn || 'Uncategorized_ECNT';
}

// ─── ECNT SYNC / RENAME FOLDER ACTION ─────────────────────────────────
/**
 * Action to manually or automatically rename the folder once an ECN is issued:
 *   payload: { action: "sync_folder", ecrNo: "ECR261001", ecnNo: "ECN261001" }
 */
function handleSyncFolder(payload, isForm) {
  var ecrNo = (payload.ecrNo || '').trim();
  var ecnNo = (payload.ecnNo || '').trim();

  if (!ecrNo || !ecnNo) {
    return jsonOrHtml({ success: false, error: 'Both ecrNo and ecnNo are required to sync folder' }, isForm);
  }

  var rootFolder = DriveApp.getFolderById(ECNT_ROOT_FOLDER_ID);
  var targetName = ecrNo + '_' + ecnNo;

  // Check if target name already exists
  var exactFolders = rootFolder.getFoldersByName(targetName);
  if (exactFolders.hasNext()) {
    var f = exactFolders.next();
    return jsonOrHtml({ success: true, folderId: f.getId(), folderName: f.getName(), folderUrl: f.getUrl(), status: 'already_synced' }, isForm);
  }

  // Check if original ecrNo folder exists
  var ecrFolders = rootFolder.getFoldersByName(ecrNo);
  if (ecrFolders.hasNext()) {
    var folder = ecrFolders.next();
    folder.setName(targetName);
    return jsonOrHtml({ success: true, folderId: folder.getId(), folderName: targetName, folderUrl: folder.getUrl(), status: 'renamed' }, isForm);
  }

  // Neither exists -> create it
  var newFolder = rootFolder.createFolder(targetName);
  return jsonOrHtml({ success: true, folderId: newFolder.getId(), folderName: targetName, folderUrl: newFolder.getUrl(), status: 'created' }, isForm);
}

// ─── KANBAN UPLOAD HANDLER (LEGACY PRESERVED) ─────────────────────────
function handleKanbanUpload(payload, isForm) {
  var fileName   = payload.fileName;
  var mimeType   = payload.mimeType;
  var base64Data = payload.base64Data;
  var projectId  = payload.projectId;
  var boardId    = payload.boardId;
  var cardId     = payload.cardId;

  if (!fileName)   return jsonOrHtml({ success: false, error: 'Missing fileName' }, isForm);
  if (!base64Data) return jsonOrHtml({ success: false, error: 'Missing base64Data' }, isForm);
  if (!projectId)  return jsonOrHtml({ success: false, error: 'Missing projectId' }, isForm);
  if (!boardId)    return jsonOrHtml({ success: false, error: 'Missing boardId' }, isForm);
  if (!cardId)     return jsonOrHtml({ success: false, error: 'Missing cardId' }, isForm);

  var rootFolder    = DriveApp.getFolderById(KANBAN_ROOT_FOLDER_ID);
  var projectFolder = getOrCreateFolder(rootFolder, String(projectId));
  var boardFolder   = getOrCreateFolder(projectFolder, String(boardId));
  var cardFolder    = getOrCreateFolder(boardFolder, String(cardId));

  var decodedBytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decodedBytes, mimeType || 'application/octet-stream', fileName);
  var file = cardFolder.createFile(blob);

  var folderPath = '/' + [projectId, boardId, cardId].join('/');

  return jsonOrHtml({
    success: true,
    system: 'kanban',
    fileId: file.getId(),
    fileName: file.getName(),
    mimeType: file.getMimeType(),
    fileSize: file.getSize(),
    folderPath: folderPath,
    webViewLink: file.getUrl(),
    webContentLink: 'https://drive.google.com/uc?id=' + file.getId() + '&export=download'
  }, isForm);
}

// ─── DELETE HANDLER ───────────────────────────────────────────────────
function handleDelete(payload, isForm) {
  var rawIds = payload.fileIds || (payload.fileId ? [payload.fileId] : []);
  if (!rawIds || rawIds.length === 0) return jsonOrHtml({ success: false, error: 'Missing fileId or fileIds' }, isForm);

  try {
    var deleted = [];
    var errors = [];
    for (var i = 0; i < rawIds.length; i++) {
      var id = String(rawIds[i]).trim();
      if (!id) continue;
      try {
        var file = DriveApp.getFileById(id);
        file.setTrashed(true);
        deleted.push(id);
      } catch (e) {
        errors.push({ id: id, error: e.message });
      }
    }
    return jsonOrHtml({
      success: deleted.length > 0 || errors.length === 0,
      fileId: rawIds[0],
      deleted: deleted,
      errors: errors,
      trashed: true
    }, isForm);
  } catch (err) {
    return jsonOrHtml({ success: false, error: 'Failed to trash file: ' + err.message }, isForm);
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────
function jsonOrHtml(data, isForm) {
  if (isForm) {
    return postMessageResponse(data);
  } else {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

function postMessageResponse(data) {
  data._gasUploadResponse = true;
  var jsonStr = JSON.stringify(data);

  var html = '<!DOCTYPE html><html><head><script>'
    + 'var d = ' + jsonStr + ';'
    + 'function send(w) { try { w.postMessage(d, "*"); return true; } catch(e) { return false; } }'
    + 'send(window.top.opener) || send(window.top) || send(window.parent);'
    + 'if (window.top.opener) { window.close(); }'
    + '</script></head><body>OK</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('GAS Response')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─── doGet: Health Check & Session Init ──────────────────────────────
function doGet(e) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;">'
    + '<h2>✅ Engineer System Drive Service Active</h2>'
    + '<p>Kanban & ECNT Google Apps Script is authorized and ready.</p>'
    + '<p style="color:#666;">ECNT Root: ' + ECNT_ROOT_FOLDER_ID + '<br>Kanban Root: ' + KANBAN_ROOT_FOLDER_ID + '</p>'
    + '</body></html>'
  ).setTitle('GAS Ready');
}
