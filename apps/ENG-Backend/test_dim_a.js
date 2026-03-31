const { engPool } = require('./instance/eng_db');
engPool.query('SELECT dim_a AS "Dim_A" FROM tooling_tsg300 LIMIT 1')
  .then(r => console.log(r.rows))
  .catch(console.error)
  .finally(() => process.exit(0));
