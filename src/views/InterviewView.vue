<template>
  <div class="interview-main-layout">
    <div v-if="showInstructions">
      <InterviewInstructions @startInterview="startInterview" />
    </div>
    <div v-else class="interview-content">
      <div v-if="interviewQA.length && interviewing" class="main-card">
        <div class="section question-section">
          <h2 class="subtitle">Question</h2>
          <p class="question-text">{{ currentQuestion }}</p>
        </div>
        <div class="section answer">
          <h2 class="subtitle">Answer</h2>
          <div class="answer-body" v-if="showAnswer">{{ currentAnswer }}</div>
          <div v-else-if="interviewing && isThinking" class="answer-body thinking-effect">
            <span>Thinking<span class="dots"><span>.</span><span>.</span><span>.</span></span></span>
          </div>
          <div v-else class="answer-body" style="color:#aaa;font-style:italic;">(Answer will appear after question is read)</div>
          <div v-if="answerTranscripts.length">
            <h3 style="margin-top:1rem;">Transcripts:</h3>
            <ul>
              <li v-for="(t, idx) in answerTranscripts" :key="idx" style="margin-bottom:0.5rem;">
                <strong>Answer {{ idx+1 }}:</strong> {{ t }}
              </li>
            </ul>
          </div>
        </div>
        <div class="actions fixed-actions">
          <button class="btn next" :disabled="!interviewing" @click="nextQuestion">Next Question</button>
          <button v-if="interviewing" class="btn stop" @click="stopInterview">Stop Interview</button>
        </div>
      </div>
      <div v-else style="color:#aaa; text-align:center;">No interview questions found.</div>
    </div>
  <div class="video-corner">
    <VideoRecorder
      :interviewing="interviewing && !showInstructions"
      @video-mounted="videoPreview = $event"
      @videoUrl="recordedVideoUrl = $event"
      @download="handleDownload"
    />
  </div>
  <!-- Download button moved to VideoRecorder.vue -->
  </div>
</template>

