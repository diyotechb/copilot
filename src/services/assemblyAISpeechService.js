// src/services/assemblyAISpeechService.js

export async function sendToAssemblyAI(audioBlob) {
  const apiKey = process.env.VUE_APP_ASSEMBLY_AI_TOKEN;
  if (!apiKey) {
    console.error('[assemblyAISpeechService] AssemblyAI token not found in environment variables.');
    throw new Error('AssemblyAI token not found in environment variables.');
  }
  // Step 1: Upload audio file
  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'Authorization': apiKey
    },
    body: audioBlob
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.upload_url) {
    console.error('[assemblyAISpeechService] Failed to upload audio to AssemblyAI.');
    throw new Error('Failed to upload audio to AssemblyAI.');
  }
  // Step 2: Request transcription
  const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ audio_url: uploadData.upload_url })
  });
  const transcriptData = await transcriptRes.json();
  if (!transcriptData.id) {
    console.error('[assemblyAISpeechService] Failed to start transcription job.');
    throw new Error('Failed to start transcription job.');
  }
  // Step 3: Poll for transcript
  let status = transcriptData.status;
  let transcript = '';
  for (let i = 0; i < 60; i++) { // Poll for up to 60 seconds
    await new Promise(res => setTimeout(res, 2000));
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptData.id}`, {
      headers: { 'Authorization': apiKey }
    });
    const pollData = await pollRes.json();
    status = pollData.status;
    if (status === 'completed') {
      transcript = pollData.text;
      console.log('[assemblyAISpeechService] Transcription completed:', transcript);
      break;
    } else if (status === 'failed') {
      console.error('[assemblyAISpeechService] AssemblyAI transcription failed.');
      throw new Error('AssemblyAI transcription failed.');
    }
  }
  if (!transcript) {
    console.warn('[assemblyAISpeechService] Transcription did not complete in time.');
  }
  return transcript;
}
