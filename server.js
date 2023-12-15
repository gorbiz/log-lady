const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');

const app = express();
const db = new sqlite3.Database('logs.db');

app.use(bodyParser.json());

// Initialize the logs table
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, text TEXT, created DATETIME, updated DATETIME, deletedAt DATETIME)");
});

// Add a new log
app.post('/logs', (req, res) => {
  const { id, text, created } = req.body;
  const sql = "INSERT INTO logs (id, text, created, updated) VALUES (?, ?, ?, ?)";
  db.run(sql, [id, text, created, created], (err) => {
    if (err) {
      res.status(500).send(err.message);
      return;
    }
    res.status(201).send('Log added');
  });
});

// Update a log
app.put('/logs/:id', (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const updated = new Date().toISOString();
  const sql = "UPDATE logs SET text = ?, updated = ? WHERE id = ?";
  db.run(sql, [text, updated, id], (err) => {
    if (err) {
      res.status(500).send(err.message);
      return;
    }
    res.send('Log updated');
  });
});

// Delete a log
app.delete('/logs/:id', (req, res) => {
  const { id } = req.params;
  const deletedAt = new Date().toISOString();
  const sql = "UPDATE logs SET deletedAt = ? WHERE id = ?";
  db.run(sql, [deletedAt, id], (err) => {
    if (err) {
      res.status(500).send(err.message);
      return;
    }
    res.send('Log deleted');
  });
});

// Fetch updates
app.get('/logs', (req, res) => {
  const { lastSyncDate } = req.query;
  const sql = "SELECT * FROM logs WHERE updated > ? OR (deletedAt IS NOT NULL AND deletedAt > ?)";
  db.all(sql, [lastSyncDate, lastSyncDate], (err, rows) => {
    if (err) {
      res.status(500).send(err.message);
      return;
    }
    res.json(rows);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
