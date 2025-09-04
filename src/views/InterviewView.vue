<template>
  <div class="interview-main-layout">
    <div v-if="showInstructions">
      <InterviewInstructions @startInterview="startInterview" />
    </div>
    <div v-else class="interview-content">
      <!-- Interview in progress -->
      <div v-if="interviewQA.length && interviewing" class="main-card">
        <div class="section question-section">
          <div class="question-number" style="font-size:1.1rem; font-weight:600; color:#2563eb; margin-bottom:0.5rem;">
            {{ turn }}/{{ interviewQA.length }}
          </div>
          <h2 class="subtitle">Question</h2>
          <p class="question-text">{{ currentQuestion }}</p>
        </div>
        <div class="section answer">
          <h2 class="subtitle">Answer</h2>
          <div
            class="answer-body"
            v-if="showAnswer"
          >
            {{ currentAnswer }}
          </div>
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
      <!-- Show loading only if loadingTranscripts is true -->
      <SummaryView
        v-else-if="!interviewing && !allTranscriptsReceived"
        :interviewQA="interviewQA"
        :answerTranscripts="answerTranscripts"
        :recordedVideoUrl="recordedVideoUrl"
        :enableVideo="enableVideo"
        :loadingTranscripts="true"
      />
      <!-- Show summary only if interview is finished and not loading -->
      <SummaryView
        v-else-if="!interviewing && allTranscriptsReceived"
        :interviewQA="interviewQA"
        :answerTranscripts="answerTranscripts"
        :recordedVideoUrl="recordedVideoUrl"
        :enableVideo="enableVideo"
        :loadingTranscripts="false"
      />
      <div v-else style="color:#aaa; text-align:center;">No interview questions found.</div>
    </div>
  <div class="video-corner">
    <!-- Show VideoRecorder only at the end of the interview if enabled -->
    <!-- VideoRecorder only mounts if enableVideo is true -->
    <VideoRecorder
      v-if="enableVideo === true && !interviewing && showRecordedVideo"
      :interviewing="false"
      @video-mounted="videoPreview = $event"
      @videoUrl="recordedVideoUrl = $event"
      @download="handleDownload"
    />
    <AnswerRecorder
      v-if="interviewing && showAnswer"
      :silenceThreshold="silenceThreshold"
      :showAnswer="showAnswer"
      :questionIndex="turn - 1"
      @silenceDetected="onSilenceDetected"
      @audioBlob="onAudioBlob"
      ref="answerRecorder"
    />
  </div>
  <!-- Download button moved to VideoRecorder.vue -->
  </div>
</template>

