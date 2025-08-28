<template>
  <div>
    <h2>Interview Assistant</h2>
    <input v-model="question" @keyup.enter="askQuestion" placeholder="Ask a question" />
    <button @click="askQuestion">Ask</button>
    <div class="response">{{ response }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { connectToWebSocket, sendQuestion } from "@/services/socketService";

const question = ref("");
const response = ref("");

function askQuestion() {
  if (question.value) {
    sendQuestion(question.value);
    question.value = "";
  }
}

onMounted(() => {
  connectToWebSocket((msg) => {
    response.value = msg;
  });
});
</script>

<style scoped>
.response {
  margin-top: 1em;
  padding: 0.5em;
  background-color: #eef;
}
</style>
