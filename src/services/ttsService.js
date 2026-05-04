import { APP_CONFIG } from '@/constants/appConfig';

// OpenAI TTS exposes a fixed set of voices (no list endpoint), so we declare
// them locally. The shape matches what the Resume Setup voice dropdown expects.
const OPENAI_VOICES = [
  { id: 'alloy',   name: 'Alloy',   gender: 'Neutral' },
  { id: 'echo',    name: 'Echo',    gender: 'Male' },
  { id: 'fable',   name: 'Fable',   gender: 'Male' },
  { id: 'onyx',    name: 'Onyx',    gender: 'Male' },
  { id: 'nova',    name: 'Nova',    gender: 'Female' },
  { id: 'shimmer', name: 'Shimmer', gender: 'Female' }
];

const DEFAULT_VOICE = 'alloy';

function resolveVoice(voice) {
  return OPENAI_VOICES.some(v => v.id === voice) ? voice : DEFAULT_VOICE;
}

function getApiKey() {
  return process.env.VUE_APP_OPENAPI_TOKEN_KEY;
}

async function requestSpeech(text, voice) {
  const apiKey = getApiKey();
  const { TTS_URL, MODEL, FORMAT } = APP_CONFIG.SERVICES.OPENAI_TTS;

  const response = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      input: text,
      voice: resolveVoice(voice),
      response_format: FORMAT
    })
  });

  if (!response.ok) throw new Error(`OpenAI TTS failed (${response.status})`);
  return response.arrayBuffer();
}

function speakWithBrowserFallback(text, onEnd) {
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

export async function fetchVoices() {
  return OPENAI_VOICES;
}

export async function playVoiceSample(voiceId) {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const audioData = await requestSpeech('This is a sample of the selected voice.', voiceId);
  const url = URL.createObjectURL(new Blob([audioData], { type: 'audio/mp3' }));
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  audio.play();
}

export async function speakWithTTS(text, voice, onEnd) {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('OpenAI API key (VUE_APP_OPENAPI_TOKEN_KEY) is missing — using browser Speech Synthesis fallback.');
    return speakWithBrowserFallback(text, onEnd);
  }

  try {
    const audioData = await requestSpeech(text, voice);
    const url = URL.createObjectURL(new Blob([audioData], { type: 'audio/mp3' }));
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (typeof onEnd === 'function') onEnd();
    };
    audio.play().catch(() => {
      if (typeof onEnd === 'function') onEnd();
    });
    return audio;
  } catch (e) {
    if (typeof onEnd === 'function') onEnd();
    return null;
  }
}

export async function speakWithTTSToContext(text, voice, audioCtx, destination, onEnd) {
  const apiKey = getApiKey();
  if (!apiKey) return speakWithTTS(text, voice, onEnd);

  try {
    const audioData = await requestSpeech(text, voice);
    const url = URL.createObjectURL(new Blob([audioData], { type: 'audio/mp3' }));
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';

    try {
      const sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(audioCtx.destination);
      if (destination) sourceNode.connect(destination);
    } catch (e) {
      // Audio routing may already be wired up; ignore.
    }

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (typeof onEnd === 'function') onEnd();
    };
    audio.play().catch(() => {
      if (typeof onEnd === 'function') onEnd();
    });
    return audio;
  } catch (e) {
    return speakWithTTS(text, voice, onEnd);
  }
}