<script>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import VideoRecorder from '../components/VideoRecorder.vue';
import InterviewInstructions from './InterviewInstructions.vue';
export default {
  name: 'InterviewView',
  components: { VideoRecorder, InterviewInstructions },
  data() {
    return {
      resumeText: localStorage.getItem('resumeText') || '',
      selectedVoice: localStorage.getItem('selectedVoice') || '',
      jobDescription: localStorage.getItem('jobDescription') || '',
      interviewQA: [],
      currentQuestion: '',
      currentAnswer: '',
      turn: 0,
            interviewing: false,
      showAnswer: false,
      isThinking: false,
      answerTranscripts: [],
      recordedVideoUrl: '',
      videoPreview: null,
      streamTimer: null,
      silenceTimer: null,
      silenceThreshold: 5000, // 5 seconds
      silenceStart: null,
      showInstructions: true,
    };
  },
  created() {
    this.parseInterviewQA();
  },
  mounted() {
    this.$on('video-mounted', (videoEl) => { this.videoPreview = videoEl; });
    // If navigated here, check if we should start interview immediately
    if (this.$route && this.$route.name === 'InterviewView') {
      this.showInstructions = false;
      this.interviewing = true;
      this.turn = 0;
      this.answerTranscripts = [];
      this.nextQuestion();
    }
  },
  beforeUnmount() {
    this.clearStream();
  },
  methods: {
    handleDownload(url) {
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = 'interview-video.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    downloadVideo() {
      if (!this.recordedVideoUrl) return;
      const a = document.createElement('a');
      a.href = this.recordedVideoUrl;
      a.download = 'interview-video.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    parseInterviewQA() {
      const qaRaw = localStorage.getItem('interviewQA') || '';
      let qaArr = this.parseBatchQA(qaRaw);
      // Shuffle Q/A array
      for (let i = qaArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qaArr[i], qaArr[j]] = [qaArr[j], qaArr[i]];
      }
      this.interviewQA = qaArr;
    },
    parseBatchQA(content) {
      const qaPairs = [];
      const regex = /Question\s*\d+\s*:(.*?)\nAnswer\s*\d+\s*:(.*?)(?=\nQuestion|$)/gs;
      let match;
      while ((match = regex.exec(content)) !== null) {
        qaPairs.push({ question: match[1].trim(), answer: match[2].trim() });
      }
      if (qaPairs.length === 0 && content.trim()) {
        qaPairs.push({ question: content.trim(), answer: '' });
      }
      return qaPairs;
    },
    async startInterview() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        this.showInstructions = false;
        this.interviewing = true;
        this.turn = 0;
        this.answerTranscripts = [];
        this.nextQuestion();
      } catch (err) {
        window.alert('Camera and microphone permission denied. Please allow access to start the interview.');
      }
    },
    async stopInterview() {
      this.interviewing = false;
      this.clearStream();
      this.currentQuestion = 'Interview stopped.';
      this.currentAnswer = '';
      this.showAnswer = false;
    },
    nextQuestion() {
      if (!this.interviewing) return;
      if (this.turn >= this.interviewQA.length) {
        window.alert('Interview finished!');
        this.interviewing = false;
        this.clearStream();
        this.currentQuestion = 'Interview finished.';
        this.currentAnswer = '';
        this.showAnswer = false;
        return;
      }
      this.clearStream();
      this.showAnswer = false;
      this.isThinking = false;
      const qa = this.interviewQA[this.turn];
      this.currentQuestion = qa.question;
      this.currentAnswer = '';
      this.turn++;
      this.speakQuestion(qa.question, () => {
        // After TTS finishes, wait 3-6 seconds before showing the answer
        this.isThinking = true;
        const delay = Math.floor(Math.random() * 3000) + 3000;
        setTimeout(() => {
          this.isThinking = false;
          this.showAnswer = true;
          if (this.interviewing) {
            this.streamLocalAnswer(qa.answer);
          } else {
            this.currentAnswer = qa.answer;
          }
        }, delay);
        // Do not start/stop video recording here
      });
    },
    streamLocalAnswer(text) {
      const chunkSize = Math.max(Math.ceil((text || '').length / 16), 8); // Smaller chunks
      const chars = [...(text || '')];
      let i = 0;
      const typeChunk = () => {
        if (i >= chars.length) {
          this.clearStream();
          return;
        }
        this.currentAnswer += chars.slice(i, i+chunkSize).join('');
        i += chunkSize;
        const delay = Math.floor(Math.random() * 700) + 500; // Slower and randomized chunk reveal
        this.streamTimer = setTimeout(typeChunk, delay);
      };
      typeChunk();
    },
    clearStream() {
      if (this.streamTimer) { clearInterval(this.streamTimer); this.streamTimer = null; }
    },
    async speakQuestion(text, onEnd) {
      // Use Azure TTS or browser TTS
      const subscriptionKey = process.env.VUE_APP_AZURE_SPEECH_KEY;
      const region = process.env.VUE_APP_AZURE_SPEECH_REGION;
      if (!subscriptionKey || !region) {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utter = new window.SpeechSynthesisUtterance(text);
          utter.lang = 'en-US';
          utter.rate = 1.05;
          utter.onend = onEnd;
          window.speechSynthesis.speak(utter);
          return;
        }
        if (typeof onEnd === 'function') onEnd();
        return;
      }
      const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
      const ssml = `
        <speak version='1.0' xml:lang='en-US'>
          <voice xml:lang='en-US' name='${this.selectedVoice}'>
            ${text}
          </voice>
        </speak>
      `;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
            'User-Agent': 'InterviewViewVue'
          },
          body: ssml
        });
        if (!response.ok) throw new Error('Azure TTS failed');
        const audioData = await response.arrayBuffer();
        const blob = new Blob([audioData], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = onEnd;
        audio.play();
      } catch (e) {
        console.error('Azure TTS error:', e);
        if (typeof onEnd === 'function') onEnd();
      }
    },
    async startAnswerRecording() {
      // Remove answer timer, only use silence detection
      this.startSilenceDetection();
    },
    startSilenceDetection() {
      if (!this.mediaStream || !(this.mediaStream instanceof MediaStream)) {
        console.error('No valid mediaStream for silence detection.');
        return;
      }
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.mediaStreamSource.connect(this.analyser);
      const data = new Uint8Array(this.analyser.fftSize);
      this.silenceStart = null;
      this.silenceTimer = setInterval(() => {
        this.analyser.getByteTimeDomainData(data);
        const isSilent = data.every(v => Math.abs(v - 128) < 2);
        if (isSilent) {
          if (!this.silenceStart) this.silenceStart = Date.now();
          if (Date.now() - this.silenceStart > this.silenceThreshold) {
            this.stopAnswerRecording();
            this.nextQuestion();
          }
        } else {
          this.silenceStart = null;
        }
      }, 250);
    },
    stopAnswerRecording() {
      // Do not stop video recording here
      if (this.silenceTimer) clearInterval(this.silenceTimer);
      if (this.audioContext) this.audioContext.close();
      this.silenceTimer = null;
      this.audioContext = null;
      this.mediaStreamSource = null;
      this.analyser = null;
      this.silenceStart = null;
    }
  }
};
</script>

