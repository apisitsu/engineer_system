'use strict';
/**
 * Aras PLM connectivity check. Reads ARAS_* from apps/ENG-Backend/.env.
 * Run:  node api/engineer/mtc/aras/aras_ping.js
 */
const { aras, isConfigured } = require('./aras_plm');

(async () => {
  if (!isConfigured()) {
    console.error('Aras PLM is not configured yet. Add to apps/ENG-Backend/.env:');
    console.error('  ARAS_URL  = http://wk10.kz.minebea.local/InnovatorServer');
    console.error('  ARAS_DB   = Rodend_PLM');
    console.error('  ARAS_USER = <local Aras service account>');
    console.error('  ARAS_PASS = <that account password>');
    process.exit(1);
  }
  const r = await aras.ping();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 2);
})();
