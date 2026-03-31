const { engPool } = require('./instance/eng_db');
engPool.query(`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name LIKE 'tooling_ks%' AND column_name IN ('dim_a','dim_b')`)
.then(r => console.table(r.rows))
.catch(console.error)
.finally(()=>process.exit(0));
