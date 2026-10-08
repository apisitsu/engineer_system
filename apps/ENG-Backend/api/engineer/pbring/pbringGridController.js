'use strict';

/**
 * PB Ring grid/PDF HTTP layer. Mounted under the existing pbring router at
 * `/api/engineer/pbring/grid`. Both routes are read-only — no admin guard
 * needed beyond the global `verifyToken` the parent router already applies.
 */

const {
  loadGridForMachine, buildPbRingValueMap, applyValuesToGrid, buildGridPdfHtml, hasDataForCn,
  listTemplates, listMachineTypes, assignMachineTemplate, setDefaultTemplate, reimportTemplates,
  getTemplateById, createTemplate, updateTemplate, deleteTemplate,
  parseXlsxGridFromBuffer, listXlsxSheets, renderBlankTemplateHtml,
  getParamConfig, saveParamConfig, buildStandardGridForMachine,
} = require('./pbringGridService');
const { renderPdf } = require('./pdfRender');

async function getPdf(req, res) {
  try {
    const { cn, machine_type_name: machineTypeName, process_code: processCode } = req.query;
    if (!cn || !machineTypeName || !processCode) {
      return res.status(400).json({ success: false, error: 'cn, machine_type_name and process_code are required' });
    }

    // Phase 6 cutover: a machine with a seeded GRIND/DRESS CONDITION config
    // (the 16 grinding machines) renders through the live SDS "Standard"
    // layout. Anything without one (the 2 turning machines — Phase 6 doesn't
    // cover them yet) falls back to the Phase 5 mechanism (own imported
    // template + {{}} replace) so this cutover can't break a machine Phase 6
    // doesn't support.
    const paramConfig = await getParamConfig(machineTypeName);
    let grid;
    if (paramConfig.length > 0) {
      grid = await buildStandardGridForMachine(cn, machineTypeName, processCode);
      if (!grid) return res.status(404).json({ success: false, error: 'Live SDS Standard template not available' });
    } else {
      const loaded = await loadGridForMachine(machineTypeName);
      if (!loaded) {
        return res.status(404).json({ success: false, error: `No PB Ring grid template for machine "${machineTypeName}"` });
      }
      const { paramMap, conditionByToolNumber } = await buildPbRingValueMap(cn, machineTypeName, processCode);
      grid = applyValuesToGrid(loaded.grid, paramMap, conditionByToolNumber);
    }

    const html = buildGridPdfHtml(grid);
    const pdf = await renderPdf(html);

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
    const { cn } = req.query;
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
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="pbring-template-blank.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error('[pbring:grid:admin:template:blank-pdf]', err);
    res.status(500).json({ error: err.message || 'Failed to render preview' });
  }
}

async function getParamConfigRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName } = req.query;
    if (!machineTypeName) return res.status(400).json({ error: 'machine_type_name is required' });
    res.json(await getParamConfig(machineTypeName));
  } catch (err) {
    console.error('[pbring:grid:admin:param-config:get]', err);
    res.status(500).json({ error: err.message || 'Failed to load param config' });
  }
}

async function putParamConfigRoute(req, res) {
  try {
    const { machine_type_name: machineTypeName } = req.query;
    if (!machineTypeName) return res.status(400).json({ error: 'machine_type_name is required' });
    const count = await saveParamConfig(machineTypeName, req.body?.rows, req.user?.empno);
    res.json({ success: true, count });
  } catch (err) {
    console.error('[pbring:grid:admin:param-config:put]', err);
    res.status(500).json({ error: err.message || 'Failed to save param config' });
  }
}

module.exports = {
  getPdf, getHasData,
  getTemplates, getMachineTypes, putMachineTemplate, putTemplateDefault, postReimport,
  getTemplate, postTemplate, putTemplate, deleteTemplate: deleteTemplateRoute,
  postXlsxUploadSheets, postXlsxUpload, getTemplateBlankPdf,
  getParamConfig: getParamConfigRoute, putParamConfig: putParamConfigRoute,
};