<style scoped>
/* Restore video preview to bottom right corner */
/* Move video preview further down to avoid obstructing answers */
.video-corner {
  position: fixed;
  bottom: 8px;
  right: 32px;
  z-index: 100;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.btn.download-btn {
  background: #10b981;
  color: #fff;
  border: none;
  padding: 0.8rem 2rem;
  border-radius: 0.75rem;
  font-size: 1.1rem;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(16,185,129,0.12);
  cursor: pointer;
  margin-top: 0.5rem;
  transition: background 0.2s;
}
.btn.download-btn:hover {
  background: #059669;
}
.interview-main-layout {
  overflow: hidden;
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
}
.interview-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  width: 100vw;
  height: 100vh;
}
.section {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #f6f8fa;
  margin-bottom: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}
.section.question-section,
.section.answer {
  width: 100vw;
  max-width: none;
  margin: 0 0 2.5rem 0;
  border-radius: 16px;
  background: #f5f5f5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem 3vw 2rem 3vw;
}
.section.question-section {
  z-index: 1;
  position: static;
  height: auto;
}
.section.answer {
  padding: 2rem 2rem 2rem 2rem;
  min-height: 320px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  max-width: none;
  margin: 0 0 1rem 0;
  width: auto;
  align-self: flex-start;
  overflow: hidden;
}
.answer-body {
  font-size: 1.15rem;
  color: #333;
  white-space: pre-wrap;
  margin-top: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}
.actions {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  margin-top: 2rem;
}
.fixed-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 32px;
  z-index: 200;
  background: transparent;
  justify-content: center;
  padding-bottom: 0;
}
.btn {
  padding: 0.8rem 2rem;
  border-radius: 0.75rem;
  font-size: 1.1rem;
  border: none;
  cursor: pointer;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  transition: background 0.2s;
}
.btn.next {
  background: #2563eb;
}
.btn.stop {
  background: #ef4444;
}
.btn:disabled {
  background: #a5b4fc;
  cursor: not-allowed;
}
.video-corner {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 100;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.thinking-effect {
  color: #2563eb;
  font-style: italic;
  font-size: 1.1em;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
}
.thinking-effect .dots {
  display: inline-block;
  animation: dots 1.5s infinite;
}
.thinking-effect .dots span {
  animation: blink 1.2s infinite;
  opacity: 0.3;
  margin-left: 2px;
}
.thinking-effect .dots span:nth-child(2) {
  animation-delay: 0.4s;
}
.thinking-effect .dots span:nth-child(3) {
  animation-delay: 0.8s;
}
@keyframes dots {
  0%, 20% { opacity: 0; }
  40% { opacity: 1; }
  60% { opacity: 1; }
  80%, 100% { opacity: 0; }
}
@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}
</style>
