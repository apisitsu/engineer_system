'use strict';

const SdsAgent = require('./agents/SdsAgent');
const cache    = require('./agents/CacheAgent');
const monitor  = require('./agents/MonitorAgent');
const cnFormat = require('../utils/cnFormat');

// Key on the CANONICAL control-no so the same sheet requested as '310368' and as
// 'C31-00368' shares one cache entry (the headless PDF route passes the raw query
// string, sdsPublicController passes a normalised control-no) and invalidate(cn)
// can actually find it whichever spelling it is handed.
function cacheKey(cn) {
  const raw = String(cn).trim().toUpperCase();
  return `sds:${cnFormat.toControlNo(raw) || raw}`;
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
