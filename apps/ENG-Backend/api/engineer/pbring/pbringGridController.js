'use strict';

/**
 * PB Ring grid/PDF HTTP layer. Mounted under the existing pbring router at
 * `/api/engineer/pbring/grid`. Both routes are read-only — no admin guard
 * needed beyond the global `verifyToken` the parent router already applies.
 */

const {
  buildGridPdfHtml, hasDataForCn,
  listTemplates, listMachineTypes, assignMachineTemplate, setDefaultTemplate, reimportTemplates,
  getTemplateById, createTemplate, updateTemplate, deleteTemplate,
  parseXlsxGridFromBuffer, listXlsxSheets, renderBlankTemplateHtml,
  getManualParams, saveManualParams, buildStandardGridForMachine,
  TURNING_MACHINE_NAMES, buildTurningGridForMachine,
  getToolingFamilyOptions,
  getToolingImageBinary, listToolingImages, upsertToolingImage, deleteToolingImage,
  getGrindingImageBinary, listGrindingImages, upsertGrindingImage, deleteGrindingImage,
} = require('./pbringGridService');
const { renderPdf } = require('./pdfRender');
const cnFormat = require('../mtc/utils/cnFormat');

// PB Ring's own tables (pbring_sds_param, pbring_sds_condition,
// pbring_sds_parameter, pbring_tooling_image, pbring_grinding_image) all
// store CN as the plain 6-digit item number ("294065"), but callers hand
// this route whatever format they have on hand — the real SDS search
// resolves CN to its own canonical "C29-04065" control-no form and
// `data.cn` (what SdsV2Page.jsx's "PB Ring PDF" button sends) is THAT
// form, not the plain one. Confirmed live (2026-10-10): the button sent
// `cn=C29-04065`, every PB Ring query against that string matched nothing,
// and the sheet rendered with blank header fields and no photos even
// though the exact same CN (294065) had full data — a silent format
// mismatch, not a caching or data bug. Normalize once at every entry point
// so the service layer always sees the one format PB Ring's tables use.
// `toItemNo` falls back to null on a shape it doesn't recognize, so `|| cn`
// keeps the raw input rather than losing it — same fail-open pattern
// `cnForms()` (sdsPrintLog.js) already uses.
const normalizeCn = (cn) => (cn ? (cnFormat.toItemNo(cn) || cn) : cn);

async function getPdf(req, res) {
  try {
    const { machine_type_name: machineTypeName, process_code: processCode } = req.query;
    const cn = normalizeCn(req.query.cn);
    if (!cn || !machineTypeName || !processCode) {
      return res.status(400).json({ success: false, error: 'cn, machine_type_name and process_code are required' });
    }

    // Phase 6: every PB Ring machine now renders through a live SDS layout —
    // grinding machines (seeded GRIND/DRESS CONDITION config) through
    // "Standard", the 2 turning machines through "Turning"
    // (TURNING_MACHINE_NAMES). The old Phase 5 mechanism (own imported
    // template + {{}} replace, and the "Grid Templates (PDF)" admin tab that
    // managed it) is no longer reachable from this route — every machine has
    // live-layout coverage.
    let grid;
    if (TURNING_MACHINE_NAMES.includes(machineTypeName)) {
      grid = await buildTurningGridForMachine(cn, machineTypeName, processCode);
      if (!grid) return res.status(404).json({ success: false, error: 'Live SDS Turning template not available' });
    } else {
      grid = await buildStandardGridForMachine(cn, machineTypeName, processCode);
      if (!grid) return res.status(404).json({ success: false, error: 'Live SDS Standard template not available' });
    }

    const html = buildGridPdfHtml(grid);
    const pdf = await renderPdf(html);

    // No-store: this URL (cn/machine/process + the caller's fixed-per-session
    // token) is byte-identical on repeat requests, so without this the
    // browser silently serves a stale cached PDF on re-click after any data
    // or layout change — confirmed live: the server returned fresh,
    // fully-populated data on a direct call while a browser tab open to the
    // exact same URL kept showing an old blank render from before this fix.
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="pbring-sds-${cn}-${machineTypeName}-${processCode}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('[pbring:grid:pdf]', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to render PDF' });
  }
}

