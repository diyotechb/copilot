<template>
  <div class="summary-main">
    <div v-if="loadingTranscripts" class="summary-loading">
      <div class="loader"></div>
      <div class="loading-text">Preparing transcripts...</div>
    </div>
    <div v-else>
      <button class="home-btn" @click="$router.push({ name: 'ResumeSetup' })">
        🏠 Home
      </button>
      <div v-if="enableVideo && recordedVideoUrl" class="summary-video-container" style="margin-bottom:2rem; text-align:center;">
        <video
          :src="recordedVideoUrl"
          controls
          style="max-width:100%; border-radius:12px; box-shadow:0 2px 8px rgba(59,130,246,0.07);"
        ></video>
        <div style="color:#2563eb; font-weight:600; margin-top:0.5rem;">Your Interview Recording</div>
          <button class="btn download-btn" :disabled="!recordedVideoUrl" @click="handleDownload" style="width:220px; margin-top:8px;"
            ref="downloadBtn">
            <span style="font-size:1.5rem; margin-right:8px;">⬇️</span> Download
        </button>
      </div>
    <h2 class="summary-title">Interview Summary</h2>
    <div class="summary-legend">
      <span>
        <span class="legend-sample legend-positive"></span> Positive sentiment
      </span>
      <span>
        <span class="legend-sample legend-neutral"></span> Neutral sentiment
      </span>
      <span>
        <span class="legend-sample legend-negative"></span> Negative sentiment
      </span>
      <span>
        <span class="legend-sample legend-filler">uh</span> Filler word
      </span>
      <span>
        <span class="legend-sample legend-confidence-low"></span> &lt; 50% confidence
      </span>
      <span>
        <span class="legend-sample legend-confidence-medium"></span> &lt; 70% confidence
      </span>
      </div>
      <div
        v-for="(transcriptObj, idx) in transcripts"
        :key="idx"
        class="section summary-section"
      >
        <h3 class="summary-question-title centered-title">Question {{ idx + 1 }}</h3>
        <div class="summary-row">
          <span class="summary-label">Question:</span>
          <span class="summary-value">{{ localInterviewQA[idx]?.question || '(No question found)' }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Your Transcript:</span>
          <span class="summary-value" v-html="highlightTranscript(transcriptObj)"></span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Actual Answer:</span>
          <span class="summary-value">{{ localInterviewQA[idx]?.answer || '(No answer found)' }}</span>
        </div>
        <div class="summary-row">
  <span class="summary-label">Statistics:</span>
  <table class="summary-stats-table">
    <tr>
      <td>Overall Confidence</td>
      <td>
        <template v-if="transcriptObj.words && transcriptObj.words.length">
          {{ averageConfidence(transcriptObj.words) }}%
        </template>
        <template v-else>
          N/A
        </template>
      </td>
    </tr>
    <tr>
      <td>Filler Word Usage</td>
      <td>
        <template v-if="typeof transcriptObj._fillerWordCount !== 'undefined'">
          {{ transcriptObj._fillerWordCount }}
        </template>
        <template v-else>
          N/A
        </template>
      </td>
    </tr>
    <tr>
      <td>Filler Words Percentage</td>
      <td>
        <template v-if="transcriptObj.words && transcriptObj.words.length && typeof transcriptObj._fillerWordCount !== 'undefined'">
          {{ ((transcriptObj._fillerWordCount / transcriptObj.words.length) * 100).toFixed(1) }}%
        </template>
        <template v-else>
          N/A
        </template>
      </td>
    </tr>
    <!-- Add more metrics here as needed -->
  </table>
  </div>
        <div class="summary-row">
        <span class="summary-label">Recording: </span>
        <button
          class="play-btn"
          :disabled="!recordingUrls['Recording_' + idx]"
          @click="playRecording(idx)"
        >
          ▶️ Play
        </button>
        <button
          class="stop-btn"
          :disabled="!recordingUrls['Recording_' + idx]"
          @click="stopPlayback(idx)"
        >
          ⏹️ Stop
        </button>
        <audio
          v-if="recordingUrls['Recording_' + idx]"
          :src="recordingUrls['Recording_' + idx]"
          :ref="'audio_' + idx"
          style="display:none"
        ></audio>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getRecording as getRecordingFromDb } from '@/store/audioStore.js';
import { getTranscriptionStatus, getTranscripts, getInterviewQA } from '@/store/interviewStore';
import { highlightTranscript, averageConfidence } from '@/utils/transcriptUtils';
import { getSetting } from '@/store/settingStore';

