// LRU-style store for the last 5 completed interview sessions.
// Each entry is keyed `history:<id>` inside the existing `interviewQA`
// IndexedDB store, so we don't have to bump the DB schema version (which
// could risk data loss for existing users).
//
// Stored shape per entry:
// {
//   id: string,                  // unique session id
//   savedAt: ISO string,         // timestamp
//   difficulty: string,
//   category: string,
//   analysisMode: 'none' | 'basic' | 'full',
//   qaList: [...],               // questions + reference answers
//   transcripts: [...],          // candidate's spoken answers
//   questionTimestamps: [...],   // for video seeking (if rerendered later)
//   llmAnalysis: object | null   // populated for completed Int/Adv with full mode
// }

import { saveItem, getItem, deleteItem, getDb } from './dbStore';
import { deleteSessionRecordings, pruneRecordingsToActiveSessions, pruneVideosToCap, MAX_VIDEO_SESSIONS } from './recordingStore';

const STORE = 'interviewQA';
const PREFIX = 'history:';
// Admin "inbox": sessions imported from another user's exported JSON. Lives
// in the same IndexedDB store but under a separate prefix so it never goes
// through the LRU prune below — an admin reviewing 100 submissions can't
// afford to silently lose 95 of them to a 20-entry cap.
const INBOX_PREFIX = 'inbox:';
export const MAX_ENTRIES = 20;

function newSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function idFromKey(key) {
  return typeof key === 'string' && key.startsWith(PREFIX)
    ? key.slice(PREFIX.length)
    : null;
}

// IDs of every history entry currently on disk, newest first. Used by the
// recordings prune so we never delete audio belonging to a saved session.
export async function listAllSessionIds() {
  const historyIds = (await listEntryKeys()).map(idFromKey).filter(Boolean);
  const inboxIds = (await listInboxKeys()).map(k => k.slice(INBOX_PREFIX.length)).filter(Boolean);
  return [...historyIds, ...inboxIds];
}

async function listEntryKeys() {
  const db = await getDb();
  const allKeys = await db.getAllKeys(STORE);
  return allKeys
    .filter(k => typeof k === 'string' && k.startsWith(PREFIX))
    .sort()
    .reverse(); // newest first (timestamps embedded in the id)
}

async function listInboxKeys() {
  const db = await getDb();
  const allKeys = await db.getAllKeys(STORE);
  return allKeys
    .filter(k => typeof k === 'string' && k.startsWith(INBOX_PREFIX))
    .sort()
    .reverse();
}

export async function saveCompletedSession(session) {
  const id = session.id || newSessionId();
  const entry = {
    id,
    savedAt: new Date().toISOString(),
    candidateName: session.candidateName || '',
    preferredKeywords: Array.isArray(session.preferredKeywords) ? session.preferredKeywords : [],
    difficulty: session.difficulty || '',
    category: session.category || 'All',
    analysisMode: session.analysisMode || 'none',
    qaList: Array.isArray(session.qaList) ? session.qaList : [],
    transcripts: Array.isArray(session.transcripts) ? session.transcripts : [],
    questionTimestamps: Array.isArray(session.questionTimestamps) ? session.questionTimestamps : [],
    completed: typeof session.completed === 'boolean' ? session.completed : true,
    llmAnalysis: session.llmAnalysis || null
  };
  await saveItem(STORE, `${PREFIX}${id}`, entry);
  await pruneOld();
  return id;
}

// Update an existing history entry (e.g. after the LLM analysis lands).
export async function updateHistoryEntry(id, patch) {
  const key = `${PREFIX}${id}`;
  const existing = await getItem(STORE, key);
  if (!existing) return;
  const merged = { ...existing, ...patch };
  await saveItem(STORE, key, merged);
}

export async function listRecentSessions(limit = MAX_ENTRIES) {
  const keys = await listEntryKeys();
  const sliced = keys.slice(0, limit);
  const out = [];
  for (const k of sliced) {
    const entry = await getItem(STORE, k);
    if (entry) out.push(entry);
  }
  return out;
}

