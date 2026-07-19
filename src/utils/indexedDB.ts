const DB_NAME = 'ConcertMediaDB'
const DB_VERSION = 1
const STORE_NAME = 'media'

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const saveLocalMedia = async (id: string, dataUrl: string): Promise<void> => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({ id, dataUrl })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Failed to save to IndexedDB:', err)
  }
}

export const getLocalMedia = async (id: string): Promise<string | null> => {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(id)
      req.onsuccess = () => {
        resolve(req.result ? req.result.dataUrl : null)
      }
      req.onerror = () => resolve(null)
    })
  } catch (err) {
    console.error('Failed to get from IndexedDB:', err)
    return null
  }
}

export const deleteLocalMedia = async (id: string): Promise<void> => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (err) {
    console.error('Failed to delete from IndexedDB:', err)
  }
}
