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
      sessionStart: null
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
      this.sessionStart = null;
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
        if (!this.sessionStart) this.sessionStart = Date.now();
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
            
            // Fix: If final is empty but we have an interim shown, likely server finalized
            // without repeating text. Commit the interim to not lose it.
            if (!final && this.currentInterim) {
                final = this.currentInterim;
            }
            
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
    },

    onFinalTranscript(text) {
        if (!text) return;
        const ts = Date.now();
        if (!this.sessionStart) this.sessionStart = ts;

        const lastIndex = this.transcriptLines.length - 1;
        const last = this.transcriptLines[lastIndex];

        // Helper to safely append avoiding duplicates/overlap
        const appendSmart = (base, addition) => {
          const a = String(addition || '').trim();
          if (!a) return base.trim();
          // If the base already ends with the addition, keep base
          if (base.trim().endsWith(a)) return base.trim();
          return `${base} ${a}`.trim();
        };

        const wordCount = String(text || '').trim().split(/\s+/).filter(Boolean).length;

        if (last) {
            // Need to retrieve the raw timestamp if possible, but existing data might not have it.
            // We'll trust 'last.ts' if we added it, otherwise fallback.
            const lastTs = last.ts || ts; 
            const dt = ts - lastTs;

            const normalize = (s) => String(s || '').replace(/[\p{P}\u2018\u2019\u201C\u201D]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
            const baseNorm = normalize(last.text);
            const newNorm = normalize(text);

            // 1. Merge logic: If new final is a better version of last final (correction)
            if (dt <= this.mergeThresholdMs && (newNorm.includes(baseNorm) || baseNorm.includes(newNorm) || /[.!?]$/.test(String(text || '')))) {
                // Replace the text of the last bubble
                last.text = text;
                last.ts = ts; 
                this.transcriptLines.splice(lastIndex, 1, last);
                this.saveCurrentTranscript();
                return;
            }

            // 2. Short append logic: If short time diff or short phrase, append to same bubble
            if (dt <= this.mergeThresholdMs || wordCount <= 2) {
                last.text = appendSmart(last.text, text);
                last.ts = ts;
                this.transcriptLines.splice(lastIndex, 1, last);
                this.saveCurrentTranscript();
                return;
            }
        }

        // 3. New Bubble
        this.transcriptLines.push({
            time: this.getCurrentTime(),
            text: text,
            ts: ts
        });
        
        this.saveCurrentTranscript();
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
.transcriptions_container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px); 
  background-color: #f9fafe;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #333;
}
</style>
