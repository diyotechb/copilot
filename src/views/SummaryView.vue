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
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>