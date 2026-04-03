const { engPool } = require('./instance/eng_db');
engPool.query("SELECT id, tooling_name, dim_a FROM tooling_ks400b WHERE dim_a !~ '^[0-9\\.]+$' AND dim_a IS NOT NULL AND dim_a != '' LIMIT 10")
.then(r => console.log(r.rows))
.catch(console.error)
.finally(()=>process.exit(0));
