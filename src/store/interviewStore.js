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

export async function getResumeText() {
  const result = await getItem(QA_STORE, 'resumeText');
  if (result) return result;
  return '';
}

export async function saveResumeText(value) {
  await saveItem(QA_STORE, 'resumeText', value);
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

