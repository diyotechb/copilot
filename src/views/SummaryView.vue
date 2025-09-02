<template>
  <div class="summary-main">
    <div v-if="loadingTranscripts" style="text-align:center; margin-top:2rem;">
      <div class="loader"></div>
      <div style="margin-top:1rem; color:#2563eb; font-size:1.2rem;">Preparing transcripts...</div>
    </div>
    <div v-else>
      <h2 style="margin-bottom:1.5rem;">Interview Summary</h2>
      <div v-if="enableVideo && recordedVideoUrl" style="margin-bottom:2rem;">
        <h3>Recorded Video:</h3>
        <video :src="recordedVideoUrl" controls width="400" style="border-radius:12px;"></video>
      </div>
      <div v-for="(qa, idx) in interviewQA" :key="idx" class="section summary-section" style="margin-bottom:2rem;">
        <h3>Question {{ idx+1 }}</h3>
        <div style="margin-bottom:0.5rem;"><strong>Question:</strong> {{ qa.question }}</div>
        <div style="margin-bottom:0.5rem;"><strong>Your Transcript:</strong> {{ answerTranscripts[idx] || '(Not received yet)' }}</div>
        <div style="margin-bottom:0.5rem;"><strong>Actual Answer:</strong> {{ qa.answer }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SummaryView',
  props: {
    interviewQA: Array,
    answerTranscripts: Array,
    recordedVideoUrl: String,
    enableVideo: Boolean,
    loadingTranscripts: Boolean
  }
};
</script>

<style scoped>
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
.summary-main {
  padding: 2rem 2vw;
}
.section.summary-section {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #f6f8fa;
  margin-bottom: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}
</style>
