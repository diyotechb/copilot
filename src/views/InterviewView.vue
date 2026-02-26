<template>
  <div class="setup-page-view">
    <!-- Interview Active State -->
    <div v-if="interviewQA.length && interviewing" class="interview-main">

      <div class="interview-scroll-container" ref="transcriptScroller">

        <!-- Header -->
        <div class="interview-header">
          <div class="header-left">
            <h2>Live Interview Session</h2>
            <p class="header-subtitle">Speak clearly and take your time.</p>
          </div>
          <div class="header-right">
            <span class="step-indicator">STEP 3/3</span>
          </div>
        </div>

        <!-- Full transcript history -->
        <div class="transcript_area">
          <div
              v-for="(item, index) in interviewTranscript"
              :key="index"
              v-show="item.type === 'user' || showQuestionSection"
              :class="['transcript-line', item.type]"
          >
            <!-- Avatar Column -->
            <div class="avatar-column">
              <div v-if="item.type === 'user'" class="user-avatar-small">Y</div>
              <div v-else class="user-avatar-small interviewer-avatar">I</div>
            </div>

            <!-- Content Column -->
            <div class="content-column">
              <div class="meta-header">
                <span class="speaker-label">{{ item.type === 'user' ? 'YOU' : 'INTERVIEWER' }}</span>
                <span class="time-stamp">{{ item.time }}</span>
              </div>
              <div class="text-container">
                <span class="text">{{ item.text }}</span>
              </div>
            </div>
          </div>

          <!-- Live status rows -->
          <template v-if="!showQuestionSection">
            <template v-if="isReading">
              <div class="transcript-line interviewer thinking">
                <div class="avatar-column">
                  <div class="user-avatar-small interviewer-avatar">I</div>
                </div>
                <div class="content-column">
                  <div class="meta-header">
                    <span class="speaker-label">INTERVIEWER</span>
                    <span class="time-stamp">{{ nowTime }}</span>
                  </div>
                  <div class="text-container">
                    <div class="status-pill speaking-pill">
                      <span class="pill-dot"></span> Speaking…
                    </div>
                  </div>
                </div>
              </div>
              <div class="transcript-line user thinking">
                <div class="avatar-column">
                  <div class="user-avatar-small">Y</div>
                </div>
                <div class="content-column">
                  <div class="meta-header">
                    <span class="speaker-label">YOU</span>
                    <span class="time-stamp">{{ nowTime }}</span>
                  </div>
                  <div class="text-container">
                    <div class="status-pill listening-pill">
                      <span class="pill-dot"></span> Listening…
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </template>

          <!-- When questions ARE visible -->
          <template v-if="showQuestionSection && isReading">
            <div class="transcript-line user thinking">
              <div class="avatar-column">
                <div class="user-avatar-small">Y</div>
              </div>
              <div class="content-column">
                <div class="meta-header">
                  <span class="speaker-label">YOU</span>
                  <span class="time-stamp">{{ nowTime }}</span>
                </div>
                <div class="text-container">
                  <div class="status-pill listening-pill">
                    <span class="pill-dot"></span> Listening…
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Control Bar -->
      <div class="control_bar">

        <!-- Status Left -->
        <div class="control-status">
          <div class="status-indicator-wrap">
            <div class="indicator-visual">
              <!-- Silence countdown bar -->
              <template v-if="silenceProgress > 0 && !isPaused">
                <div class="silence-countdown">
                  <div class="cbar-track">
                    <div class="cbar-fill" :style="{ width: silenceProgress * 100 + '%' }"></div>
                  </div>
                  <span class="cbar-secs">{{ countdownSecsLeft }}s</span>
                </div>
              </template>
              <!-- Recording or Paused wave -->
              <template v-else>
                <div class="audio-wave" :class="{ 'paused-wave': isPaused }">
                  <div class="bar"></div><div class="bar"></div>
                  <div class="bar"></div><div class="bar"></div>
                  <div class="bar"></div>
                </div>
              </template>
            </div>
            <span class="status-label" :class="isPaused || silenceProgress > 0 ? 'paused-text' : 'recording-text'">
              {{ isPaused ? 'Paused' : 'Recording...' }}
            </span>
          </div>
          <span class="session-timer">{{ formatDuration(currentMediaTime) }}</span>
        </div>

        <!-- Progress Centre -->
        <div class="bar-progress-group">
          <div class="progress-info-row">
            <span class="progress-text">Question {{ turn }} of {{ interviewQA.length }}</span>
            <span class="progress-percent">{{ Math.round((turn / interviewQA.length) * 100) }}%</span>
          </div>
          <div class="footer-progress-bar">
            <div class="progress-fill" :style="{ width: (turn / interviewQA.length) * 100 + '%' }"></div>
          </div>
        </div>

        <!-- Controls Right -->
        <div class="controls-group">
          <div class="controls">
            <el-button type="danger" circle class="record-btn" title="Stop Session" @click="stopInterview">
              <i class="el-icon-close"></i>
            </el-button>
            <div class="control-text">Stop</div>
          </div>

          <div class="controls video-control-wrap" v-if="enableVideo">
            <!-- Video popup anchored above the button -->
            <transition name="video-pop">
              <div v-if="showVideoPreview" class="video-popup">
                <div class="video-popup-header">
                  <span>Live Preview</span>
                  <button class="video-popup-close" @click.stop="showVideoPreview = false">
                    <i class="el-icon-close"></i>
                  </button>
                </div>
                <div class="video-popup-body">
                  <video ref="inlinePreviewVideo" autoplay muted playsinline class="inline-preview-video"></video>
                </div>
              </div>
            </transition>
            <el-button type="info" circle class="record-btn" :class="{ 'video-active': showVideoPreview }" title="Toggle Video" @click="toggleVideoPreview">
              <i class="el-icon-video-camera"></i>
            </el-button>
            <div class="control-text">Video</div>
          </div>

          <div class="controls">
            <el-button
                :type="isPaused ? 'primary' : 'warning'"
                circle class="record-btn"
                :class="{ 'is-recording': !isPaused, 'is-paused': isPaused }"
                @click="togglePause">
              <i :class="isPaused ? 'el-icon-microphone' : 'el-icon-video-pause'"></i>
            </el-button>
            <div class="control-text">{{ isPaused ? 'Resume' : 'Pause' }}</div>
          </div>

          <div class="controls">
            <el-button
                type="success" circle class="record-btn done-btn"
                :disabled="!interviewing || isPaused"
                @click="nextQuestion">
              <i class="el-icon-arrow-right"></i>
            </el-button>
            <div class="control-text">Next</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary State -->
    <div v-else-if="!interviewing" class="summary-wrapper">
      <SummaryView />
    </div>

    <!-- Empty State -->
    <div v-else class="setup-status-view">
      <div class="status-content">
        <i class="el-icon-warning-outline empty-icon"></i>
        <h3>No Questions Ready</h3>
        <p>Return to setup to generate your interview questions.</p>
        <el-button type="primary" style="margin-top: 20px;" @click="$router.push({name: 'ResumeSetup'})">Back to Setup</el-button>
      </div>
    </div>

    <!-- Background Recorders -->
    <div class="system-recorders">
      <VideoRecorder
          v-if="enableVideo"
          ref="videoRecorder"
          :visible="showVideoPreview"
          :interviewing="interviewing"
          @close="showVideoPreview = false"
          @recordingStarted="onVideoRecordingStarted"
          :audioMixStream="mixDestination ? mixDestination.stream : null"
      />
      <AnswerRecorder
          v-if="interviewing && showAnswer && turn > 0"
          :showAnswer="showAnswer"
          :questionIndex="turn - 1"
          :isPaused="isPaused"
          @transcript="handleTranscriptReady"
          @silenceDetected="onSilenceDetected"
          @silenceProgress="onSilenceProgress"
          :sharedAudioCtx="sharedAudioCtx"
          :mixDestination="mixDestination"
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
import { getInterviewQA, saveQuestionTimestamps } from '@/store/interviewStore';
import { highlightTranscript, averageConfidence } from '@/utils/transcriptUtils';
import { speakWithAzureTTS, speakWithAzureTTSToContext } from '@/services/azureSpeechService';
import FeedbackSection from '../views/FeedbackSection.vue';

