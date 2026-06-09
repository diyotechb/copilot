import interviewApi from '@/services/interviewApi';
import { getDb, deleteItem } from './dbStore';
import { getSetting, saveSetting } from './settingStore';
import {
  deleteSessionRecordings,
  pruneVideosToCap,
  listSessionsWithRecordings,
  MAX_VIDEO_SESSIONS
} from './recordingStore';

export const MAX_ENTRIES = 20;

export async function listAllSessionIds() {
  const ids = await listSessionsWithRecordings();
  return ids.slice().sort().reverse();
}

export async function saveCompletedSession(session) {
  const res = await interviewApi.saveSession(session);
  const id = (res && (res.sessionId || res.id)) || session.id;
  try {
    const recent = await listAllSessionIds();
    await pruneVideosToCap(recent, MAX_VIDEO_SESSIONS);
  } catch (e) { /* best-effort */ }
  return id;
}

export async function updateHistoryEntry(id, patch) {
  if (!id) return;
  try {
    await interviewApi.updateSession(id, patch);
  } catch (e) { /* best-effort */ }
}

export async function listRecentSessions(limit = MAX_ENTRIES) {
  const sessions = await interviewApi.listSessions();
  const list = Array.isArray(sessions) ? sessions : [];
  return typeof limit === 'number' ? list.slice(0, limit) : list;
}

export async function getSessionById(id) {
  try {
    return await interviewApi.getSession(id);
  } catch (e) {
    return null;
  }
}

export async function deleteSession(id) {
  try {
    await interviewApi.deleteSession(id);
  } catch (e) { /* best-effort */ }
  try { await deleteSessionRecordings(id); } catch (e) { /* best-effort */ }
}

// one-time cutover: drop legacy local history/inbox keys (metadata is cloud now)
export async function discardLegacyLocalInterviews() {
  try {
    if (await getSetting('legacyInterviewsDiscarded')) return;
    const db = await getDb();
    const keys = await db.getAllKeys('interviewQA');
    for (const k of keys) {
      if (typeof k === 'string' && (k.startsWith('history:') || k.startsWith('inbox:'))) {
        await deleteItem('interviewQA', k);
      }
    }
    await saveSetting('legacyInterviewsDiscarded', true);
  } catch (e) { /* best-effort */ }
}
