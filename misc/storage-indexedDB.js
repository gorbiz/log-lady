// complete untested, written by Chat-GPT 4 2023-12-13

function IndexedDBStorage(dbName, storeName) {
  let db = null

  async function open() {
    if (db) return db

    const request = indexedDB.open(dbName, 1)
    request.onupgradeneeded = event => {
      const db = event.target.result
      db.createObjectStore(storeName, { keyPath: 'id' })
    }

    db = await new Promise((resolve, reject) => {
      request.onerror = () => reject('IndexedDB error')
      request.onsuccess = () => resolve(request.result)
    })

    return db
  }

  async function get() {
    await open()
    const transaction = db.transaction([storeName], 'readonly')
    const objectStore = transaction.objectStore(storeName)
    const request = objectStore.getAll()

    return new Promise((resolve, reject) => {
      request.onerror = () => reject('Error fetching data')
      request.onsuccess = () => resolve(request.result)
    })
  }

  async function add(entry) {
    await open()
    const transaction = db.transaction([storeName], 'readwrite')
    const objectStore = transaction.objectStore(storeName)
    const request = objectStore.add(entry)

    return new Promise((resolve, reject) => {
      request.onerror = () => reject('Error adding data')
      request.onsuccess = () => resolve()
    })
  }

  async function remove(id) {
    await open()
    const transaction = db.transaction([storeName], 'readwrite')
    const objectStore = transaction.objectStore(storeName)
    const request = objectStore.delete(id)

    return new Promise((resolve, reject) => {
      request.onerror = () => reject('Error deleting data')
      request.onsuccess = () => resolve()
    })
  }

  async function clear() {
    await open()
    const transaction = db.transaction([storeName], 'readwrite')
    const objectStore = transaction.objectStore(storeName)
    const request = objectStore.clear()

    return new Promise((resolve, reject) => {
      request.onerror = () => reject('Error clearing store')
      request.onsuccess = () => resolve()
    })
  }

  return { get, add, remove, clear }
}

// Example usage:
// const storage = IndexedDBStorage('myDatabase', 'logEntries')
// storage.add({ id: '123', text: 'This is a log entry', created: new Date() })
