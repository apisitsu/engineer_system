const { engPool } = require('./instance/eng_db');
engPool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'tooling_%' ORDER BY table_name, ordinal_position;")
  .then(r => {
    let tMap = {};
    r.rows.forEach(row => {
      if(!tMap[row.table_name]) tMap[row.table_name] = [];
      tMap[row.table_name].push(row.column_name + '(' + row.data_type + ')');
    });
    console.log(tMap);
  }).catch(console.error).finally(()=>process.exit(0));
