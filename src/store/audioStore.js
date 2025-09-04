import { clearStore, saveItem, getItem, deleteItem } from './dbStore';

const STORE_NAME = 'recordings';

export async function clearRecordingsStore() {
  await clearStore(STORE_NAME);
}

export async function saveRecording(key, blob) {
  await saveItem(STORE_NAME, key, blob);
}

export async function getRecording(key) {
  return await getItem(STORE_NAME, key);
}

export async function deleteRecording(key) {
  await deleteItem(STORE_NAME, key);
}