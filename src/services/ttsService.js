import { APP_CONFIG } from '@/constants/appConfig';
import { backendUrl, authHeaders, assertOk } from './backendApi';

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

function isBackendConfigured() {
  return !!APP_CONFIG.SERVICES.COPILOT_BACKEND_URL;
}

// LRU cap on cached TTS ArrayBuffers. Each entry is ~50–300 KB; capping at 30
// keeps the per-tab footprint to a few MB even across long interviews. Map
// preserves insertion order, which we abuse for LRU: re-insert on hit, evict
// the oldest key when size exceeds the cap.
const MAX_SPEECH_CACHE_ENTRIES = 30;
const _speechCache = new Map();
const _inFlight = new Map();

function cacheKey(text, voice) {
  const { MODEL } = APP_CONFIG.SERVICES.OPENAI_TTS;
  return `${MODEL}|${resolveVoice(voice)}|${text || ''}`;
}

function cacheGet(key) {
  const buf = _speechCache.get(key);
  if (buf === undefined) return undefined;
  // Move to most-recently-used position.
  _speechCache.delete(key);
  _speechCache.set(key, buf);
  return buf;
}

function cachePut(key, buf) {
  if (_speechCache.has(key)) _speechCache.delete(key);
  _speechCache.set(key, buf);
  while (_speechCache.size > MAX_SPEECH_CACHE_ENTRIES) {
    const oldest = _speechCache.keys().next().value;
    if (oldest === undefined) break;
    _speechCache.delete(oldest);
  }
}

export function clearSpeechCache() {
  _speechCache.clear();
}

async function requestSpeech(text, voice) {
  const { FORMAT } = APP_CONFIG.SERVICES.OPENAI_TTS;

  const response = await fetch(backendUrl('/api/tts/speech'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      text,
      voice: resolveVoice(voice),
      format: FORMAT
    })
  });

  await assertOk(response, 'Backend TTS');
  return response.arrayBuffer();
}

async function getSpeechBuffer(text, voice) {
  if (!text || !isBackendConfigured()) {
    return requestSpeech(text, voice);
  }
  const key = cacheKey(text, voice);
  const cached = cacheGet(key);
  if (cached) return cached.slice(0);
  const flight = _inFlight.get(key);
  if (flight) return (await flight).slice(0);
  const promise = requestSpeech(text, voice).then(
    (buf) => {
      cachePut(key, buf);
      _inFlight.delete(key);
      return buf;
    },
    (err) => {
      _inFlight.delete(key);
      throw err;
    }
  );
  _inFlight.set(key, promise);
  const buf = await promise;
  return buf.slice(0);
}

export async function prefetchSpeech(text, voice) {
  if (!text || !isBackendConfigured()) return;
  const key = cacheKey(text, voice);
  if (_speechCache.has(key) || _inFlight.has(key)) return;
  try {
    await getSpeechBuffer(text, voice);
  } catch (e) { /* best-effort */ }
}

// Delayed so the browser's post-playback fetches against the blob URL
// (especially via createMediaElementSource) don't log ERR_FILE_NOT_FOUND.
const REVOKE_DELAY_MS = 3000;
function scheduleRevoke(url) {
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch (e) { /* noop */ }
  }, REVOKE_DELAY_MS);
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
  if (!isBackendConfigured()) return;

  const audioData = await getSpeechBuffer('This is a sample of the selected voice.', voiceId);
  const url = URL.createObjectURL(new Blob([audioData], { type: 'audio/mp3' }));
  const audio = new Audio(url);

  return new Promise((resolve, reject) => {
    audio.onended = () => { scheduleRevoke(url); resolve(); };
    audio.onerror = () => { scheduleRevoke(url); reject(new Error('Audio playback failed')); };
    audio.play().catch(reject);
  });
}

export async function speakWithTTS(text, voice, onEnd) {
  if (!isBackendConfigured()) {
    console.warn('Copilot backend URL is missing — using browser Speech Synthesis fallback.');
    return speakWithBrowserFallback(text, onEnd);
  }

  try {
    const audioData = await getSpeechBuffer(text, voice);
    const url = URL.createObjectURL(new Blob([audioData], { type: 'audio/mp3' }));
    const audio = new Audio(url);
    audio.onended = () => {
      scheduleRevoke(url);
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
  if (!isBackendConfigured()) return speakWithTTS(text, voice, onEnd);

  try {
    const audioData = await getSpeechBuffer(text, voice);
    const url = URL.createObjectURL(new Blob([audioData], { type: 'audio/mp3' }));
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';

    try {
      const sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(audioCtx.destination);
      if (destination) sourceNode.connect(destination);
    } catch (e) { /* routing may already be wired up */ }

    audio.onended = () => {
      scheduleRevoke(url);
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
