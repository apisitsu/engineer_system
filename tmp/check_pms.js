const { engPool } = require('./apps/ENG-Backend/instance/eng_db');

async function test() {
    console.log("Checking DB Project Managers...");
    const { rows } = await engPool.query('SELECT * FROM kb_project_manager');
    console.log("kb_project_manager rows:", rows);
    process.exit(0);
}

test();
