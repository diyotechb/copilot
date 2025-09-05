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
  return await getItem(QA_STORE, 'interviewQA');
}

export async function deleteInterviewQA(key) {
  await deleteItem(QA_STORE, key);
}

// Transcript functions
export async function clearTranscriptsStore() {
  await clearStore(TRANSCRIPT_STORE);
}

<<<<<<< HEAD
export async function saveTranscript(key, value) {
  await saveItem(TRANSCRIPT_STORE, key, value);
}

export async function getTranscript(key) {
  return await getItem(TRANSCRIPT_STORE, key);
}

export async function deleteTranscript(key) {
  await deleteItem(TRANSCRIPT_STORE, key);
=======
export async function saveTranscripts(value) {
  await saveItem(TRANSCRIPT_STORE, "transcripts", value);
}

export async function getTranscripts() {
  return await getItem(TRANSCRIPT_STORE, "transcripts");
}

export async function deleteTranscript() {
  await deleteItem(TRANSCRIPT_STORE, "transcripts");
>>>>>>> 684fce0 (Implemented storage in IndexDB and initial implementation of Interview Level: Beginner and Intermediate)
}

export async function saveTranscriptionStatus(value) {
  await saveItem(QA_STORE, 'transcriptionInProcess', value);
}

// Get transcriptionInProcess flag
export async function getTranscriptionStatus() {
  return await getItem(QA_STORE, 'transcriptionInProcess');
}