<template>
  <div class="main_content">
    <div class="scroll-container" ref="scrollContainer">
      <div class="header">
        <div class="header-left">
          <el-button icon="el-icon-back" circle size="small" @click="$emit('back')" title="Back to Dashboard"></el-button>

          <div class="session-info">
            <div class="title-row">
              <h2
                  contenteditable="true"
                  @blur="onTitleBlur"
                  @keydown.enter.prevent="$event.target.blur()"
                  class="editable-title"
                  ref="titleHeading"
              >{{ title }}</h2>
              <i class="el-icon-edit edit-icon" title="Edit Title"></i>
            </div>

            <div class="meta-row">
              <span class="meta-item"><i class="el-icon-date"></i> {{ dateStr || 'Just now' }}</span>
              <span class="meta-item ml-2" v-if="sessionId">ID: {{ sessionId }}</span>
              <span v-if="engine && !isReadOnly" class="engine-badge" :class="engine === 'v2' ? 'badge-new' : 'badge-classic'">
                {{ engine === 'v2' ? 'New Engine' : 'Classic' }}
              </span>
            </div>
          </div>

        </div>

        <div class="header-right">
          <el-button
            size="small"
            icon="el-icon-document-copy"
            :disabled="lines.length === 0"
            @click="copyTranscript"
            title="Copy transcript to clipboard"
          >Copy</el-button>
        </div>
      </div>

      <div class="transcript_area">
        <div v-if="lines.length === 0 && !currentInterim" class="empty-state">
          <div v-if="!isReadOnly">Your transcription will appear here...</div>
          <div v-else>No text recorded.</div>
        </div>

        <div v-for="(line, index) in lines" :key="index" class="transcript-line">
          <div class="avatar-column">
            <div class="user-avatar-small">{{ userInitials }}</div>
          </div>
          <div class="content-column">
            <span class="time-stamp">{{ line.time }}</span>
            <div class="text-container">
              <span class="text">{{ line.text }}</span>
              <span v-if="index === lines.length - 1 && currentInterim && isInterimInline" class="text interim-inline">
                {{ currentInterim }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="currentInterim && !isInterimInline" class="transcript-line interim">
          <div class="avatar-column">
            <div class="user-avatar-small">{{ userInitials }}</div>
          </div>
          <div class="content-column">
            <span class="time-stamp">{{ currentTime }}</span>
            <span class="text">{{ currentInterim }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="control_bar" v-if="!isReadOnly">
      <div class="control-status">
        <div class="status-indicator-wrap" :class="{ 'is-paused-mode': !isListening }">
          <i class="el-icon-microphone status-mic-icon" :class="{ 'is-recording': isListening }" title="Recording Status"></i>
          <span class="status-label" :class="{ 'recording-text': isListening, 'paused-text': !isListening }">
            {{ isListening ? 'RECORDING' : 'PAUSED' }}
          </span>

          <div class="recording-duration">
            {{ currentTime }}
          </div>
        </div>
      </div>

      <div class="controls-group">
        <!-- Bubble-up Pause Indicator -->
        <transition name="bubble">
          <div v-if="!isListening" class="pause-bubble">
            <i class="el-icon-video-pause"></i> Recording Paused
          </div>
        </transition>

        <div class="controls action-controls">
          <el-button
              :circle="isListening"
              class="record-btn minimal-control-btn"
              :class="{ 'is-active': isListening, 'is-paused': !isListening, 'resume-prominent': !isListening }"
              @click="$emit('toggle-pause')"
              :title="isListening ? 'Pause Recording' : 'Resume Recording'"
          >
            <div class="btn-content-wrap">
              <i :class="isListening ? 'el-icon-video-pause' : 'el-icon-video-play'" class="control-icon"></i>
              <span v-if="!isListening" class="resume-label">RESUME</span>
            </div>
          </el-button>
        </div>

        <div class="controls action-controls">
          <el-button circle class="record-btn done-btn minimal-control-btn" @click="$emit('finish')" title="Finish Recording">
            <i class="el-icon-check control-icon"></i>
          </el-button>
        </div>
      </div>
    </div>

    <div class="control_bar read-only-bar" v-else>
      <span>Viewing History. <a @click="$emit('back')" style="cursor:pointer; color:#409EFF;">Back to Dashboard</a></span>
    </div>
  </div>
</template>

<script>
import authService from '@/services/authService';

export default {
  name: 'TranscriptDetail',
  props: {
    title: String,
    dateStr: String,
    sessionId: String,
    isListening: Boolean,
    isReadOnly: Boolean,
    lines: Array,
    currentInterim: String,
    isInterimInline: Boolean,
    currentTime: String,
    engine: { type: String, default: null },
    silenceProgress: { type: Number, default: 0 },
    countdownSecsLeft: { type: [Number, String], default: 0 }
  },
  computed: {
    userEmail() {
      return authService.getUserEmail();
    },
    userInitials() {
      if (!this.userEmail) return '?';
      return this.userEmail.charAt(0).toUpperCase();
    }
  },
  methods: {
    onTitleBlur(e) {
      const newTitle = e.target.innerText.trim();
      if (newTitle && newTitle !== this.title) {
        this.$emit('update-title', newTitle);
      } else {
        e.target.innerText = this.title;
      }
    },
    copyTranscript() {
      const text = this.lines.map(l => l.text).join('\n\n');
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        this.$message({ message: 'Copied to clipboard', type: 'success', duration: 2000 });
      }).catch(() => {
        this.$message({ message: 'Could not copy — try selecting text manually', type: 'error', duration: 3000 });
      });
    }
  }
}