async function getHasData(req, res) {
  try {
    const cn = normalizeCn(req.query.cn);
    if (!cn) return res.status(400).json({ success: false, error: 'cn is required' });
    const result = await hasDataForCn(cn);
    res.json(result);
  } catch (err) {
    console.error('[pbring:grid:has-data]', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to check PB Ring data' });
  }
}

async function getTemplates(req, res) {
  try {
    res.json(await listTemplates());
  } catch (err) {
    console.error('[pbring:grid:admin:templates]', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to list templates' });
  }
}

async function getMachineTypes(req, res) {
  try {
    res.json(await listMachineTypes());
  } catch (err) {
    console.error('[pbring:grid:admin:machine-types]', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to list machine types' });
  }
}

async function putMachineTemplate(req, res) {
  try {
    const row = await assignMachineTemplate(req.params.id, req.body?.grid_template_id);
    if (!row) return res.status(404).json({ success: false, error: 'Machine type not found' });
    res.json(row);
  } catch (err) {
    console.error('[pbring:grid:admin:assign]', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to assign template' });
  }
}

async function putTemplateDefault(req, res) {
  try {
    const ok = await setDefaultTemplate(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[pbring:grid:admin:default]', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to set default' });
  }
}

async function postReimport(req, res) {
  try {
    const results = await reimportTemplates(req.body?.templateNames, req.user?.empno);
    res.json({ success: true, results });
  } catch (err) {
    console.error('[pbring:grid:admin:reimport]', err);
    res.status(500).json({ success: false, error: err.message || 'Re-import failed' });
  }
}

// ---- Full template CRUD + xlsx upload (PbRingGridTemplateEditor.jsx) ----

async function getTemplate(req, res) {
  try {
    const tpl = await getTemplateById(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    res.json(tpl);
  } catch (err) {
    console.error('[pbring:grid:admin:template:get]', err);
    res.status(500).json({ error: err.message || 'Failed to load template' });
  }
}

async function postTemplate(req, res) {
  try {
    const row = await createTemplate(req.body || {}, req.user?.empno);
    res.json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A template with that name already exists' });
    console.error('[pbring:grid:admin:template:create]', err);
    res.status(400).json({ error: err.message || 'Failed to create template' });
  }
}

async function putTemplate(req, res) {
  try {
    const row = await updateTemplate(req.params.id, req.body || {}, req.user?.empno);
    if (!row) return res.status(404).json({ error: 'Template not found' });
    res.json(row);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A template with that name already exists' });
    console.error('[pbring:grid:admin:template:update]', err);
    res.status(400).json({ error: err.message || 'Failed to update template' });
  }
}

async function deleteTemplateRoute(req, res) {
  try {
    const result = await deleteTemplate(req.params.id);
    if (!result.ok && result.reason === 'not_found') return res.status(404).json({ error: 'Template not found' });
    if (!result.ok && result.reason === 'is_default') {
      return res.status(400).json({ error: 'Cannot delete the default template — set another default first' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[pbring:grid:admin:template:delete]', err);
    res.status(500).json({ error: err.message || 'Failed to delete template' });
  }
}

function getUploadedXlsx(req) {
  if (!req.files || !req.files.xlsx) return null;
  const file = Array.isArray(req.files.xlsx) ? req.files.xlsx[0] : req.files.xlsx;
  if (!/\.xlsx$/i.test(file.name || '')) return null;
  return file;
}

async function postXlsxUploadSheets(req, res) {
  const file = getUploadedXlsx(req);
  if (!file) return res.status(400).json({ error: 'xlsx file is required (field: xlsx)' });
  try {
    res.json({ sheets: await listXlsxSheets(file.data) });
  } catch (err) {
    res.status(400).json({ error: `Could not parse workbook: ${err.message}` });
  }
}

async function postXlsxUpload(req, res) {
  const file = getUploadedXlsx(req);
  if (!file) return res.status(400).json({ error: 'xlsx file is required (field: xlsx)' });
  try {
    const grid = await parseXlsxGridFromBuffer(file.data, req.body?.sheet);
    res.json({ grid });
  } catch (err) {
    res.status(400).json({ error: `Could not parse workbook: ${err.message}` });
  }
}

/** GET admin: blank preview PDF for one template — no cn/machine/process, placeholders shown literally. */
async function getTemplateBlankPdf(req, res) {
  try {
    const html = await renderBlankTemplateHtml(req.params.id);
    if (!html) return res.status(404).json({ error: 'Template not found' });
    const pdf = await renderPdf(html);
    res.set('Cache-Control', 'no-store'); // same stale-cache risk as getPdf — see its comment
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="pbring-template-blank.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error('[pbring:grid:admin:template:blank-pdf]', err);
    res.status(500).json({ error: err.message || 'Failed to render preview' });
  }
}

/**
 * GET /grid/admin/parameters?machine_type_name=&cn=&process_code=
 * cn omitted/null -> machine-default rows; cn set -> that CN's override rows
 * (optionally scoped to one process_code), mirroring the real
 * `/api/sds/v2/admin/parameters` GET semantics.
 */
async function getManualParamsRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName, cn, process_code: processCode } = req.query;
    if (!machineTypeName) return res.status(400).json({ error: 'machine_type_name is required' });
    const cnVal = cn && cn !== 'null' ? normalizeCn(cn) : null;
    res.json(await getManualParams(machineTypeName, cnVal, processCode && processCode !== 'null' ? processCode : null));
  } catch (err) {
    console.error('[pbring:grid:admin:parameters:get]', err);
    res.status(500).json({ error: err.message || 'Failed to load parameters' });
  }
}

/**
 * PUT /grid/admin/parameters/bulk - body { machine_type_name, cn, process_code, params: [{ param_key, param_value }] }
 * cn omitted/null -> machine-default save; cn set -> CN override (optionally process-scoped).
 */
async function putManualParamsRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName, cn, process_code: processCode, params } = req.body || {};
    if (!machineTypeName) return res.status(400).json({ error: 'machine_type_name is required' });
    const saved = await saveManualParams(machineTypeName, cn ? normalizeCn(cn) : null, processCode || null, params, req.user?.empno);
    res.json({ success: true, saved, count: saved.length });
  } catch (err) {
    console.error('[pbring:grid:admin:parameters:put]', err);
    res.status(500).json({ error: err.message || 'Failed to save parameters' });
  }
}

function getUploadedImage(req) {
  if (!req.files || !req.files.image) return null;
  const file = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;
  return file;
}

/** GET /grid/tooling-image?machine_type_name=&family= — serve image binary (a raw tooling_no also works, normalized server-side) */
async function getToolingImageRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName, family } = req.query;
    if (!machineTypeName || !family) return res.status(400).json({ error: 'machine_type_name and family are required' });
    const img = await getToolingImageBinary(machineTypeName, family);
    if (!img) return res.status(404).json({ error: 'Image not found' });
    res.setHeader('Content-Type', img.mime_type || 'image/jpeg');
    if (img.file_name) res.setHeader('Content-Disposition', `inline; filename="${img.file_name}"`);
    res.send(img.image_data);
  } catch (err) {
    console.error('[pbring:grid:tooling-image:get]', err);
    res.status(500).json({ error: err.message || 'Failed to load image' });
  }
}

