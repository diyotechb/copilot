import { reactive } from 'vue';

const RESUME_KEY = 'interview_copilot_resume';

export const resumeStore = reactive({
  resumeText: localStorage.getItem(RESUME_KEY) || '',

  setResume(text) {
    this.resumeText = text;
    localStorage.setItem(RESUME_KEY, text);
  },

  clearResume() {
    this.resumeText = '';
    localStorage.removeItem(RESUME_KEY);
  }
});