export async function getSessionById(id) {
  return getItem(STORE, `${PREFIX}${id}`);
}

export async function deleteSession(id) {
  await deleteItem(STORE, `${PREFIX}${id}`);
  // The history entry and the per-question audio belong together — drop
  // both atomically so a stale entry never points at missing audio (or
  // worse, audio from a different session that happens to share an idx).
  try { await deleteSessionRecordings(id); } catch (e) { /* best-effort */ }
}

// ─── Inbox: imported sessions from other users (admin review queue) ───
// The text entry here holds only the analysis-relevant fields; a .zip import
// also restores per-question audio into recordingStore (keyed by this id) so
// staff can transcribe. Inbox entries live in a separate keyspace from
// `history:` and are NEVER pruned — the admin chooses when to delete each one.

export async function saveImportedSession(payload) {
  if (!payload || !payload.id) {
    throw new Error('Imported session is missing an id.');
  }
  const entry = {
    id: payload.id,
    savedAt: payload.savedAt || new Date().toISOString(),
    importedAt: new Date().toISOString(),
    candidateName: payload.candidateName || '',
    preferredKeywords: Array.isArray(payload.preferredKeywords) ? payload.preferredKeywords : [],
    difficulty: payload.difficulty || '',
    category: payload.category || 'All',
    analysisMode: payload.analysisMode || 'none',
    qaList: Array.isArray(payload.qaList) ? payload.qaList : [],
    transcripts: Array.isArray(payload.transcripts) ? payload.transcripts : [],
    questionTimestamps: Array.isArray(payload.questionTimestamps) ? payload.questionTimestamps : [],
    completed: typeof payload.completed === 'boolean' ? payload.completed : true,
    llmAnalysis: payload.llmAnalysis || null
  };
  await saveItem(STORE, `${INBOX_PREFIX}${payload.id}`, entry);
  return payload.id;
}

export async function listInboxSessions() {
  const keys = await listInboxKeys();
  const out = [];
  for (const k of keys) {
    const entry = await getItem(STORE, k);
    if (entry) out.push(entry);
  }
  return out;
}

export async function getInboxSession(id) {
  return getItem(STORE, `${INBOX_PREFIX}${id}`);
}

export async function deleteInboxSession(id) {
  await deleteItem(STORE, `${INBOX_PREFIX}${id}`);
  // Drop the imported audio too, otherwise it's orphaned in recordingStore.
  try { await deleteSessionRecordings(id); } catch (e) { /* best-effort */ }
}

async function pruneOld() {
  const keys = await listEntryKeys();
  if (keys.length > MAX_ENTRIES) {
    const toDelete = keys.slice(MAX_ENTRIES);
    for (const k of toDelete) {
      const id = idFromKey(k);
      await deleteItem(STORE, k);
      if (id) {
        try { await deleteSessionRecordings(id); } catch (e) { /* best-effort */ }
      }
    }
  }
  // Drop audio (and any per-session video) belonging to a session no
  // longer in history. Catches recordings whose history entry was deleted
  // out from under them or never written through saveCompletedSession.
  // Legacy un-scoped `Recording_<n>` keys are preserved here on purpose —
  // they belong to the one pre-scoping interview and the user may still
  // want to recover it via the Transcribe-answers button.
  try {
    const remaining = await listAllSessionIds();
    await pruneRecordingsToActiveSessions(remaining);
    // Independent video cap: keep videos for the MOST RECENT N sessions
    // only, even though the metadata cap is higher. Videos are heavy
    // (50-300 MB each on long Advanced interviews) and would otherwise
    // blow past browser quotas inside ~5 long sessions.
    await pruneVideosToCap(remaining, MAX_VIDEO_SESSIONS);
  } catch (e) { /* best-effort */ }
}
