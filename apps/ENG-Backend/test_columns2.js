const { engPool } = require('./instance/eng_db');
Promise.all(['tooling_ksb22g', 'tooling_ksb80', 'tooling_ks400b'].map(t => 
  engPool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}';`)
    .then(r => console.log(t, r.rows))
)).catch(console.error).finally(() => process.exit(0));
