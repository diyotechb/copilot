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
import { deleteSessionRecordings, pruneRecordingsToActiveSessions } from './recordingStore';

const STORE = 'interviewQA';
const PREFIX = 'history:';
export const MAX_ENTRIES = 5;

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
  const keys = await listEntryKeys();
  return keys.map(idFromKey).filter(Boolean);
}

async function listEntryKeys() {
  const db = await getDb();
  const allKeys = await db.getAllKeys(STORE);
  return allKeys
    .filter(k => typeof k === 'string' && k.startsWith(PREFIX))
    .sort()
    .reverse(); // newest first (timestamps embedded in the id)
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
  // Also drop any audio that belongs to a session no longer in history.
  // Catches recordings whose history entry was deleted out from under
  // them (or never written through saveCompletedSession). Legacy un-scoped
  // `Recording_<n>` keys are preserved here on purpose — they belong to
  // the one pre-scoping interview and the user may still want to recover
  // it via the Transcribe-answers button.
  try {
    const remaining = (await listEntryKeys()).map(idFromKey).filter(Boolean);
    await pruneRecordingsToActiveSessions(remaining);
  } catch (e) { /* best-effort */ }
}
