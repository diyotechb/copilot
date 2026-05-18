// Mirror of copilot-backend/.../BackendDefaults.java MAX_* constants.
// Frontend enforces these for fast UX feedback; backend enforces them as
// the source of truth (a forged request that bypasses these gets 400).

export const INPUT_LIMITS = {
  RESUME: 50000,
  JOB_DESCRIPTION: 20000,
  PREFERRED_KEYWORDS_COUNT: 20,
  PREFERRED_KEYWORD_CHARS: 100,
  TTS_TEXT: 5000,
  SAMPLE_KEYWORDS: 500,
  AUDIO_BYTES: 50 * 1024 * 1024
};
