// loglady.js (core browser part of loglady)

// library functions (not loglady specific)

// storage "engine" (can be replaced with IndexedDB, etc.)
function Storage (name) {
  const storage = {
    get(id = null) {
      if (id) return this.get().find(entry => entry.id === id)
      return JSON.parse(localStorage.getItem(name)) || []
    },
    set(entries) {
      entries = entries.sort((a, b) => a.created < b.created ? 1 : -1)
      localStorage.setItem(name, JSON.stringify(entries))
    },
    add(entry) {
      const entries = this.get()
      entries.push(entry)
      this.set(entries)
    },
    update (entry) {
      const entries = this.get()
      const index = entries.findIndex(e => e.id === entry.id)
      if (index === -1) return
      entries[index] = { ...entries[index], ...entry }
      this.set(entries)
    },
    remove (id) {
      const entries = this.get()
      const index = entries.findIndex(entry => entry.id === id)
      if (index === -1) return
      entries.splice(index, 1)
      this.set(entries)
    },
    clear() {
      this.set([])
    }
  }
  return storage
}

function LogLady ({ storage, server, bucket = 'logs' } = { }) {
  storage = storage || Storage('loglady')
  if (server === true) server = '/api'
  const apiUrl = server ? `${server}/${bucket}` : null
  console.log('apiUrl', apiUrl)

  const emit = (eventName, detail) => { // convenience function
    window.dispatchEvent(new CustomEvent(eventName, { detail }))
  }  

  async function syncLogWithServer (log, method = 'POST') {
    const endpoint = method === 'DELETE' ? `${apiUrl}/${log.id}` : apiUrl
    const body = method === 'DELETE' ? null : JSON.stringify(log)
    await fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: body
    })
    delete log.synced
    storage.update(log)
  }
  

  return {
    get (id = null) {
      return storage.get(id)
    },
    async add ({ text, created, id, extra } = {}) { // normally only text is passed
      if  (!text) return false

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

      if (server && navigator.onLine) await syncLogWithServer(log)
    },
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
