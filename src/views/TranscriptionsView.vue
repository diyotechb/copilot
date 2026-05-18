<template>
  <div class="transcriptions_container">
    <transcript-dashboard
      v-if="viewMode === 'dashboard'"
      :history="history"
      @start-new="startNewSession"
      @open-detail="openDetail"
      @delete-item="deleteHistoryItem"
      @delete-all="deleteAllHistory"
    />

    <transcript-detail
      v-else
      :title="sessionTitle"
      :date-str="sessionDate"
      :session-id="sessionId"
      :is-listening="isListening"
      :is-read-only="isReadOnly"
      :lines="transcriptLines"
      :current-interim="currentInterim"
      :is-interim-inline="isInterimInActiveParagraph"
      :current-time="getCurrentTime()"
      @back="openDashboard"
      @update-title="updateTitle"
      @toggle-pause="togglePause"
      @finish="finishRecording"
    />

    <ConfirmDialog
      :visible.sync="confirmVisible"
      :title="confirmConfig.title"
      :message="confirmConfig.message"
      :type="confirmConfig.type"
      :confirm-text="confirmConfig.confirmText"
      :show-cancel="confirmConfig.showCancel"
      :icon="confirmConfig.icon"
      @confirm="handleConfirmAction"
    />
  </div>
</template>

<script>
import transcriptService from '@/services/transcriptService';
import speechService from '@/services/transcriptionSpeechService';
import TranscriptDashboard from '@/components/transcription/TranscriptDashboard.vue';
import TranscriptDetail from '@/components/transcription/TranscriptDetail.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { APP_CONFIG } from '@/constants/appConfig';

