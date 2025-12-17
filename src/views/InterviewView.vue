<template>
  <div class="interview-main-layout">
    <div v-if="showInstructions">
      <InterviewInstructions @startInterview="startInterview" />
    </div>
    <div v-else class="interview-content">
      <!-- Interview in progress -->
      <div v-if="interviewQA.length && interviewing" class="main-card">
        <div class="question-number" style="font-size:1.1rem; font-weight:600; color:#2563eb; margin-bottom:0.5rem;">
          {{ turn }}/{{ interviewQA.length }}
        </div>
        <!-- Question Section -->
        <div v-if="showQuestionSection" class="section question-section">
          <h2 class="subtitle">Question</h2>
          <p class="question-text">{{ currentQuestion }}</p>
        </div>
        <!-- Answer Section -->
        <div class="section answer">
          <h2 class="subtitle">Answer</h2>
          <div class="answer-body" v-if="showAnswer">
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
        <!-- Transcript Section for Beginner -->
        <div v-if="showTranscriptSection && difficultyLevel === 'Beginner'" class="section transcript-section">
          <h3>Transcript</h3>
          <div v-if="transcriptLoading" style="color:#2563eb; font-style:italic;">
            Loading transcript...
          </div>
          <p v-else class="otter-transcript" v-html="highlightTranscript(currentTranscript)"></p>
          <div v-if="currentTranscript && currentTranscript.words">
              <table class="transcript-metrics-table">
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
              <tr>
                <td>Confidence</td>
                <td>{{ averageConfidence(currentTranscript.words) }}%</td>
              </tr>
              <tr>
                <td>Filler Words</td>
                <td>{{ currentTranscript._fillerWordCount }}</td>
              </tr>
              <tr>
                <td>Filler Word Percentage</td>
                <td>
                  {{ ((currentTranscript._fillerWordCount / currentTranscript.words.length) * 100).toFixed(1) }}%
                </td>
              </tr>
            </table>
          </div>
          <FeedbackSection v-if="currentTranscript && currentTranscript.words" :transcript="currentTranscript" />
          <!-- Legend for highlights -->
          <div class="transcript-legend" style="margin-top:1.5rem;">
          <strong>Legend:</strong>
          <div>
            <span
              style="background:rgba(34,197,94,0.15);padding:2px 8px;border-radius:4px;"
              title="Positive sentiment: Indicates the speaker expressed positive emotion or approval in this segment."
            >Positive sentiment</span>
            <span
              style="background:rgba(239,68,68,0.15);padding:2px 8px;border-radius:4px;margin-left:8px;"
              title="Negative sentiment: Indicates the speaker expressed negative emotion or disapproval in this segment."
            >Negative sentiment</span>
            <span
              style="background:rgba(59,130,246,0.10);padding:2px 8px;border-radius:4px;margin-left:8px;"
              title="Neutral sentiment: Indicates the speaker expressed neutral or factual information."
            >Neutral sentiment</span>
            <span
              style="color:#a855f7;font-weight:bold;margin-left:8px;"
              title="Filler word: Common words or phrases that do not add meaning, such as 'um', 'uh', 'you know'."
            >Filler word</span>
            <span
              style="background:#fee2e2;color:#dc2626;border-radius:3px;font-weight:bold;margin-left:8px;"
              title="Low confidence: The speech recognition system was not confident about this word."
            >Low confidence</span>
            <span
              style="background:#fef9c3;color:#ca8a04;border-radius:3px;font-weight:bold;margin-left:8px;"
              title="Medium confidence: The speech recognition system was moderately confident about this word."
            >Medium confidence</span>
          </div>
        </div>
        </div>
        <!-- Actions (Buttons) always below all sections -->
        <div class="fixed-actions" style="margin-top:2rem;">
          <button
            class="btn next"
            :disabled="!interviewing || (difficultyLevel === 'Beginner' && !transcriptLoaded)"
            @click="nextQuestion"
          >
            Next Question
          </button>
          <button v-if="interviewing" class="btn stop" @click="stopInterview">Stop Interview</button>
        </div>
      </div>
      <SummaryView
        v-else-if="!interviewing"
      />
      <div v-else style="color:#aaa; text-align:center;">No interview questions found.</div>
    </div>
    <div class="video-corner">
      <!-- Show VideoRecorder only at the end of the interview if enabled -->
      <VideoRecorder v-if="enableVideo === true" ref="videoRecorder"/>
      <AnswerRecorder
        v-if="interviewing && showAnswer"
        :showAnswer="showAnswer"
        :questionIndex="turn - 1"
        @transcript="handleTranscriptReady"
        @silenceDetected="onSilenceDetected"
        ref="answerRecorder"
      />
    </div>
  </div>
