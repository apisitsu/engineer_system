'use strict';
/**
 * Aras Innovator PLM connector (Rodend_PLM) — OAuth2 password-grant client.
 *
 * Data source: http://wk10.kz.minebea.local/InnovatorServer  (database: Rodend_PLM)
 * Auth model : Aras IdentityServer OAuth2. This client uses the `password` grant with
 *              a LOCAL Aras service account (NOT a Windows/AD account — those cannot be
 *              used head-less). Aras requires the password to be sent as a lowercase MD5
 *              hash (the server rejects plaintext with `incompatible_hash_use_md5`).
 *
 * Env (apps/ENG-Backend/.env):
 *   ARAS_URL   = http://wk10.kz.minebea.local/InnovatorServer   (no trailing slash)
 *   ARAS_DB    = Rodend_PLM
 *   ARAS_USER  = <local Aras service account login>
 *   ARAS_PASS  = <that account's Aras-internal password>        (plaintext; hashed here)
 *
 * Usage (from an MTC controller/service):
 *   const { aras } = require('../aras/aras_plm');
 *   const itemTypes = await aras.odata(`ItemType?$select=name&$top=5`);
 *   const parts     = await aras.odata(`Part?$filter=item_number eq '${n}'&$top=1`);
 *
 * Unlike the pg pools, this module does NOT connect on import (HTTP is stateless) and
 * never throws at require-time — it fails only when a call is made without config, so a
 * missing ARAS_* block never blocks server startup.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });
const crypto = require('crypto');

const CFG = {
  url:  (process.env.ARAS_URL || '').trim().replace(/\/+$/, ''),
  db:   (process.env.ARAS_DB  || '').trim(),
  user: (process.env.ARAS_USER || '').trim(),
  pass:  process.env.ARAS_PASS || '',
};

const md5lower = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex');

const tokenMode = () => !!(process.env.ARAS_TOKEN || '').trim();

function assertConfigured() {
  // Token-mode needs only ARAS_URL; password-grant mode needs the full account.
  const required = tokenMode() ? ['url'] : ['url', 'db', 'user', 'pass'];
  const missing = required.filter(k => !CFG[k]);
  if (missing.length) {
    throw new Error(`Aras PLM not configured — set ARAS_${missing.map(m => m.toUpperCase()).join(', ARAS_')}${tokenMode() ? '' : ' in .env'}`);
  }
}

// ── Token cache (single in-flight fetch, refresh 60s before expiry) ──────────
let _token = null;          // { access_token, refresh_token, expires_at (ms) }
let _inflight = null;

async function _requestToken(useRefresh) {
  const body = new URLSearchParams(
    useRefresh && _token?.refresh_token
      ? { grant_type: 'refresh_token', client_id: 'IOMApp', refresh_token: _token.refresh_token }
      : {
          grant_type: 'password',
          client_id: 'IOMApp',
          scope: 'Innovator offline_access',
          username: CFG.user,
          password: md5lower(CFG.pass),   // Aras requires lowercase-MD5
          database: CFG.db,
        }
  );
  const res = await fetch(`${CFG.url}/OAuthServer/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  if (!res.ok || !json?.access_token) {
    const detail = json ? `${json.error || res.status}: ${json.error_description || ''}` : text.slice(0, 200);
    const err = new Error(`Aras token request failed (${res.status}) ${detail}`);
    err.status = res.status; err.aras = json;
    throw err;
  }
  _token = {
    access_token: json.access_token,
    refresh_token: json.refresh_token || _token?.refresh_token || null,
    expires_at: Date.now() + (Number(json.expires_in || 1800) * 1000),
  };
  return _token.access_token;
}

async function getToken() {
  // Token-mode: a Bearer token supplied directly (e.g. copied from the browser after
  // Windows SSO login) short-circuits the password grant. Good for periodic imports run
  // by a logged-in user without storing any password. No auto-refresh — grab a fresh one
  // per run (Aras access tokens last ~30 min).
  const supplied = (process.env.ARAS_TOKEN || '').trim();
  if (supplied) return supplied;

  assertConfigured();
  if (_token && Date.now() < _token.expires_at - 60_000) return _token.access_token;
  if (_inflight) return _inflight;
  const useRefresh = !!(_token && _token.refresh_token);
  _inflight = _requestToken(useRefresh)
    .catch(async (e) => {
      // A stale/expired refresh_token → fall back to a fresh password grant once.
      if (useRefresh) { _token = null; return _requestToken(false); }
      throw e;
    })
    .finally(() => { _inflight = null; });
  return _inflight;
}

/**
 * OData REST call against Server/OData/<path>. Returns parsed JSON.
 * On 401 the token is dropped and the call is retried once with a fresh token.
 * @param {string} odataPath e.g. `Part?$top=5` or `ItemType('<id>')`
 * @param {object} [opts] { method, body (object→JSON), headers, _retried }
 */
async function odata(odataPath, opts = {}) {
  assertConfigured();
  const token = await getToken();
  const method = opts.method || 'GET';
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${CFG.url}/Server/OData/${odataPath}`, {
    method, headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && !opts._retried) {
    _token = null;                                   // force re-auth
    return odata(odataPath, { ...opts, _retried: true });
  }
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`Aras OData ${method} ${odataPath} failed (${res.status}): ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

/** Lightweight health check — returns { ok, database, sample|error }. Never throws. */
async function ping() {
  try {
    const j = await odata(`ItemType?$select=name&$top=3`);
    return { ok: true, database: CFG.db, sample: (j.value || []).map(x => x.name) };
  } catch (e) {
    return { ok: false, database: CFG.db, error: e.message };
  }
}

module.exports = {
  aras: { getToken, odata, ping },
  isConfigured: () => (tokenMode() ? !!CFG.url : ['url', 'db', 'user', 'pass'].every(k => CFG[k])),
};
