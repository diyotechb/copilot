<template>
  <div class="summary-main">
    <div v-if="loadingTranscripts" class="summary-loading">
      <div class="loader"></div>
      <div class="loading-text">Preparing transcripts...</div>
    </div>
    <div v-else>
      <h2 class="summary-title">Interview Summary</h2>
      <div
        v-for="(transcript, idx) in transcripts"
        :key="idx"
        class="section summary-section"
      >
        <h3 class="summary-question-title centered-title">Question {{ idx + 1 }}</h3>
        <div class="summary-row">
          <span class="summary-label">Question:</span>
          <span class="summary-value">{{ localInterviewQA[idx]?.question || '(No question found)' }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Your Transcript:</span>
          <span class="summary-value">{{ transcript || '(Not received yet)' }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Actual Answer:</span>
          <span class="summary-value">{{ localInterviewQA[idx]?.answer || '(No answer found)' }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Recording: </span>
          <button
            class="play-btn"
            :disabled="!getRecording(idx)"
            @click="playRecording(idx)"
          >
            ▶️ Play
          </button>
          <button
            class="stop-btn"
            :disabled="!getRecording(idx)"
            @click="stopPlayback(idx)"
          >
            ⏹️ Stop
          </button>
          <audio
            v-if="getRecording(idx)"
            :src="getRecording(idx)"
            :ref="'audio_' + idx"
            style="display:none"
          ></audio>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SummaryView',
  props: {
    interviewQA: Array
  },
  data() {
    return {
      transcripts: [],
      localInterviewQA: [],
      loadingTranscripts: true
    };
  },
  mounted() {
    this.localInterviewQA = this.interviewQA && this.interviewQA.length
      ? this.interviewQA
      : JSON.parse(localStorage.getItem('interviewQA') || '[]');
    this.checkTranscriptionStatus();
  },
  methods: {
    checkTranscriptionStatus() {
      const inProcess = localStorage.getItem('transcriptionInProcess');
      if (inProcess === 'true') {
        this.loadingTranscripts = true;
        setTimeout(this.checkTranscriptionStatus, 1000);
      } else {
        this.loadingTranscripts = false;
        this.loadTranscripts();
      }
    },
    loadTranscripts() {
      const stored = localStorage.getItem('transcripts');
      this.transcripts = stored ? JSON.parse(stored) : [];
    },
    getRecording(idx) {
      return localStorage.getItem(`Recording_${idx}`);
    },
     playRecording(idx) {
      let audioEl = this.$refs['audio_' + idx];
      if (Array.isArray(audioEl)) audioEl = audioEl[0];
      if (audioEl && typeof audioEl.play === 'function') {
        audioEl.currentTime = 0;
        audioEl.play();
      }
    },
    stopPlayback(idx) {
      let audioEl = this.$refs['audio_' + idx];
      if (Array.isArray(audioEl)) audioEl = audioEl[0];
      if (audioEl && typeof audioEl.pause === 'function') {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
    }
  }
};
</script>

<style scoped>
.summary-main {
  padding: 2rem 2vw;
  max-width: 700px;
  margin: 0 auto;
  box-sizing: border-box;
}
.summary-title {
  margin-bottom: 1.5rem;
  color: #22223b;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
}
.section.summary-section {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #f6f8fa;
  margin-bottom: 1.5rem;
  width: 100%;
  box-sizing: border-box;
  padding: 1.25rem 1rem;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.summary-question-title {
  margin-bottom: 1rem;
  color: #2563eb;
  font-size: 1.2rem;
  font-weight: 600;
}
.summary-row {
  margin-bottom: 0.5rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.play-btn,
.stop-btn {
  padding-left: 1rem;      /* Add left padding */
  padding-right: 1rem;     /* Keep right padding for balance */
  min-width: 90px;
  margin-left: 0.5rem;
  text-align: center;
  display: inline-block;
}
.summary-label {
  font-weight: 600;
  color: #22223b;
  min-width: 120px;
}
.summary-value {
  color: #3a3a3a;
  flex: 1 1 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.summary-loading {
  text-align: center;
  margin-top: 2rem;
}
.loading-text {
  margin-top: 1rem;
  color: #2563eb;
  font-size: 1.2rem;
}
.centered-title {
  text-align: center;
}
.loader {
  border: 6px solid #e5e7eb;
  border-top: 6px solid #2563eb;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}
.play-btn {
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.4rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  margin-left: 0.5rem;
  transition: background 0.2s;
}
.play-btn:disabled {
  background: #e5e7eb;
  color: #888;
  cursor: not-allowed;
}
.stop-btn {
  background: #ef4444;
}
.stop-btn:hover {
  background: #dc2626;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>