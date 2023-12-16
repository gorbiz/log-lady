/* global fetch localStorage CustomEvent */
import io from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js'

// storage "engine" (can be replaced with IndexedDB, etc.)

function Storage (name) {
  function save (entriesObj) {
    localStorage.setItem(name, JSON.stringify(entriesObj))
  }

  const storage = {
    get ({ id = null, includeDeleted = false } = {}) {
      const logs = JSON.parse(localStorage.getItem(name)) || {}
      if (id) return logs[id] // NOTE ignores includeDeleted here
      return Object.values(logs).filter(log => (includeDeleted || !log.deleted))
    },
    set (entry) { // TODO rename to upsert?
      const entries = JSON.parse(localStorage.getItem(name)) || {}
      entries[entry.id] = entry
      save(entries)
    },
    remove (id) { // almost never used (soft delete instead)
      const entries = JSON.parse(localStorage.getItem(name)) || {}
      if (!entries[id]) return
      delete entries[id]
      save(entries)
    },
    clear () {
      save({})
    }
  }
  return storage
}

function HttpJSON (baseUrl) {
  return {
    async get ({ url = '', query } = {}) {
      url = `${baseUrl}/${url}`
      if (query) url += '?' + new URLSearchParams(query).toString()
      const res = await fetch(url)
      return res.json()
    },
    post ({ url, data } = {}) { // NOTE never used (yet)
      url = `${baseUrl}/${url}`
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
    },
    put ({ url, data, headers }) {
      url = `${baseUrl}/${url}`
      return fetch(url, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
    }
    // TODO delete (id) { ... }
  }
}

function connectSocket (socket) {
  return new Promise((resolve, reject) => {
    socket.on('connect', () => { resolve() })
    socket.on('connect_error', (error) => { reject(error) }) // Optional: handle connection error
  })
}

function Api ({ url, storage, socket } = {}) {
  const http = HttpJSON(url)
  console.log({ socket })

  async function getSocketId () {
    if (!socket) return null
    if (!socket.connected) await connectSocket(socket)
    return socket.id
  }

  function markSynced (entry) {
    delete entry.synced
    storage.set(entry)
  }

  return {
    get ({ id, since } = {}) {
      return http.get({ id, query: { since } })
    },
    async set (entry) {
      if (!navigator.onLine) return false
      const socketId = socket ? await getSocketId() : null
      console.debug('set:', socketId)
      const headers = socketId ? { 'X-Socket-Id': socketId } : {}
      return http.put({ url: entry.id, data: entry, headers }).then(response => {
        if (response.ok) markSynced(entry)
        return response
      })
    }
  }
}

function LogLady ({ storage, server, socket, bucket = 'logs' } = {}) {
  storage = storage || Storage('loglady')
  if (server === true) server = '/api'
  const url = server ? `${server}/${bucket}` : null

  if (socket === true) socket = io()
  if (socket) socket.on('changes', (data) => { sync() })

  const api = server ? Api({ url, storage, socket }) : null

  // Call fetchUpdates when the app starts or comes online
  if (server) sync()
  window.addEventListener('online', sync) // TODO de-bounce? (in sync function)

  const emit = (eventName, detail) => { // TODO (re)move
    window.dispatchEvent(new CustomEvent(eventName, { detail }))
  }

  async function pushLocalChanges () {
    const entries = storage.get({ includeDeleted: true }).filter(entry => entry.synced === false)
    if (!entries.length) return false
    console.debug('pushLocalChanges:', { nr: entries.length })
    const promises = entries.map(entry => api.set(entry))
    await Promise.all(promises)
  }

  async function sync () {
    if (!navigator.onLine) return false
    await pushLocalChanges()
    const lastSync = localStorage.getItem('lastSync') || '1970-01-01T00:00:00.000Z'
    const entries = await api.get({ since: lastSync }) // TODO api.get
    let changes = false
    console.debug('sync:', { nr: entries.length, lastSync })
    entries.forEach(log => { // NOTE later ensure oldest first (for UI events)?
      const current = storage.get(log.id)
      if (current.modified >= log.modified) return
      storage.set(log)
      changes = true
      // emit('logAdded', log) // TODO or? emit('logUpdated', update)
    })
    localStorage.setItem('lastSync', new Date().toISOString()) // TODO get from server instead
    if (changes) emit('logsChanged') // basic 1.0
  }

  // TODO realtime sync, pseudo-code:
  // io.on('added / modified', (entry) => {
  //   return sync()
  //   // Maybe 2.0
  //   current = storage.get(entry)
  //   if current.modified >= entry.modified return
  //   storage.set(entry)
  //   emit logsChanged
  // }

  return {
    get (id = null) {
      return storage.get({ id })
    },
    async add ({ text, extra } = {}) { // normaly only text is passed
      if (!text) return false
      const created = new Date()
      const id = created.toISOString() // TODO add initials
      const log = { id, text, created, synced: false }
      if (extra) log.extra = extra

      storage.set(log)
      emit('logAdded', log)

      if (server) api.set(log)
    },
    async remove (id) {
      let log = storage.get({ id })
      if (!log) return
      log = { ...log, deleted: true, modified: new Date(), synced: false }
      storage.set(log) // used to be: storage.remove(id)
      emit('logRemoved', { id })

      if (server) api.set(log)
    },
    clear () {
      storage.clear()
      // TODO syncLogWithServer(...) for each log
      emit('logsCleared')
    },
    sync,
    on (eventNames, handler) { // TODO move from here; makes no sense here
      const names = eventNames.split(' ')
      names.forEach(name => window.addEventListener(name, handler))
    }
  }
}

export { LogLady }
