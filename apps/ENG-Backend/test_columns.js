const { engPool } = require('./instance/eng_db');
engPool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tooling_tsg300';")
  .then(r => console.log(r.rows))
  .catch(console.error)
  .finally(() => process.exit(0));
