import { saveInterviewQA } from '@/store/interviewStore';
import { backendUrl, authHeaders, assertOk, SYSTEM_UNAVAILABLE_MSG } from './backendApi';

const SSE_STALL_TIMEOUT_MS = 60000;

export async function generateInterviewQA({
  resumeText,
  jobDescriptionText,
  difficulty,
  category,
  preferredKeywords,
  onProgress,
  onUpdate
}) {
  const controller = new AbortController();
  let stallTimer = null;
  let stalled = false;
  const resetStallTimer = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, SSE_STALL_TIMEOUT_MS);
  };

  let response;
  try {
    response = await fetch(backendUrl('/api/interview/generate'), {
      method: 'POST',
      headers: authHeaders({
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      }),
      body: JSON.stringify({
        resumeText,
        jobDescriptionText: jobDescriptionText || '',
        difficulty,
        category,
        preferredKeywords: Array.isArray(preferredKeywords) ? preferredKeywords : []
      }),
      signal: controller.signal
    });
  } catch (e) {
    if (stallTimer) clearTimeout(stallTimer);
    throw e;
  }

  await assertOk(response, 'Interview generation request');
  if (!response.body) {
    throw new Error('Interview generation stream is missing a response body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalQA = null;
  let streamError = null;
  resetStallTimer();

  try {
    while (true) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (e) {
        if (stalled) throw new Error('Interview generation stalled — no activity from the server for 60 seconds.');
        throw e;
      }
      const { value, done } = chunk;
      if (value) {
        resetStallTimer();
        buffer += decoder.decode(value, { stream: true });
      }
      if (done) break;

      let sepIdx;
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        const evt = parseSseBlock(block);
        if (!evt) continue;

        if (evt.event === 'progress' && typeof onProgress === 'function') {
          try { onProgress(JSON.parse(evt.data)); } catch (e) { /* ignore parse */ }
        } else if (evt.event === 'update' && typeof onUpdate === 'function') {
          try { onUpdate(JSON.parse(evt.data)); } catch (e) { /* ignore parse */ }
        } else if (evt.event === 'done') {
          try { finalQA = JSON.parse(evt.data); } catch (e) { streamError = 'Malformed done event'; }
        } else if (evt.event === 'error') {
          try {
            const body = JSON.parse(evt.data);
            streamError = body.message || 'Unknown error';
          } catch (e) {
            streamError = 'Unknown error';
          }
        }
      }
    }
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
  }

  if (streamError) {
    console.warn('[generate] stream error:', streamError);
    throw new Error(SYSTEM_UNAVAILABLE_MSG);
  }
  if (!Array.isArray(finalQA)) throw new Error('Interview generation ended without a final result.');

  await saveInterviewQA(finalQA);
  return finalQA;
}

function parseSseBlock(block) {
  const out = { event: 'message', data: '' };
  const lines = block.split('\n');
  const dataLines = [];
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon);
    const value = line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') out.event = value;
    else if (field === 'data') dataLines.push(value);
  }
  out.data = dataLines.join('\n');
  return out;
}
