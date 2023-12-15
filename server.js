const express = require('express')
const fs = require('fs')
const sqlite3 = require('sqlite3')
const bodyParser = require('body-parser')

const app = express()
const db = new sqlite3.Database('loglady.db')

// if public folder exists, serve it
if (fs.existsSync('public')) app.use(express.static('public'))

app.use(bodyParser.json())

// Initialize the logs table with an additional 'bucket' column
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS logs (id TEXT, bucket TEXT, text TEXT, created DATETIME, updated DATETIME, deleted DATETIME, PRIMARY KEY (id, bucket))')
})

// Dynamic route to handle different buckets
app.post('/api/:bucket', (req, res) => {
  const { bucket } = req.params
  const { id, text, created } = req.body
  const sql = 'INSERT INTO logs (id, bucket, text, created, updated) VALUES (?, ?, ?, ?, ?)'
  db.run(sql, [id, bucket, text, created, created], (err) => {
    if (err) return res.status(500).send(err.message)
    res.status(201).send(`Log added to bucket ${bucket}`)
  })
})

// Update a log
app.put('/api/:bucket/:id', (req, res) => {
  const { id, bucket } = req.params
  const { text } = req.body
  const updated = new Date().toISOString()
  const sql = 'UPDATE logs SET text = ?, updated = ? WHERE id = ? AND bucket = ?'
  db.run(sql, [text, updated, id, bucket], (err) => {
    if (err) return res.status(500).send(err.message)
    res.send('Log updated')
  })
})

// Delete a log
app.delete('/api/:bucket/:id', (req, res) => {
  const { id, bucket } = req.params
  const deleted = new Date().toISOString()
  const sql = 'UPDATE logs SET deleted = ? WHERE id = ? AND bucket = ?'
  db.run(sql, [deleted, id, bucket], (err) => {
    if (err) return res.status(500).send(err.message)
    res.send('Log deleted')
  })
})

// Fetch updates
app.get('/api/:bucket', (req, res) => {
  const { bucket } = req.params
  const { lastSyncDate } = req.query
  const sql = 'SELECT * FROM logs WHERE bucket = ? AND updated > ?'
  db.all(sql, [bucket, lastSyncDate], (err, rows) => {
    if (err) console.error(err)
    if (err) return res.status(500).send(err.message)
    res.json(rows)
  })
})

// Start the server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
