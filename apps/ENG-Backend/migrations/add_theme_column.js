const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use absolute path directly to avoid ambiguity
const dbPath = 'D:\\97_Projects\\02_New_Model\\Engineering_System\\apps\\ENG-Backend\\instance\\test.db';

console.log('Connecting to database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        addThemeColumn();
    }
});

function addThemeColumn() {
    // First check if column exists
    db.all("PRAGMA table_info(users_profile);", [], (err, columns) => {
        if (err) {
            console.error('Error checking schema:', err.message);
            return;
        }

        console.log('Current columns:', columns.map(c => c.name).join(', '));

        const hasTheme = columns.some(c => c.name === 'theme');
        if (hasTheme) {
            console.log('Column "theme" already exists (verified via PRAGMA).');
            // Check value for a user
            db.get("SELECT u_code, theme FROM users_profile LIMIT 1", (err, row) => {
                console.log('Sample user row:', row);
                db.close();
            });
            return;
        }

        console.log('Adding "theme" column...');
        const sql = `ALTER TABLE users_profile ADD COLUMN theme TEXT DEFAULT 'lavenderRose'`;
        db.run(sql, [], (err) => {
            if (err) {
                console.error('Error executing ALTER TABLE:', err.message);
            } else {
                console.log('Column "theme" added successfully.');
            }
            db.close();
        });
    });
}
