const sqlite3 = require('sqlite3').verbose();
const { existsSync, readFileSync } = require('fs');
const { join } = require('path');


// Initialize SQLite database
const db = new sqlite3.Database(join(__dirname, '../db.sqlite'), (err) => {
  if (err) {
    console.error('Could not connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    // Read and execute schema.sql
    const schemaPath = join(__dirname, '../schema.sql');
    if (existsSync(schemaPath)) {
      const schema = readFileSync(schemaPath, 'utf8');
      db.exec(schema, (err) => {
        if (err) {
          console.error('Error executing schema.sql:', err.message);
        } else {
          console.log('Database schema initialized from schema.sql');
        }
      });
    } else {
      console.warn('schema.sql not found, skipping schema initialization.');
    }
  }
});

module.exports = db;