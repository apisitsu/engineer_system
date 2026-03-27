const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'D:\\97_Projects\\02_New_Model\\Engineering_System\\apps\\ENG-Backend\\instance\\test.db';

// Try opening with verbose method to see more info
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to database at', dbPath);
        db.configure('busyTimeout', 5000); // Wait up to 5s for locks
        performFix();
    }
});

function performFix() {
    db.serialize(() => {
        // List tables
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
            if (err) console.error('List tables error:', err.message);
            else console.log('Tables:', tables.map(t => t.name));
        });

        // Add column if not exists
        db.all("PRAGMA table_info(users_profile)", (err, columns) => {
            if (err) {
                console.error('Schema error:', err.message);
                return;
            }

            const hasTheme = columns.some(c => c.name === 'theme');
            console.log('Has theme column?', hasTheme);

            if (!hasTheme) {
                console.log('Adding theme column...');
                db.run("ALTER TABLE users_profile ADD COLUMN theme TEXT DEFAULT 'lavenderRose'", (err) => {
                    if (err) console.error('ALTER error:', err.message);
                    else {
                        console.log('SUCCESS: Column added!');
                    }
                });
            } else {
                console.log('Column already exists.');
            }
        });
    });

    // Explicit close after delay
    setTimeout(() => {
        console.log('Closing...');
        db.close();
    }, 2000);
}
