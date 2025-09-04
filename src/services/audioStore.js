import { openDB } from 'idb';

export async function getDb() {
  return openDB('audio-recordings', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('recordings')) {
        db.createObjectStore('recordings');
      }
    }
  });
}

export async function clearRecordingsStore() {
  const db = await getDb();
  const tx = db.transaction('recordings', 'readwrite');
  await tx.objectStore('recordings').clear();
  await tx.done;
  console.log('All recordings cleared from IndexedDB.');
}

export async function saveRecording(key, blob) {
  const db = await getDb();
  await db.put('recordings', blob, key);
}

export async function getRecording(key) {
  const db = await getDb();
  return db.get('recordings', key);
}

export async function deleteRecording(key) {
  const db = await getDb();
  await db.delete('recordings', key);
}