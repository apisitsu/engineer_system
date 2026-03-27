const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 6543,
    database: 'eng_system',
    user: 'eng_admin',
    password: 'eng_secret_2026'
});

async function run() {
    try {
        console.log("--- LATEST COMMENTS ---");
        const comments = await pool.query('SELECT * FROM kb_comment ORDER BY id DESC LIMIT 5');
        console.log(comments.rows);

        console.log("--- LATEST ACTIONS ---");
        const actions = await pool.query('SELECT * FROM kb_action ORDER BY id DESC LIMIT 5');
        console.log(actions.rows);

        console.log("--- LATEST MEMBERSHIPS ---");
        const memberships = await pool.query('SELECT * FROM kb_card_membership ORDER BY id DESC LIMIT 5');
        console.log(memberships.rows);

    } catch (e) { console.error(e); }
    process.exit(0);
}
run();
