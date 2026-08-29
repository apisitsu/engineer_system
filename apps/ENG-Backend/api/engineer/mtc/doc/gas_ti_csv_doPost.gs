/**
 * ═══════════════════════════════════════════════════════════════════════
 * gas_ti_csv_doPost.gs — put the Tooling Inspection CSVs on Drive
 * ═══════════════════════════════════════════════════════════════════════
 *
 * WHY THIS EXISTS
 * ───────────────
 * The backend used to write these two CSVs straight into a Google Drive for
 * Desktop folder (`G:\Shared drives\...`). That fails, intermittently and
 * unpredictably, with `UNKNOWN` / errno -4094 on open: Drive holds the file
 * while it syncs it, and the sync is asynchronous — it can still be running
 * minutes or hours after whatever triggered it, and the desktop client was
 * observed stuck at "1.1 MB, 0% downloaded".
 *
 * Uploading through Drive instead of through a drive letter removes the file
 * that was being locked. There is nothing on disk to contend over.
 *
 * The alternative — the Drive API with an OAuth token — needs a token this
 * project does not have: GMAIL_REFRESH_TOKEN carries only `gmail.send`, so a
 * Drive scope means a new consent flow and a Cloud Console change. A Web App
 * deployed "Execute as: Me" needs neither, and the same pattern is already in
 * use here (api/kanban/gas/Code.gs, and GAS_EMAIL_URL which the backend POSTs
 * to server-to-server).
 *
 * DEPLOYMENT
 * ──────────
 * 1. https://script.google.com → New Project → name it "TI CSV Upload"
 * 2. Paste this file into Code.gs
 * 3. Set FOLDER_ID to the Drive folder that holds the CSVs today.
 *    Open the folder in Drive; the ID is the last path segment of the URL.
 * 4. Set SHARED_SECRET to a long random string, and put the SAME value in
 *    apps/ENG-Backend/.env as TI_CSV_GAS_SECRET on every host that runs the
 *    import. Without it, anyone inside the organisation who finds the URL can
 *    overwrite these files.
 * 5. Deploy → New Deployment → Web App
 *      Execute as:      Me            ← the whole point: YOUR Drive rights are used
 *      Who has access:  Anyone within <your org>
 * 6. Copy the /exec URL into .env as TI_CSV_GAS_URL
 *
 * Re-deploying mints a NEW /exec URL. If uploads silently stop working after
 * someone "fixed" the script, that is almost always why — check the URL first.
 *
 * REQUEST  { secret, fileName, base64Data }
 * RESPONSE { success, fileId, fileName, bytes, action: 'updated'|'created' }
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── CONFIGURATION ────────────────────────────────────────────────────
const FOLDER_ID = 'PUT_THE_TOOLINGINSPECTION_FOLDER_ID_HERE';
const SHARED_SECRET = 'PUT_A_LONG_RANDOM_STRING_HERE';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return fail('Empty request body');

    var payload = JSON.parse(e.postData.contents);

    // Compare full-length rather than bailing on the first differing character.
    // This is a shared secret over an internal network, not a password store, but
    // there is no reason to leak its length either.
    if (!payload.secret || payload.secret !== SHARED_SECRET) return fail('Bad secret');

    var fileName = payload.fileName;
    var base64Data = payload.base64Data;
    if (!fileName) return fail('Missing fileName');
    if (!base64Data) return fail('Missing base64Data');
    // Only ever touch the two files this exists for. A bug in the caller should not
    // be able to overwrite something else in the folder.
    if (!/^[A-Za-z0-9_\-]+\.csv$/.test(fileName)) return fail('Unexpected fileName: ' + fileName);

    var text = Utilities.newBlob(Utilities.base64Decode(base64Data)).getDataAsString('UTF-8');
    var folder = DriveApp.getFolderById(FOLDER_ID);

    // Update in place when the file already exists, so its ID and every link and
    // IMPORTRANGE pointing at it keep working. Creating a replacement would leave
    // the Sheet reading a file nobody writes to any more.
    var existing = folder.getFilesByName(fileName);
    if (existing.hasNext()) {
      var file = existing.next();
      file.setContent(text);
      // More than one file can share a name in Drive. If that ever happens here it
      // means something created a duplicate, and silently updating one of them
      // would look like the upload is not working.
      if (existing.hasNext()) {
        return fail('Multiple files named ' + fileName + ' in the folder — resolve by hand');
      }
      return ok({ fileId: file.getId(), fileName: fileName, bytes: text.length, action: 'updated' });
    }

    var created = folder.createFile(fileName, text, MimeType.CSV);
    return ok({ fileId: created.getId(), fileName: fileName, bytes: text.length, action: 'created' });
  } catch (err) {
    return fail(String(err && err.message ? err.message : err));
  }
}

/** A GET is for checking the deployment is alive without uploading anything. */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, service: 'TI CSV Upload', ready: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok(extra) {
  var body = { success: true };
  for (var k in extra) body[k] = extra[k];
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail(message) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
