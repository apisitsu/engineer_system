const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Adjust path to point to the correct database location
const dbPath = path.resolve(__dirname, '../instance/test.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        listTables();
    }
});

function listTables() {
    db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, tables) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('Tables:', tables);
            checkUsersProfileSchema();
        }
    });
}

function checkUsersProfileSchema() {
    db.all("PRAGMA table_info(users_profile);", [], (err, columns) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log('users_profile columns:', columns);
        }
        db.close();
    });
}
