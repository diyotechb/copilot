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

export async function speakWithAzureTTS(text, voice, onEnd) {
  const subscriptionKey = process.env.VUE_APP_AZURE_SPEECH_KEY;
  const region = process.env.VUE_APP_AZURE_SPEECH_REGION;

  if (!subscriptionKey || !region) {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 1.05;
      utter.onend = onEnd;
      window.speechSynthesis.speak(utter);
      return window.speechSynthesis;

    }
    if (typeof onEnd === 'function') onEnd();
    return null;
  }

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `
    <speak version='1.0' xml:lang='en-US'>
      <voice xml:lang='en-US' name='${voice}'>
        ${text}
      </voice>
    </speak>
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
        'User-Agent': 'InterviewViewVue'
      },
      body: ssml
    });
    if (!response.ok) throw new Error('Azure TTS failed');
    const audioData = await response.arrayBuffer();
    const blob = new Blob([audioData], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = onEnd;
    audio.play().catch(e => {
      console.error('Audio playback error:', e);
      if (typeof onEnd === 'function') onEnd();
    });
    return audio;

  } catch (e) {
    console.error('Azure TTS error:', e);
    if (typeof onEnd === 'function') onEnd();
    return null;
  }
}


export async function speakWithAzureTTSToContext(text, voice, audioCtx, destination, onEnd) {
  const subscriptionKey = process.env.VUE_APP_AZURE_SPEECH_KEY;
  const region = process.env.VUE_APP_AZURE_SPEECH_REGION;

  if (!subscriptionKey || !region) {

    return speakWithAzureTTS(text, voice, onEnd);
  }

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `
    <speak version='1.0' xml:lang='en-US'>
      <voice xml:lang='en-US' name='${voice}'>${text}</voice>
    </speak>
  `;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
        'User-Agent': 'InterviewViewVue'
      },
      body: ssml
    });
    if (!response.ok) throw new Error('Azure TTS failed');

    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);


    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';

    let sourceNode = null;
    try {
      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(audioCtx.destination);       // speakers
      if (destination) sourceNode.connect(destination); // recording mix
    } catch (e) {

      console.warn('[TTS] Could not route through AudioContext:', e);
    }

    audio.onended = () => {
      if (typeof onEnd === 'function') onEnd();
      URL.revokeObjectURL(url);
    };

    audio.play().catch(e => {
      console.error('TTS audio playback error:', e);
      if (typeof onEnd === 'function') onEnd();
    });


    return audio;
  } catch (e) {
    console.error('Azure TTS context error:', e);
    // Fallback to normal playback
    return speakWithAzureTTS(text, voice, onEnd);
  }
}