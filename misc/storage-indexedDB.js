// complete untested, written by Chat-GPT 4 2023-12-13

class IndexedDBStorage {
  constructor(dbName, storeName) {
    this.dbName = dbName
    this.storeName = storeName
    this.db = null
  }

  async open() {
    if (this.db) return this.db

    const request = indexedDB.open(this.dbName, 1)
    request.onupgradeneeded = event => {
      const db = event.target.result
      db.createObjectStore(this.storeName, { keyPath: 'id' })
    }

    const dbOpen = await new Promise((resolve, reject) => {
      request.onerror = () => reject('IndexedDB error')
      request.onsuccess = () => resolve(request.result)
    })

    this.db = dbOpen
    return this.db
  }

  async get() {
    await this.open()
    const transaction = this.db.transaction([this.storeName], 'readonly')
    const objectStore = transaction.objectStore(this.storeName)
    const request = objectStore.getAll()

    return new Promise((resolve, reject) => {
      request.onerror = () => reject('Error fetching data')
      request.onsuccess = () => resolve(request.result)
    })
  }

  async add(entry) {
    await this.open()
    const transaction = this.db.transaction([this.storeName], 'readwrite')
    const objectStore = transaction.objectStore(this.storeName)
    const request = objectStore.add(entry)

    return new Promise((resolve, reject) => {
      request.onerror = () => reject('Error adding data')
      request.onsuccess = () => resolve()
    })
  }

  async remove(id) {
    await this.open()
    const transaction = this.db.transaction([this.storeName], 'readwrite')
    const objectStore = transaction.objectStore(this.storeName)
    const request = objectStore.delete(id)

    return new Promise((resolve, reject) => {
      request.onerror = () => reject('Error deleting data')
      request.onsuccess = () => resolve()
    })
  }

  async clear() {
    await this.open()
    const transaction = this.db.transaction([this.storeName], 'readwrite')
    const objectStore = transaction.objectStore(this.storeName)
    const request = objectStore.clear()

    return new Promise((resolve, reject) => {
      request.onerror = () => reject('Error clearing store')
      request.onsuccess = () => resolve()
    })
  }
}

// Example usage:
// const storage = new IndexedDBStorage('myDatabase', 'logEntries')
// storage.add({ id: '123', text: 'This is a log entry', created: new Date() })
