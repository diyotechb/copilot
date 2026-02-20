import { clearStore, saveItem, getItem, deleteItem } from './dbStore';

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

export async function deleteInterviewQA(key) {
  await deleteItem(QA_STORE, key);
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

export async function deleteTranscript() {
  await deleteItem(TRANSCRIPT_STORE, "transcripts");
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
  console.log("[DEBUG] Transcription status is undefined, defaulting to true");
  return true;
}