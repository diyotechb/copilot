import { clearStore, saveItem, getItem, deleteItem } from './dbStore';

const STORE_NAME = 'settings';

export async function clearSettingsStore() {
  await clearStore(STORE_NAME);
}

export async function saveSetting(key, value) {
  await saveItem(STORE_NAME, key, value);
}

export async function getSetting(key) {
  return await getItem(STORE_NAME, key);
}

export async function deleteSetting(key) {
  await deleteItem(STORE_NAME, key);
}