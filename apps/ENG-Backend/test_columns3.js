const { engPool } = require('./instance/eng_db');
Promise.all([
  'tooling_tsg300', 'tooling_ksb22g', 'tooling_ksb80', 
  'tooling_ks03a', 'tooling_ks400b', 'tooling_ks500rd', 
  'tooling_ks400b5', 'tooling_ks400b6'
].map(t => 
  engPool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}' ORDER BY ordinal_position;`)
    .then(r => console.log(t, r.rows.map(c => `${c.column_name}(${c.data_type})`)))
)).catch(console.error).finally(() => process.exit(0));
