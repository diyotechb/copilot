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
        <div class="audio-wave" v-if="isListening">
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
          <div class="bar"></div>
        </div>
        <span class="recording-text" :class="{ 'paused-text': !isListening }">
            {{ isListening ? 'Recording...' : 'Recording Paused' }}
         </span>
      </div>

      <div class="controls-group">
        <div class="controls">
          <el-button
              type="primary"
              circle
              class="record-btn"
              :class="{ 'is-recording': isListening, 'is-paused': !isListening }"
              @click="$emit('toggle-pause')"
          >
            <i :class="isListening ? 'el-icon-video-pause' : 'el-icon-microphone'"></i>
          </el-button>
          <div class="control-text">{{ isListening ? 'Pause' : 'Resume' }}</div>
        </div>

        <div class="controls">
          <el-button type="success" circle class="record-btn done-btn" @click="$emit('finish')">
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
    currentTime: String
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
    handleScroll() {
      const container = this.$refs.scrollContainer;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    },
    onTitleClick() {
      if (this.isReadOnly) return;
      this.$nextTick(() => {
        this.$refs.titleInput.focus();
      });
    },
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

.control_bar.read-only-bar {
  background: #f9fafe;
  color: #666;
  justify-content: center;
}

.control-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.recording-text {
  color: #f56c6c;
  font-weight: 600;
  font-size: 11px;
  animation: flash 2s infinite;
  display: flex;
  align-items: center;
  height: 100%;
}

@keyframes flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.paused-text {
  color: #e6a23c;
  animation: none;
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

.controls-group {
  display: flex;
  gap: 30px;
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

.done-btn {
  width: 30px;
  height: 30px;
  font-size: 14px;
  margin-bottom: 0;
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3);
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