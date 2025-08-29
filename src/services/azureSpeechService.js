export async function fetchVoices(subscriptionKey, region) {
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
  const response = await fetch(endpoint, {
    headers: { 'Ocp-Apim-Subscription-Key': subscriptionKey }
  });
  return await response.json();
}

export async function playVoiceSample(voiceName, subscriptionKey, region) {
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `
    <speak version='1.0' xml:lang='en-US'>
      <voice xml:lang='en-US' name='${voiceName}'>
        This is a sample of the selected Azure voice.
      </voice>
    </speak>
  `;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
      'User-Agent': 'ResumeSetupVue'
    },
    body: ssml
  });
  if (!response.ok) throw new Error('Azure TTS failed');
  const audioData = await response.arrayBuffer();
  const blob = new Blob([audioData], { type: 'audio/mp3' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
}
