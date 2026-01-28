<template>
  <div class="main_content">
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
        
        <div class="status-indicator" v-if="isListening">
          <span class="pulsing-dot"></span> Recording...
        </div>
        <div class="status-indicator paused" v-else-if="!isListening && !isReadOnly">
          Paused
        </div>
      </div>
    </div>
    
    <div class="transcript_area" ref="transcriptArea">
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

    <div class="control_bar" v-if="!isReadOnly">
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
  watch: {
    lines: {
      handler() {
        this.$nextTick(this.handleScroll);
      },
      deep: true
    },
    currentInterim() {
      this.$nextTick(this.handleScroll);
    }
  },
  methods: {
    handleScroll() {
      const area = this.$refs.transcriptArea;
      if (area) {
        area.scrollTop = area.scrollHeight;
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
}

.header {
  padding: 15px 25px;
  background: white;
  border-bottom: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
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

.status-indicator {
  display: flex;
  align-items: center;
  color: #f56c6c;
  font-weight: 600;
  font-size: 0.85em;
  background: #fef0f0;
  padding: 4px 10px;
  border-radius: 20px;
  margin-left: 20px;
}
.status-indicator.paused {
  color: #e6a23c;
  background: #fdf6ec;
}

.pulsing-dot {
  width: 6px;
  height: 6px;
  background-color: #f56c6c;
  border-radius: 50%;
  margin-right: 6px;
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 4px rgba(245, 108, 108, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 108, 108, 0); }
}

.transcript_area {
  flex-grow: 1;
  overflow-y: auto;
  padding: 30px 60px;
  background: white;
  max-width: 1000px;
  align-self: center;
  width: 100%;
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
  color: #999;
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
  padding: 15px;
  border-top: 1px solid #f0f2f5;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 30px;
}

.control_bar.read-only-bar {
  background: #f9fafe;
  color: #666;
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
