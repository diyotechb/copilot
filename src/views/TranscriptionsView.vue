<template>
  <div class="transcriptions_container">
    <transcript-dashboard
      v-if="viewMode === 'dashboard'"
      :history="history"
      :mic-permission="micPermissionState"
      :show-v2-button="featureV2Enabled"
      @start-new="startNewSession"
      @start-new-v2="startNewSessionV2"
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
      :engine="engine"
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
import storageService from '@/services/storageService';
import speechServiceV1 from '@/services/transcriptionSpeechService';
import speechServiceV2 from '@/services/transcriptionSpeechServiceV2';
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

      // ── Engine selector ──────────────────────────────────────────────
      // 'v1' = classic complex engine  |  'v2' = direct AssemblyAI V3 engine
      engine: 'v1',
      featureV2Enabled: false,

      // ── V1 engine config ─────────────────────────────────────────────
      transcriptConfig: {
        mergeThresholdMs:   APP_CONFIG.TRANSCRIPTION.MERGE_THRESHOLD_MS,
        overlapFuzzyInterim: APP_CONFIG.TRANSCRIPTION.OVERLAP_FUZZY_INTERIM_MS,
        overlapFuzzyFinal:   APP_CONFIG.TRANSCRIPTION.OVERLAP_FUZZY_FINAL_MS,
        mergeBufferMs:       APP_CONFIG.TRANSCRIPTION.MERGE_BUFFER_MS,
        searchDepthLines:    APP_CONFIG.TRANSCRIPTION.SEARCH_DEPTH_LINES,
        overlapBufferMs:     APP_CONFIG.TRANSCRIPTION.OVERLAP_BUFFER_MS,
      },

      // ── V2 engine state ───────────────────────────────────────────────
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

  computed: {
    activeService() {
      return this.engine === 'v2' ? speechServiceV2 : speechServiceV1;
    }
  },

  mounted() {
    this.history = transcriptService.loadHistory();
    const features = storageService.getItem(storageService.KEYS.USER_FEATURES, true);
    this.featureV2Enabled = !!(features && features.transcriptionV2Enabled);
    this.initV1Callbacks();
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
    // Session management (shared)
    // ─────────────────────────────────────────────────────────────────────

    startNewSession()   { this._launchSession('v1'); },
    startNewSessionV2() { this._launchSession('v2'); },

    async _launchSession(engineType) {
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
        this.activeService.stop();
        this.resetActiveSession();

        this.engine = engineType;
        if (engineType === 'v2') {
          this.isInterimInActiveParagraph = true;
          this.initV2Callbacks();
        }

        this.sessionId = transcriptService.generateId();
        const now = new Date();
        this.sessionDate = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        this.sessionTitle = `Note ${now.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;
        this.isReadOnly = false;

        this.$nextTick(() => {
          this.activeService.start();
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
      this.engine = 'v1';
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
      this.activeService.stop();
      this.cleanupMedia();
      this.saveCurrentTranscript();
      this.$root.$emit('toggle-sidebar', false);
      this.viewMode = 'dashboard';
      this.resetActiveSession();
    },

    togglePause() {
      if (this.isListening) {
        this.activeService.stop();
        this.isListening = false;
        this.stopDurationTimer();
      } else {
        if (this.isReadOnly) return;
        if (this.transcriptLines.length > 0) {
          const last = this.transcriptLines[this.transcriptLines.length - 1];
          if (this.engine === 'v1' && last.allWords && last.allWords.length > 0) {
            this.audioTimeOffset = last.allWords[last.allWords.length - 1].end + 500;
          } else {
            this.audioTimeOffset = (last.audioEnd || this.lastTurnAudioEnd || 0) + 500;
          }
        }
        this.activeService.start();
        this.isListening = true;
        this.startDurationTimer();
      }
    },

    cleanupMedia() {
      speechServiceV1.stop();
      speechServiceV2.stop();
      this.stopDurationTimer();
      this.isListening = false;
    },

    // ─────────────────────────────────────────────────────────────────────
    // History & persistence (shared)
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
        this.activeService.stop();
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
    // V1 Engine — classic complex overlap/merge logic
    // ─────────────────────────────────────────────────────────────────────

    initV1Callbacks() {
      if (!speechServiceV1.isSupported()) {
        console.warn("Speech API not supported");
        return;
      }

      speechServiceV1.setCallback('onStart', () => {
        this.isListening = true;
        if (!this.sessionStart) { this.sessionStart = Date.now(); this.startDurationTimer(); }
      });

      speechServiceV1.setCallback('onEnd', () => {
        if (this.engine === 'v1' && !speechServiceV1.isListening) this.isListening = false;
      });

      speechServiceV1.setCallback('onResult', (event) => {
        let interim = '', final = '', audioStart = 0, audioEnd = 0, words = [];
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const offset = this.audioTimeOffset;
          if (res.isFinal) {
            final = res[0].transcript;
            audioStart = (res.audioStart || 0) + offset;
            audioEnd = (res.audioEnd || 0) + offset;
            words = (res.words || []).map(w => ({ ...w, start: (w.start || 0) + offset, end: (w.end || 0) + offset }));
            if (!final && this.currentInterim) final = this.currentInterim;
            this.v1OnFinal(final, audioStart, audioEnd, words);
          } else {
            interim += res[0].transcript;
            audioStart = (res.audioStart || 0) + offset;
            audioEnd   = (res.audioEnd   || 0) + offset;
          }
        }
        if (interim) this.v1OnPartial(interim, audioStart, audioEnd);
        else this.currentInterim = '';
      });

      speechServiceV1.setCallback('onError', (event) => {
        if (event.error === 'not-allowed') {
          this.isListening = false;
          this._showMicDeniedDialog();
        }
      });
    },

    v1OnPartial(text, audioStart) {
      this.currentInterim = text || '';
      if (!audioStart) return;
      const now = Date.now();
      const overlaps = this._v1FindOverlaps(audioStart, this.transcriptConfig.overlapFuzzyInterim);
      if (overlaps.length > 0) {
        this.isInterimInActiveParagraph = true;
        this.transcriptLines[overlaps[0]].ts = now;
        this.lastActivityTime = now;
        return;
      }
      const last = this.transcriptLines[this.transcriptLines.length - 1];
      if (last) {
        const willSplit = this._v1ShouldSplit(audioStart, last, true);
        this.isInterimInActiveParagraph = !willSplit;
        if (this.isInterimInActiveParagraph) last.ts = now;
      } else {
        this.isInterimInActiveParagraph = false;
      }
      this.lastActivityTime = now;
    },

    v1OnFinal(text, audioStart, audioEnd, newWords) {
      if (!text) return;
      const ts = Date.now();
      if (!this.sessionStart) this.sessionStart = ts;
      if (!newWords || !newWords.length) newWords = [{ text, start: audioStart, end: audioEnd || (audioStart + 1000) }];

      const overlaps = this._v1FindOverlaps(newWords[0].start, this.transcriptConfig.overlapFuzzyFinal);
      if (overlaps.length > 0) {
        const target = this.transcriptLines[overlaps[0]];
        target.allWords = this._v1MergeWords(target.allWords || [], newWords);
        target.text = target.allWords.map(w => w.text).join(' ');
        target.ts = ts;
        for (let i = overlaps.length - 1; i > 0; i--) this.transcriptLines.splice(overlaps[i], 1);
        this.lastActivityTime = ts;
        this.isInterimInActiveParagraph = false;
        this.saveCurrentTranscript();
        return;
      }

      const last = this.transcriptLines[this.transcriptLines.length - 1];
      if (last) {
        const splitDecided = !!this.currentInterim && !this.isInterimInActiveParagraph;
        const splitByTiming = !this.currentInterim && this._v1ShouldSplit(newWords[0].start, last, false);
        if (!splitDecided && !splitByTiming) {
          last.allWords = [...(last.allWords || []), ...newWords];
          last.text = last.allWords.map(w => w.text).join(' ');
          last.ts = ts;
          this.lastActivityTime = ts;
          this.isInterimInActiveParagraph = false;
          this.saveCurrentTranscript();
          return;
        }
      }

      if (last && text.length > 10) {
        const lastText = last.text.trim();
        if (text.startsWith(lastText) || (lastText.length > 20 && text.includes(lastText.substring(lastText.length - 20)))) {
          last.allWords = this._v1MergeWords(last.allWords || [], newWords);
          last.text = text;
          last.ts = ts;
          this.saveCurrentTranscript();
          return;
        }
      }

      this.lastActivityTime = ts;
      this.transcriptLines.push({
        time: this.getCurrentTime(), text, ts,
        audioStart, audioEnd,
        allWords: newWords || [{ text, start: audioStart, end: audioEnd }]
      });
      this.isInterimInActiveParagraph = false;
      this.saveCurrentTranscript();
    },

    _v1FindOverlaps(audioStart, fuzzyMs) {
      const indices = [];
      const depth = this.transcriptConfig.searchDepthLines;
      for (let i = this.transcriptLines.length - 1; i >= 0; i--) {
        const words = this.transcriptLines[i].allWords || [];
        if (words.some(w => Math.abs(w.start - audioStart) < fuzzyMs)) indices.unshift(i);
        if (i < this.transcriptLines.length - depth) break;
      }
      return indices;
    },

    _v1ShouldSplit(newAudioStart, last, checkWallClock) {
      if (!last || !last.allWords || !last.allWords.length) return true;
      const lastWordEnd = last.allWords[last.allWords.length - 1].end;
      const silence = newAudioStart - lastWordEnd;
      const threshold = this.transcriptConfig.mergeThresholdMs;
      if (newAudioStart > 0) {
        if (silence >= threshold) return true;
        if (silence < this.transcriptConfig.overlapBufferMs) return false;
      }
      if (checkWallClock && this.lastActivityTime) {
        return (Date.now() - this.lastActivityTime) >= threshold;
      }
      return false;
    },

    _v1MergeWords(existing, newWords) {
      if (!newWords.length) return existing;
      const buf = this.transcriptConfig.mergeBufferMs;
      const start = newWords[0].start - buf;
      const end   = newWords[newWords.length - 1].end + buf;
      return [...existing.filter(w => w.start < start || w.start > end), ...newWords]
        .sort((a, b) => a.start - b.start);
    },

    // ─────────────────────────────────────────────────────────────────────
    // V2 Engine — direct AssemblyAI V3 pass-through
    // ─────────────────────────────────────────────────────────────────────

    initV2Callbacks() {
      speechServiceV2.setCallback('onStart', () => {
        this.isListening = true;
        if (!this.sessionStart) { this.sessionStart = Date.now(); this.startDurationTimer(); }
      });

      speechServiceV2.setCallback('onEnd', () => {
        if (this.engine === 'v2' && !speechServiceV2.isListening) this.isListening = false;
      });

      speechServiceV2.setCallback('onError', (event) => {
        if (event.error === 'not-allowed') {
          this.isListening = false;
          this._showMicDeniedDialog();
        } else {
          this.$message({ message: event.error || 'Recording stopped unexpectedly.', type: 'warning', duration: 4000 });
        }
      });

      speechServiceV2.setCallback('onResult', (event) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const offset = this.audioTimeOffset;
          const text = res[0].transcript;
          const audioStart = (res.audioStart || 0) + offset;
          const audioEnd   = (res.audioEnd   || 0) + offset;
          if (res.isFinal) this.v2OnFinal(text || this.currentInterim, audioStart, audioEnd);
          else if (text)   this.v2OnPartial(text, audioStart);
        }
      });

    },

    v2OnPartial(text, audioStart) {
      // AssemblyAI V3 sends cumulative turn text — just replace interim, no accumulation.
      if (!text) return;
      this.currentInterim = text;
      this.isInterimInActiveParagraph = !this._v2NeedsNewParagraph(audioStart);
      this.lastActivityTime = Date.now();
    },

    v2OnFinal(text, audioStart, audioEnd) {
      // end_of_turn=true: turn complete, text is fully punctuated. Lock it.
      if (!text) return;
      const now = Date.now();
      if (!this.sessionStart) this.sessionStart = now;

      if (this._v2NeedsNewParagraph(audioStart) || !this.transcriptLines.length) {
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

    _v2NeedsNewParagraph(audioStart) {
      if (!this.transcriptLines.length) return true;
      const threshold = APP_CONFIG.TRANSCRIPTION.V2_PARAGRAPH_THRESHOLD_MS;
      if (audioStart > 0 && this.lastTurnAudioEnd > 0) {
        return (audioStart - this.lastTurnAudioEnd) >= threshold;
      }
      if (this.lastActivityTime) {
        return (Date.now() - this.lastActivityTime) >= threshold;
      }
      return false;
    },

    // ─────────────────────────────────────────────────────────────────────
    // Utilities (shared)
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
