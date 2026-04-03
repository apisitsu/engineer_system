const { engPool } = require('./instance/eng_db');
engPool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%ks400b%';")
  .then(r => console.log(r.rows.map(x=>x.table_name)))
  .catch(console.error)
  .finally(() => process.exit(0));