<script>
import { sendToAssemblyAI } from '../services/assemblyAISpeechService';
import VideoRecorder from '../components/VideoRecorder.vue';
import InterviewInstructions from './InterviewInstructions.vue';
import AnswerRecorder from '../components/AnswerRecorder.vue';
import SummaryView from './SummaryView.vue';
import { getSetting } from '@/store/settingStore';
import { getInterviewQA, saveTranscriptionStatus } from '@/store/interviewStore';
export default {
  computed: {
    showRecordedVideo() {
      return this.enableVideo && !this.interviewing && this.recordedVideoUrl;
    },
    allTranscriptsReceived() {
      if (this.interviewing) {
        const allReceived = this.answerTranscripts.length === this.interviewQA.length;
        return false;
      }
      if (this.lastAudioBlob) {
        return false;
      }
      const allReceived = this.answerTranscripts.length === this.interviewQA.length && this.interviewQA.length > 0;
      if (allReceived) {
        return true;
      }
      if (this.answerTranscripts.length === 0 && this.interviewQA.length === 0) {
        return true;
      }
      return false;
    }
  },
  name: 'InterviewView',
  components: { VideoRecorder, InterviewInstructions, AnswerRecorder, SummaryView },
  data() {
    return {
      resumeText: '',
      selectedVoice: '',
      jobDescription: '',
      interviewStopping: false,
      interviewQA: [],
      currentQuestion: '',
      currentAnswer: '',
      turn: 0,
      interviewing: true,
      showAnswer: true,
      isThinking: false,
      answerTranscripts: [],
      recordedVideoUrl: '',
      videoPreview: null,
      enableVideo: false,
      streamTimer: null,
      silenceTimer: null,
      silenceThreshold: Number(process.env.VUE_APP_SILENCE_WAIT_MS) || 3000, // Silence wait time from env
      silenceStart: null,
      showInstructions: true,
      loadingTranscripts: false,
      lastAudioBlob: null,
    };
  },
  async created() {
    this.resumeText = (await getSetting('resumeText')) || '';
    this.selectedVoice = (await getSetting('selectedVoice')) || '';
    this.jobDescription = (await getSetting('jobDescription')) || '';
    this.enableVideo = (await getSetting('enableVideo')) === 'true';
    const qaArr = await getInterviewQA(); // Use your session key or logic
    this.interviewQA = qaArr || [];
  },
  mounted() {
    this.$on('video-mounted', (videoEl) => { this.videoPreview = videoEl; });
    this.showInstructions = false;
    this.interviewing = true;
    this.turn = 0;
    this.answerTranscripts = [];
    console.log("[Debug] On mount interviewing:", this.interviewing);
  },
  beforeUnmount() {
    this.clearStream();
  },
  methods: {
    onSilenceDetected() {
      this.nextQuestion();
    },
    async onAudioBlob(blob) {
      this.showAnswer = false; // Unmount AnswerRecorder immediately
      this.lastAudioBlob = blob;
      try {
        const transcript = await sendToAssemblyAI(blob);
        this.answerTranscripts.push(transcript || '[No transcript received]');
      } catch (err) {
        this.answerTranscripts.push('[Transcription error]');
      } finally {
        this.lastAudioBlob = null;
        this.loadingTranscripts = false;
        this.interviewStopping = false;
      }
    },
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
    async startInterview() {
      console.log("[Debug] startInterview called");
      try {
        if (this.enableVideo) {
          await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } else {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        this.showInstructions = false;
        this.interviewing = true;
        this.turn = 0;
        this.answerTranscripts = [];
        this.nextQuestion();
      } catch (err) {
        console.error('[InterviewView] Permission error:', err);
        window.alert('Microphone (and camera, if enabled) permission denied. Please allow access to start the interview.');
      }
    },
    async stopInterview() {
      await saveTranscriptionStatus(true);
      if (this.$refs.answerRecorder && this.$refs.answerRecorder.isRecording) {
        this.$refs.answerRecorder.stopRecording();
      }
      this.interviewing = false;
      this.showAnswer = false;
      this.$router.push({ name: 'SummaryView' });
    },
    nextQuestion() {
      console.log("[Debug] nextQuestion called");
      if (!this.interviewing || this.interviewStopping) return;
      if (this.turn >= this.interviewQA.length) {
        console.log("[Debug] Interview finished");
        this.interviewing = false;
        this.showAnswer = false;
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
      console.log("[Debug] Current turn:", this.turn);
      console.log("[Debug] Next question:", qa.question);
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
      const delayFactor = Number(process.env.VUE_APP_STREAM_DELAY_FACTOR) || 1;
      const chunkSizeFactor = Number(process.env.VUE_APP_STREAM_CHUNK_FACTOR) || 1;

      console.log('Streaming answer with chunk size factor:', chunkSizeFactor);
      console.log('Streaming answer with delay factor:', delayFactor);

      if (!delayFactor || !chunkSizeFactor) {
        throw new Error('Missing VUE_APP_STREAM_DELAY_FACTOR or VUE_APP_STREAM_CHUNK_FACTOR in environment variables.');
      }

      const baseChunkSize = Math.max(Math.ceil((text || '').length / 16), 8);
      const chunkSize = Math.round(baseChunkSize * chunkSizeFactor);

      const baseMinDelay = 500;
      const baseMaxDelay = 700;
      const minDelay = Math.floor(baseMinDelay * delayFactor);
      const maxDelay = Math.floor(baseMaxDelay * delayFactor);

      const chars = [...(text || '')];
      let i = 0;
      const typeChunk = () => {
        if (i >= chars.length) {
          this.clearStream();
          return;
        }
        this.currentAnswer += chars.slice(i, i + chunkSize).join('');
        i += chunkSize;
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        this.streamTimer = setTimeout(typeChunk, delay);
      };
      typeChunk();
    },
    clearStream() {
      if (this.streamTimer) { clearInterval(this.streamTimer); this.streamTimer = null; }
    },
   async speakQuestion(text, onEnd) {
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
    audio.play().catch(e => {
      console.error('Audio playback error:', e);
      if (typeof onEnd === 'function') onEnd();
    });
  } catch (e) {
    console.error('Azure TTS error:', e);
    if (typeof onEnd === 'function') onEnd();
  }
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
  width: 80vw;
  max-width: 800px;
  margin: 0 auto 1rem auto;
  border-radius: 16px;
  background: #f5f5f5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem 2vw 2rem 2vw;
}
.section.question-section {
  width: 80vw;
  max-width: 800px;
  margin: 0 auto 2.5rem auto;
  border-radius: 16px;
  background: #f5f5f5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem 2vw 2rem 2vw;
  z-index: 1;
  position: static;
  height: auto;
}
.section.question-section {
  z-index: 1;
  position: static;
  height: auto;
}
.section.answer {
  width: 80vw;
  max-width: 800px;
  margin: 0 auto 1rem auto;
  border-radius: 16px;
  background: #f5f5f5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem 2vw 2rem 2vw;
  min-height: 320px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
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
.otter-transcript {
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  font-size: 18px; /* Fixed font size similar to Otter.ai */
  background: #f8fafc;
  line-height: 1.7;
  color: #222;
  box-shadow: 0 2px 8px rgba(59,130,246,0.07);
  word-break: break-word;
  overflow-wrap: anywhere;
}
.answer-body {
  font-size: 18px; /* Match Otter.ai font size */
  color: #333;
  white-space: pre-wrap;
  margin-top: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
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
