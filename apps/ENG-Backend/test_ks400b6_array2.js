const { engPool } = require('./instance/eng_db');
engPool.query(`
      SELECT t.table_name,
        array_agg(c.column_name::TEXT ORDER BY c.ordinal_position)
          FILTER (WHERE c.column_name NOT IN ('id','tooling_name','tooling_no','machine','created_at','updated_at')) AS data_cols
      FROM information_schema.tables t
      JOIN information_schema.columns c
        ON c.table_name = t.table_name AND c.table_schema = 'public'
      WHERE t.table_schema = 'public'
        AND t.table_name = 'tooling_ks400b6'
      GROUP BY t.table_name
`)
  .then(r => console.log('is array:', Array.isArray(r.rows[0].data_cols), r.rows[0].data_cols))
  .catch(console.error).finally(()=>process.exit(0));
