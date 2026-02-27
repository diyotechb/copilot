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
  </div>
</template>

<script>
import moment from 'moment';
import transcriptService from '@/services/transcriptService';
import speechRecognitionService from '@/services/transcriptionSpeechService';
import TranscriptDashboard from '@/components/transcription/TranscriptDashboard.vue';
import TranscriptDetail from '@/components/transcription/TranscriptDetail.vue';

export default {
  name: "TranscriptionsView",
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
      isReadOnly: false,
      mergeThresholdMs: 3500,
      isInterimInActiveParagraph: false,
      sessionStart: null,
      recordingDurationMs: 0,
      durationTimer: null
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
      if (!this.isReadOnly) {
        return this.formatDuration(this.recordingDurationMs);
      }
      return moment().format('h:mm A');
    },

    formatDuration(ms) {
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    },
    
    openDashboard() {
      if (this.isListening) {
        if (!confirm("Recording active. Stop and save?")) {
            return; 
        }
        speechRecognitionService.stop();
      }
      
      this.saveCurrentTranscript(); 
      this.$root.$emit('toggle-sidebar', false);
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
      this.sessionStart = null;
      this.recordingDurationMs = 0;
      this.stopDurationTimer();
    },
    openDetail(item) {
      this.$root.$emit('toggle-sidebar', true);
      this.viewMode = 'detail';
      this.transcriptLines = JSON.parse(JSON.stringify(item.lines));
      this.sessionId = item.id;
      this.sessionTitle = item.title || "Note";
      this.sessionDate = item.dateStr;
      this.isReadOnly = true;
      this.lastFinalTime = null;
    },
    async startNewSession() {
      try {
        // Force permission check before changing view state
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        this.$root.$emit('toggle-sidebar', true);
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
      } catch (err) {
        console.warn("[TranscriptionsView] Microphone access denied or failed:", err);
        alert("Microphone access is required to start a new recording. Please check your browser settings and try again.");
      }
    },
    
    finishRecording() {
      this.stopDurationTimer();
      speechRecognitionService.stop();
      this.saveCurrentTranscript();
      this.$root.$emit('toggle-sidebar', false);
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
        if (!this.sessionStart) {
          this.sessionStart = Date.now();
          this.startDurationTimer();
        }
      });

      speechRecognitionService.setCallback('onEnd', () => {
        if (!speechRecognitionService.isListening) {
          this.isListening = false;
        }
      });

      speechRecognitionService.setCallback('onResult', (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final = event.results[i][0].transcript;
            if (!final && this.currentInterim) final = this.currentInterim;
            this.onFinalTranscript(final);
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
           this.onPartial(interim);
        } else {
           this.currentInterim = '';
        }
      });
      
      speechRecognitionService.setCallback('onError', (event) => {
        if(event.error === 'not-allowed') {
          this.isListening = false;
          alert("Microphone access denied.");
        }
      });
    },

    onPartial(text) {
        this.currentInterim = text || '';
        
        const last = this.transcriptLines[this.transcriptLines.length - 1];
        const now = Date.now();
        if (last && this.currentInterim) {
          const timeDiff = now - (last.ts || now);
          this.isInterimInActiveParagraph = timeDiff <= this.mergeThresholdMs;
          
          // Keep paragraph alive while speaking
          if (this.isInterimInActiveParagraph) {
            last.ts = now;
          }
        } else {
          this.isInterimInActiveParagraph = false;
        }
    },

    cleanupText(text) {
        if (!text) return "";
        let t = text.trim();
        const words = t.split(/\s+/).filter(Boolean);
        // Only strip trailing period for absolute single words
        if (words.length === 1) {
            t = t.replace(/[.,!?]$/, "");
        }
        return t;
    },

    onFinalTranscript(text) {
        if (!text) return;
        const cleaned = this.cleanupText(text);
        const timestamp = Date.now();
        if (!this.sessionStart) this.sessionStart = timestamp;

        const lastIndex = this.transcriptLines.length - 1;
        const lastLine = this.transcriptLines[lastIndex];

        if (lastLine) {
            const timeDiff = timestamp - (lastLine.ts || timestamp);
            if (timeDiff <= this.mergeThresholdMs) {
                this.mergeWithLast(lastIndex, lastLine, cleaned, timestamp);
                this.isInterimInActiveParagraph = false;
                return;
            }
        }

        this.addNewLine(cleaned, timestamp);
        this.isInterimInActiveParagraph = false;
    },

    mergeWithLast(index, lastLine, text, timestamp) {
        const updatedLine = { ...lastLine };
        updatedLine.ts = timestamp;
        
        const numMap = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
        const normalize = (s) => String(s || '')
            .replace(/[\p{P}\u2018\u2019\u201C\u201D]/gu, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .split(' ')
            .map(w => numMap[w] || w)
            .join(' ');

        const baseNorm = normalize(lastLine.text);
        const newNorm = normalize(text);

        if (newNorm.includes(baseNorm) || baseNorm.includes(newNorm)) {
            if (text.length >= lastLine.text.length) {
                updatedLine.text = text;
            }
        } else {
            const b = lastLine.text.trim();
            const a = text.trim();
            if (normalize(b).endsWith(normalize(a))) {
                updatedLine.text = b;
            } else {
                updatedLine.text = `${b} ${a}`;
            }
        }

        this.transcriptLines.splice(index, 1, updatedLine);
        this.saveCurrentTranscript();
    },

    addNewLine(text, timestamp) {
        this.transcriptLines.push({
            time: this.getCurrentTime(),
            text: text,
            ts: timestamp
        });
        this.saveCurrentTranscript();
    },

    togglePause() {
      if (this.isListening) {
        speechRecognitionService.stop(); 
        this.isListening = false;
        this.stopDurationTimer();
      } else {
        if (this.isReadOnly) return; 
        speechRecognitionService.start();
        this.isListening = true;
        this.startDurationTimer();
      }
    },

    startDurationTimer() {
      if (this.durationTimer) return;
      const startTime = Date.now() - this.recordingDurationMs;
      this.durationTimer = setInterval(() => {
        this.recordingDurationMs = Date.now() - startTime;
      }, 100);
    },

    stopDurationTimer() {
      if (this.durationTimer) {
        clearInterval(this.durationTimer);
        this.durationTimer = null;
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
