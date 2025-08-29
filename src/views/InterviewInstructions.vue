<template>
  <div class="instructions-container">
    <div class="attention-banner">
      <span>Important: Please read these instructions before starting your interview!</span>
    </div>
    <h2>Interview Instructions</h2>
    <div class="instructions-box">
      <ul>
        <li>The interview will begin immediately after you click <b>Start Interview</b>.</li>
        <li>Each question will be read aloud by the selected voice.</li>
        <li style="background:#fffbe6; border-radius:8px; padding:0.5rem 1rem; font-weight:600; color:#b45309; box-shadow:0 2px 8px rgba(180,83,9,0.08);">
          If you pause or are silent for more than <b>5 seconds</b>, the interview will automatically skip to the next question.
        </li>
        <li>All your answers will be recorded on video for review.</li>
        <li>Questions are generated based on your resume and job description (if provided).</li>
        <li>You can stop the interview at any time using the <b>Stop Interview</b> button.</li>
      </ul>
      <div class="instructions-note">Make sure your camera and microphone are enabled before starting.</div>
    </div>
    <div style="text-align:center; margin-top:2rem;">
      <slot name="loading"></slot>
      <button v-if="!$attrs.loadingQA" class="btn submit-btn" @click="$emit('startInterview')">Start Interview</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'InterviewInstructions'
};
</script>

<style scoped>
.instructions-container {
  max-width: 520px;
  margin: 2rem auto;
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 2rem;
}
.instructions-box {
  background: #f6f8fa;
  border-radius: 12px;
  padding: 1.5rem;
  color: #333;
  font-size: 1rem;
  margin-bottom: 1.5rem;
}
.instructions-box ul {
  margin-left: 1.5rem;
}
.instructions-note {
  margin-top: 1rem;
  color: #2563eb;
  font-weight: 500;
}
.btn.submit-btn {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 1rem 2.5rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
}
.attention-banner {
  background: #fffbe6;
  color: #b45309;
  border: 2px solid #f59e42;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(245, 158, 66, 0.08);
}
</style>
