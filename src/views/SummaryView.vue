<template>
  <div class="setup-page-view">
    <!-- Loading / Processing States -->
    <div v-if="loadingTranscripts || (enableVideo && !recordedVideoUrl && !videoTimeout)" class="setup-status-view">
      <div class="status-content">
        <div class="main-loader"></div>
        <h3>{{ loadingTranscripts ? 'Preparing Transcripts' : 'Processing Video' }}</h3>
        <p>The system is finalizing your interview review. This will only take a moment.</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else>
      <div class="setup-view-header">
        <div class="header-main">
          <h2>Interview Performance Summary</h2>
          <p class="header-subtitle">Review your recordings, transcripts, and automated feedback.</p>
        </div>
        <div class="header-actions">
          <el-button
              type="primary"
              icon="el-icon-refresh-left"
              @click="$router.push({ name: 'ResumeSetup' })">
            Start New Session
          </el-button>
        </div>
      </div>

      <div class="setup-form-container">
        <!-- Video Recording Card -->
        <div v-if="enableVideo" class="setup-card video-card">
          <div class="card-header highlight">
            <i class="el-icon-video-camera"></i>
            <h3>Session Recording</h3>
          </div>
          <div class="card-body centered-body">
            <div v-if="recordedVideoUrl" class="video-preview-wrapper">
              <video :src="recordedVideoUrl" controls class="summary-video" ref="summaryVideo" @pause="onVideoPaused" @play="onVideoPlayed"></video>
              <div class="video-actions">
                <el-button
                    type="success"
                    icon="el-icon-download"
                    @click="handleDownload">
                  Download Recording
                </el-button>
                <el-button
                    type="info"
                    icon="el-icon-document"
                    @click="downloadScript">
                  Download Script
                </el-button>
              </div>
            </div>
            <div v-else-if="videoTimeout" class="video-missing-alert">
              <i class="el-icon-warning-outline"></i>
              <p>Video recording was not found, but your transcript is available below.</p>
              <el-button type="info" icon="el-icon-document" @click="downloadScript" style="margin-top:12px;">
                Download Script
              </el-button>
            </div>
          </div>
        </div>

        <!-- Download Script (shown when video card is hidden) -->
        <div v-if="!enableVideo" class="download-bar">
          <el-button type="info" icon="el-icon-document" @click="downloadScript">
            Download Script
          </el-button>
        </div>

        <!-- Legend Card -->
        <div class="setup-card legend-card">
          <div class="card-header">
            <i class="el-icon-guide"></i>
            <h3>Transcript Legend</h3>
          </div>
          <div class="card-body">
            <div class="industrial-legend">
              <div class="legend-item"><span class="pip pos"></span> Positive</div>
              <div class="legend-item"><span class="pip neu"></span> Neutral</div>
              <div class="legend-item"><span class="pip neg"></span> Negative</div>
              <div class="legend-item"><span class="pip filler">uh</span> Filler Word</div>
              <div class="legend-item"><span class="pip conf-low"></span> &lt;50% Conf.</div>
              <div class="legend-item"><span class="pip conf-med"></span> &lt;70% Conf.</div>
            </div>
          </div>
        </div>

        <!-- Transcript Blocks -->
        <div
            v-for="(transcriptObj, idx) in transcripts"
            :key="idx"
            class="setup-card transcript-block"
        >
          <div class="card-header">
            <i class="el-icon-chat-line-round"></i>
            <h3>Question {{ idx + 1 }}</h3>
            <div class="header-audio-controls">
              <el-button
                  size="mini"
                  circle
                  :type="currentlyPlayingIdx === idx ? 'danger' : 'primary'"
                  :icon="currentlyPlayingIdx === idx ? 'el-icon-video-pause' : 'el-icon-video-play'"
                  @click="togglePlayback(idx)"
                  :disabled="!recordedVideoUrl || questionTimestamps[idx] === undefined"
              ></el-button>

            </div>
          </div>
          <div class="card-body">
            <div class="summary-data-item">
              <label>The Question</label>
              <p class="data-text">{{ localInterviewQA[idx]?.question || '(No question found)' }}</p>
            </div>

            <div class="summary-data-item">
              <label>Your Transcript</label>
              <div class="transcript-surface" v-html="safeHighlight(transcriptObj)"></div>
            </div>

            <div class="summary-data-item">
              <label>Analysis & Feedback</label>
              <div class="stats-feedback-row">
                <div class="mini-stats">
                  <div class="stat-pill">
                    <span class="stat-val">{{ transcriptWords(transcriptObj).length ? averageConfidence(transcriptWords(transcriptObj)) : 'N/A' }}%</span>
                    <span class="stat-lab">Confidence</span>
                  </div>
                  <div class="stat-pill">
                    <span class="stat-val">{{ typeof transcriptObj === 'object' && typeof transcriptObj._fillerWordCount !== 'undefined' ? transcriptObj._fillerWordCount : 'N/A' }}</span>
                    <span class="stat-lab">Fillers</span>
                  </div>
                </div>
                <FeedbackSection v-if="typeof transcriptObj === 'object' && transcriptObj.words?.length" :transcript="transcriptObj" />
              </div>
            </div>

            <div class="summary-data-item">
              <label>Reference Answer</label>
              <p class="data-text muted">{{ localInterviewQA[idx]?.answer || '(No answer found)' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getTranscriptionStatus, getTranscripts, getInterviewQA, getQuestionTimestamps } from '@/store/interviewStore';
import { highlightTranscript, averageConfidence } from '@/utils/transcriptUtils';
import { getSetting } from '@/store/settingStore';
import { getVideoRecording } from '@/store/recordingStore.js';
import FeedbackSection from '@/views/FeedbackSection.vue';


export default {
  name: 'SummaryView',
  components: {
    FeedbackSection,
  },
  data() {
    return {
      transcripts: [],
      localInterviewQA: [],
      loadingTranscripts: true,
      recordingUrls: {},
      enableVideo: false,
      recordedVideoUrl: '',
      videoTimeout: false,
      currentlyPlayingIdx: null,
      questionTimestamps: [],
    };
  },
  async mounted() {
    this.localInterviewQA = this.interviewQA && this.interviewQA.length
        ? this.interviewQA
        : await getInterviewQA() || '[]';
    this.enableVideo = await getSetting('enableVideo');

    // Fetch question timestamps for seeking
    this.questionTimestamps = await getQuestionTimestamps();

    this.pollForVideoBlob();
    this.checkTranscriptionStatus();
  },
  methods: {
    highlightTranscript,
    averageConfidence,
    safeHighlight(transcriptObj) {
      // transcriptObj may be a plain string (from AssemblyAI) or a rich object
      if (!transcriptObj) return '';
      if (typeof transcriptObj === 'string') {
        // Escape HTML and return as plain text
        return transcriptObj.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }
      return highlightTranscript(transcriptObj);
    },
    transcriptWords(transcriptObj) {
      if (!transcriptObj || typeof transcriptObj === 'string') return [];
      return transcriptObj.words || [];
    },
    async pollForVideoBlob(retries = 20, interval = 1000) {
      for (let i = 0; i < retries; i++) {
        const videoBlob = await getVideoRecording();
        if (videoBlob) {
          this.recordedVideoUrl = URL.createObjectURL(videoBlob);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      // If not found after retries, show a warning or fallback
      console.warn('Video recording not found after polling.');
      this.recordedVideoUrl = '';
      this.videoTimeout = true;
    },
    async checkTranscriptionStatus() {
      const inProcess = await getTranscriptionStatus();
      if (inProcess === true) {
        setTimeout(() => this.checkTranscriptionStatus(), 1000);
      } else if (inProcess === false) {
        this.pollForTranscripts();
      } else {
        // Handle undefined or error
        console.warn('Transcription status is undefined, retrying...');
        setTimeout(() => this.checkTranscriptionStatus(), 1000);
      }
    },
    async pollForTranscripts(retries = 10, interval = 1500) {
      for (let i = 0; i < retries; i++) {
        const stored = await getTranscripts();
        if (Array.isArray(stored) && stored.length > 0) {
          this.transcripts = stored;
          await this.loadRecordingUrls();
          this.loadingTranscripts = false;
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      // If not found after retries, show a warning or fallback
      console.warn('Transcripts not found after polling.');
      this.transcripts = [];
      this.loadingTranscripts = false;
    },
    async loadRecordingUrls() {
      const { getRecording } = await import('@/store/recordingStore');
      for (let i = 0; i < this.transcripts.length; i++) {
        const key = `Recording_${i}`;
        const blob = await getRecording(key);
        if (blob) {
          this.$set(this.recordingUrls, key, URL.createObjectURL(blob));
        }
      }
    },
    togglePlayback(idx) {
      const videoEl = this.$refs.summaryVideo;
      if (!videoEl) return;

      if (this.currentlyPlayingIdx === idx && !videoEl.paused) {
        // Same question — pause
        videoEl.pause();
        this.currentlyPlayingIdx = null;
      } else {
        // Different question or resuming — seek and play
        const offsetSec = (this.questionTimestamps[idx] || 0) / 1000;
        videoEl.currentTime = offsetSec;
        videoEl.play().catch(e => console.error('Video play error:', e));
        this.currentlyPlayingIdx = idx;

        // When video ends, reset button state
        videoEl.onended = () => { this.currentlyPlayingIdx = null; };
      }
    },
    onVideoPaused() {
      // If video is paused externally (user clicks native controls), sync button state
      this.currentlyPlayingIdx = null;
    },
    onVideoPlayed() {
      // No-op — currentlyPlayingIdx already set by togglePlayback
    },
    stopPlayback() {
      const videoEl = this.$refs.summaryVideo;
      if (videoEl) { videoEl.pause(); videoEl.currentTime = 0; }
      this.currentlyPlayingIdx = null;
    },
    handleDownload() {
      if (!this.recordedVideoUrl) return;
      const link = document.createElement('a');
      link.href = this.recordedVideoUrl;
      link.download = 'interview-recording.webm';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    downloadScript() {
      if (!this.localInterviewQA || !this.localInterviewQA.length) return;
      let text = 'INTERVIEW SCRIPT\n';
      text += '='.repeat(60) + '\n\n';
      this.localInterviewQA.forEach((qa, idx) => {
        text += `Question ${idx + 1}\n`;
        text += '-'.repeat(40) + '\n';
        text += `Q: ${qa.question || ''}\n\n`;
        text += `A: ${qa.answer || ''}\n\n`;
      });
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'interview-script.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }
};
</script>

<style scoped>
.setup-page-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 0 40px;
  overflow-y: auto;
  height: calc(100vh - 60px);
  background-color: #f9fafe;
  font-family: var(--font-family);
}

.setup-view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin: 40px 0 30px 0;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
}

.header-main h2 {
  font-size: 28px;
  color: #1a1a1a;
  margin: 0;
  font-weight: 700;
}

.header-subtitle {
  color: #666;
  margin-top: 5px;
  font-size: 1.05rem;
}

.setup-form-container {
  display: flex;
  flex-direction: column;
  gap: 25px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  padding-bottom: 60px;
}

/* Cards */
.setup-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  border: 1px solid #f0f2f5;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 25px;
  background: #fcfcfd;
  border-bottom: 1px solid #f0f2f5;
}

.card-header.highlight {
  background: #f0f7ff;
}

.card-header i {
  font-size: 1.25rem;
  color: #2563eb;
}

.card-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #1a1a1a;
  font-weight: 600;
  flex: 1;
}

.card-body {
  padding: 25px;
}

.centered-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* Video Section */
.video-preview-wrapper {
  width: 100%;
  max-width: 800px;
}

.summary-video {
  width: 100%;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  background: black;
}

.download-bar {
  display: flex;
  justify-content: flex-start;
  padding: 0 4px;
}

.video-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
  justify-content: center;
}

.video-missing-alert {
  padding: 30px;
  color: #64748b;
}

.video-missing-alert i {
  font-size: 2rem;
  margin-bottom: 10px;
  color: #fbbf24;
}

/* Legend */
.industrial-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #475569;
  font-weight: 500;
}

.pip {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
}

.pip.pos { background: rgba(34,197,94,0.15); border: 1px solid #22c55e; }
.pip.neu { background: rgba(59,130,246,0.10); border: 1px solid #3b82f6; }
.pip.neg { background: rgba(239,68,68,0.15); border: 1px solid #ef4444; }
.pip.filler { color: #a855f7; font-weight: 800; background: none; border: none; font-size: 0.8rem; width: auto; height: auto; }
.pip.conf-low { background: #fee2e2; border: 1px solid #dc2626; }
.pip.conf-med { background: #fef9c3; border: 1px solid #ca8a04; }

/* Transcript Data Items */
.summary-data-item {
  margin-bottom: 25px;
}

.summary-data-item:last-child {
  margin-bottom: 0;
}

.summary-data-item label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.data-text {
  font-size: 1.05rem;
  color: #1e293b;
  line-height: 1.6;
  margin: 0;
}

.data-text.muted {
  color: #64748b;
}

.transcript-surface {
  background: #f8fafc;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  font-size: 1.1rem;
  line-height: 1.7;
  color: #334155;
}

/* Mini Stats & Feedback */
.stats-feedback-row {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mini-stats {
  display: flex;
  gap: 20px;
}

.stat-pill {
  background: #fff;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
}

.stat-val {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1a1a;
}

.stat-lab {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #94a3b8;
  font-weight: 700;
  letter-spacing: 0.5px;
}

/* Audio Controls in Header */
.header-audio-controls {
  display: flex;
  gap: 8px;
}

/* Loading State */
.setup-status-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80vh;
}

.main-loader {
  border: 4px solid #f3f4f6;
  border-top: 4px solid #2563eb;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@media (max-width: 900px) {
  .setup-page-view { padding: 0 20px; }
}

@media (max-width: 768px) {
  .setup-page-view {
    padding: 0 14px;
    height: auto;
    overflow-y: visible;
  }

  .setup-view-header {
    flex-direction: column;
    align-items: flex-start;
    margin: 20px 0 18px 0;
    gap: 12px;
  }

  .header-main h2  { font-size: 1.35rem; }
  .header-subtitle { font-size: 0.9rem; }

  .header-actions        { width: 100%; }
  .header-actions .el-button { width: 100%; }

  .setup-form-container { gap: 16px; }

  .card-header { padding: 14px 18px; }
  .card-body   { padding: 18px 14px; }

  .summary-video { border-radius: 8px; }

  .video-actions {
    flex-direction: column;
    gap: 10px;
  }
  .video-actions .el-button { width: 100%; }

  .industrial-legend {
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .mini-stats       { flex-direction: column; gap: 8px; }
  .stat-pill        { width: 100%; }

  .transcript-surface { padding: 14px; font-size: 0.95rem; }

  .summary-data-item { flex-direction: column; gap: 4px; }
}

@media (max-width: 480px) {
  .setup-page-view { padding: 0 10px; }
  .header-main h2  { font-size: 1.2rem; }
  .header-subtitle { font-size: 0.85rem; }
  .card-header h3  { font-size: 0.95rem; }
  .card-header     { padding: 12px 14px; }
  .card-body       { padding: 14px 12px; }
}
</style>