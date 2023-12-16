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
  db.run('CREATE TABLE IF NOT EXISTS logs (id TEXT, bucket TEXT, text TEXT, created DATETIME, modified DATETIME, deleted DATETIME, PRIMARY KEY (id, bucket))')
})

async function getOne (id, bucket) {
  const sql = 'SELECT * FROM logs WHERE id = ? AND bucket = ?'
  return new Promise((resolve, reject) => {
    db.get(sql, [id, bucket], (err, row) => {
      if (err) return reject(err)
      resolve(row)
    })
  })
}

// Fetch [updates]
app.get('/api/:bucket', (req, res) => {
  const { bucket } = req.params
  const since = req.query.since || '1970-01-01T00:00:00.000Z' // not super pretty but works. probably.
  const sql = 'SELECT * FROM logs WHERE bucket = ? AND modified > ?'
  db.all(sql, [bucket, since], (err, rows) => {
    if (err) console.error(err)
    if (err) return res.status(500).send(err.message)
    res.json(rows)
  })
})

// NOTE new entries possible
app.put('/api/:bucket/:id', async (req, res) => {
  const { id, bucket } = req.params
  const { text, created } = req.body
  const modified = new Date().toISOString()

  let sql = 'UPDATE logs SET text = ?, modified = ? WHERE bucket = ? AND id = ?'
  const params = [text, modified, bucket, id]
  const exists = await getOne(id, bucket)

  if (exists) {
    if (exists.modified >= modified) return res.send({ change: false })
    if (req.body.deleted) sql = 'UPDATE logs SET text = ?, modified = ?, deleted=1 WHERE bucket = ? AND id = ?'
  } else {
    sql = 'INSERT INTO logs (text, modified, bucket, id, created) VALUES (?, ?, ?, ?, ?)'
    params.push(created)
  }

  console.log(sql, params)
  db.run(sql, params, (err) => {
    if (!err) return res.send({ change: true })
    console.error(err)
    res.status(500).send(err.message)
  })
})

// Dynamic route to handle different buckets
// app.post('/api/:bucket', (req, res) => { // NOTE never used (yet)
//   const { bucket } = req.params
//   const { id, text, created } = req.body
//   const sql = 'INSERT INTO logs (id, bucket, text, created, modified) VALUES (?, ?, ?, ?, ?)'
//   db.run(sql, [id, bucket, text, created, created], (err) => {
//     if (err) return res.status(500).send(err.message)
//     res.status(201).send(`Log added to bucket ${bucket}`)
//   })
// })

// Delete a log; never used (yet)... we do soft deletes
// app.delete('/api/:bucket/:id', (req, res) => {
//   const { id, bucket } = req.params
//   const deleted = new Date().toISOString()
//   const sql = 'UPDATE logs SET deleted = ? WHERE id = ? AND bucket = ?'
//   db.run(sql, [deleted, id, bucket], (err) => {
//     if (err) return res.status(500).send(err.message)
//     res.send('Log deleted')
//   })
// })

// Start the server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