export default {
  name: 'InterviewView',
  components: { VideoRecorder, InterviewInstructions, AnswerRecorder, SummaryView, FeedbackSection },

  data() {
    return {
      selectedVoice: '',
      interviewQA: [],
      interviewTranscript: [],   // full history shown in UI
      turn: 0,
      interviewing: true,
      // AnswerRecorder is mounted ONLY after TTS finishes — silence detection starts then
      showAnswer: false,
      isReading: false,          // TTS in progress → show thinking dots
      silenceProgress: 0,        // 0–1, drives footer countdown bar
      transitioning: false,      // guard: blocks nextQuestion re-entry during advance
      answerTranscripts: [],
      enableVideo: false,
      showVideoPreview: false,
      isPaused: false,
      currentMediaTime: 0,
      lastTickTime: null,
      timerInterval: null,
      questionTimestamps: [],
      activeInterviewerAudio: null,
      interviewStopping: false,
      difficultyLevel: null,
      showInstructions: true,
      showQuestionSection: true,
      lastAudioBlob: null,
      transcriptLoaded: false,
      transcriptLoading: false,
      showTranscriptSection: false,
      currentTranscript: null,
      videoMinimized: false,
      streamTimer: null,
      videoRecordingStartTime: null,
      sharedAudioCtx: null,       // shared Web Audio context for TTS+mic mixing
      mixDestination: null,        // MediaStreamDestination — its stream goes into VideoRecorder
    };
  },

  computed: {
    nowTime() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    countdownSecsLeft() {
      // silenceThreshold is 3000ms; show 3→2→1→0
      const remaining = Math.ceil((1 - this.silenceProgress) * 3);
      return Math.max(0, remaining);
    },
  },

  async created() {
    const storedQA = await getInterviewQA();
    this.interviewQA = Array.isArray(storedQA) ? storedQA : [];
    this.difficultyLevel = await getSetting('interviewDifficulty');
  },

  async mounted() {
    this.enableVideo = await getSetting('enableVideo');
    const savedShowQuestions = await getSetting('showQuestions');
    if (savedShowQuestions !== null) this.showQuestionSection = savedShowQuestions;
    const savedVoice = await getSetting('selectedVoice');
    this.selectedVoice = savedVoice;
    this.interviewQA = await getInterviewQA();
    if (this.$route && this.$route.name === 'InterviewView') {
      this.showInstructions = false;
      this.interviewing = true;
      this.turn = 0;
      this.currentMediaTime = 0;
      this.questionTimestamps = [];
      this.answerTranscripts = [];
      this.startTimer();
      this.nextQuestion();
    }
    // Release camera/mic if the user refreshes or closes the page
    this._beforeUnloadHandler = () => this.releaseMediaDevices();
    window.addEventListener('beforeunload', this._beforeUnloadHandler);
  },

  beforeRouteLeave(to, from, next) {
    this.releaseMediaDevices();
    next();
  },

  beforeUnmount() {
    this.releaseMediaDevices();
    if (this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
    }
    this.stopTimer();
    this.clearStream();
  },

  methods: {
    // ── Release all media devices (camera + mic) ──────────────────────────
    releaseMediaDevices() {
      if (this.$refs.answerRecorder) {
        try { this.$refs.answerRecorder.stopRecording(); } catch (e) {}
      }
      if (this.$refs.videoRecorder) {
        try { this.$refs.videoRecorder.forceStopAllTracks(); } catch (e) {}
      }
      // Cancel any TTS
      if (this.activeInterviewerAudio) {
        try {
          if (typeof this.activeInterviewerAudio.pause === 'function') this.activeInterviewerAudio.pause();
          else if (window.speechSynthesis) window.speechSynthesis.cancel();
        } catch (e) {}
        this.activeInterviewerAudio = null;
      }
    },

    highlightTranscript,
    averageConfidence,

    // ── Video Preview Popup ───────────────────────────────────────────────
    toggleVideoPreview() {
      this.showVideoPreview = !this.showVideoPreview;
      if (this.showVideoPreview) {
        // Wire the video stream to our inline preview element after DOM update
        this.$nextTick(() => {
          const videoEl = this.$refs.inlinePreviewVideo;
          const recorderStream = this.$refs.videoRecorder && this.$refs.videoRecorder.mediaStream;
          if (videoEl && recorderStream) {
            videoEl.srcObject = recorderStream;
          }
        });
      }
    },

    onVideoRecordingStarted(wallClockMs) {
      this.videoRecordingStartTime = wallClockMs;
    },

    // ── Called every 100ms by AnswerRecorder while silent ─────────────────
    onSilenceProgress(progress) {
      if (this.isPaused || this.transitioning) return;
      this.silenceProgress = progress;
    },

    // ── Called exactly once by AnswerRecorder when threshold exceeded ──────
    onSilenceDetected() {
      if (this.isPaused || this.transitioning) return;
      this.silenceProgress = 0;
      this.nextQuestion();
    },

    // ── Core flow ─────────────────────────────────────────────────────────
    nextQuestion() {
      // Hard guard — only one advance at a time
      if (this.transitioning || !this.interviewing || this.interviewStopping) return;
      this.transitioning = true;

      // Tear down current recorder and any streaming
      this.clearStream();
      this.showAnswer = false;
      this.silenceProgress = 0;
      this.isReading = false;

      // Cancel any active TTS
      if (this.activeInterviewerAudio) {
        if (typeof this.activeInterviewerAudio.pause === 'function') this.activeInterviewerAudio.pause();
        else if (window.speechSynthesis) window.speechSynthesis.cancel();
        this.activeInterviewerAudio = null;
      }

      if (this.turn >= this.interviewQA.length) {
        this.interviewing = false;
        this.transitioning = false;
        return;
      }

      const qa = this.interviewQA[this.turn];
      this.turn++;

      // Push question into transcript history
      this.interviewTranscript.push({
        type: 'interviewer',
        text: qa.question,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      this.isReading = true;
      this.scrollTranscript();

      // Timestamp = video offset at the moment the question starts being read aloud
      const videoOffsetMs = this.videoRecordingStartTime
          ? Date.now() - this.videoRecordingStartTime
          : this.currentMediaTime;
      this.questionTimestamps[this.turn - 1] = videoOffsetMs;

      // Speak the question; only after it finishes — open mic + stream answer
      const ttsFunc = (this.sharedAudioCtx && this.mixDestination)
          ? (text, voice, onEnd) => speakWithAzureTTSToContext(text, voice, this.sharedAudioCtx, this.mixDestination, onEnd)
          : speakWithAzureTTS;
      ttsFunc(qa.question, this.selectedVoice, () => {
        if (!this.interviewing) { this.transitioning = false; return; }
        this.isReading = false;
        this.showAnswer = true;     // mounts AnswerRecorder → mic on → silence detection starts
        this.transcriptLoaded = true;
        this.transitioning = false; // allow next advance only after TTS done

        // Push answer entry then stream word-by-word so candidate can read along
        const answerEntry = {
          type: 'user',
          text: '',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        this.interviewTranscript.push(answerEntry);
        this.streamAnswer(qa.answer, answerEntry);
      }).then(audio => {
        this.activeInterviewerAudio = audio;
      });
    },

    streamAnswer(text, entry) {
      const WPM = 130;
      const BASE_DELAY = (60 / WPM) * 1000;
      const words = (text || '').split(' ');
      let i = 0;
      const typeWord = () => {
        if (!this.interviewing) return;
        // If paused mid-stream, park here and wait for resumeStream() to call us
        if (this.isPaused) {
          this.streamTimer = null;
          this._streamResumeCallback = typeWord;
          return;
        }
        if (i >= words.length) {
          this.streamTimer = null;
          this._streamResumeCallback = null;
          return;
        }
        entry.text += (i === 0 ? '' : ' ') + words[i];
        i++;
        this.scrollTranscript();
        const lastChar = words[i - 1].slice(-1);
        const delay = ['.', '!', '?'].includes(lastChar)
            ? BASE_DELAY * 2.5 + Math.random() * 200
            : [',', ';', ':'].includes(lastChar)
                ? BASE_DELAY * 1.5 + Math.random() * 100
                : BASE_DELAY * (0.7 + Math.random() * 0.6);
        this.streamTimer = setTimeout(typeWord, delay);
      };
      this._streamResumeCallback = null;
      typeWord();
    },

    clearStream() {
      if (this.streamTimer) { clearTimeout(this.streamTimer); this.streamTimer = null; }
      this._streamResumeCallback = null;
      this._pausedStreamTimer = false;
    },

    scrollTranscript() {
      this.$nextTick(() => {
        const el = this.$refs.transcriptScroller;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    handleTranscriptReady(transcript) {
      this.currentTranscript = transcript;
      this.showTranscriptSection = true;
      this.transcriptLoading = false;
    },

    // ── Stop ──────────────────────────────────────────────────────────────
    async stopInterview() {
      this.transitioning = true; // prevent any queued advance
      this.clearStream();
      this.releaseMediaDevices();
      this.stopTimer();
      await saveQuestionTimestamps(this.questionTimestamps);
      this.interviewing = false;
      this.showAnswer = false;
      this.$router.push({ name: 'SummaryView' });
    },

    // ── Pause / Resume ────────────────────────────────────────────────────
    togglePause() {
      this.isPaused = !this.isPaused;

      if (this.isPaused) {
        // ── PAUSE ──

        // 1. Pause TTS audio
        if (this.activeInterviewerAudio) {
          if (typeof this.activeInterviewerAudio.pause === 'function') this.activeInterviewerAudio.pause();
          else if (window.speechSynthesis) window.speechSynthesis.pause();
        }

        // 2. Freeze streaming answer — cancel pending timeout
        //    typeWord() checks isPaused on its next tick and self-parks as _streamResumeCallback
        if (this.streamTimer) {
          clearTimeout(this.streamTimer);
          this.streamTimer = null;
        }

        // 3. Pause mic + video recording
        if (this.$refs.answerRecorder) this.$refs.answerRecorder.pauseRecording();
        if (this.$refs.videoRecorder)  this.$refs.videoRecorder.pauseRecording();

      } else {
        // ── RESUME ──

        // 1. Resume TTS audio
        if (this.activeInterviewerAudio) {
          if (typeof this.activeInterviewerAudio.play === 'function') this.activeInterviewerAudio.play();
          else if (window.speechSynthesis) window.speechSynthesis.resume();
        }

        // 2. Resume streaming answer from exactly where it stopped
        if (this._streamResumeCallback) {
          const cb = this._streamResumeCallback;
          this._streamResumeCallback = null;
          cb();
        }

        // 3. Resume mic + video recording (restarts silence detection interval too)
        if (this.$refs.answerRecorder) this.$refs.answerRecorder.resumeRecording();
        if (this.$refs.videoRecorder)  this.$refs.videoRecorder.resumeRecording();
      }
    },

    // ── Timer ─────────────────────────────────────────────────────────────
    startTimer() {
      // Set up shared AudioContext for TTS + mic mixing into video recording
      this.sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.mixDestination = this.sharedAudioCtx.createMediaStreamDestination();
      this.lastTickTime = Date.now();
      this.timerInterval = setInterval(() => {
        const now = Date.now();
        if (!this.isPaused) this.currentMediaTime += (now - this.lastTickTime);
        this.lastTickTime = now;
      }, 100);
    },
    stopTimer() {
      if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
      if (this.sharedAudioCtx) {
        this.sharedAudioCtx.close();
        this.sharedAudioCtx = null;
        this.mixDestination = null;
      }
    },
    formatDuration(ms) {
      if (!ms) return '00:00';
      const s   = Math.floor(ms / 1000);
      const m   = Math.floor(s / 60);
      const sec = s % 60;
      return `${m < 10 ? '0' + m : m}:${sec < 10 ? '0' + sec : sec}`;
    },

    async startInterview() {
      try {
        const constraints = this.enableVideo ? { video: true, audio: true } : { audio: true };
        await navigator.mediaDevices.getUserMedia(constraints);
        this.showInstructions = false;
        this.interviewing = true;
        this.turn = 0;
        this.currentMediaTime = 0;
        this.questionTimestamps = [];
        this.answerTranscripts = [];
        this.startTimer();
        this.nextQuestion();
      } catch (err) {
        window.alert('Microphone permission denied. Please allow access to start the interview.');
      }
    },
  },
};
</script>

<style scoped>
.setup-page-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.interview-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  background: white;
  height: 100vh;
}

/* Scrollable zone */
.interview-scroll-container {
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
}

.interview-header {
  padding: 18px 60px;
  background: white;
  border-bottom: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.interview-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #1e293b;
}
.header-subtitle {
  color: #64748b;
  margin: 2px 0 0 0;
  font-size: 0.85rem;
}
.step-indicator {
  background: #e6f0ff;
  color: #2563eb;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.transcript_area {
  padding: 30px 60px;
  padding-bottom: 55vh;
  background: white;
}

.transcript-line {
  display: flex;
  gap: 12px;
  margin: 1.25rem 0;
  align-items: flex-start;
}

.avatar-column {
  flex-shrink: 0;
  width: 24px;
}

.content-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-avatar-small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #94a3b8;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
}

.interviewer-avatar {
  background: #64748b;
}

.time-stamp {
  font-size: 0.65rem;
  color: #b0b7c3;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.meta-header {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 24px; /* Match avatar height */
  margin-bottom: 2px;
}

.speaker-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
}

.transcript-line.user .speaker-label {
  color: #2563eb;
  opacity: 0.8;
}

.text-container {
  flex: 1;
  margin-top: -2px; /* Pull text closer to time */
}

.text {
  font-size: 1.1em;
  color: #0f172a;
  line-height: 1.6;
  font-weight: 400;
}

/* Typing indicator */
.typing-indicator { display: flex; gap: 4px; padding: 8px 0; }
.typing-indicator span {
  width: 6px; height: 6px;
  background: #94a3b8;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}
.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40%           { transform: scale(1.0); }
}

/* ── Control Bar ── */
.control_bar {
  background: white;
  padding: 20px 30px;
  border-top: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
  z-index: 20;
  height: 15px;
  overflow: visible;
  line-height: 1;
}
.control-status {
  display: flex;
  align-items: center;
  gap: 15px;
  min-width: 280px;
}
.status-indicator-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.indicator-visual {
  width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Silence countdown bar (replaces wave in footer) */
.silence-countdown {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cbar-track {
  width: 50px;
  height: 4px;
  background: #fef3c7;
  border-radius: 2px;
  overflow: hidden;
}
.cbar-fill {
  height: 100%;
  background: #f59e0b;
  border-radius: 2px;
  transition: width 0.1s linear;
}
.cbar-secs {
  font-size: 0.82rem;
  font-weight: 700;
  color: #f59e0b;
  min-width: 18px;
}

.recording-text {
  color: #f56c6c;
  font-weight: 600;
  font-size: 0.9em;
  animation: flash 2s infinite;
}
.paused-text { color: #e6a23c; animation: none; }
@keyframes flash {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}
.session-timer {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  color: #94a3b8;
  font-weight: 500;
}

.bar-progress-group { flex: 1; max-width: 420px; }
.progress-info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}
.progress-text    { font-size: 0.78rem; font-weight: 700; color: #475569; }
.progress-percent { font-size: 0.78rem; font-weight: 700; color: #2563eb; }
.footer-progress-bar {
  height: 4px;
  background: #f1f5f9;
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #2563eb;
  transition: width 0.35s ease;
}

.controls-group { display: flex; gap: 24px; }
.controls {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Video control with anchored popup */
.video-control-wrap {
  position: relative;
}
.video-popup {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 50%;
  transform: translateX(-50%);
  width: 260px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  z-index: 3000;
}
.video-popup::after {
  content: '';
  position: absolute;
  bottom: -7px;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 14px;
  background: white;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  transform: translateX(-50%) rotate(45deg);
}
.video-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.video-popup-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  padding: 2px 4px;
  font-size: 0.9rem;
  line-height: 1;
}
.video-popup-close:hover { color: #475569; }
.video-popup-body {
  aspect-ratio: 16/9;
  background: #000;
}
.inline-preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  display: block;
}
.record-btn.video-active {
  background-color: #2563eb;
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}
/* Popup transition */
.video-pop-enter-active, .video-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.video-pop-enter-from, .video-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
.video-pop-enter-to, .video-pop-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.record-btn {
  width: 30px;
  height: 30px;
  font-size: 14px;
  margin-bottom: 0;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
}
.record-btn i {
  margin: 0 !important;
  line-height: normal !important;
}
.record-btn.is-recording {
  background-color: #f56c6c;
  border-color: #f56c6c;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4);
}
.record-btn.is-paused {
  background-color: #e6a23c;
  border-color: #e6a23c;
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.4);
  color: white;
}
.done-btn { box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3); }
.control-text { display: none; }

/* Audio Wave */
.audio-wave { display: flex; align-items: center; gap: 2px; height: 12px; }
.bar { width: 3px; background-color: #f56c6c; border-radius: 2px; animation: wave 1s ease-in-out infinite; }
.paused-wave .bar { background-color: #e6a23c; animation: none; }
.bar:nth-child(1) { height: 60%; animation-delay: 0.0s; }
.bar:nth-child(2) { height: 80%; animation-delay: 0.1s; }
.bar:nth-child(3) { height: 100%; animation-delay: 0.2s; }
.bar:nth-child(4) { height: 70%; animation-delay: 0.3s; }
.bar:nth-child(5) { height: 50%; animation-delay: 0.4s; }
@keyframes wave {
  0%, 100% { transform: scaleY(1); }
  50%       { transform: scaleY(0.4); }
}
.recording-text { color: #f56c6c; transition: color 0.3s; }
.paused-text { color: #e6a23c; transition: color 0.3s; }

.summary-wrapper, .setup-status-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}
.system-recorders { display: none; }

/* ── Status pills (Listening / Thinking) ── */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  letter-spacing: 0.3px;
}
.speaking-pill {
  background: #eff6ff;
  color: #2563eb;
}
.speaking-pill .pill-dot {
  width: 7px; height: 7px;
  background: #2563eb;
  border-radius: 50%;
  animation: pillPulse 1.0s ease-in-out infinite;
}
.listening-pill {
  background: #f0fdf4;
  color: #16a34a;
}
.listening-pill .pill-dot {
  width: 7px; height: 7px;
  background: #16a34a;
  border-radius: 50%;
  animation: pillPulse 1.4s ease-in-out infinite;
}
@keyframes pillPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.7); }
}

/* ── Status indicator wrapper ── */
.status-indicator-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}
.status-label {
  font-weight: 600;
  font-size: 0.88em;
  white-space: nowrap;
}

/* Paused wave bars — static, muted */
.audio-wave.paused-wave .bar {
  background-color: #e6a23c;
  animation: none;
  height: 60% !important;
  opacity: 0.6;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .interview-header { padding: 14px 30px; }
  .transcript_area  { padding: 24px 30px; padding-bottom: 55vh; }
}

@media (max-width: 768px) {
  .interview-header {
    padding: 12px 16px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .interview-header h2 { font-size: 1rem; }
  .header-subtitle { font-size: 0.78rem; }

  /* Transcript: timestamp on its own line above text */
  .transcript_area  { padding: 14px 14px; padding-bottom: 55vh; }
  .transcript-line {
    gap: 10px;
  }
  .avatar-column, .user-avatar-small {
    width: 22px;
    height: 22px;
  }
  .user-avatar-small { font-size: 0.6rem; }
  .time-stamp {
    font-size: 0.6rem;
    line-height: 22px;
  }
  .text { font-size: 1em; }

  /* Control bar - forced ultra-slim */
  .control_bar {
    height: 15px !important;
    overflow: visible !important;
  }
  .control-status   { min-width: 0; flex: 1 1 auto; order: 1; }
  .bar-progress-group { flex: 1 1 100%; order: 3; max-width: 100%; }
  .controls-group   { order: 2; gap: 12px; }
  .status-indicator-wrap { min-width: 0; }

  .record-btn   { width: 30px !important; height: 30px !important; font-size: 14px !important; }
  .control-text { display: none !important; }

  /* Video popup: anchor to right edge */
  .video-popup {
    left: auto;
    right: 0;
    transform: none;
    width: 220px;
  }
  .video-popup::after {
    left: auto;
    right: 22px;
    transform: rotate(45deg);
  }
  .video-pop-enter-from, .video-pop-leave-to { transform: translateY(8px); }
  .video-pop-enter-to, .video-pop-leave-from { transform: translateY(0); }

  .cbar-track { width: 60px; }
  .session-timer { font-size: 0.78rem; }
}

@media (max-width: 480px) {
  .interview-header h2 { font-size: 0.92rem; }
  .transcript_area { padding: 10px 10px; padding-bottom: 55vh; }
  .text { font-size: 0.95em; }

  .control_bar { height: 15px !important; padding: 0 10px !important; gap: 6px; }
  .controls-group { gap: 8px; }
  .record-btn { width: 30px !important; height: 30px !important; font-size: 14px !important; }
  .control-text { display: none !important; }
  .bar-progress-group { display: none; }
  .silence-countdown .cbar-track { width: 50px; }
  .status-label { font-size: 0.8em; }
}
</style>