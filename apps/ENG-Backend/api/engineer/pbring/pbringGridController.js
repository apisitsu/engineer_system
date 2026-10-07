'use strict';

/**
 * PB Ring grid/PDF HTTP layer. Mounted under the existing pbring router at
 * `/api/engineer/pbring/grid`. Both routes are read-only — no admin guard
 * needed beyond the global `verifyToken` the parent router already applies.
 */

const { loadGridForMachine, buildPbRingValueMap, applyValuesToGrid, buildGridPdfHtml, hasDataForCn } = require('./pbringGridService');
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

module.exports = { getPdf, getHasData };
