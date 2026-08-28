const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { initSchema, DB_PATH } = require('./db/db');
const { seed } = require('./db/seed');
const apiRoutes = require('./routes/api');

const PORT = process.env.PORT || 3000;

// First-run: create schema + seed if the database file doesn't exist yet.
if (!fs.existsSync(DB_PATH)) {
  initSchema();
  seed();
} else {
  initSchema(); // safe no-op if tables already exist
}

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Madras Menu Studio running at http://localhost:${PORT}`);
});
