<template>
  <div>
  <UserNavbar />
  <div class="summary-main">
   <div v-if="loadingTranscripts" class="summary-loading" style="margin-top:3rem; text-align:center;">
        <div class="loader" style="margin-bottom:1.5rem;"></div>
        <div class="loading-text" style="color:#2563eb; font-weight:600; font-size:1.2rem;">
          Waiting for transcripts
        </div>
        <div style="color:#2563eb; font-weight:600; font-size:1.2rem;">
          This may take a few moments
        </div>
      </div>
    <div v-else>
      <h2 class="summary-title">Interview Summary</h2>
      <InterviewSummaryList
        :interviews="interviews"
        :showBackButton="false"
      />
    </div>
  </div>
  </div>
</template>

<script>
import UserNavbar from '@/components/UserNavbar.vue';
import { getTranscripts, getInterviewQA } from '@/store/interviewStore';
import { highlightTranscript, averageConfidence } from '@/utils/transcriptUtils';
import { getSetting } from '@/store/settingStore';
import { getVideoRecording } from '@/store/recordingStore.js';
import FeedbackSection from '@/views/FeedbackSection.vue';
import { createInterviewsBulk } from '@/services/backendService';
import InterviewSummaryList from '@/components/InterviewSummaryList.vue';

export default {
  name: 'SummaryView',
  components: {
    FeedbackSection,
    InterviewSummaryList,
    UserNavbar
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
    };
  },
  computed: {
    interviews() {
      if (!Array.isArray(this.transcripts) || this.transcripts.length === 0) return [];
      return this.transcripts.map((t, idx) => {
        const result = highlightTranscript(t);
        return {
          question: this.localInterviewQA[idx]?.question || '',
          answer: this.localInterviewQA[idx]?.answer || '',
          highlightedHtml: result.highlightedHtml,
          transcript: result.transcript,
        };
      });
    }
  },
  async mounted() {
    this.localInterviewQA = this.interviewQA && this.interviewQA.length
      ? this.interviewQA
      : await getInterviewQA() || '[]';
    this.enableVideo = await getSetting('enableVideo');
    if (this.enableVideo) {
      this.pollForVideoBlob();
    }
    setTimeout(() => {
      this.checkTranscriptionStatus();
    }, 15000);
  },
  methods: {
    highlightTranscript,
    averageConfidence,
    async submitBulk() {
      if (this.transcripts.length === 0) return;
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        console.error('No sessionId found in localStorage. Cannot submit interviews.');
        return;
      }
      // For backend, you may want to send only the transcript object, not the highlightedHtml
      const interviewsForBackend = this.transcripts.map((t, idx) => ({
        sessionId: sessionId,
        question: this.localInterviewQA[idx]?.question || '',
        answer: this.localInterviewQA[idx]?.answer || '',
        transcript: t,
      }));
      try {
        const res = await createInterviewsBulk(interviewsForBackend);
        console.log('Bulk submission response:', res);
      } catch (e) {
        console.error('Bulk submission failed:', e);
      }
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
      console.warn('Video recording not found after polling.');
      this.recordedVideoUrl = ''; 
      this.videoTimeout = true;
    },
    checkTranscriptionStatus() {
      const inProcess = localStorage.getItem('transcriptionStatus');
      if (inProcess === 'true') {
        setTimeout(() => this.checkTranscriptionStatus(), 1000);
      } else if (inProcess === 'false') {
        this.pollForTranscripts();
      } else {
        setTimeout(() => this.checkTranscriptionStatus(), 1000);
      }
    },
    async pollForTranscripts(retries = 10, interval = 1500) {
      for (let i = 0; i < retries; i++) {
        const stored = await getTranscripts();
        if (Array.isArray(stored) && stored.length > 0) {
          this.transcripts = stored;
          this.loadingTranscripts = false;
          console.log("Transcripts loaded:", this.transcripts);
          console.log("Sending bulk request to backend...");
          this.submitBulk();
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      this.transcripts = [];
      this.loadingTranscripts = false;
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
    handleDownload() {
      if (!this.recordedVideoUrl) return;
      const link = document.createElement('a');
      link.href = this.recordedVideoUrl;
      link.download = 'interview-recording.webm';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
};
</script>

<style scoped>
.loader {
  border: 6px solid #e5e7eb;
  border-top: 6px solid #2563eb;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}
</style>