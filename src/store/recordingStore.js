import { clearStore, saveItem, getItem, deleteItem, getAllKeysFromStore } from './dbStore';

const STORE_NAME = 'recordings';
// Legacy single-blob video key from before session-scoping. Kept as a constant
// only so a future migration can target it explicitly; no active code path
// reads or writes it any more.
const VIDEO_KEY = 'lastRecordedVideoBlob';

// Video retention cap. Sized below the history cap (5) on purpose: video is
// orders of magnitude larger than audio/transcripts, and 5 × 200MB videos
// would routinely hit browser quotas on Advanced (~1 hr) sessions. Audio,
// transcripts, and analysis still live on the full 5 most-recent history
// entries — only the video itself is purged when this cap is exceeded.
export const MAX_VIDEO_SESSIONS = 3;

// Session-scoped audio key: `Recording_${sessionId}_${idx}`. Older entries
// from before this scheme are un-scoped (`Recording_${idx}`); the read path
// falls back to those so the user's pre-fix interview is still recoverable.
const LEGACY_KEY_RE = /^Recording_\d+$/;
function scopedKey(sessionId, idx) {
  return `Recording_${sessionId}_${idx}`;
}

// Session-scoped video key: `Video_${sessionId}`. One blob per session.
function videoKey(sessionId) {
  return `Video_${sessionId}`;
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

// Legacy single-blob helpers. Kept around so any stale import still
// resolves; new code paths should use the per-session helpers below.
export async function saveVideoRecording(blob) {
  await saveItem(STORE_NAME, VIDEO_KEY, blob);
}

export async function getVideoRecording() {
  return await getItem(STORE_NAME, VIDEO_KEY);
}

export async function saveVideoForSession(sessionId, blob) {
  if (!sessionId) {
    // Defensive: don't lose the video if sessionId is somehow missing.
    await saveItem(STORE_NAME, VIDEO_KEY, blob);
    return;
  }
  await saveItem(STORE_NAME, videoKey(sessionId), blob);
}

export async function getVideoForSession(sessionId) {
  if (!sessionId) return null;
  return await getItem(STORE_NAME, videoKey(sessionId));
}

export async function hasVideoForSession(sessionId) {
  if (!sessionId) return false;
  const keys = await getAllKeysFromStore(STORE_NAME);
  return keys.includes(videoKey(sessionId));
}

export async function deleteVideoForSession(sessionId) {
  if (!sessionId) return;
  await deleteItem(STORE_NAME, videoKey(sessionId));
}

// Returns the set of sessionIds that currently have a video blob on disk.
export async function listSessionsWithVideo() {
  const keys = await getAllKeysFromStore(STORE_NAME);
  const out = [];
  for (const k of keys) {
    if (typeof k !== 'string') continue;
    const m = k.match(/^Video_(.+)$/);
    if (m) out.push(m[1]);
  }
  return out;
}

// Drop the oldest videos beyond MAX_VIDEO_SESSIONS, where "oldest" means
// the session id appears later in `recentSessionIdsNewestFirst`. Audio,
// transcripts, and analysis are NOT touched here — only videos.
// Returns the list of sessionIds whose video was deleted.
export async function pruneVideosToCap(recentSessionIdsNewestFirst, cap = MAX_VIDEO_SESSIONS) {
  const recent = (recentSessionIdsNewestFirst || []).filter(Boolean);
  const allowed = new Set(recent.slice(0, cap));
  const sessionsWithVideo = await listSessionsWithVideo();
  const purged = [];
  for (const sid of sessionsWithVideo) {
    if (!allowed.has(sid)) {
      await deleteVideoForSession(sid);
      purged.push(sid);
    }
  }
  return purged;
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

// Remove every audio blob AND the video blob belonging to a session.
// Called from deleteSession() and from pruneRecordingsToActiveSessions().
export async function deleteSessionRecordings(sessionId) {
  if (!sessionId) return 0;
  const audioPrefix = `Recording_${sessionId}_`;
  const vKey = videoKey(sessionId);
  const keys = await getAllKeysFromStore(STORE_NAME);
  let deleted = 0;
  for (const k of keys) {
    if (typeof k !== 'string') continue;
    if (k.startsWith(audioPrefix) || k === vKey) {
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
    // Audio: Recording_<sid>_<idx>
    const audioMatch = k.match(/^Recording_(.+?)_\d+$/);
    if (audioMatch) {
      if (!active.has(audioMatch[1])) {
        await deleteItem(STORE_NAME, k);
        removed += 1;
      }
      continue;
    }
    // Video: Video_<sid>
    const videoMatch = k.match(/^Video_(.+)$/);
    if (videoMatch) {
      if (!active.has(videoMatch[1])) {
        await deleteItem(STORE_NAME, k);
        removed += 1;
      }
      continue;
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
