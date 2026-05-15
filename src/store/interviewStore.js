import { clearStore, saveItem, getItem } from './dbStore';

const QA_STORE = 'interviewQA';
const TRANSCRIPT_STORE = 'transcripts';

// Interview QA functions
export async function clearInterviewQAStore() {
  await clearStore(QA_STORE);
}

export async function saveInterviewQA(value) {
  await saveItem(QA_STORE, 'interviewQA', value);
}

export async function getInterviewQA() {
  const result = await getItem(QA_STORE, 'interviewQA');
  // Always return an array
  if (Array.isArray(result)) return result;
  if (result) {
    try {
      const parsed = JSON.parse(result);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

// Transcript functions
export async function clearTranscriptsStore() {
  await clearStore(TRANSCRIPT_STORE);
}

export async function saveTranscripts(value) {
  await saveItem(TRANSCRIPT_STORE, "transcripts", value);
}

export async function getTranscripts() {
  const result = await getItem(TRANSCRIPT_STORE, "transcripts");
  // Always return an array
  if (Array.isArray(result)) return result;
  if (result) {
    try {
      const parsed = JSON.parse(result);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

export async function saveTranscriptionStatus(value) {
  await saveItem(QA_STORE, 'transcriptionInProcess', value);
}

export async function saveQuestionTimestamps(value) {
  await saveItem(QA_STORE, 'questionTimestamps', value);
}

export async function getQuestionTimestamps() {
  const result = await getItem(QA_STORE, 'questionTimestamps');
  return Array.isArray(result) ? result : [];
}

// Get transcriptionInProcess flag
export async function getTranscriptionStatus() {
  const result = await getItem(QA_STORE, 'transcriptionInProcess');
  // Always return true or false
  if (typeof result === 'boolean') return result;
  if (typeof result === 'string') {
    if (result === 'true') return true;
    if (result === 'false') return false;
  }
  return true;
}

// Session metadata: difficulty, category, analysisMode, completed flag, etc.
// Used to drive Summary screen rendering and history saving.
export async function saveInterviewMeta(meta) {
  await saveItem(QA_STORE, 'interviewMeta', meta);
}

export async function getInterviewMeta() {
  const result = await getItem(QA_STORE, 'interviewMeta');
  if (result && typeof result === 'object') return result;
  if (typeof result === 'string') {
    try { return JSON.parse(result); } catch (e) { return {}; }
  }
  return {};
}

export async function setInterviewCompleted(completed = true) {
  const meta = await getInterviewMeta();
  meta.completed = !!completed;
  meta.endedAt = new Date().toISOString();
  await saveInterviewMeta(meta);
}

// Session id is generated once at interview start and reused for the
// recording keys, the history entry id, and any later recovery work. Read
// existing meta first so a mid-interview reload doesn't mint a new id and
// orphan the audio already on disk.
export async function getOrCreateInterviewSessionId() {
  const meta = await getInterviewMeta();
  if (meta && typeof meta.sessionId === 'string' && meta.sessionId) {
    return meta.sessionId;
  }
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  meta.sessionId = sessionId;
  if (!meta.startedAt) meta.startedAt = new Date().toISOString();
  await saveInterviewMeta(meta);
  return sessionId;
}

// Update the live session's analysis mode after the user toggles it on the
// Summary screen. Safe to call when no live meta exists — just writes.
export async function setAnalysisMode(mode) {
  const meta = await getInterviewMeta();
  meta.analysisMode = mode;
  await saveInterviewMeta(meta);
}