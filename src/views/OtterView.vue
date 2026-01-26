<template>
  <div class="otter_container">
    
    <!-- DASHBOARD VIEW -->
    <div v-if="viewMode === 'dashboard'" class="dashboard-view">
       <div class="dashboard-header">
         <h2>Transcripts</h2>
         <div class="dash-actions">
             <el-button type="primary" icon="el-icon-microphone" @click="startNewSession">Start Recording</el-button>
         </div>
       </div>       
       <div class="dashboard-content">
          <div v-if="history.length === 0" class="empty-dashboard">
             <i class="el-icon-microphone empty-icon"></i>
             <h3>No transcripts yet</h3>
             <p>Start a new recording to get started</p>
          </div>
          
          <div v-else class="transcript-list">
            <div class="recent-header" v-if="history.length > 0">
              <h3 class="recent-title">Recent Transcripts</h3>
              <el-button v-if="history.length > 1" type="text" class="delete-all-btn" @click="deleteAllHistory">Delete All</el-button>
            </div>

            <div class="storage-info" v-if="history.length > 0">
              <i class="el-icon-info"></i> Only the 10 most recent recordings are saved and will be replaced by new ones.
            </div>

            <div v-for="(item, index) in history" :key="item.id" class="transcript-card" @click="openDetail(item)">
                <div class="card-header">
                   <h3 class="card-title">{{ item.title || 'Note' }}</h3>
                   <div class="card-meta">
                       <span class="card-date">{{ item.dateStr }}</span>
                       <i class="el-icon-delete delete-btn" @click.stop="deleteHistoryItem(index)"></i>
                   </div>
                </div>
                <div class="card-body">
                   <p v-if="getPreviewText(item)">{{ getPreviewText(item) }}</p>
                   <p v-else class="empty-preview">Empty transcript</p>
                </div>
             </div>
          </div>
       </div>
    </div>

    <!-- DETAIL VIEW (New Layout) -->
    <div v-else class="detail-view">
      
      <div class="main_content">
        <div class="header">
          <div class="header-left">
            <el-button icon="el-icon-back" circle size="small" @click="openDashboard" title="Back to Dashboard"></el-button>
            
            <div class="session-info">
               <!-- Editable Title -->
               <div class="title-row">
                   <h2 
                      contenteditable="true" 
                      @blur="updateTitle" 
                      @keydown.enter.prevent="$event.target.blur()"
                      class="editable-title"
                   >{{ sessionTitle }}</h2>
                   <i class="el-icon-edit edit-icon" title="Edit Title"></i>
               </div>
               
               <div class="meta-row">
                   <span class="meta-item"><i class="el-icon-date"></i> {{ sessionDate || 'Just now' }}</span>
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
          <div class="header-controls">
             <!-- Done button moved to footer as requested -->
          </div>
        </div>
        
        <div class="transcript_area" ref="transcriptArea">
          <div v-if="transcriptLines.length === 0 && !currentInterim" class="empty-state">
             <div v-if="!isReadOnly">
                Your transcription will appear here...
             </div>
             <div v-else>
                No text recorded.
             </div>
          </div>
          
          <div v-for="(line, index) in transcriptLines" :key="index" class="transcript-line">
            <span class="time-stamp">{{ line.time }}</span>
            <span class="text">{{ line.text }}</span>
          </div>
          
          <div v-if="currentInterim" class="transcript-line interim">
             <span class="time-stamp">{{ getCurrentTime() }}</span>
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
              @click="togglePause"
            >
              <i :class="isListening ? 'el-icon-video-pause' : 'el-icon-microphone'"></i>
            </el-button>
            <div class="control-text">{{ isListening ? 'Pause' : 'Resume' }}</div>
          </div>
          
          <div class="controls">
             <el-button type="success" circle class="record-btn done-btn" @click="finishRecording">
                <i class="el-icon-check"></i>
             </el-button>
             <div class="control-text">Done</div>
          </div>
        </div>
        
        <div class="control_bar read-only-bar" v-else>
           <span>Viewing History. <a @click="openDashboard" style="cursor:pointer; color:#409EFF;">Back to Dashboard</a></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import moment from 'moment';

