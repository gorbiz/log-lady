// loglady.js (core browser part of loglady)

// library functions (not loglady specific)

// storage "engine" (can be replaced with IndexedDB, etc.)
function Storage (name) {
  const storage = {
    get() {
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

function LogLady () {
  const storage = Storage('loglady')

  const emit = (eventName, detail) => { // convenience function
    console.log(detail, '<-- detail')
    window.dispatchEvent(new CustomEvent(eventName, { detail }))
  }  

  return {
    add ({ text, created, id } = {}) { // normally only text is passed
      if  (!text) return false
      created = created || new Date()
      id = created // TODO add initials
      const log = { id, text, created }
      // TODO preAdd hook
      storage.add(log)
      emit('logAdded', log)
    },
    remove (id) {
      storage.remove(id)
      emit('logRemoved', { id })
    },
    clear () {
      storage.clear()
      emit('logsCleared')
    },
    get () {
      return storage.get()
    },
    on (eventNames, handler) { // TODO move from here; makes no sense here
      const names = eventNames.split(' ')
      console.log(names)
      names.forEach(name => window.addEventListener(name, handler))
    }
  }
}

export { LogLady }
