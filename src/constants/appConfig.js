export const APP_CONFIG = {
  /**
   * TRANSCRIPTION SETTINGS
   * Used in: TranscriptionsView.vue, transcriptService.js, transcriptionSpeechService.js
   */
  TRANSCRIPTION: {
    // Maximum number of transcription sessions to keep in local storage
    MAX_HISTORY: 10,

    // Max words for the sidebar preview
    PREVIEW_LENGTH: 75,

    // Silence duration (ms) that triggers a new paragraph break (V1 engine)
    MERGE_THRESHOLD_MS: 5000,

    // Silence duration (ms) that triggers a new paragraph break (V2 engine — shorter feels more natural)
    V2_PARAGRAPH_THRESHOLD_MS: 3000,

    // AUDIO PROCESSING
    SAMPLE_RATE: 16000,
    BUFFER_SIZE: 1024,

    // FUZZY MATCHING
    OVERLAP_FUZZY_INTERIM_MS: 500,
    OVERLAP_FUZZY_FINAL_MS: 1000,
    MERGE_BUFFER_MS: 100,
    SEARCH_DEPTH_LINES: 10,
    OVERLAP_BUFFER_MS: 500
  },

  /**
   * INTERVIEW SETTINGS
   * Used in: InterviewView.vue, AnswerRecorder.vue
   */
  INTERVIEW: {
    // Simulated typing speed (Words Per Minute) for the interviewer
    WPM: 300,

    // Duration of silence (ms) at the end of an answer to trigger the next question
    SILENCE_WAIT_MS: 3000,

    // Timer tick interval
    TIMER_TICK_MS: 100,

    // AUDIO LEVEL DETECTION
    // Mid-point for 8-bit PCM (128) and the tolerance for "silence"
    PCM_MIDPOINT: 128,
    SILENCE_TOLERANCE: 2
  },

  /**
   * AI & BACKEND SERVICES
   * Used in: openaiService.js, assemblyAISpeechService.js, azureSpeechService.js
   */
  SERVICES: {
    OPENAI: {
      MODEL: 'gpt-4o-mini',
      MIN_Q_COUNT: 30,
      MAX_Q_COUNT: 45,
      BATCH_SIZE: 8,
      PARALLEL_BATCHES: 6,
    },

    ASSEMBLY_AI: {
      UPLOAD_URL: 'https://api.assemblyai.com/v2/upload',
      TRANSCRIPT_URL: 'https://api.assemblyai.com/v2/transcript',
      POLLING_INTERVAL_MS: 2000,
      MAX_POLLING_RETRIES: 60
    },

    AZURE: {
      REGION: 'eastus',
      // Azure TTS URLs using the configured region
      get VOICES_LIST_URL() { return `https://${this.REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list`; },
      get TTS_URL() { return `https://${this.REGION}.tts.speech.microsoft.com/cognitiveservices/v1`; }
    },

    // Diyo Service Backend URL (Auth, etc.)
    get DIYO_SERVICE_URL() {
      return (process.env.VUE_APP_DIYO_SERVICE_BACKEND_ENDPOINT || '').replace(/\/+$/, '');
    },

    // Websocket/Real-time Backend URL
    get WS_URL() {
      return (process.env.VUE_APP_SERVER_URL || '').replace(/\/+$/, '');
    },

    // Main Branding / Links
    DIYO_MAIN_WEBSITE: 'https://www.diyotech.net'
  }
};
