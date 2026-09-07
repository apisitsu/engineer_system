'use strict';

/**
 * Lot Status Tracker — source registry.
 *
 * Each source exports `{ name, isRealtime, fetchLot(lotNo, opts) }`. Add a new feed
 * (AS/400 DB2, KZW job-check service, …) by dropping a file here and registering it
 * below — the route, the service and the page do not change.
 */

const maqdb = require('./maqdbSource');
const { DEFAULT_SOURCE } = require('../lotTrackConstants');

const REGISTRY = {
  [maqdb.name]: maqdb,
};

function getSource(requested) {
  const key = String(requested || DEFAULT_SOURCE || 'maqdb').trim().toLowerCase();
  return REGISTRY[key] || REGISTRY[maqdb.name];
}

const listSources = () =>
  Object.values(REGISTRY).map((s) => ({ name: s.name, isRealtime: s.isRealtime }));

module.exports = { getSource, listSources };
