const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'D:\\97_Projects\\02_New_Model\\Engineering_System\\apps\\ENG-Backend\\instance\\test.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to database at', dbPath);
        checkSchema();
    }
});

function checkSchema() {
    // List all tables
    db.all("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view')", [], (err, items) => {
        if (err) {
            console.error(err.message);
            return;
        }

        console.log('--- Database Items ---');
        items.forEach(item => console.log(`${item.type.toUpperCase()}: ${item.name}`));

        // Detailed info for users_profile
        const userProfile = items.find(i => i.name === 'users_profile');
        if (userProfile) {
            console.log('\n--- users_profile Schema ---');
            db.all(`PRAGMA table_info(users_profile)`, [], (err, columns) => {
                if (err) console.error(err);
                else {
                    console.log('Columns:', columns);
                    // If it's a view, show its SQL
                    if (userProfile.type === 'view') {
                        db.get(`SELECT sql FROM sqlite_master WHERE name = 'users_profile'`, (err, row) => {
                            console.log('View SQL:', row.sql);
                        });
                    }
                }
            });
        } else {
            console.log('\nusers_profile does NOT exist!');
        }
    });

    // Keep process alive for a moment to ensure async logs print
    setTimeout(() => db.close(), 2000);
}