/** GET /grid/admin/tooling-images?machine_type_name= — list (metadata only) */
async function getToolingImagesRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName } = req.query;
    if (!machineTypeName) return res.status(400).json({ error: 'machine_type_name is required' });
    res.json(await listToolingImages(machineTypeName));
  } catch (err) {
    console.error('[pbring:grid:admin:tooling-images:get]', err);
    res.status(500).json({ error: err.message || 'Failed to list images' });
  }
}

/** GET /grid/admin/tooling-families?machine_type_name= — DWG-family dropdown source, from pbring_sds_condition history */
async function getToolingFamiliesRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName } = req.query;
    if (!machineTypeName) return res.status(400).json({ error: 'machine_type_name is required' });
    res.json(await getToolingFamilyOptions(machineTypeName));
  } catch (err) {
    console.error('[pbring:grid:admin:tooling-families:get]', err);
    res.status(500).json({ error: err.message || 'Failed to load tooling families' });
  }
}

/** POST /grid/admin/tooling-image — multipart: machine_type_name, family, description, file (field: image) */
async function postToolingImageRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName, family, description } = req.body;
    if (!machineTypeName?.trim() || !family?.trim()) {
      return res.status(400).json({ error: 'machine_type_name and family are required' });
    }
    const file = getUploadedImage(req);
    if (!file) return res.status(400).json({ error: 'image file is required (field: image)' });
    const row = await upsertToolingImage(machineTypeName.trim(), family.trim(), file, description, req.user?.empno);
    res.json(row);
  } catch (err) {
    console.error('[pbring:grid:admin:tooling-image:post]', err);
    res.status(500).json({ error: err.message || 'Failed to upload image' });
  }
}