export default {
  name: "OtterView",
  data() {
    return {
      // View State
      viewMode: 'dashboard', // 'dashboard' or 'detail'
      
      isListening: false,
      transcriptLines: [],
      currentInterim: "",
      recognition: null,
      lastFinalTime: null, 
      history: [], 
      
      sessionId: null,      
      sessionTitle: "Note",
      sessionDate: null,
      
      isReadOnly: false,    
      isSidebarVisible: true, 
    };
  },
  mounted() {
    this.loadHistory();
    // Do NOT auto-init session or speech on mount anymore. Wait for user action.
  },
  beforeDestroy() {
    this.stopRecognition();
  },
  methods: {
    getCurrentTime() {
      return moment().format('h:mm A');
    },
    getTimestamp() {
      return new Date().getTime();
    },
    getPreviewText(item) {
      if (!item.lines || item.lines.length === 0) return '';
      const allText = item.lines.map(line => line.text).join(' ');
      const words = allText.split(/\s+/);
      if (words.length > 75) {
        return words.slice(0, 75).join(' ') + '...';
      }
      return allText;
    },
    
    // --- Navigation & View Logic ---
    openDashboard() {
        if (this.isListening) {
           if (!confirm("Recording active. Stop and save?")) {
               return; 
           }
           this.stopRecognition();
        }
        
        this.saveCurrentTranscript(); 
        this.viewMode = 'dashboard';
        
        // Clear state
        this.transcriptLines = []; 
        this.currentInterim = "";
        this.sessionId = null;
        this.sessionTitle = "";
    },
    openDetail(item) {
        this.viewMode = 'detail';
        this.transcriptLines = JSON.parse(JSON.stringify(item.lines));
        this.sessionId = item.id;
        this.sessionTitle = item.title || "Note";
        this.sessionDate = item.dateStr;
        this.isReadOnly = true;
        this.lastFinalTime = null;
    },
    startNewSession() {
        this.viewMode = 'detail';
        this.stopRecognition(); 
        
        // Reset
        this.transcriptLines = [];
        this.currentInterim = "";
        this.lastFinalTime = null;
        
        // Init New Session
        this.sessionId = 'SID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        this.sessionDate = moment().format('MMM D, h:mm A');
        this.sessionTitle = `Note ${moment().format('MMM D')}`;
        this.isReadOnly = false;
        
        // Auto-start recording
        this.$nextTick(() => {
            this.initSpeechRecognition();
            try {
               this.recognition.start();
               this.isListening = true;
            } catch (e) {
               console.error("Auto-start failed", e);
            }
        });
    },
    
    finishRecording() {
       this.stopRecognition();
       this.saveCurrentTranscript();
       this.openDashboard();
    },

    // --- Title Editing ---
    updateTitle(e) {
       const newTitle = e.target.innerText.trim();
       if (newTitle) {
          this.sessionTitle = newTitle;
          this.saveCurrentTranscript(); 
       } else {
          e.target.innerText = this.sessionTitle; 
       }
    },
    
    // --- History Logic ---
    loadHistory() {
      const saved = localStorage.getItem('otter_history');
      if (saved) {
        try {
          let parsed = JSON.parse(saved);
          // Fixed: Show ALL recordings. No filtering by date or limit.
          
          parsed.sort((a, b) => b.timestamp - a.timestamp);
          this.history = parsed;
        } catch (e) {
          console.error("Failed to load history", e);
          this.history = [];
        }
      }
    },
    saveHistoryToStorage() {
      localStorage.setItem('otter_history', JSON.stringify(this.history));
    },
    saveCurrentTranscript() {
      if (this.transcriptLines.length === 0 && !this.sessionTitle) return;
      if (this.isReadOnly) {
          const idx = this.history.findIndex(h => h.id === this.sessionId);
          if (idx >= 0) {
             if (this.history[idx].title !== this.sessionTitle) {
                 this.history[idx].title = this.sessionTitle;
                 this.saveHistoryToStorage();
             }
          }
          return; 
      }
      
      const newEntry = {
        id: this.sessionId, 
        timestamp: this.getTimestamp(),
        dateStr: this.sessionDate || moment().format('MMM D, h:mm A'),
        title: this.sessionTitle,
        lines: this.transcriptLines
      };
      
      const existingIdx = this.history.findIndex(h => h.id === this.sessionId);
      if (existingIdx >= 0) {
        this.history.splice(existingIdx, 1);
        this.history.unshift(newEntry);
      } else {
        this.history.unshift(newEntry);
      }
      
      // Limit to 10 transcripts
      if (this.history.length > 10) {
        this.history = this.history.slice(0, 10);
      }
      
      this.saveHistoryToStorage();
    },
    deleteHistoryItem(index) {
      if (confirm("Delete this recording?")) {
        this.history.splice(index, 1);
        this.saveHistoryToStorage();
      }
    },
    deleteAllHistory() {
       if (confirm("Are you sure you want to delete ALL recordings? This cannot be undone.")) {
           this.history = [];
           this.saveHistoryToStorage();
       }
    },
    
    // --- Speech Logic ---
    initSpeechRecognition() {
      if (this.recognition) return; // Already init

      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Web Speech API is not supported in this browser. Please use Chrome.");
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
      };

      this.recognition.onend = () => {
        if (this.isListening) {
           try {
             this.recognition.start();
           } catch(e) {
             this.isListening = false;
           }
        }
      };

      this.recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript.trim();
            if (!transcript) continue;

            const now = new Date();
            const isNewParagraph = !this.lastFinalTime || (now - this.lastFinalTime > 3000);
            
            if (isNewParagraph || this.transcriptLines.length === 0) {
              // Add new paragraph at the END (chronological order)
              this.transcriptLines.push({
                time: this.getCurrentTime(),
                text: transcript
              });
              // Scroll to show the latest paragraph
              this.$nextTick(() => {
                const lines = this.$refs.transcriptArea?.querySelectorAll('.transcript-line');
                if (lines && lines.length > 0) {
                  lines[lines.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              });
            } else {
              // Append to the LAST item (most recent)
              const lastIdx = this.transcriptLines.length - 1;
              this.transcriptLines[lastIdx].text += ' ' + transcript;
            }
            
            this.lastFinalTime = now;
            this.saveCurrentTranscript();
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        this.currentInterim = interim;
      };
      
      this.recognition.onerror = (event) => {
          console.error("Speech recognition error", event.error);
          if(event.error === 'not-allowed') {
              this.isListening = false;
              alert("Microphone access denied.");
          }
      }
    },
    stopRecognition() {
      if (this.recognition) {
        this.recognition.stop();
      }
      this.isListening = false;
      this.saveCurrentTranscript();
    },
    togglePause() {
      // Toggle Pause/Resume
      if (this.isListening) {
        this.stopRecognition(); // Acts as pause
      } else {
        if (this.isReadOnly) return; 
        try {
          if (!this.recognition) this.initSpeechRecognition();
          this.recognition.start();
          this.isListening = true;
        } catch (e) {
          console.error("Error starting recognition:", e);
        }
      }
    },
    toggleSidebar() {
      this.isSidebarVisible = !this.isSidebarVisible;
    },

  }
};
</script>

