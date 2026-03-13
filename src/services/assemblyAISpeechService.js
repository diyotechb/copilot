import { APP_CONFIG } from '@/constants/appConfig';

export async function sendToAssemblyAI(audioBlob) {
  const apiKey = process.env.VUE_APP_ASSEMBLY_AI_TOKEN;
  if (!apiKey) {
    throw new Error('AssemblyAI token not found in environment variables.');
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

  // Step 2: Request transcription
  const transcriptRes = await fetch(APP_CONFIG.SERVICES.ASSEMBLY_AI.TRANSCRIPT_URL, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audio_url: audioUrl
    })
  });

  if (!transcriptRes.ok) {
    throw new Error('Failed to start transcription on AssemblyAI.');
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
      return pollData.text;
    } else if (pollData.status === 'error') {
      throw new Error(`AssemblyAI Error: ${pollData.error}`);
    }
  }

  throw new Error('AssemblyAI transcription timed out.');
}