/** DELETE /grid/admin/tooling-image?machine_type_name=&family= */
async function deleteToolingImageRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName, family } = req.query;
    if (!machineTypeName || !family) return res.status(400).json({ error: 'machine_type_name and family are required' });
    const ok = await deleteToolingImage(machineTypeName, family);
    if (!ok) return res.status(404).json({ error: 'Image not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[pbring:grid:admin:tooling-image:delete]', err);
    res.status(500).json({ error: err.message || 'Failed to delete image' });
  }
}

/** GET /grid/grinding-image?machine_type_name=&cn=&process_code= — serve image binary */
async function getGrindingImageRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName, process_code: processCode } = req.query;
    const cn = normalizeCn(req.query.cn);
    if (!machineTypeName || !cn || !processCode) {
      return res.status(400).json({ error: 'machine_type_name, cn and process_code are required' });
    }
    const img = await getGrindingImageBinary(machineTypeName, cn, processCode);
    if (!img) return res.status(404).json({ error: 'Image not found' });
    res.setHeader('Content-Type', img.mime_type || 'image/jpeg');
    if (img.file_name) res.setHeader('Content-Disposition', `inline; filename="${img.file_name}"`);
    res.send(img.image_data);
  } catch (err) {
    console.error('[pbring:grid:grinding-image:get]', err);
    res.status(500).json({ error: err.message || 'Failed to load image' });
  }
}

/** GET /grid/admin/grinding-images?machine_type_name= — list (metadata only) */
async function getGrindingImagesRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName } = req.query;
    if (!machineTypeName) return res.status(400).json({ error: 'machine_type_name is required' });
    res.json(await listGrindingImages(machineTypeName));
  } catch (err) {
    console.error('[pbring:grid:admin:grinding-images:get]', err);
    res.status(500).json({ error: err.message || 'Failed to list images' });
  }
}

/** POST /grid/admin/grinding-image — multipart: machine_type_name, cn, process_code, description, file (field: image) */
async function postGrindingImageRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName, cn, process_code: processCode, description } = req.body;
    if (!machineTypeName?.trim() || !cn?.trim() || !processCode?.trim()) {
      return res.status(400).json({ error: 'machine_type_name, cn and process_code are required' });
    }
    const file = getUploadedImage(req);
    if (!file) return res.status(400).json({ error: 'image file is required (field: image)' });
    const row = await upsertGrindingImage(machineTypeName.trim(), normalizeCn(cn.trim()), processCode.trim(), file, description, req.user?.empno);
    res.json(row);
  } catch (err) {
    console.error('[pbring:grid:admin:grinding-image:post]', err);
    res.status(500).json({ error: err.message || 'Failed to upload image' });
  }
}

/** DELETE /grid/admin/grinding-image?machine_type_name=&cn=&process_code= */
async function deleteGrindingImageRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName, process_code: processCode } = req.query;
    const cn = normalizeCn(req.query.cn);
    if (!machineTypeName || !cn || !processCode) {
      return res.status(400).json({ error: 'machine_type_name, cn and process_code are required' });
    }
    const ok = await deleteGrindingImage(machineTypeName, cn, processCode);
    if (!ok) return res.status(404).json({ error: 'Image not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[pbring:grid:admin:grinding-image:delete]', err);
    res.status(500).json({ error: err.message || 'Failed to delete image' });
  }
}

module.exports = {
  getPdf, getHasData,
  getTemplates, getMachineTypes, putMachineTemplate, putTemplateDefault, postReimport,
  getTemplate, postTemplate, putTemplate, deleteTemplate: deleteTemplateRoute,
  postXlsxUploadSheets, postXlsxUpload, getTemplateBlankPdf,
  getManualParams: getManualParamsRoute, putManualParams: putManualParamsRoute,
  getToolingImage: getToolingImageRoute, getToolingImages: getToolingImagesRoute,
  getToolingFamilies: getToolingFamiliesRoute,
  postToolingImage: postToolingImageRoute, deleteToolingImage: deleteToolingImageRoute,
  getGrindingImage: getGrindingImageRoute, getGrindingImages: getGrindingImagesRoute,
  postGrindingImage: postGrindingImageRoute, deleteGrindingImage: deleteGrindingImageRoute,
};