<style scoped>
.otter_container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px); 
  background-color: #f9fafe;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #333;
}

/* --- Dashboard View Styling --- */
.dashboard-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 0 40px; 
  overflow-y: auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 40px 0 30px 0;
  flex-wrap: wrap; 
  gap: 15px; 
}

.dashboard-header h2 {
  font-size: 28px;
  color: #2c3e50;
  margin: 0;
  font-weight: 700;
}

.dash-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.recent-section {
  margin-bottom: 20px;
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #e4e7ed;
  margin-bottom: 15px;
}

.recent-title {
  color: #606266;
  font-weight: 500;
}

.delete-all-btn {
  color: #909399 !important;
  font-size: 0.85em;
}

.delete-all-btn:hover {
  color: #f56c6c !important;
}

.storage-info {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 6px;
  padding: 8px 12px;
  color: #0050b3;
  font-size: 0.85em;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.storage-info i {
  font-size: 1.1em;
}

.dashboard-content {
  flex-grow: 1;
  padding-bottom: 40px;
}

.empty-dashboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #909399;
}

.empty-icon {
  font-size: 64px;
  color: #dcdfe6;
  margin-bottom: 20px;
}

.empty-dashboard h3 {
  font-size: 20px;
  margin: 10px 0;
  color: #606266;
}

/* List Layout (Single Column) */
.transcript-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-width: 1000px; 
  margin: 0 auto;
  width: 100%;
}

/* Card Styling - Row Based */
.transcript-card {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  min-height: 30px; 
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.transcript-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08);
  border-color: #c6e2ff;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-title {
  font-weight: 700;
  font-size: 1.1em;
  color: #2c3e50;
  margin: 0;
}

.card-meta {
    display: flex;
    align-items: center;
    gap: 10px;
}

.card-date {
  font-size: 0.8em;
  color: #999;
}

.delete-btn {
  color: #e4e7ed;
  cursor: pointer;
  padding: 5px;
}
.delete-btn:hover {
  color: #f56c6c;
}

.card-body {
  flex-grow: 1;
}

.card-body p {
  margin: 0;
  color: #606266;
  font-size: 0.95em;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3; 
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden; 
}

.empty-preview {
  color: #c0c4cc !important;
  font-style: italic;
}


/* --- Detail View Styling --- */
.detail-view {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
}

.main_content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  background: white; 
}

.header {
  padding: 10px 40px; 
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
    gap: 20px;
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
  color: #000; /* Black text */
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

/* Reduced Button Sizes */
.record-btn {
  width: 52px; /* Smaller */
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
    width: 52px; /* Smaller */
    height: 52px; 
    font-size: 24px;
    margin-bottom: 6px;
    box-shadow: 0 4px 12px rgba(103, 194, 58, 0.3);
}

.control-text {
  font-size: 0.75em;
  color: #909399;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* --- Mobile Responsiveness --- */
@media (max-width: 600px) {
  .dashboard-view {
    padding: 0 15px; /* Reduced side padding */
  }
  .dashboard-header {
    margin: 20px 0;
  }
  .dashboard-header h2 {
    font-size: 22px;
  }
  .transcript-card {
    padding: 15px;
  }
  .card-title {
    font-size: 1em;
  }
  
  .header {
    padding: 10px 15px;
    height: auto;
    min-height: 60px;
    flex-wrap: wrap; 
  }
  .header-left {
      width: 100%;
      margin-bottom: 5px; 
  }
  .editable-title {
      font-size: 1.1em;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
  }
  
  .transcript_area {
    padding: 20px;
  }
  .text {
    font-size: 1em;
  }
  .time-stamp {
    min-width: 55px;
    font-size: 0.75em;
  }
  
  .control_bar {
      gap: 20px;
  }
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: transparent; 
}
::-webkit-scrollbar-thumb {
  background: #e4e7ed; 
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #dcdfe6; 
}
</style>
