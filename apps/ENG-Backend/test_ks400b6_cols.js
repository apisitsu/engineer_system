const { engPool } = require('./instance/eng_db');
engPool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tooling_ks400b6' ORDER BY ordinal_position")
  .then(r => console.log(r.rows.map(x=>x.column_name)))
  .catch(console.error).finally(()=>process.exit(0));
