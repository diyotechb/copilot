import { defineStore } from 'pinia';

export const useInterviewStore = defineStore('interview', {
  state: () => ({
    resumeText: '',
    jobDescriptionText: '',
    selectedVoice: '',
    interviewQA: [],
    currentQuestion: '',
    currentAnswer: '',
    turn: 0,
    interviewing: false,
    showAnswer: false,
    isThinking: false,
    answerTranscripts: [],
    recordedVideoUrl: '',
  }),
  actions: {
    setResume(text) { this.resumeText = text; },
    setJobDescription(text) { this.jobDescriptionText = text; },
    setVoice(voice) { this.selectedVoice = voice; },
    setQA(qa) { this.interviewQA = qa; },
    setCurrentQuestion(q) { this.currentQuestion = q; },
    setCurrentAnswer(a) { this.currentAnswer = a; },
    setTurn(t) { this.turn = t; },
    setInterviewing(val) { this.interviewing = val; },
    setShowAnswer(val) { this.showAnswer = val; },
    setIsThinking(val) { this.isThinking = val; },
    setAnswerTranscripts(arr) { this.answerTranscripts = arr; },
    setRecordedVideoUrl(url) { this.recordedVideoUrl = url; },
    resetInterview() {
      this.turn = 0;
      this.currentQuestion = '';
      this.currentAnswer = '';
      this.showAnswer = false;
      this.isThinking = false;
      this.answerTranscripts = [];
      this.recordedVideoUrl = '';
      this.interviewing = false;
    }
  }
});
