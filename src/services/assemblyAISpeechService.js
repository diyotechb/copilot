import { backendUrl, authHeaders, assertOk } from './backendApi';
import { INPUT_LIMITS } from '@/constants/inputLimits';

export async function sendToAssemblyAI(audioBlob) {
  if (!audioBlob || !audioBlob.size) {
    return { text: '', words: [], sentiment_analysis_results: [] };
  }
  if (audioBlob.size > INPUT_LIMITS.AUDIO_BYTES) {
    const mb = (audioBlob.size / 1024 / 1024).toFixed(1);
    const cap = Math.round(INPUT_LIMITS.AUDIO_BYTES / 1024 / 1024);
    throw new Error(`Recording is ${mb} MB; the upload limit is ${cap} MB.`);
  }

  const form = new FormData();
  form.append('audio', audioBlob, 'answer.webm');

  const response = await fetch(backendUrl('/api/transcribe/audio'), {
    method: 'POST',
    headers: authHeaders(),
    body: form
  });

  await assertOk(response, 'Backend transcription');
  return response.json();
}
