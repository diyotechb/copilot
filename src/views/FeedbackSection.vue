<template>
  <div v-if="feedbackMessage" class="feedback-section" style="margin-top:1.5rem;">
    <h3>Feedback</h3>
    <p>{{ feedbackMessage }}</p>
    <div style="color: #888; font-size: 0.9em;">
      <!-- Optional: Add extra info or debug here -->
    </div>
  </div>
</template>

<script>
export default {
  name: 'FeedbackSection',
  props: {
    transcript: {
      type: Object,
      required: true
    }
  },
  computed: {
    feedbackMessage() {
      if (!this.transcript || !this.transcript.words) return '';
      const words = this.transcript.words;
      const confidence = Number(this.averageConfidence(words));
      const fillerCount = this.transcript._fillerWordCount || 0;
      const totalWords = words.length || 1;
      const fillerPercent = ((fillerCount / totalWords) * 100);

      let feedback = [];
      if (confidence >= 90) {
        feedback.push('Excellent clarity and pronunciation. Your answers are very clear.');
      } else if (confidence >= 75) {
        feedback.push('Good clarity, but try to speak a bit more clearly for even better results.');
      } else {
        feedback.push('Speech recognition had trouble understanding some words. Try to speak slower and more clearly.');
      }
      if (fillerPercent < 5) {
        feedback.push('Great job minimizing filler words!');
      } else if (fillerPercent < 15) {
        feedback.push('You used some filler words. Try to reduce them for a more polished response.');
      } else {
        feedback.push('Frequent use of filler words detected. Practice pausing instead of using fillers.');
      }
      if (confidence >= 90 && fillerPercent < 5) {
        feedback.push('Overall, your answer was very strong!');
      }
      return feedback.join(' ');
    }
  },
  methods: {
    averageConfidence(words) {
      if (!words || !words.length) return 0;
      const sum = words.reduce((acc, w) => acc + (w.confidence || 0), 0);
      return (sum / words.length).toFixed(1);
    }
  }
};
</script>

<style scoped>
.feedback-section {
  background: #fef9c3;
  border-radius: 8px;
  padding: 1rem 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 4px rgba(202,138,4,0.07);
  font-size: 1.1rem;
  color: #92400e;
}
.feedback-section h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: #ca8a04;
  font-size: 1.15rem;
}
</style>