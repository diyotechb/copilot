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
   * DIFFICULTY LEVELS
   * Drives question count, duration estimate, on-screen question/answer visibility,
   * and prompt-style hints for openaiService.js.
   */
  DIFFICULTY: {
    // NOTE: MIN_Q / MAX_Q now count *main* questions only — they exclude
    // the casual openers (3-4 items), the format pivot (1 item), the
    // single intro / "tell me about your journey" question, and the
    // closing thank-you message. So the actual interview includes ~5-6
    // additional items on top of these counts.
    Beginner: {
      LABEL: 'Beginner',
      DURATION_TEXT: '~25 min',
      COUNT_TEXT: '20-25 main questions',
      MIN_Q: 20,
      MAX_Q: 25,
      SHOW_QUESTIONS_MODE: 'optional',
      DEFAULT_SHOW_QUESTIONS: true,
      SHOW_AI_ANSWER: true,
      DESCRIPTION: 'Friendly, supportive pace. Questions and a suggested answer appear on screen by default so you can follow along — but you can hide them and use the Repeat button if you want a more realistic try. 20-25 main questions plus a warm intro and closing.'
    },
    Intermediate: {
      LABEL: 'Intermediate',
      DURATION_TEXT: '40-50 min',
      COUNT_TEXT: '25-30 main questions',
      MIN_Q: 25,
      MAX_Q: 30,
      SHOW_QUESTIONS_MODE: 'optional',
      DEFAULT_SHOW_QUESTIONS: false,
      SHOW_AI_ANSWER: true,
      DESCRIPTION: 'Realistic technical interview. Deep-dive questions on projects, debugging, behavioral STAR scenarios, and tradeoffs. 25-30 main questions plus intro and closing. Toggle questions on screen if you want a guide; use Repeat if you miss a question.'
    },
    Advanced: {
      LABEL: 'Advanced',
      DURATION_TEXT: '55-65 min',
      COUNT_TEXT: '30-35 main questions',
      MIN_Q: 30,
      MAX_Q: 35,
      SHOW_QUESTIONS_MODE: 'never',
      DEFAULT_SHOW_QUESTIONS: false,
      SHOW_AI_ANSWER: false,
      DESCRIPTION: 'Senior-level simulation. System design, architecture, scaling, and advanced behavioral questions tied to your resume. 30-35 main questions. Nothing on screen — listen, think, respond. Use Repeat if needed.'
    }
  },
  DIFFICULTY_DEFAULT: 'Beginner',

  /**
   * INTERVIEW CATEGORY (Intermediate only)
   * Lets the candidate narrow Intermediate-level practice to a specific
   * question style. "All" preserves the default mix.
   */
  CATEGORY: {
    All:           { LABEL: 'All',            DESCRIPTION: 'Balanced mix of technical, behavioral, and scenario-based questions.' },
    Technical:     { LABEL: 'Technical',      DESCRIPTION: 'Code-level deep-dives, debugging, technical tradeoffs, and tool/framework specifics.' },
    Behavioral:    { LABEL: 'Behavioral',     DESCRIPTION: 'STAR-format situational stories: teamwork, conflict, ownership, communication, leadership.' },
    'Scenario Based': { LABEL: 'Scenario Based', DESCRIPTION: 'Hypothetical "what would you do if…" scenarios that test judgment and tradeoff thinking.' }
  },
  CATEGORY_DEFAULT: 'All',

  /**
   * INTERVIEW SETTINGS
   * Used in: InterviewView.vue, AnswerRecorder.vue
   */
  INTERVIEW: {
    // Streaming pace (Words Per Minute) for the AI's reference answer.
    // Around 200 WPM matches a natural human speaking/reading rhythm — the
    // answer types out in time with the candidate's own pace.
    WPM: 200,

    // Duration of silence (ms) at the end of an answer to trigger the next question
    SILENCE_WAIT_MS: 3000,

    // Timer tick interval
    TIMER_TICK_MS: 100,

    // AUDIO LEVEL DETECTION
    // Mid-point for 8-bit PCM samples (range 0-255, midpoint 128).
    PCM_MIDPOINT: 128,
    // Silence is detected via RMS (root-mean-square) energy of the audio
    // buffer rather than per-sample amplitude. RMS averages noise spikes
    // out, so background noise (fan, cough, distant voice) no longer
    // resets the countdown — only sustained speech does.
    // Tuning guide (8-bit PCM):
    //   ~0-3   = truly silent / quiet ambient noise
    //   ~5-15  = soft speech
    //   ~15-30 = normal conversational speech
    //   ~30+   = loud speech
    // 6 sits comfortably above typical room noise but below soft speech.
    SILENCE_RMS_THRESHOLD: 6
  },

  /**
   * AI & BACKEND SERVICES
   * Used in: openaiService.js, assemblyAISpeechService.js, ttsService.js
   */
  SERVICES: {
    OPENAI: {
      MODEL: 'gpt-4o-mini',
      ANALYSIS_MODEL: 'gpt-4o-mini',
      MIN_Q_COUNT: 30,
      MAX_Q_COUNT: 45,
      BATCH_SIZE: 10,
      PARALLEL_BATCHES: 3,
      // Threshold of ready questions before the user can start the interview.
      // The first batch (which contains the openers, format pivot, and intro)
      // is also required to be done — so this only governs the size of the
      // safety buffer beyond the openers. Set low: the rest of the questions
      // generate in the background while the user is doing the opener + intro
      // questions (which take ~30-60s each), and InterviewView re-reads the
      // qaList on every advance, so later batches land before the user
      // catches up. 5 = openers + ~2 main questions buffered.
      START_THRESHOLD: 5
    },

    ASSEMBLY_AI: {
      UPLOAD_URL: 'https://api.assemblyai.com/v2/upload',
      TRANSCRIPT_URL: 'https://api.assemblyai.com/v2/transcript',
      POLLING_INTERVAL_MS: 2000,
      MAX_POLLING_RETRIES: 60
    },

    OPENAI_TTS: {
      TTS_URL: 'https://api.openai.com/v1/audio/speech',
      MODEL: 'tts-1',
      FORMAT: 'mp3'
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
