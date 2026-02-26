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
            </div>
          </div>

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
        <div class="status-indicator-wrap">
          <i class="el-icon-microphone status-mic-icon" :class="{ 'is-recording': isListening }"></i>
          <span class="status-label" :class="{ 'recording-text': isListening, 'paused-text': !isListening }">
            {{ isListening ? 'RECORDING' : 'PAUSED' }}
          </span>
        </div>
      </div>

      <div class="controls-group">
        <!-- Timers Section in Center -->
        <div class="center-timers">
          
          <div class="recording-duration">
            {{ currentTime }}
          </div>
        </div>

        <div class="controls">
          <el-button
              circle
              class="record-btn minimal-control-btn"
              :class="{ 'is-active': isListening, 'is-paused': !isListening }"
              @click="$emit('toggle-pause')"
          >
            <i :class="isListening ? 'el-icon-video-pause' : 'el-icon-video-play'"></i>
          </el-button>
          <div class="control-text">{{ isListening ? 'Pause' : 'Resume' }}</div>
        </div>

        <div class="controls">
          <el-button circle class="record-btn done-btn minimal-control-btn" @click="$emit('finish')">
            <i class="el-icon-check"></i>
          </el-button>
          <div class="control-text">Done</div>
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
  margin-bottom: 24px;
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
  font-size: 1.15em;
  color: #000;
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
  flex: 0 0 220px;
}

.status-indicator-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
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
  width: 24px;
  height: 24px;
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
  justify-content: center;
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
  min-width: 24px;
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


.controls {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.record-btn {
  width: 30px;
  height: 30px;
  margin-bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
}

.record-btn i {
  margin: 0 !important;
  line-height: normal !important;
}

.done-btn {
  width: 30px;
  height: 30px;
  font-size: 14px;
  margin-bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
}
.done-btn i {
  margin: 0 !important;
  line-height: normal !important;
}

.control-text {
  display: none;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .transcript-line {
    margin-bottom: 18px;
  }
  .time-stamp {
    font-size: 0.6rem;
    line-height: 24px;
  }
  .text { font-size: 1.05em; line-height: 1.55; }
  .transcript_area { padding: 14px 14px; padding-bottom: 55vh; }

  .control_bar {
    height: 15px !important;
    overflow: visible !important;
    gap: 10px;
  }
  .controls-group { gap: 16px; }
  .record-btn, .done-btn {
    width: 30px !important;
    height: 30px !important;
    font-size: 14px !important;
  }
  .control-text { display: none !important; }
}

@media (max-width: 480px) {
  .transcript_area { padding: 10px; padding-bottom: 55vh; }
  .text { font-size: 1em; }
  .control_bar { height: 15px !important; padding: 0 10px !important; gap: 8px; overflow: visible !important; }
  .controls-group { gap: 10px; }
  .record-btn, .done-btn { width: 30px !important; height: 30px !important; font-size: 14px !important; }
  .control-text { display: none !important; }
}
</style>