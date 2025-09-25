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
    console.error('[assemblyAISpeechService] Failed to upload audio to AssemblyAI.', uploadData);
    throw new Error('Failed to upload audio to AssemblyAI.');
  }
  // Step 2: Request transcription
  const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        audio_url: uploadData.upload_url,
        sentiment_analysis: true,
        disfluencies: true
    })
  });
  const transcriptData = await transcriptRes.json();
  if (!transcriptData.id) {
    console.error('[assemblyAISpeechService] Failed to start transcription job.', transcriptData);
    throw new Error('Failed to start transcription job.');
  }
  // Step 3: Poll for transcript
  let status = transcriptData.status;
  for (let i = 0; i < 60; i++) { // Poll for up to 60 seconds
    await new Promise(res => setTimeout(res, 2000));
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptData.id}`, {
      headers: { 'Authorization': apiKey }
    });
    const pollData = await pollRes.json();
    status = pollData.status;
    if (status === 'completed') {
      return pollData;
    } else if (status === 'failed') {
      console.error('[assemblyAISpeechService] AssemblyAI transcription failed.', pollData);
      throw new Error('AssemblyAI transcription failed.');
    }
  }
  return null;
}