export default {
  name: "TranscriptionsView",
  components: { TranscriptDashboard, TranscriptDetail, ConfirmDialog },

  data() {
    return {
      // ── Session state ────────────────────────────────────────────────
      viewMode: 'dashboard',
      isListening: false,
      sessionId: null,
      sessionTitle: "Note",
      sessionDate: null,
      isReadOnly: false,
      sessionStart: null,
      recordingDurationMs: 0,
      durationTimer: null,
      audioTimeOffset: 0,
      micPermissionState: 'prompt',

      // ── Transcript lines ─────────────────────────────────────────────
      transcriptLines: [],
      currentInterim: "",
      isInterimInActiveParagraph: false,
      lastActivityTime: null,
      history: [],

      // ── Turn timing ───────────────────────────────────────────────────
      lastTurnAudioEnd: 0,

      // ── Confirm dialog ───────────────────────────────────────────────
      confirmVisible: false,
      confirmConfig: {
        title: '', message: '', type: 'primary',
        confirmText: 'Confirm', showCancel: true,
        icon: 'el-icon-warning-outline', data: null, action: null
      }
    };
  },

  mounted() {
    this.history = transcriptService.loadHistory();
    this.initSpeechCallbacks();
    this.initMicPermissionCheck();
    this._unloadHandler = () => this.cleanupMedia();
    window.addEventListener('beforeunload', this._unloadHandler);
  },

  beforeRouteLeave(to, from, next) {
    this.cleanupMedia();
    next();
  },

  beforeDestroy() {
    this.cleanupMedia();
    if (this._unloadHandler) window.removeEventListener('beforeunload', this._unloadHandler);
  },

  methods: {

    // ─────────────────────────────────────────────────────────────────────
    // Session management
    // ─────────────────────────────────────────────────────────────────────

    async startNewSession() {
      if (this.micPermissionState === 'denied') {
        this._showConfirm({
          title: 'Microphone Restricted',
          message: 'Microphone access is blocked. Please enable it in your browser settings to start recording.',
          type: 'warning', confirmText: 'Understand',
          showCancel: false, icon: 'el-icon-lock', action: 'ack'
        });
        return;
      }

      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micPermissionState = 'granted';

        this.$root.$emit('toggle-sidebar', true);
        this.viewMode = 'detail';
        speechService.stop();
        this.resetActiveSession();

        this.isInterimInActiveParagraph = true;

        this.sessionId = transcriptService.generateId();
        const now = new Date();
        this.sessionDate = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        this.sessionTitle = `Note ${now.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;
        this.isReadOnly = false;

        this.$nextTick(() => {
          speechService.start();
          this.isListening = true;
        });
      } catch (err) {
        this._showConfirm({
          title: 'Access Required',
          message: 'Microphone access is required to start a new recording. Please check your browser settings and try again.',
          type: 'danger', confirmText: 'Got it',
          showCancel: false, icon: 'el-icon-warning', action: 'ack'
        });
      }
    },

    resetActiveSession() {
      this.transcriptLines = [];
      this.currentInterim = "";
      this.sessionId = null;
      this.sessionTitle = "";
      this.isReadOnly = false;
      this.lastActivityTime = null;
      this.lastTurnAudioEnd = 0;
      this.sessionStart = null;
      this.recordingDurationMs = 0;
      this.audioTimeOffset = 0;
      this.isInterimInActiveParagraph = false;
      this.stopDurationTimer();
    },

    openDashboard() {
      if (this.isListening) {
        this._showConfirm({
          title: 'Active Recording',
          message: 'A recording is currently active. Would you like to stop it and save the session or continue recording?',
          type: 'warning', confirmText: 'Stop & Save',
          showCancel: true, icon: 'el-icon-video-pause', action: 'stopAndSave'
        });
        return;
      }
      this.saveCurrentTranscript();
      this.$root.$emit('toggle-sidebar', false);
      this.viewMode = 'dashboard';
      this.resetActiveSession();
    },

    openDetail(item) {
      this.$root.$emit('toggle-sidebar', true);
      this.viewMode = 'detail';
      this.transcriptLines = JSON.parse(JSON.stringify(item.lines));
      this.sessionId = item.id;
      this.sessionTitle = item.title || "Note";
      this.sessionDate = item.dateStr;
      this.isReadOnly = true;
      this.lastActivityTime = null;
    },

    finishRecording() {
      this.stopDurationTimer();
      speechService.stop();
      this.cleanupMedia();
      this.saveCurrentTranscript();
      this.$root.$emit('toggle-sidebar', false);
      this.viewMode = 'dashboard';
      this.resetActiveSession();
    },

    togglePause() {
      if (this.isListening) {
        speechService.stop();
        this.isListening = false;
        this.stopDurationTimer();
      } else {
        if (this.isReadOnly) return;
        if (this.transcriptLines.length > 0) {
          const last = this.transcriptLines[this.transcriptLines.length - 1];
          this.audioTimeOffset = (last.audioEnd || this.lastTurnAudioEnd || 0) + 500;
        }
        speechService.start();
        this.isListening = true;
        this.startDurationTimer();
      }
    },

    cleanupMedia() {
      speechService.stop();
      this.stopDurationTimer();
      this.isListening = false;
    },

    // ─────────────────────────────────────────────────────────────────────
    // History & persistence
    // ─────────────────────────────────────────────────────────────────────

    updateTitle(newTitle) {
      this.sessionTitle = newTitle;
      this.saveCurrentTranscript();
    },

    saveCurrentTranscript() {
      if (this.isReadOnly) {
        const idx = this.history.findIndex(h => h.id === this.sessionId);
        if (idx >= 0 && this.history[idx].title !== this.sessionTitle) {
          this.history[idx].title = this.sessionTitle;
          transcriptService.saveHistory(this.history);
        }
        return;
      }
      if (this.transcriptLines.length === 0) return;
      this.history = transcriptService.saveTranscript({
        id: this.sessionId,
        title: this.sessionTitle,
        dateStr: this.sessionDate,
        lines: this.transcriptLines
      });
    },

    deleteHistoryItem({ item, index }) {
      this._showConfirm({
        title: 'Delete Recording',
        message: `Are you sure you want to delete "${item.title || 'this recording'}"? This action cannot be undone.`,
        type: 'danger', confirmText: 'Delete',
        showCancel: true, icon: 'el-icon-delete',
        data: { item, index }, action: 'deleteItem'
      });
    },

    deleteAllHistory() {
      this._showConfirm({
        title: 'Clear All History',
        message: 'Are you sure you want to delete ALL recordings from your history? This action is permanent.',
        type: 'danger', confirmText: 'Delete Everything',
        showCancel: true, icon: 'el-icon-warning', action: 'deleteAll'
      });
    },

    handleConfirmAction() {
      const { action, data } = this.confirmConfig;
      if (action === 'stopAndSave') {
        speechService.stop();
        this.cleanupMedia();
        this.saveCurrentTranscript();
        this.$root.$emit('toggle-sidebar', false);
        this.viewMode = 'dashboard';
        this.resetActiveSession();
      } else if (action === 'deleteItem') {
        this.history = transcriptService.deleteTranscript(data.item.id);
      } else if (action === 'deleteAll') {
        this.history = transcriptService.deleteAll();
      }
      this.confirmVisible = false;
    },

    _showConfirm(config) {
      this.confirmConfig = { ...this.confirmConfig, ...config };
      this.confirmVisible = true;
    },

    // ─────────────────────────────────────────────────────────────────────
    // Speech callbacks — direct AssemblyAI V3 pass-through
    // ─────────────────────────────────────────────────────────────────────

    initSpeechCallbacks() {
      speechService.setCallback('onStart', () => {
        this.isListening = true;
        if (!this.sessionStart) { this.sessionStart = Date.now(); this.startDurationTimer(); }
      });

      speechService.setCallback('onEnd', () => {
        if (!speechService.isListening) this.isListening = false;
      });

      speechService.setCallback('onError', (event) => {
        if (event.error === 'not-allowed') {
          this.isListening = false;
          this._showMicDeniedDialog();
        } else {
          this.$message({ message: event.error || 'Recording stopped unexpectedly.', type: 'warning', duration: 4000 });
        }
      });

      speechService.setCallback('onResult', (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const offset = this.audioTimeOffset;
          const text = res[0].transcript;
          const audioStart = (res.audioStart || 0) + offset;
          const audioEnd   = (res.audioEnd   || 0) + offset;
          if (res.isFinal) this.onFinal(text || this.currentInterim, audioStart, audioEnd);
          else if (text)   this.onPartial(text, audioStart);
        }
      });

    },

    onPartial(text, audioStart) {
      // AssemblyAI V3 sends cumulative turn text — just replace interim, no accumulation.
      if (!text) return;
      this.currentInterim = text;
      this.isInterimInActiveParagraph = !this._needsNewParagraph(audioStart);
      this.lastActivityTime = Date.now();
    },

    onFinal(text, audioStart, audioEnd) {
      // end_of_turn=true: turn complete, text is fully punctuated. Lock it.
      if (!text) return;
      const now = Date.now();
      if (!this.sessionStart) this.sessionStart = now;

      if (this._needsNewParagraph(audioStart) || !this.transcriptLines.length) {
        this.transcriptLines.push({
          time: this.getCurrentTime(), text, ts: now,
          audioStart: audioStart || 0, audioEnd: audioEnd || 0
        });
      } else {
        const last = this.transcriptLines[this.transcriptLines.length - 1];
        last.text = last.text.trimEnd() + ' ' + text;
        last.ts = now;
        last.audioEnd = audioEnd || 0;
      }

      this.currentInterim = '';
      this.isInterimInActiveParagraph = true;
      this.lastTurnAudioEnd = audioEnd > 0 ? audioEnd : audioStart;
      this.lastActivityTime = now;
      this.saveCurrentTranscript();
    },

    _needsNewParagraph(audioStart) {
      if (!this.transcriptLines.length) return true;
      const threshold = APP_CONFIG.TRANSCRIPTION.PARAGRAPH_THRESHOLD_MS;
      if (audioStart > 0 && this.lastTurnAudioEnd > 0) {
        return (audioStart - this.lastTurnAudioEnd) >= threshold;
      }
      if (this.lastActivityTime) {
        return (Date.now() - this.lastActivityTime) >= threshold;
      }
      return false;
    },

    // ─────────────────────────────────────────────────────────────────────
    // Utilities
    // ─────────────────────────────────────────────────────────────────────

    getCurrentTime() {
      return this.isReadOnly
        ? new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : this.formatDuration(this.recordingDurationMs);
    },

    formatDuration(ms) {
      const s = Math.floor(ms / 1000);
      return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    },

    startDurationTimer() {
      if (this.durationTimer) return;
      const t0 = Date.now() - this.recordingDurationMs;
      this.durationTimer = setInterval(() => { this.recordingDurationMs = Date.now() - t0; }, 100);
    },

    stopDurationTimer() {
      if (this.durationTimer) { clearInterval(this.durationTimer); this.durationTimer = null; }
    },

    _showMicDeniedDialog() {
      this._showConfirm({
        title: 'Mic Access Denied',
        message: 'Microphone access was denied. Please update your permissions to continue.',
        type: 'danger', confirmText: 'Dismiss',
        showCancel: false, icon: 'el-icon-circle-close', action: 'ack'
      });
    },

    async initMicPermissionCheck() {
      if (!navigator.permissions?.query) return;
      try {
        const result = await navigator.permissions.query({ name: 'microphone' });
        this.micPermissionState = result.state;
        result.onchange = () => { this.micPermissionState = result.state; };
      } catch (e) {
        console.warn("[TranscriptionsView] Permissions API not supported:", e);
      }
    }
  }
};
</script>

<style scoped>
.transcriptions_container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  background-color: #f9fafe;
  color: #333;
}
</style>
