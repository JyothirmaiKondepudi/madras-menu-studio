const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // built-in since Node 22.5 — no native compile step required

const DB_PATH = path.join(__dirname, 'database.sqlite');
const raw = new DatabaseSync(DB_PATH);
raw.exec('PRAGMA journal_mode = WAL;');

// Thin adapter so the rest of the app can keep using the better-sqlite3-style API
// (db.prepare(sql).run/get/all, db.exec, db.transaction).
const db = {
  exec: (sql) => raw.exec(sql),
  prepare: (sql) => {
    const stmt = raw.prepare(sql);
    return {
      run: (...args) => stmt.run(...args),
      get: (...args) => stmt.get(...args),
      all: (...args) => stmt.all(...args),
    };
  },
  transaction: (fn) => {
    return (...args) => {
      raw.exec('BEGIN');
      try {
        const result = fn(...args);
        raw.exec('COMMIT');
        return result;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    };
  },
};

function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

module.exports = { db, initSchema, DB_PATH };
