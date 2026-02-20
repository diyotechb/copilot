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
      return window.speechSynthesis; // Return for control (cancel/pause)
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
    return audio; // Return for control (pause/play)
  } catch (e) {
    console.error('Azure TTS error:', e);
    if (typeof onEnd === 'function') onEnd();
    return null;
  }
}

/**
 * Speak text via Azure TTS, routing audio through a shared AudioContext
 * so it can be captured by MediaRecorder alongside the microphone.
 * Falls back to normal Audio() playback if no context is provided.
 */
export async function speakWithAzureTTSToContext(text, voice, audioCtx, destination, onEnd) {
  const subscriptionKey = process.env.VUE_APP_AZURE_SPEECH_KEY;
  const region = process.env.VUE_APP_AZURE_SPEECH_REGION;

  if (!subscriptionKey || !region) {
    // Fallback: browser TTS (can't route through context easily)
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

    // Use an HTML Audio element so we get proper pause/resume support.
    // Route it through the AudioContext via createMediaElementSource so it's
    // captured by MediaRecorder alongside the mic.
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';

    let sourceNode = null;
    try {
      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(audioCtx.destination);       // speakers
      if (destination) sourceNode.connect(destination); // recording mix
    } catch (e) {
      // If createMediaElementSource fails (e.g. already connected), play directly
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

    // Return standard pause/play interface — HTML Audio handles it natively
    return audio;
  } catch (e) {
    console.error('Azure TTS context error:', e);
    // Fallback to normal playback
    return speakWithAzureTTS(text, voice, onEnd);
  }
}