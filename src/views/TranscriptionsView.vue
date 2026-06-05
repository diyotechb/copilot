<template>
  <div class="transcriptions_container">
    <transcript-dashboard
      v-if="viewMode === 'dashboard'"
      :cloud-recent="recentCloud"
      :loading-cloud="loadingCloud"
      :mic-permission="micPermissionState"
      :continue-target="continueTarget"
      @start="startCloudRecording"
      @continue-start="startContinueRecording"
      @cancel-continue="onCancelContinue"
      @view-all="goToAll"
      @open-cloud="goToSession"
      @continue-cloud="prepareContinue"
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
      :cancel-text="confirmConfig.cancelText"
      :show-cancel="confirmConfig.showCancel"
      :icon="confirmConfig.icon"
      @confirm="handleConfirmAction"
      @cancel="onConfirmCancel"
    />
  </div>
</template>

<script>
import transcriptionApi from '@/services/transcriptionApi';
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
      isCloud: false,
      cloudSessions: [],
      loadingCloud: true,
      continueTarget: null,
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

      // ── Turn timing ───────────────────────────────────────────────────
      lastTurnAudioEnd: 0,

      // ── Confirm dialog ───────────────────────────────────────────────
      confirmVisible: false,
      confirmConfig: {
        title: '', message: '', type: 'primary',
        confirmText: 'Confirm', cancelText: 'Cancel', showCancel: true,
        icon: 'el-icon-warning-outline', data: null, action: null
      }
    };
  },

  computed: {
    recentCloud() {
      return this.cloudSessions.slice(0, 20);
    },
    isActiveCloudRecording() {
      return this.viewMode === 'detail' && this.isCloud && !!this.sessionId && !this.isReadOnly;
    }
  },

  mounted() {
    this.loadCloud();
    this.initSpeechCallbacks();
    this.initMicPermissionCheck();
    this._beforeUnload = (e) => this.onBeforeUnload(e);
    this._pageHide = () => this.onPageHide();
    window.addEventListener('beforeunload', this._beforeUnload);
    window.addEventListener('pagehide', this._pageHide);
  },

  async beforeRouteLeave(to, from, next) {
    if (this.isActiveCloudRecording) {
      const ok = await this.confirmLeave();
      if (!ok) { next(false); return; }
      this._clearCheckpointTimer();
      try { await transcriptionApi.end(this.sessionId, this.transcriptLines, this.recordingDurationMs); } catch (e) { /* best-effort */ }
      await this.loadCloud();
    }
    this.cleanupMedia();
    next();
  },

  beforeDestroy() {
    this.cleanupMedia();
    if (this._beforeUnload) window.removeEventListener('beforeunload', this._beforeUnload);
    if (this._pageHide) window.removeEventListener('pagehide', this._pageHide);
  },

  methods: {

    // ─────────────────────────────────────────────────────────────────────
    // Session management
    // ─────────────────────────────────────────────────────────────────────

    async startCloudRecording(payload) {
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
      } catch (err) {
        this._showConfirm({
          title: 'Access Required',
          message: 'Microphone access is required to start a new recording. Please check your browser settings and try again.',
          type: 'danger', confirmText: 'Got it',
          showCancel: false, icon: 'el-icon-warning', action: 'ack'
        });
        return;
      }

      const startedAt = Date.now();
      let created;
      try {
        created = await transcriptionApi.createSession({ ...payload, startedAt });
      } catch (e) {
        this.$message({ message: e.message || 'Could not start session', type: 'error', duration: 4000 });
        return;
      }
      if (!created || !created.ok) {
        this.$message({ message: (created && created.error) || 'Could not start session', type: 'error', duration: 4000 });
        return;
      }

      this.$root.$emit('toggle-sidebar', true);
      this.viewMode = 'detail';
      speechService.stop();
      this.resetActiveSession();

      this.isInterimInActiveParagraph = true;
      this.sessionId = created.sessionId;
      this.isCloud = true;
      this.isReadOnly = false;
      const now = new Date();
      this.sessionDate = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      this.sessionTitle = payload.label || `Transcription ${now.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;

      this.$nextTick(() => {
        speechService.start();
        this.isListening = true;
      });
    },

    // ── Cloud (DynamoDB) transcriptions ──────────────────────────────────

    async loadCloud() {
      this.loadingCloud = true;
      try {
        const list = await transcriptionApi.list();
        this.cloudSessions = Array.isArray(list) ? list : [];
      } catch (e) {
        this.cloudSessions = [];
      } finally {
        this.loadingCloud = false;
      }
    },

    scheduleCloudCheckpoint() {
      if (!this.isCloud || this.isReadOnly || !this.sessionId) return;
      this._checkpointDirty = true;
      if (this._checkpointTimer) return;
      this._checkpointTimer = setTimeout(() => {
        this._checkpointTimer = null;
        this.flushCheckpoint();
      }, 5000);
    },

    async flushCheckpoint() {
      if (!this._checkpointDirty || !this.isCloud || !this.sessionId) return;
      this._checkpointDirty = false;
      try {
        await transcriptionApi.checkpoint(this.sessionId, this.transcriptLines, this.recordingDurationMs);
      } catch (e) {
        // best-effort — retried on the next finalized turn / on stop
      }
    },

    _clearCheckpointTimer() {
      if (this._checkpointTimer) { clearTimeout(this._checkpointTimer); this._checkpointTimer = null; }
      this._checkpointDirty = false;
    },

    async finalizeActiveRecording() {
      if (this.isReadOnly) return;
      if (this.isCloud && this.sessionId) {
        this._clearCheckpointTimer();
        try {
          await transcriptionApi.end(this.sessionId, this.transcriptLines, this.recordingDurationMs);
        } catch (e) {
          this.$message({ message: e.message || 'Could not save transcription', type: 'error', duration: 4000 });
        }
        await this.loadCloud();
      }
    },

    prepareContinue(item) {
      this.continueTarget = {
        sessionId: item.sessionId,
        label: item.label,
        category: item.category,
        candidateName: item.candidateName,
        vendor: item.vendor,
        client: item.client,
        callTaker: item.callTaker,
        duration: item.duration,
        createdAt: item.createdAt
      };
    },

    onCancelContinue() {
      this.continueTarget = null;
    },

    async startContinueRecording(sessionId) {
      if (this.micPermissionState === 'denied') { this._showMicDeniedDialog(); return; }
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micPermissionState = 'granted';
      } catch (e) { this._showMicDeniedDialog(); return; }

      let res;
      try { res = await transcriptionApi.continueSession(sessionId); }
      catch (e) { this.$message.error(e.message || 'Could not continue session'); return; }
      if (!res || !res.ok) { this.$message.error((res && res.error) || 'Could not continue session'); return; }

      const target = this.continueTarget;
      this.$root.$emit('toggle-sidebar', true);
      this.viewMode = 'detail';
      speechService.stop();
      this.resetActiveSession();

      this.sessionId = sessionId;
      this.isCloud = true;
      this.isReadOnly = false;
      this.sessionTitle = res.label || (target && target.label) || 'Transcription';
      this.sessionDate = (target && target.createdAt)
        ? new Date(target.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '';
      this.transcriptLines = (res.lines || []).map(l => ({ time: l.time, text: l.text, ts: l.ts, audioStart: 0, audioEnd: 0 }));
      this.lastActivityTime = 1;
      this.lastTurnAudioEnd = 0;
      this.isInterimInActiveParagraph = false;
      this.continueTarget = null;

      this.$nextTick(() => { speechService.start(); this.isListening = true; });
    },

    goToAll() {
      this.$router.push({ name: 'TranscriptionSessions' }).catch(() => {});
    },

    goToSession(item) {
      this.$router.push({ name: 'TranscriptionSessions', query: { sessionId: item.sessionId } }).catch(() => {});
    },

    resetActiveSession() {
      this.transcriptLines = [];
      this.currentInterim = "";
      this.sessionId = null;
      this.sessionTitle = "";
      this.isReadOnly = false;
      this.isCloud = false;
      this.lastActivityTime = null;
      this.lastTurnAudioEnd = 0;
      this.sessionStart = null;
      this.recordingDurationMs = 0;
      this.audioTimeOffset = 0;
      this.isInterimInActiveParagraph = false;
      this._clearCheckpointTimer();
      this.stopDurationTimer();
    },

    async openDashboard() {
      if (this.isListening) {
        this._showConfirm({
          title: 'Active Recording',
          message: 'A recording is currently active. Would you like to stop it and save the session or continue recording?',
          type: 'warning', confirmText: 'Stop & Save',
          showCancel: true, icon: 'el-icon-video-pause', action: 'stopAndSave'
        });
        return;
      }
      await this.finalizeActiveRecording();
      this.$root.$emit('toggle-sidebar', false);
      this.viewMode = 'dashboard';
      this.resetActiveSession();
      if (this.$route.query.sessionId) {
        const next = { ...this.$route.query };
        delete next.sessionId;
        this.$router.push({ query: next }).catch(() => {});
      }
    },

    async finishRecording() {
      this._clearCheckpointTimer();
      this.stopDurationTimer();
      speechService.stop();
      this.cleanupMedia();
      await this.finalizeActiveRecording();
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

    confirmLeave() {
      this._showConfirm({
        title: 'Recording in progress',
        message: 'Leaving will end this recording. Your transcript so far is saved.',
        type: 'warning', confirmText: 'End & leave', cancelText: 'Stay',
        showCancel: true, icon: 'el-icon-warning-outline', action: null
      });
      return new Promise((resolve) => { this._leaveResolver = resolve; });
    },

    onConfirmCancel() {
      if (this._leaveResolver) {
        const resolve = this._leaveResolver;
        this._leaveResolver = null;
        resolve(false);
      }
    },

    onBeforeUnload(e) {
      if (!this.isActiveCloudRecording) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    },

    onPageHide() {
      if (!this.isActiveCloudRecording) return;
      this._clearCheckpointTimer();
      try { transcriptionApi.endOnUnload(this.sessionId); } catch (e) { /* best-effort */ }
      this.cleanupMedia();
    },

    // ─────────────────────────────────────────────────────────────────────
    // History & persistence
    // ─────────────────────────────────────────────────────────────────────

    updateTitle(newTitle) {
      this.sessionTitle = newTitle;
      const name = (newTitle || '').trim();
      if (this.sessionId && name) {
        transcriptionApi.rename(this.sessionId, name)
          .then(() => this.loadCloud())
          .catch(() => {});
      }
    },

    async handleConfirmAction() {
      if (this._leaveResolver) {
        const resolve = this._leaveResolver;
        this._leaveResolver = null;
        this.confirmVisible = false;
        resolve(true);
        return;
      }
      const { action } = this.confirmConfig;
      if (action === 'stopAndSave') {
        this._clearCheckpointTimer();
        speechService.stop();
        this.cleanupMedia();
        await this.finalizeActiveRecording();
        this.$root.$emit('toggle-sidebar', false);
        this.viewMode = 'dashboard';
        this.resetActiveSession();
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
      this.scheduleCloudCheckpoint();
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
