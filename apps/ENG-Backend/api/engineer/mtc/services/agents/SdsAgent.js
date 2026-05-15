'use strict';

const BaseAgent    = require('./BaseAgent');
const { searchByCn } = require('../sdsV2SearchService');

// Pool stub returned when rodpcPool is unreachable — lets searchByCn continue
// with empty production + process-name data rather than crashing entirely.
const NULL_POOL = { query: async () => ({ rows: [] }) };

function isConnectionError(err) {
  const m = err.message.toLowerCase();
  return m.includes('connect') || m.includes('econnrefused') ||
         m.includes('timeout')  || m.includes('enotfound');
}

class SdsAgent extends BaseAgent {
  constructor(maqPool, rodpcPool) {
    super('SdsAgent', 15000); // cross-DB queries can be slow
    this.maqPool   = maqPool;
    this.rodpcPool = rodpcPool;
  }

  async run({ cn }) {
    try {
      return await searchByCn(cn, this.maqPool, this.rodpcPool);
    } catch (err) {
      // If rodpcPool is the cause, retry without it (graceful degradation)
      if (isConnectionError(err)) {
        console.warn('[SdsAgent] rodpcPool unreachable, retrying without production data');
        const result = await searchByCn(cn, this.maqPool, NULL_POOL);
        return { ...result, _rodpcUnavailable: true };
      }
      throw err;
    }
  }
}

module.exports = SdsAgent;
