'use strict';

/**
 * Lot Status Tracker — service layer.
 *
 * Thin today: it just picks a source from the registry and delegates. It exists so
 * that cross-source concerns (merging a real-time position over the batch roadmap,
 * caching, provenance stamping) have a home that is not the controller.
 */

const { getSource, listSources } = require('./sources');

async function getLotStatus(lotNo, { controlNo, source } = {}) {
  const src = getSource(source);
  const result = await src.fetchLot(lotNo, { controlNo });
  return { ...result, availableSources: listSources() };
}

module.exports = { getLotStatus, listSources };
