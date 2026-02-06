<template>
  <div class="main_content">
    <!-- Combined Scroll Container -->
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
          <span class="time-stamp">{{ line.time }}</span>
          <span class="text">{{ line.text }}</span>
        </div>
        
        <div v-if="currentInterim" class="transcript-line interim">
          <span class="time-stamp">{{ currentTime }}</span>
          <span class="text">{{ currentInterim }}</span>
        </div>
      </div>
    </div>

    <!-- Fixed Control Bar at Bottom -->
    <div class="control_bar" v-if="!isReadOnly">
      <!-- Status & Visualizer Area -->
      <!-- Status & Visualizer Area -->
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
    currentTime: String
  },
  methods: {
    handleScroll() {
      const container = this.$refs.scrollContainer;
      if (container) {
        // Scroll to the very bottom of the container
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
  align-items: center;
  /* Remove fixed height constraint or let it flow, effectively it will scroll */
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
  padding-bottom: 65vh; 
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
  margin-bottom: 24px;
  line-height: 1.7;
}

.transcript-line.interim .text {
  color: #000;
}

.time-stamp {
  min-width: 70px;
  color: #c0c4cc;
  font-size: 0.8em;
  padding-top: 5px;
  font-variant-numeric: tabular-nums;
}

.text {
  flex-grow: 1;
  font-size: 1.15em;
  color: #000;
}

.control_bar {
  background: white;
  padding: 15px 30px;
  border-top: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between; /* Space out status and controls */
  align-items: center;
  gap: 30px;
  flex-shrink: 0;
  z-index: 20;
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
    font-size: 0.95em;
    animation: flash 2s infinite;
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
    gap: 3px;
    height: 20px;
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
  width: 52px;
  height: 52px;
  font-size: 24px;
  margin-bottom: 6px;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
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
  width: 52px;
  height: 52px;
  font-size: 24px;
  margin-bottom: 6px;
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3);
}

.control-text {
  font-size: 0.75em;
}
</style>
