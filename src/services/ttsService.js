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

// ── Speech cache ────────────────────────────────────────────────────
// Memoizes generated speech blobs by (model, voice, text) so a question
// repeated within a session — or pre-fetched while the previous one is
// playing — never hits the network twice. In-memory only by design;
// swapping out the upstream for the backend later does not need to
// touch this cache. The cache is bounded simply by the natural size of
// an interview (~30 entries) so no LRU eviction is needed.
const _speechCache = new Map();   // key → ArrayBuffer
const _inFlight = new Map();      // key → Promise<ArrayBuffer>

function cacheKey(text, voice) {
  const { MODEL } = APP_CONFIG.SERVICES.OPENAI_TTS;
  return `${MODEL}|${resolveVoice(voice)}|${text || ''}`;
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

// Returns the speech buffer for (text, voice). Uses the in-memory cache;
// coalesces concurrent requests for the same key into a single network
// call (so prefetch + immediate play don't double-fetch). Returns a
// COPY of the buffer because Audio playback can transfer/consume it.
async function getSpeechBuffer(text, voice) {
  if (!text || !getApiKey()) {
    // Caller will hit the browser-synthesis fallback paths below.
    return requestSpeech(text, voice);
  }
  const key = cacheKey(text, voice);
  const cached = _speechCache.get(key);
  if (cached) return cached.slice(0);
  const flight = _inFlight.get(key);
  if (flight) return (await flight).slice(0);
  const promise = requestSpeech(text, voice).then(
    (buf) => {
      _speechCache.set(key, buf);
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

// Fire-and-forget cache warmup. Safe to call any number of times — same
// text/voice will only ever produce one network request. Used by
// InterviewView to fetch the next question's audio while the current
// one is being answered, so the transition between questions is
// effectively instant.
export async function prefetchSpeech(text, voice) {
  if (!text || !getApiKey()) return;
  const key = cacheKey(text, voice);
  if (_speechCache.has(key) || _inFlight.has(key)) return;
  try {
    await getSpeechBuffer(text, voice);
  } catch (e) {
    // Best-effort. If prefetch fails the live play will fail too and
    // surface its own error.
  }
}

// Object URLs are revoked through this helper instead of immediately on
// `audio.onended`. The browser sometimes performs follow-up fetches
// against a blob URL right after playback finishes (especially when the
// audio element was hooked into an AudioContext via
// createMediaElementSource). Revoking inside the same tick produced a
// trail of `net::ERR_FILE_NOT_FOUND` console errors. A short delay
// past the cleanup window keeps the console clean without leaking
// noticeable memory — each clip is ~30 KB and we hold them for ~3s.
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
  const apiKey = getApiKey();
  if (!apiKey) return;

  const audioData = await getSpeechBuffer('This is a sample of the selected voice.', voiceId);
  const url = URL.createObjectURL(new Blob([audioData], { type: 'audio/mp3' }));
  const audio = new Audio(url);

  // Resolve when playback ends so the caller can show a "playing" state.
  return new Promise((resolve, reject) => {
    audio.onended = () => { scheduleRevoke(url); resolve(); };
    audio.onerror = () => { scheduleRevoke(url); reject(new Error('Audio playback failed')); };
    audio.play().catch(reject);
  });
}

export async function speakWithTTS(text, voice, onEnd) {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('OpenAI API key (VUE_APP_OPENAPI_TOKEN_KEY) is missing — using browser Speech Synthesis fallback.');
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
  const apiKey = getApiKey();
  if (!apiKey) return speakWithTTS(text, voice, onEnd);

  try {
    const audioData = await getSpeechBuffer(text, voice);
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