export default {
  name: 'SummaryView',
  data() {
    return {
      transcripts: [],
      localInterviewQA: [],
      loadingTranscripts: true,
      recordingUrls: {},
      enableVideo: false,
      recordedVideoUrl: ''
    };
  },
  async mounted() {
    this.localInterviewQA = this.interviewQA && this.interviewQA.length
      ? this.interviewQA
      : await getInterviewQA() || '[]';
    this.enableVideo = await getSetting('enableVideo');
    this.recordedVideoUrl = await getSetting('recordedVideoUrl');
    if (this.enableVideo && (this.recordedVideoUrl == null || this.recordedVideoUrl === '')) {
      console.warn('Video enabled but no recorded video URL found.');
    }
    this.checkTranscriptionStatus();
  },
  methods: {
    highlightTranscript,
    averageConfidence,
    async checkTranscriptionStatus() {
      const inProcess = await getTranscriptionStatus();
      if (inProcess === true) {
        console.log('Transcription in process...');
        this.loadingTranscripts = true;
        setTimeout(this.checkTranscriptionStatus, 1000);
      } else {
        console.log('Transcription finished. Loading transcripts...');
        this.loadingTranscripts = false;
        this.loadTranscripts();
      }
    },
    async loadTranscripts() {
      const stored = await getTranscripts();
      this.transcripts = Array.isArray(stored) ? stored : (stored ? JSON.parse(stored) : []);
      // Preload audio URLs for all indices
      for (let idx = 0; idx < this.transcripts.length; idx++) {
        const key = `Recording_${idx}`;
        const blob = await getRecordingFromDb(key);
        if (blob) {
          const url = URL.createObjectURL(blob);
          this.$set(this.recordingUrls, key, url);
        }
      }
    },
     async playRecording(idx) {
          let audioEl = this.$refs['audio_' + idx];
          if (Array.isArray(audioEl)) audioEl = audioEl[0];
          const url = this.recordingUrls[`Recording_${idx}`];
          if (audioEl && typeof audioEl.play === 'function' && url) {
            audioEl.src = url;
            audioEl.currentTime = 0;
            audioEl.play().catch(e => {
              console.error('Audio play error:', e);
            });
          } else {
            console.warn('No audio available to play.');
          }
        },
        stopPlayback(idx) {
          let audioEl = this.$refs['audio_' + idx];
          if (Array.isArray(audioEl)) audioEl = audioEl[0];
          if (audioEl && typeof audioEl.pause === 'function') {
            audioEl.pause();
            audioEl.currentTime = 0;
          }
        },
      }
};
</script>

<style scoped>
.summary-main {
  padding: 2rem 2vw;
  max-width: 700px;
  margin: 0 auto;
  box-sizing: border-box;
}
.summary-title {
  margin-bottom: 1.5rem;
  color: #22223b;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
}
.section.summary-section {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #f6f8fa;
  margin-bottom: 2.5rem; /* Increased from 1.5rem to 2.5rem */
  width: 100%;
  box-sizing: border-box;
  padding: 1.25rem 1rem;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.summary-question-title {
  margin-bottom: 1rem;
  color: #2563eb;
  font-size: 1.2rem;
  font-weight: 600;
}
.summary-row {
  margin-bottom: 0.5rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.play-btn,
.stop-btn {
  padding-left: 1rem;      /* Add left padding */
  padding-right: 1rem;     /* Keep right padding for balance */
  min-width: 90px;
  margin-left: 0.5rem;
  text-align: center;
  display: inline-block;
}
.summary-label {
  font-weight: 600;
  color: #22223b;
  min-width: 120px;
}
.summary-value {
  color: #3a3a3a;
  flex: 1 1 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.summary-loading {
  text-align: center;
  margin-top: 2rem;
}
.loading-text {
  margin-top: 1rem;
  color: #2563eb;
  font-size: 1.2rem;
}
.centered-title {
  text-align: center;
}
.loader {
  border: 6px solid #e5e7eb;
  border-top: 6px solid #2563eb;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}
.play-btn {
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.4rem 1rem;
  font-size: 1rem;
  cursor: pointer;
  margin-left: 0.5rem;
  transition: background 0.2s;
}
.play-btn:disabled {
  background: #e5e7eb;
  color: #888;
  cursor: not-allowed;
}
.stop-btn {
  background: #ef4444;
}
.stop-btn:hover {
  background: #dc2626;
}
.summary-legend {
  display: flex;
  gap: 2rem;
  margin: 0.5rem 0 2rem 0;
  font-size: 0.95rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}
.legend-sample {
  display: inline-block;
  width: 24px;
  height: 20px;
  vertical-align: middle;
  margin-right: 6px;
  border-radius: 4px;
  padding: 0 4px;
}
.legend-positive {
  background: rgba(34,197,94,0.15);
  border: 1px solid #22c55e;
}
.legend-neutral {
  background: rgba(59,130,246,0.10);
  border: 1px solid #3b82f6;
}
.legend-negative {
  background: rgba(239,68,68,0.15);
  border: 1px solid #ef4444;
}
.legend-filler {
  color: #a855f7;
  font-weight: bold;
  background: transparent;
  border: none;
  width: auto;
  height: auto;
  padding: 0;
}
.legend-confidence-low {
  background: #fee2e2;
  border: 1px solid #dc2626;
}
.legend-confidence-medium {
  background: #fef9c3;
  border: 1px solid #ca8a04;
}
.summary-stats-table {
  border-collapse: collapse;
  width: 100%;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  background: #f6f8fa; /* Light background for the table */
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(59,130,246,0.07);
  overflow: hidden;
}
.summary-stats-table td {
  border: 1px solid #e5e7eb;
  padding: 8px 14px;
  font-size: 1rem;
}
.summary-stats-table tr td:first-child {
  font-weight: 600;
  background: #e0e7ff; /* Slightly different shade for labels */
  width: 180px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>