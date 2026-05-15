'use strict';

const SdsAgent = require('./agents/SdsAgent');
const cache    = require('./agents/CacheAgent');
const monitor  = require('./agents/MonitorAgent');

function cacheKey(cn) {
  return `sds:${cn.trim().toUpperCase()}`;
}

async function search(cn, maqPool, rodpcPool) {
  const key    = cacheKey(cn);
  const cached = cache.get(key);

  if (cached) {
    monitor.record('SdsOrchestrator:cache-hit', 0);
    return { ...cached, _fromCache: true };
  }

  const result = await new SdsAgent(maqPool, rodpcPool).execute({ cn });

  if (result._agentError) {
    return { error: result.error, success: false };
  }

  cache.set(key, result, cache.TTL.SDS);
  return result;
}

// Called after a CN's upstream data changes (e.g., re-import from factory DB)
function invalidate(cn) {
  cache.invalidate(cacheKey(cn));
}

module.exports = { search, invalidate };
