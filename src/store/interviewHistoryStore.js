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

const STORE = 'interviewQA';
const PREFIX = 'history:';
const MAX_ENTRIES = 5;

function newSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
}

async function pruneOld() {
  const keys = await listEntryKeys();
  if (keys.length <= MAX_ENTRIES) return;
  const toDelete = keys.slice(MAX_ENTRIES);
  for (const k of toDelete) {
    await deleteItem(STORE, k);
  }
}
