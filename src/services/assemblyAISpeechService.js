// src/services/assemblyAISpeechService.js

export async function sendToAssemblyAI(audioBlob) {
  console.log('[assemblyAISpeechService] sendToAssemblyAI called with audioBlob:', audioBlob);
  const apiKey = process.env.VUE_APP_ASSEMBLY_AI_TOKEN;
  console.log('[assemblyAISpeechService] Starting transcription process...');
  if (!apiKey) {
    console.error('[assemblyAISpeechService] AssemblyAI token not found in environment variables.');
    throw new Error('AssemblyAI token not found in environment variables.');
  }
  // Step 1: Upload audio file
  console.log('[assemblyAISpeechService] Uploading audio to AssemblyAI...');
  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'Authorization': apiKey
    },
    body: audioBlob
  });
  const uploadData = await uploadRes.json();
  console.log('[assemblyAISpeechService] Upload response:', uploadData);
  if (!uploadData.upload_url) {
    console.error('[assemblyAISpeechService] Failed to upload audio to AssemblyAI.');
    throw new Error('Failed to upload audio to AssemblyAI.');
  }
  // Step 2: Request transcription
  console.log('[assemblyAISpeechService] Requesting transcription job...');
  const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ audio_url: uploadData.upload_url })
  });
  const transcriptData = await transcriptRes.json();
  console.log('[assemblyAISpeechService] Transcription job response:', transcriptData);
  if (!transcriptData.id) {
    console.error('[assemblyAISpeechService] Failed to start transcription job.');
    throw new Error('Failed to start transcription job.');
  }
  // Step 3: Poll for transcript
  let status = transcriptData.status;
  let transcript = '';
  console.log(`[assemblyAISpeechService] Polling for transcript (id: ${transcriptData.id})...`);
  for (let i = 0; i < 60; i++) { // Poll for up to 60 seconds
    await new Promise(res => setTimeout(res, 2000));
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptData.id}`, {
      headers: { 'Authorization': apiKey }
    });
    const pollData = await pollRes.json();
    status = pollData.status;
    console.log(`[assemblyAISpeechService] Poll attempt ${i+1}: status=${status}`);
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