</script>

<style scoped>
.main_content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  background: white;
  height: 100%;
  position: relative;
}

.scroll-container {
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 15px 25px;
  background: white;
  border-bottom: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  min-height: 60px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.session-info {
  display: flex;
  flex-direction: column;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.editable-title {
  margin: 0;
  font-weight: 700;
  color: #1a1a1a;
  font-size: 1.2em;
  border-bottom: 1px solid transparent;
  padding-bottom: 2px;
  outline: none;
  min-width: 100px;
}
.editable-title:focus {
  border-bottom: 1px solid #409EFF;
}

.edit-icon {
  color: #cbd5e0;
  font-size: 0.9em;
  opacity: 0;
}
.title-row:hover .edit-icon {
  opacity: 1;
}

.meta-row {
  display: flex;
  align-items: center;
  font-size: 0.8em;
  color: #999;
}
.meta-item { display: flex; align-items: center; gap: 5px; }
.ml-2 { margin-left: 10px; }

.engine-badge {
  margin-left: 10px;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 0.7em;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}
.badge-new {
  background: #ede9fe;
  color: #7c3aed;
  border: 1px solid #ddd6fe;
}
.badge-classic {
  background: #f0f9ff;
  color: #0284c7;
  border: 1px solid #bae6fd;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.transcript_area {
  padding: 30px 60px;
  background: white;
  margin: 0; /* Align left instead of center */
  padding-bottom: 55vh;
}

.empty-state {
  text-align: center;
  color: #999;
  margin-top: 100px;
  font-size: 1.4em;
  font-weight: 300;
}

.transcript-line {
  display: flex;
  flex-direction: row;
  gap: 12px;
  margin-bottom: 15px;
  animation: fadeIn 0.4s ease-out;
}

.avatar-column {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
}

.content-column {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.user-avatar-small {
  width: 24px;
  height: 24px;
  background: #94a3b8;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.7rem;
  flex-shrink: 0;
}

.time-stamp {
  font-size: 0.65rem;
  color: #b0b7c3;
  font-weight: 500;
  line-height: 24px; /* Vertically align with avatar center/top line */
}

.text-container {
  margin-top: -2px; /* Pull text closer to time */
}

.text {
  font-size: 1.30em;
  color: #0f172a;
  line-height: 1.65;
}

.interim-inline {
  color: #000;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(2px); }
  to { opacity: 1; transform: translateY(0); }
}

.control_bar {
  background: white;
  padding: 10px 25px;
  border-top: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  flex-shrink: 0;
  z-index: 20;
  min-height: 65px;
}

.control-status {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.status-indicator-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8fafc;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid #f1f5f9;
}

.status-indicator-wrap.is-paused-mode {
  border-color: #fef3c7;
  background-color: #fffbeb;
}

.status-mic-icon {
  font-size: 1.2rem;
  transition: all 0.3s ease;
  color: #94a3b8; /* Default dimmed color */
}

.status-mic-icon.is-recording {
  color: #dc2626;
  animation: mic-pulse 1.5s infinite;
}

@keyframes mic-pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}

.circular-timer-wrap {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circular-timer-wrap.mini-timer {
  width: 32px;
  height: 32px;
}

.circular-timer {
  width: 100%;
  height: 100%;
}

.circle-bg {
  fill: none;
  stroke: #f1f5f9;
  stroke-width: 3.8;
}

.circle-fill {
  fill: none;
  stroke: #059669;
  stroke-width: 3.8;
  stroke-linecap: round;
  transition: stroke-dasharray 0.1s linear;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}

.timer-countdown {
  position: absolute;
  font-size: 0.7rem;
  font-weight: 800;
  color: #059669;
}

.mini-count {
  font-size: 0.6rem !important;
}

.status-label {
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.8px;
  text-transform: uppercase;
}

.recording-text { color: #dc2626; }
.paused-text { color: #e6a23c; }

.controls-group {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  flex: 1;
}

.center-timers {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  padding: 6px 16px;
  border-radius: 24px;
  border: 1px solid #f1f5f9;
  margin-right: 12px;
}

.silence-indicator-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.timer-icon {
  font-size: 1.1rem;
  color: #64748b;
}

.recording-duration {
  font-weight: 800;
  font-size: 0.92rem;
  color: #1e293b;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
  margin-left: 4px;
  padding-left: 10px;
  border-left: 1px solid #e2e8f0;
}


.audio-wave {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 12px;
}

.bar {
  width: 3px;
  background-color: #f56c6c;
  border-radius: 2px;
  animation: wave 1s ease-in-out infinite;
}

.bar:nth-child(1) { height: 60%; animation-delay: 0.0s; }
.bar:nth-child(2) { height: 80%; animation-delay: 0.1s; }
.bar:nth-child(3) { height: 100%; animation-delay: 0.2s; }
.bar:nth-child(4) { height: 70%; animation-delay: 0.3s; }
.bar:nth-child(5) { height: 50%; animation-delay: 0.4s; }

@keyframes wave {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.4); }
}


.record-btn {
  width: 40px !important;
  height: 40px !important;
  margin-bottom: 0;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  border-radius: 50% !important;
  transition: all 0.2s ease !important;
  border: 1px solid #e2e8f0 !important;
  background-color: #f8fafc !important;
  color: #64748b !important;
}

.record-btn:hover {
  background-color: #f1f5f9 !important;
  border-color: #cbd5e0 !important;
}

.record-btn .control-icon {
  font-size: 1.3rem !important;
  line-height: 1 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.resume-prominent {
  width: auto !important;
  padding: 0 20px !important;
  border-radius: 24px !important;
  background-color: #f59e0b !important;
  border-color: #f59e0b !important;
  color: white !important;
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.35) !important;
}

.btn-content-wrap {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 10px !important;
}

.pause-bubble {
  position: absolute;
  top: -45px;
  right: 25px;
  background: #fffbeb;
  color: #b45309;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid #fef3c7;
  box-shadow: 0 4px 12px rgba(180, 83, 9, 0.1);
  display: flex;
  align-items: center;
  gap: 6px;
  animation: float 2s infinite ease-in-out;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.bubble-enter-active, .bubble-leave-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.bubble-enter {
  opacity: 0;
  transform: translateY(10px) scale(0.9);
}
.bubble-leave-to {
  opacity: 0;
  transform: translateY(5px);
}

.resume-prominent:hover {
  background-color: #d97706 !important;
  border-color: #d97706 !important;
}

.resume-prominent .control-icon {
  font-size: 1.1rem !important;
  color: white !important;
}

.resume-label {
  font-size: 0.82rem;
  color: white;
  font-weight: 800;
  letter-spacing: 0.6px;
  line-height: 1;
  text-transform: uppercase;
  margin-top: 1px; /* Optical centering */
}

/* Done-btn specific was removed and unified into .record-btn base classes */

.control-text {
  display: none;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .transcript-line {
    margin-bottom: 15px;
  }
  .time-stamp {
    font-size: 0.6rem;
    line-height: 24px;
  }
  .text { font-size: 1.05em; line-height: 1.55; }
  .transcript_area { padding: 14px 14px; padding-bottom: 55vh; }

  .control_bar {
    height: auto !important;
    flex-wrap: wrap;
    padding: 15px !important;
    gap: 15px;
    justify-content: center;
  }
  .control-status {
    flex: 1 1 100%;
    justify-content: center;
    order: 1;
  }
  .controls-group {
    flex: 1 1 100%;
    order: 2;
    gap: 20px;
    justify-content: center;
  }
  .record-btn, .done-btn {
    width: 36px !important;
    height: 36px !important;
    font-size: 16px !important;
  }
  .control-text { display: none !important; }
}

@media (max-width: 480px) {
  .transcript_area { padding: 10px; padding-bottom: 55vh; }
  .text { font-size: 1em; }
  .control_bar {
    padding: 12px !important;
    gap: 12px;
  }
  .controls-group { gap: 15px; }
  .record-btn, .done-btn { width: 32px !important; height: 32px !important; font-size: 14px !important; }
  .control-text { display: none !important; }
}
</style>