import { openDB } from 'idb';

export const APP_DB_NAME = 'app-data';

export async function getDb() {
  return openDB(APP_DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('recordings')) {
        db.createObjectStore('recordings');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
      if (!db.objectStoreNames.contains('interviewQA')) {
        db.createObjectStore('interviewQA');
      }
      if (!db.objectStoreNames.contains('transcripts')) {
        db.createObjectStore('transcripts');
      }
    }
  });
}

export async function clearStore(storeName) {
  const db = await getDb();
  const tx = db.transaction(storeName, 'readwrite');
  await tx.objectStore(storeName).clear();
  await tx.done;
}

export async function saveItem(storeName, key, value) {
  const db = await getDb();
  await db.put(storeName, value, key);
}

export async function getItem(storeName, key) {
  const db = await getDb();
  return db.get(storeName, key);
}

export async function deleteItem(storeName, key) {
  const db = await getDb();
  await db.delete(storeName, key);
}