</template>

<script>
import VideoRecorder from '../components/VideoRecorder.vue';
import InterviewInstructions from './InterviewInstructions.vue';
import AnswerRecorder from '../components/AnswerRecorder.vue';
import SummaryView from './SummaryView.vue';
import { getSetting } from '@/store/settingStore';
import { getInterviewQA } from '@/store/interviewStore';
import { highlightTranscript, averageConfidence } from '@/utils/transcriptUtils';
import { speakWithAzureTTS } from '@/services/azureSpeechService';
import FeedbackSection from '../views/FeedbackSection.vue';

export default {
  watch: {
    feedbackMessage(newVal, oldVal) {
      if (newVal && newVal !== oldVal && this.selectedVoice && this.difficultyLevel === 'Beginner') {
        speakWithAzureTTS(newVal, this.selectedVoice, () => {
          this.transcriptLoaded = true;
        });
    }
  },
},
  computed: {
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
    },
  },
  name: 'InterviewView',
  components: { VideoRecorder, InterviewInstructions, AnswerRecorder, SummaryView, FeedbackSection },
  data() {
    return {
      selectedVoice: '',
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
      silenceThreshold: Number(process.env.VUE_APP_SILENCE_WAIT_MS) || 3000, 
      showQuestionSection: process.env.VUE_APP_SHOW_QUESTION_SECTION === 'true',
      showInstructions: true,
      loadingTranscripts: false,
      lastAudioBlob: null,
      difficultyLevel: null,
      showTranscriptSection: false,
      currentTranscript: null,
      transcriptLoading: false,
      transcriptLoaded: false,
    };
  },
  async created() {
    const storedQA = await getInterviewQA();
    this.interviewQA = Array.isArray(storedQA) ? storedQA : [];
    this.difficultyLevel = await getSetting('interviewDifficulty');
  },  
  async mounted() {
    this.enableVideo = await getSetting('enableVideo');
    this.$on('video-mounted', (videoEl) => { this.videoPreview = videoEl; });
    const savedVoice = await getSetting('selectedVoice');
    this.selectedVoice = savedVoice; 
    this.interviewQA = await getInterviewQA();
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
    highlightTranscript,
    averageConfidence,
    async onSilenceDetected() {
      if (this.difficultyLevel === 'Intermediate') {
        this.nextQuestion();
      } else {
        this.showTranscriptSection = true;
        this.transcriptLoading = true;
      }
    },
    async startInterview() {
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
      if (this.$refs.answerRecorder && this.$refs.answerRecorder.isRecording) {
        this.$refs.answerRecorder.stopRecording();
      }
      if (this.$refs.videoRecorder && this.enableVideo) {
        this.$refs.videoRecorder.stopRecording();
      }
      this.interviewing = false;
      this.showAnswer = false;
      this.$router.push({ name: 'SummaryView' });
    },
    nextQuestion() {
      if (!this.interviewing || this.interviewStopping) return;
      if (this.turn >= this.interviewQA.length) {
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
      this.showTranscriptSection = false;
      this.currentTranscript = null;
      this.transcriptLoaded = false;
      this.transcriptLoading = false;
      const qa = this.interviewQA[this.turn];
      this.currentQuestion = qa.question;
      this.currentAnswer = '';
      this.turn++;
      speakWithAzureTTS(qa.question, this.selectedVoice, () => {
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
    handleTranscriptReady(transcript) {
      this.currentTranscript = transcript;
      this.showTranscriptSection = true;
      this.transcriptLoading = false;
    }
  }
};
</script>

<style scoped>
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
  min-height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  overflow-x: hidden;
  overflow-y: auto; /* Allow vertical scrolling */
}

.interview-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  width: 100vw;
  min-height: 100vh;
  overflow-x: hidden;
  overflow-y: auto; /* Allow vertical scrolling */
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
  margin: 3rem auto 1rem auto;
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
.section.transcript-section {
  width: 80vw;
  max-width: 800px;
  margin: 0 auto 1rem auto;
  border-radius: 16px;
  background: #e0e7ff; /* Slightly different background color */
  box-shadow: 0 2px 8px rgba(59,130,246,0.07);
  padding: 2.5rem 2vw 2rem 2vw;
  min-height: 220px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  overflow: hidden;
  margin-bottom: 6rem;
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
  display: flex;
  gap: 1.5rem;
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
.transcript-metrics-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
  background: #f8fafc;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(59,130,246,0.07);
}
.transcript-metrics-table th,
.transcript-metrics-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  font-size: 1rem;
}
.transcript-metrics-table th {
  background: #e0e7ff;
  font-weight: 600;
}
.transcript-metrics-table tr:last-child td {
  border-bottom: none;
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