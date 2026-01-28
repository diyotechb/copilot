<template>
  <div class="otter_container">
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
      :current-time="getCurrentTime()"
      @back="openDashboard"
      @update-title="updateTitle"
      @toggle-pause="togglePause"
      @finish="finishRecording"
    />
  </div>
</template>

<script>
import moment from 'moment';
import transcriptService from '@/services/transcriptService';
import speechRecognitionService from '@/services/speechRecognitionService';
import TranscriptDashboard from '@/components/otter/TranscriptDashboard.vue';
import TranscriptDetail from '@/components/otter/TranscriptDetail.vue';

export default {
  name: "OtterView",
  components: { TranscriptDashboard, TranscriptDetail },
  data() {
    return {
      viewMode: 'dashboard',
      isListening: false,
      transcriptLines: [],
      currentInterim: "",
      lastFinalTime: null, 
      history: [], 
      sessionId: null,      
      sessionTitle: "Note",
      sessionDate: null,
      isReadOnly: false
    };
  },
  mounted() {
    this.history = transcriptService.loadHistory();
    this.initSpeechRecognition();
  },
  beforeDestroy() {
    speechRecognitionService.stop();
  },
  methods: {
    getCurrentTime() {
      return moment().format('h:mm A');
    },
    
    openDashboard() {
      if (this.isListening) {
        if (!confirm("Recording active. Stop and save?")) {
            return; 
        }
        speechRecognitionService.stop();
      }
      
      this.saveCurrentTranscript(); 
      this.viewMode = 'dashboard';
      this.resetActiveSession();
    },
    resetActiveSession() {
      this.transcriptLines = []; 
      this.currentInterim = "";
      this.sessionId = null;
      this.sessionTitle = "";
      this.isReadOnly = false;
      this.lastFinalTime = null;
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
      speechRecognitionService.stop(); 
      this.resetActiveSession();
      
      this.sessionId = transcriptService.generateId();
      this.sessionDate = moment().format('MMM D, h:mm A');
      this.sessionTitle = `Note ${moment().format('MMM D')}`;
      this.isReadOnly = false;
      
      this.$nextTick(() => {
        speechRecognitionService.start();
        this.isListening = true;
      });
    },
    
    finishRecording() {
      speechRecognitionService.stop();
      this.saveCurrentTranscript();
      this.viewMode = 'dashboard';
      this.resetActiveSession();
    },

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

      const session = {
        id: this.sessionId,
        title: this.sessionTitle,
        dateStr: this.sessionDate,
        lines: this.transcriptLines
      };

      this.history = transcriptService.saveTranscript(session);
    },

    deleteHistoryItem({ item, index }) {
      if (confirm("Delete this recording?")) {
        this.history = transcriptService.deleteTranscript(item.id);
      }
    },

    deleteAllHistory() {
      if (confirm("Are you sure you want to delete ALL recordings? This cannot be undone.")) {
        this.history = transcriptService.deleteAll();
      }
    },
    
    initSpeechRecognition() {
      if (!speechRecognitionService.isSupported()) {
        console.warn("Speech API not supported");
        return;
      }

      speechRecognitionService.setCallback('onStart', () => {
        this.isListening = true;
      });

      speechRecognitionService.setCallback('onEnd', () => {
        if (!speechRecognitionService.isListening) {
          this.isListening = false;
        }
      });

      speechRecognitionService.setCallback('onResult', (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript.trim();
            if (!transcript) continue;

            const now = new Date();
            const isNewParagraph = !this.lastFinalTime || (now - this.lastFinalTime > 3000);
            
            if (isNewParagraph || this.transcriptLines.length === 0) {
              this.transcriptLines.push({
                time: this.getCurrentTime(),
                text: transcript
              });
            } else {
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
      });
      
      speechRecognitionService.setCallback('onError', (event) => {
        if(event.error === 'not-allowed') {
          this.isListening = false;
          alert("Microphone access denied.");
        }
      });
    },

    togglePause() {
      if (this.isListening) {
        speechRecognitionService.stop(); 
        this.isListening = false;
      } else {
        if (this.isReadOnly) return; 
        speechRecognitionService.start();
        this.isListening = true;
      }
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
</style>
