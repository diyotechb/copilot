// Batch transcription orchestrator.
//
// Pulls the per-question audio blobs out of recordingStore, sends each one
// to AssemblyAI (sendToAssemblyAI), and writes results back into the
// transcripts array via interviewStore. Replaces the per-answer call that
// used to live inside AnswerRecorder so we only spend on AssemblyAI when
// the candidate actually finished the interview.
//
// Behaviour:
// - Concurrency-capped (default 5 in-flight) so we don't blast the API or
//   the user's upload bandwidth.
// - Skips slots that are already a real (non-pending) transcript, so the
//   job is safe to re-run as a recovery action ("Transcribe now").
// - Reports progress through an onProgress callback for UI status.
// - Sets transcriptionInProcess to true on start, false on done. The
//   Summary page polls that flag to decide whether to keep waiting.

import { sendToAssemblyAI } from './assemblyAISpeechService';
import { getRecordingForSession } from '@/store/recordingStore';
import {
  getTranscripts,
  saveTranscripts,
  saveTranscriptionStatus
} from '@/store/interviewStore';

const DEFAULT_CONCURRENCY = 5;

function isPending(t) {
  return !!(t && typeof t === 'object' && t.pending);
}

function isSkipped(t) {
  return !!(t && typeof t === 'object' && t.skipped);
}

function hasRealText(t) {
  if (!t) return false;
  if (typeof t === 'string') return t !== '' && t !== '[Transcription error]';
  if (typeof t === 'object') return !!t.text || (Array.isArray(t.words) && t.words.length > 0);
  return false;
}

// Decide which question indexes still need transcription. We treat a slot
// as "needs transcription" when:
//   - the slot is empty/undefined,
//   - the slot is the {pending:true} sentinel placed by AnswerRecorder, or
//   - the slot is a transcription error (so a retry can recover it).
// {skipped: true} slots are intentionally left alone — they represent
// answers the user did not speak, so there's no audio to transcribe.
function indexesNeedingTranscription(transcripts, totalQuestions) {
  const need = [];
  for (let i = 0; i < totalQuestions; i++) {
    const t = transcripts[i];
    if (isSkipped(t)) continue;
    if (t === undefined || t === null) { need.push(i); continue; }
    if (typeof t === 'string' && t === '[Transcription error]') { need.push(i); continue; }
    if (isPending(t)) { need.push(i); continue; }
    if (!hasRealText(t)) {
      // Empty {text:'', words:[]} — could be "no spoken audio" already
      // resolved successfully. Don't re-transcribe unless explicitly
      // marked pending.
      continue;
    }
  }
  return need;
}

async function transcribeOne(idx, sessionId) {
  // getRecordingForSession looks at the session-scoped key first and falls
  // back to the legacy un-scoped key, so the pre-scoping interview can
  // still be recovered from the Summary "Transcribe answers" button.
  const blob = await getRecordingForSession(sessionId, idx);
  if (!blob || !blob.size) {
    return { text: '', words: [], sentiment_analysis_results: [] };
  }
  return await sendToAssemblyAI(blob);
}

// Writes a single result into the transcripts array. Re-reads the latest
// array each time so concurrent writes don't clobber each other when the
// job runs in the background while the user is doing something else.
async function writeSlot(idx, value) {
  const latest = (await getTranscripts()) || [];
  latest[idx] = value;
  await saveTranscripts(latest);
}

export async function transcribeAllAnswers({
  totalQuestions,
  sessionId = '',
  concurrency = DEFAULT_CONCURRENCY,
  onProgress
} = {}) {
  if (!totalQuestions || totalQuestions < 1) return { processed: 0, failed: 0 };

  const initial = (await getTranscripts()) || [];
  const queue = indexesNeedingTranscription(initial, totalQuestions);
  if (!queue.length) {
    if (typeof onProgress === 'function') {
      onProgress({ done: 0, failed: 0, total: 0, complete: true });
    }
    return { processed: 0, failed: 0 };
  }

  await saveTranscriptionStatus(true);
  const total = queue.length;
  let done = 0;
  let failed = 0;
  let cursor = 0;

  // Emit an initial "starting" tick so the UI can show "0 / N" right away.
  if (typeof onProgress === 'function') {
    onProgress({ done: 0, failed: 0, total, complete: false });
  }

  // Simple sliding-window worker pool. Each worker pulls from the shared
  // cursor and processes one job at a time. Bounds are enforced by the
  // number of workers we spin up.
  const workerCount = Math.min(concurrency, total);

  async function worker() {
    while (true) {
      const localIdx = cursor++;
      if (localIdx >= total) return;
      const qIdx = queue[localIdx];
      try {
        const transcript = await transcribeOne(qIdx, sessionId);
        await writeSlot(qIdx, transcript);
      } catch (e) {
        console.error('[batchTranscribe] failed for Q' + qIdx + ':', e);
        failed += 1;
        // Persist the failure marker so the Summary page knows this slot
        // didn't land. The user can hit "Transcribe now" to retry.
        await writeSlot(qIdx, '[Transcription error]');
      } finally {
        done += 1;
        if (typeof onProgress === 'function') {
          onProgress({ done, failed, total, complete: false });
        }
      }
    }
  }

  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  await saveTranscriptionStatus(false);
  if (typeof onProgress === 'function') {
    onProgress({ done, failed, total, complete: true });
  }
  return { processed: done - failed, failed };
}

// Cheap check the Summary page can call to decide whether a "Transcribe
// now" recovery button should be offered — i.e. there's at least one
// pending or errored slot waiting on a real transcript.
export async function hasPendingTranscriptions(totalQuestions) {
  const transcripts = (await getTranscripts()) || [];
  return indexesNeedingTranscription(transcripts, totalQuestions).length > 0;
}
