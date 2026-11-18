/* ApplyReady local storage: a small IndexedDB wrapper.
   Everything stays in this browser on this device. Nothing is sent to a server.

   Database "applyready", version 1:
     resumes  keyPath "id"   one record per saved resume: { id, name, data, createdAt, updatedAt, schemaVersion }
     meta     keyPath "key"  small app records, e.g. the last opened resume

   If IndexedDB cannot be opened (some private windows, disabled site data, very old browsers),
   the store falls back to memory for this tab and reports `persistent: false`, so the interface
   can say plainly that work will be lost when the tab closes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ApplyReadyStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DB_NAME = 'applyready';
  const DB_VERSION = 1;
  const STORES = { resumes: 'id', meta: 'key' };

  let dbPromise = null;
  let memory = null; // fallback: { storeName: Map }
  let lastError = null;

  function upgrade(db) {
    for (const [name, keyPath] of Object.entries(STORES)) {
      if (!db.objectStoreNames.contains(name)) {
        const store = db.createObjectStore(name, { keyPath });
        if (name === 'resumes') store.createIndex('updatedAt', 'updatedAt');
      }
    }
  }

  function useMemory(err) {
    lastError = err || lastError;
    if (!memory) memory = Object.fromEntries(Object.keys(STORES).map(name => [name, new Map()]));
    return null;
  }

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(resolve => {
      let idb;
      try { idb = typeof indexedDB !== 'undefined' ? indexedDB : null; } catch (e) { idb = null; }
      if (!idb) { resolve(useMemory(new Error('IndexedDB is not available in this browser.'))); return; }
      let request;
      try { request = idb.open(DB_NAME, DB_VERSION); } catch (e) { resolve(useMemory(e)); return; }
      const timer = setTimeout(() => resolve(useMemory(new Error('Browser storage did not respond.'))), 8000);
      request.onupgradeneeded = () => upgrade(request.result);
      request.onsuccess = () => {
        clearTimeout(timer);
        const db = request.result;
        // Another tab upgraded the database: close so it can proceed, reopen on next use.
        db.onversionchange = () => { db.close(); dbPromise = null; };
        // The browser closed the connection (site data cleared while the page is open): reopen on next use.
        db.onclose = () => { dbPromise = null; };
        resolve(db);
      };
      request.onerror = () => { clearTimeout(timer); resolve(useMemory(request.error)); };
      request.onblocked = () => { /* wait: the other tab will close on versionchange */ };
    });
    return dbPromise;
  }

  function wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function tx(storeName, mode, fn) {
    const db = await open();
    if (!db) return fn(null, memory[storeName]);
    return new Promise((resolve, reject) => {
      let result;
      let transaction;
      try { transaction = db.transaction(storeName, mode); } catch (e) { reject(e); return; }
      const store = transaction.objectStore(storeName);
      Promise.resolve(fn(store, null)).then(value => { result = value; }, reject);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Storage transaction aborted'));
    });
  }

  const clone = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

  function get(storeName, key) {
    return tx(storeName, 'readonly', (store, mem) => (store ? wrap(store.get(key)) : clone(mem.get(key))));
  }

  function getAll(storeName) {
    return tx(storeName, 'readonly', (store, mem) => (store ? wrap(store.getAll()) : Array.from(mem.values()).map(clone)));
  }

  function put(storeName, value) {
    return tx(storeName, 'readwrite', (store, mem) => {
      if (store) return wrap(store.put(value));
      mem.set(value[STORES[storeName]], clone(value));
      return value[STORES[storeName]];
    });
  }

  function remove(storeName, key) {
    return tx(storeName, 'readwrite', (store, mem) => (store ? wrap(store.delete(key)) : mem.delete(key)));
  }

  function clear(storeName) {
    return tx(storeName, 'readwrite', (store, mem) => (store ? wrap(store.clear()) : mem.clear()));
  }

  /** Remove the whole database (Storage page, "Delete everything"). */
  async function destroy() {
    const db = await open();
    if (db) db.close();
    dbPromise = null;
    memory = null;
    let idb = null;
    try { idb = indexedDB; } catch (e) { idb = null; }
    if (!idb) return true;
    return new Promise(resolve => {
      const req = idb.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    });
  }

  async function status() {
    await open();
    const out = { persistent: !memory, error: lastError ? String(lastError.message || lastError) : '', usage: null, quota: null, persisted: null };
    try {
      if (typeof navigator !== 'undefined' && navigator.storage) {
        if (navigator.storage.estimate) { const e = await navigator.storage.estimate(); out.usage = e.usage; out.quota = e.quota; }
        if (navigator.storage.persisted) out.persisted = await navigator.storage.persisted();
      }
    } catch (e) { /* estimates are optional */ }
    return out;
  }

  /** Ask the browser not to evict our data under storage pressure. The browser may say no. */
  async function requestPersistence() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
    } catch (e) { /* ignore */ }
    return false;
  }

  return { open, get, getAll, put, remove, clear, destroy, status, requestPersistence, DB_NAME, DB_VERSION };
});
