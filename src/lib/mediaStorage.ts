/**
 * Local-first storage for the heavy photo/video blobs that accompany a
 * manifestation. Metadata and a small thumbnail live in Turso; the full file
 * never leaves the device unless a cloud provider is added later.
 */

const DB_NAME = 'manifest_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media';

const isBrowser = () => typeof window !== 'undefined' && 'indexedDB' in window;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (!isBrowser()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

export async function putMedia(storageKey: string, blob: Blob): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(
        {
          blob,
          mimeType: blob.type,
          byteSize: blob.size,
          savedAt: new Date().toISOString(),
        },
        storageKey,
      );
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getMedia(storageKey: string): Promise<Blob | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(storageKey);
      request.onsuccess = () => {
        const value = request.result;
        if (value instanceof Blob) {
          resolve(value);
          return;
        }
        if (value?.blob instanceof Blob) {
          resolve(value.blob);
          return;
        }
        resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function hasMedia(storageKey: string): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getKey(storageKey);
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function deleteMedia(storageKey: string): Promise<boolean> {
  if (!storageKey) return false;
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(storageKey);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
