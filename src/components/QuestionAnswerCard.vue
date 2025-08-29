<template>
  <div class="qa-card">
    <div class="qa-section">
      <h2 class="qa-title">Question</h2>
      <p class="qa-text">{{ question }}</p>
    </div>
    <div class="qa-section">
      <h2 class="qa-title">Answer</h2>
      <div class="qa-text" v-if="showAnswer">{{ answer }}</div>
      <div v-else class="qa-text qa-placeholder">(Answer will appear after question is read)</div>
    </div>
    <slot name="actions"></slot>
  </div>
</template>

<script>
export default {
  name: 'QuestionAnswerCard',
  props: {
    question: {
      type: String,
      required: true
    },
    answer: {
      type: String,
      default: ''
    },
    showAnswer: {
      type: Boolean,
      default: false
    }
  }
};
</script>

<style scoped>
.qa-card {
  width: 100vw;
  height: 100vh;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
  background: inherit;
  padding: 3rem 5vw 3rem 5vw;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.qa-section {
  margin-bottom: 1.5rem;
}
.qa-title {
  font-size: 1.2rem;
  color: #2563eb;
  margin-bottom: 0.5rem;
}
.qa-text {
  font-size: 1.1rem;
  color: #333;
  white-space: pre-wrap;
}
.qa-placeholder {
  color: #aaa;
  font-style: italic;
}
</style>
