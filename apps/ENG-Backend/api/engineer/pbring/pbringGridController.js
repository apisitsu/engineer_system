'use strict';

/**
 * PB Ring grid/PDF HTTP layer. Mounted under the existing pbring router at
 * `/api/engineer/pbring/grid`. Both routes are read-only — no admin guard
 * needed beyond the global `verifyToken` the parent router already applies.
 */

const {
  loadGridForMachine, buildPbRingValueMap, applyValuesToGrid, buildGridPdfHtml, hasDataForCn,
  listTemplates, listMachineTypes, assignMachineTemplate, setDefaultTemplate, reimportTemplates,
} = require('./pbringGridService');
const { renderPdf } = require('./pdfRender');

async function getPdf(req, res) {
  try {
    const { cn, machine_type_name: machineTypeName, process_code: processCode } = req.query;
    if (!cn || !machineTypeName || !processCode) {
      return res.status(400).json({ success: false, error: 'cn, machine_type_name and process_code are required' });
    }

    const loaded = await loadGridForMachine(machineTypeName);
    if (!loaded) {
      return res.status(404).json({ success: false, error: `No PB Ring grid template for machine "${machineTypeName}"` });
    }

    const { paramMap, conditionByToolNumber } = await buildPbRingValueMap(cn, machineTypeName, processCode);
    const grid = applyValuesToGrid(loaded.grid, paramMap, conditionByToolNumber);
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

module.exports = {
  getPdf, getHasData,
  getTemplates, getMachineTypes, putMachineTemplate, putTemplateDefault, postReimport,
};
