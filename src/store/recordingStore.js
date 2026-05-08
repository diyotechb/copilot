import { clearStore, saveItem, getItem, deleteItem, getAllKeysFromStore } from './dbStore';

const STORE_NAME = 'recordings';
const VIDEO_KEY = 'lastRecordedVideoBlob';

// Session-scoped audio key: `Recording_${sessionId}_${idx}`. Older entries
// from before this scheme are un-scoped (`Recording_${idx}`); the read path
// falls back to those so the user's pre-fix interview is still recoverable.
const LEGACY_KEY_RE = /^Recording_\d+$/;
function scopedKey(sessionId, idx) {
  return `Recording_${sessionId}_${idx}`;
}

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

export async function saveVideoRecording(blob) {
  await saveItem(STORE_NAME, VIDEO_KEY, blob);
}

export async function getVideoRecording() {
  return await getItem(STORE_NAME, VIDEO_KEY);
}

// Save audio for a specific session + question index.
export async function saveRecordingForSession(sessionId, idx, blob) {
  if (!sessionId) {
    // No sessionId yet (shouldn't happen post-fix, but don't lose the audio).
    await saveItem(STORE_NAME, `Recording_${idx}`, blob);
    return;
  }
  await saveItem(STORE_NAME, scopedKey(sessionId, idx), blob);
}

// Read audio for a session+idx, with fallback to the legacy un-scoped key
// so interviews recorded before session scoping was added still load.
export async function getRecordingForSession(sessionId, idx) {
  if (sessionId) {
    const scoped = await getItem(STORE_NAME, scopedKey(sessionId, idx));
    if (scoped) return scoped;
  }
  return await getItem(STORE_NAME, `Recording_${idx}`);
}

// Remove every audio blob belonging to a session. Called from
// deleteSession() and from pruneRecordingsToActiveSessions().
export async function deleteSessionRecordings(sessionId) {
  if (!sessionId) return 0;
  const prefix = `Recording_${sessionId}_`;
  const keys = await getAllKeysFromStore(STORE_NAME);
  let deleted = 0;
  for (const k of keys) {
    if (typeof k === 'string' && k.startsWith(prefix)) {
      await deleteItem(STORE_NAME, k);
      deleted += 1;
    }
  }
  return deleted;
}

// Drop any recording whose session is no longer in `activeSessionIds`.
// Legacy un-scoped `Recording_<n>` entries are PRESERVED by default — they
// belong to the one interview that ran before scoping existed and we never
// want to wipe them ahead of a recovery transcribe. Pass `keepLegacy:false`
// only from explicit cleanup paths once the legacy session is known-safe.
export async function pruneRecordingsToActiveSessions(activeSessionIds, { keepLegacy = true } = {}) {
  const active = new Set(activeSessionIds || []);
  const keys = await getAllKeysFromStore(STORE_NAME);
  let removed = 0;
  for (const k of keys) {
    if (typeof k !== 'string') continue;
    if (k === VIDEO_KEY) continue;
    if (LEGACY_KEY_RE.test(k)) {
      if (!keepLegacy) {
        await deleteItem(STORE_NAME, k);
        removed += 1;
      }
      continue;
    }
    const m = k.match(/^Recording_(.+?)_\d+$/);
    if (!m) continue;
    const sid = m[1];
    if (!active.has(sid)) {
      await deleteItem(STORE_NAME, k);
      removed += 1;
    }
  }
  return removed;
}

// Best-effort browser storage usage report. Logs to console; callers can
// also use the returned object. Called once at app start so the dev/owner
// can see how IndexedDB is growing without opening DevTools.
export async function logStorageEstimate(label = 'app start') {
  try {
    if (!navigator || !navigator.storage || !navigator.storage.estimate) {
      return null;
    }
    const est = await navigator.storage.estimate();
    const used = est.usage || 0;
    const quota = est.quota || 0;
    const pct = quota ? ((used / quota) * 100).toFixed(2) : '0';
    const mb = (n) => (n / (1024 * 1024)).toFixed(2);
    // eslint-disable-next-line no-console
    console.info(
      `[storage:${label}] used=${mb(used)} MB / quota=${mb(quota)} MB (${pct}%)`
    );
    return { used, quota, percent: Number(pct) };
  } catch (e) {
    return null;
  }
}
