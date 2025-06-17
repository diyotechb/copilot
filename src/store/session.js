import { defineStore } from 'pinia';

export const useSessionStore = defineStore('session', {
  state: () => ({
    candidateId: '',
    assistantId: '',
    threadId: ''
  }),
  actions: {
    setSession({ candidateId, assistantId, threadId }) {
      this.candidateId = candidateId;
      this.assistantId = assistantId;
      this.threadId = threadId;
    }
  }
});
