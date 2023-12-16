/* global fetch localStorage CustomEvent */

// storage "engine" (can be replaced with IndexedDB, etc.)
function Storage (name) {
  const storage = {
    get ({ id = null, includeDeleted = false } = {}) {
      const logs = JSON.parse(localStorage.getItem(name)) || {}
      if (id) return logs[id] // NOTE ignores includeDeleted here
      return Object.values(logs).filter(log => (includeDeleted || log.deleted))
    },
    set (entriesObj) { // NOTE set all
      localStorage.setItem(name, JSON.stringify(entriesObj))
    },
    add (entry) { // TODO rename to upsert?
      const entries = JSON.parse(localStorage.getItem(name)) || {}
      entries[entry.id] = entry
      this.set(entries)
    },
    update (entry) { // TODO upsert instead, see above?
      const entries = JSON.parse(localStorage.getItem(name)) || {}
      entries[entry.id] = { ...entries[entry.id], ...entry }
      this.set(entries)
    },
    remove (id) { // almost never used (soft delete instead)
      const entries = JSON.parse(localStorage.getItem(name)) || {}
      if (!entries[id]) return
      delete entries[id]
      this.set(entries)
    },
    clear () {
      this.set({})
    }
  }
  return storage
}

function Http (baseUrl, storage) { // NOTE passing storage is a bit convoluted... but handy also?
  function markSynced (entry) {
    delete entry.synced
    storage.update(entry)
  }

  return {
    get ({ id = '', since } = {}) {
      let url = `${baseUrl}/${id}`
      if (since) url += `?since=${since}`
      return fetch(url)
    },
    post (entry) {
      if (!navigator.onLine) return false
      return fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      })
      .then(response => {
        if (response.ok) markSynced(entry)
        return response
      })
    },
    put (entry) {
      if (!navigator.onLine) return false
      return fetch(`${baseUrl}/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      })
      .then(response => {
        if (response.ok) markSynced(entry)
        return response
      })
    },
    // delete (id) { ... }
  }
}

function LogLady ({ storage, server, bucket = 'logs' } = { }) {
  storage = storage || Storage('loglady')
  if (server === true) server = '/api'
  const apiUrl = server ? `${server}/${bucket}` : null
  let http = server ? Http(apiUrl, storage) : null

  // Call fetchUpdates when the app starts or comes online
  if (server) fetchUpdates()
  window.addEventListener('online', fetchUpdates)

  const emit = (eventName, detail) => { // convenience function
    window.dispatchEvent(new CustomEvent(eventName, { detail }))
  }

  
  const lastSync = localStorage.getItem('lastSync') || '1970-01-01T00:00:00.000Z'
  function sync () {
    const entries = http.get({ since: lastSync }) // TODO api.get
    entries.forEach(log => {
      const current = storage.get(log.id)
      if (current.modified >= log.modified) return
      storage.set(log)
      // emit('logAdded', log) // TODO or? emit('logUpdated', update)
    })
    localStorage.setItem('lastSync', new Date().toISOString()) // TODO get from server instead
    if (updates.length) emit('logsChanged') // basic 1.0
    // later trigger one event per entry, oldest modified first
  }
    
  // TODO realtime sync, pseudo-code:
  // io.on('added / modified', (entry) => {
  //   return sync()
  //   // Maybe 2.0
  //   current = storage.get(entry)
  //   if current.modified >= entry.modified return
  //   storage.upsert(entry)
  //   emit logsChanged
  // }    

  return {
    get (id = null) {
      return storage.get({ id })
    },
    async add ({ text, created, id, extra } = {}) { // normally only text is passed
      if (!text) return false

      created = created || new Date()
      id = created // TODO add initials
      const log = { id, text, created, synced: false }
      if (extra) log.extra = extra

      storage.add(log)
      emit('logAdded', log)

      if (server) http.post(log)
    },
    async remove (id) {
      let log = storage.get({ id })
      if (!log) return
      log = { ...log, deleted: true, modified: new Date(), synced: false }

      storage.update(log) // used to be: storage.remove(id)
      emit('logRemoved', { id })

      if (server) http.put(log)
    },
    fetchUpdates,
    clear () {
      storage.clear()
      // TODO syncLogWithServer(...) for each log
      emit('logsCleared')
    },
    on (eventNames, handler) { // TODO move from here; makes no sense here
      const names = eventNames.split(' ')
      names.forEach(name => window.addEventListener(name, handler))
    }
  }
}

export { LogLady }
