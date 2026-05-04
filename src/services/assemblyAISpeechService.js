import { APP_CONFIG } from '@/constants/appConfig';

export async function sendToAssemblyAI(audioBlob) {
  const apiKey = process.env.VUE_APP_ASSEMBLY_AI_TOKEN;
  if (!apiKey) {
    console.error('********************************************************************************');
    console.error('ERROR: AssemblyAI Token (VUE_APP_ASSEMBLY_AI_TOKEN) is MISSING!');
    console.error('Transcription for recorded audio will FAIL.');
    console.error('Please provide the token in your .env file or environment.');
    console.error('********************************************************************************');
    throw new Error('AssemblyAI token not found. Recorded transcription cannot proceed.');
  }

  // Step 1: Upload audio file
  const uploadRes = await fetch(APP_CONFIG.SERVICES.ASSEMBLY_AI.UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Authorization': apiKey
    },
    body: audioBlob
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload audio to AssemblyAI.');
  }

  const uploadData = await uploadRes.json();
  const audioUrl = uploadData.upload_url;

  // Step 2: Request transcription.
  // - `speech_models` is now required by the API.
  // - `sentiment_analysis` enables the rich highlights / per-word confidence
  //   the summary view renders.
  // - `language_code: 'en'` pins the language and disables auto-detection,
  //   which would otherwise crash the job when the recording is silent /
  //   has no speech ("language_detection cannot be performed on files with
  //   no spoken audio").
  const transcriptRes = await fetch(APP_CONFIG.SERVICES.ASSEMBLY_AI.TRANSCRIPT_URL, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speech_models: ['universal-2'],
      sentiment_analysis: true,
      language_code: 'en'
    })
  });

  if (!transcriptRes.ok) {
    let detail = '';
    try { detail = (await transcriptRes.json()).error || ''; } catch (e) { /* ignore */ }
    throw new Error(`Failed to start transcription on AssemblyAI.${detail ? ' ' + detail : ''}`);
  }

  const transcriptData = await transcriptRes.json();

  // Step 3: Poll for transcript
  const maxRetries = APP_CONFIG.SERVICES.ASSEMBLY_AI.MAX_POLLING_RETRIES;
  const pollInterval = APP_CONFIG.SERVICES.ASSEMBLY_AI.POLLING_INTERVAL_MS;

  for (let i = 0; i < maxRetries; i++) {
    await new Promise(res => setTimeout(res, pollInterval));

    const pollRes = await fetch(`${APP_CONFIG.SERVICES.ASSEMBLY_AI.TRANSCRIPT_URL}/${transcriptData.id}`, {
      headers: { 'Authorization': apiKey }
    });

    const pollData = await pollRes.json();

    if (pollData.status === 'completed') {
      // Return the full transcript object so the summary view can compute
      // word counts, pace, fillers, sentiment, and per-word confidence.
      // Callers that only need text can read `result.text`.
      return pollData;
    } else if (pollData.status === 'error') {
      // If the recording is silent, return an empty transcript object
      // instead of throwing — the summary view already renders that as
      // "No spoken answer was recorded for this question."
      const msg = (pollData.error || '').toLowerCase();
      if (msg.includes('no spoken audio') || msg.includes('no speech')) {
        return { text: '', words: [], sentiment_analysis_results: [] };
      }
      throw new Error(`AssemblyAI Error: ${pollData.error}`);
    }
  }

  throw new Error('AssemblyAI transcription timed out.');
}
