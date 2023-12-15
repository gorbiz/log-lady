/* global fetch localStorage CustomEvent */

// storage "engine" (can be replaced with IndexedDB, etc.)
function Storage (name) {
  const storage = {
    get (id = null, excludeDeleted = true) {
      const logs = JSON.parse(localStorage.getItem(name)) || {}
      if (id) return logs[id]

      return Object.values(logs).filter(log => !(excludeDeleted && log.deleted))
    },
    set (entriesObj) {
      localStorage.setItem(name, JSON.stringify(entriesObj))
    },
    add (entry) {
      const entries = JSON.parse(localStorage.getItem(name)) || {}
      entries[entry.id] = entry
      this.set(entries)
    },
    update (entry) {
      const entries = JSON.parse(localStorage.getItem(name)) || {}
      entries[entry.id] = { ...entries[entry.id], ...entry }
      this.set(entries)
    },
    remove (id) {
      const entries = JSON.parse(localStorage.getItem(name)) || {}
      if (entries[id]) {
        delete entries[id]
        this.set(entries)
      }
    },
    clear () {
      this.set({})
    }
  }
  return storage
}

function LogLady ({ storage, server, bucket = 'logs' } = { }) {
  storage = storage || Storage('loglady')
  if (server === true) server = '/api'
  const apiUrl = server ? `${server}/${bucket}` : null

  // Call fetchUpdates when the app starts or comes online
  if (server) fetchUpdates()
  window.addEventListener('online', fetchUpdates)

  const emit = (eventName, detail) => { // convenience function
    window.dispatchEvent(new CustomEvent(eventName, { detail }))
  }

  async function syncLogWithServer (log, method = 'POST') {
    const endpoint = method === 'DELETE' ? `${apiUrl}/${log.id}` : apiUrl
    const body = method === 'DELETE' ? null : JSON.stringify(log)
    await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body
    })
    delete log.synced
    storage.update(log)
  }

  async function fetchUpdates () {
    const lastSyncDate = localStorage.getItem('lastSyncDate') || '1970-01-01T00:00:00.000Z'
    try {
      const response = await fetch(`${apiUrl}?lastSyncDate=${lastSyncDate}`)
      if (!response.ok) throw new Error('Network response was not ok')

      const updates = await response.json()

      // Process updates: add new logs, update existing, and handle deletions
      updates.forEach(update => {
        if (update.deleted) {
          storage.remove(update.id)
        } else {
          storage.update(update)
        }
      })

      // Update lastSyncDate in localStorage
      localStorage.setItem('lastSyncDate', new Date().toISOString())
    } catch (error) {
      console.error('Fetch updates failed:', error)
    }
  }

  return {
    get (id = null) {
      return storage.get(id)
    },
    async add ({ text, created, id, extra } = {}) { // normally only text is passed
      if (!text) return false

      created = created || new Date()
      id = created // TODO add initials
      const log = { id, text, created, synced: false }
      if (extra) log.extra = extra

      storage.add(log)
      emit('logAdded', log)

      if (server && navigator.onLine) await syncLogWithServer(log)
    },
    async remove (id) {
      let log = storage.get(id)
      if (!log) return
      const now = new Date()
      log = { ...log, deleted: now, modified: now, synced: false }

      storage.update(log) // used to be: storage.remove(id)
      emit('logRemoved', { id })

      if (server && navigator.onLine) await syncLogWithServer(log, 'DELETE')
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
