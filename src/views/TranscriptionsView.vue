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
      transcriptConfig: {
        mergeThresholdMs: 5000,   // Silence gap to trigger new paragraph (5.0s)
        overlapFuzzyInterim: 500, // Tolerance for matching ghost text start times
        overlapFuzzyFinal: 1000,  // Tolerance for matching final segments
        mergeBufferMs: 100,       // Padding for time-slice replacement
        searchDepthLines: 10,     // How many previous segments to check for overlaps
        overlapBufferMs: 500      // Micro-gap ignored for paragraph splitting
      },
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
        let audioStart = 0;
        let audioEnd = 0;
        let words = [];

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final = event.results[i][0].transcript;
            audioStart = event.results[i].audioStart;
            audioEnd = event.results[i].audioEnd;
            words = event.results[i].words || [];
            if (!final && this.currentInterim) final = this.currentInterim;
            this.onFinalTranscript(final, audioStart, audioEnd, words);
          } else {
            interim += event.results[i][0].transcript;
            audioStart = event.results[i].audioStart;
            audioEnd = event.results[i].audioEnd;
            words = event.results[i].words || [];
          }
        }

        if (interim) {
           this.onPartial(interim, audioStart, audioEnd);
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

    /**
     * Handles interim (ghost) transcription results.
     * Decisions made here (like paragraph splitting) are persisted to the final result
     * to prevent "snapping back" UI jitter.
     * 
     * @param {String} text - Current ghost text
     * @param {Number} audioStart - Start time in audio milliseconds
     * @param {Number} audioEnd - End time in audio milliseconds
     */
    onPartial(text, audioStart, audioEnd) {
        this.currentInterim = text || '';
        const now = Date.now();
        
        // 1. REFINEMENT DETECTION
        // If this ghost text starts near where an existing line started, it's an update.
        const overlaps = this.findOverlappingIndices(audioStart, this.transcriptConfig.overlapFuzzyInterim);
        if (overlaps.length > 0) {
            this.isInterimInActiveParagraph = true;
            this.transcriptLines[overlaps[0]].ts = now;
            return;
        }

        // 2. PROACTIVE PARAGRAPHING
        // Anticipate if we should jump to a new line based on silence.
        const lastLine = this.transcriptLines[this.transcriptLines.length - 1];
        if (lastLine) {
            // Guard: Check for both Audio silence and Wall-Clock silence.
            const willSplit = this.shouldSplitParagraph(audioStart, lastLine, true);
            this.isInterimInActiveParagraph = !willSplit;
            
            if (this.isInterimInActiveParagraph) {
                lastLine.ts = now;
            }
        } else {
            this.isInterimInActiveParagraph = false;
        }
    },

    /**
     * Handles finalized transcription results from the backend.
     * Implements "Shared Decision" logic: respects decisions made in onPartial.
     * Implements "Multi-Line Merge": consolidates lines if the backend re-segments.
     * 
     * @param {String} text - Finalized text string
     * @param {Number} audioStart - Start timestamp (from backend)
     * @param {Number} audioEnd - End timestamp (from backend)
     * @param {Array} newWords - Individual word timing metadata
     */
    onFinalTranscript(text, audioStart, audioEnd, newWords) {
        if (!text) return;
        const timestamp = Date.now();
        if (!this.sessionStart) this.sessionStart = timestamp;

        // Fallback if word-level data is missing
        if (!newWords || newWords.length === 0) {
            newWords = [{ text, start: audioStart, end: audioEnd || (audioStart + 1000) }];
        }

        // 1. SURGICAL REFINEMENT & MULTI-LINE CONSOLIDATION
        // If new words overlap with history, merge them and delete old split versions.
        const overlaps = this.findOverlappingIndices(newWords[0].start, this.transcriptConfig.overlapFuzzyFinal);
        if (overlaps.length > 0) {
            const firstIdx = overlaps[0];
            const targetLine = this.transcriptLines[firstIdx];
            
            targetLine.allWords = this.mergeWords(targetLine.allWords || [], newWords);
            targetLine.text = targetLine.allWords.map(w => w.text).join(' ');
            targetLine.ts = timestamp;
            
            // Delete subsequent lines that are now redundant (Consolidation)
            for (let i = overlaps.length - 1; i > 0; i--) {
                this.transcriptLines.splice(overlaps[i], 1);
            }

            this.isInterimInActiveParagraph = false;
            this.saveCurrentTranscript();
            return;
        }

        // 2. SHARED DECISION PARAGRAPHING
        const lastLine = this.transcriptLines[this.transcriptLines.length - 1];
        if (lastLine) {
            // Priority 1: Did onPartial already decide this segment starts a new line?
            const hasInterimDecision = !!this.currentInterim;
            const splitAlreadyDecided = hasInterimDecision && !this.isInterimInActiveParagraph;
            
            // Priority 2: Trust absolute AUDIO timing for finalizing (ignore wall-clock jitter).
            const newTimingRequiresSplit = this.shouldSplitParagraph(newWords[0].start, lastLine, false);

            if (!splitAlreadyDecided && !newTimingRequiresSplit) {
                // APPEND TO PARAGRAPH
                lastLine.allWords = [...(lastLine.allWords || []), ...newWords];
                lastLine.text = lastLine.allWords.map(w => w.text).join(' ');
                lastLine.ts = timestamp;
                this.lastFinalTime = timestamp; 
                this.isInterimInActiveParagraph = false;
                this.saveCurrentTranscript();
                return;
            }
        }

        // 3. START FRESH LINE
        this.lastFinalTime = timestamp;
        this.addNewLine(text, timestamp, audioStart, audioEnd, newWords);
        this.isInterimInActiveParagraph = false;
    },

    /**
     * Finds all lines in history that overlap with a timestamp.
     */
    findOverlappingIndices(audioStart, fuzzyMs) {
        const indices = [];
        const depth = this.transcriptConfig.searchDepthLines;
        for (let i = this.transcriptLines.length - 1; i >= 0; i--) {
            const words = this.transcriptLines[i].allWords || [];
            if (words.some(w => Math.abs(w.start - audioStart) < fuzzyMs)) {
                indices.unshift(i);
            }
            if (i < this.transcriptLines.length - depth) break;
        }
        return indices;
    },

    /**
     * Logic for deciding if a new sentence starts a fresh paragraph.
     */
    shouldSplitParagraph(newAudioStart, lastLine, checkWallClock = false) {
        if (!lastLine || !lastLine.allWords || lastLine.allWords.length === 0) return true;
        
        const lastWordEnd = lastLine.allWords[lastLine.allWords.length - 1].end;
        const audioSilence = newAudioStart - lastWordEnd;
        
        // Always merge if audio shows we are overlapping or speaking very fast.
        if (audioSilence < this.transcriptConfig.overlapBufferMs) return false;

        const wallClockSilence = (this.lastFinalTime && checkWallClock) ? (Date.now() - this.lastFinalTime) : 0;
        const threshold = this.transcriptConfig.mergeThresholdMs;

        return audioSilence >= threshold || wallClockSilence >= threshold;
    },

    /**
     * Surgically replaces words in the time slice with new results.
     */
    mergeWords(existingWords, newWords) {
        if (!newWords.length) return existingWords;
        const buffer = this.transcriptConfig.mergeBufferMs;
        const start = newWords[0].start - buffer;
        const end = newWords[newWords.length - 1].end + buffer;

        const unchanged = existingWords.filter(w => w.start < start || w.start > end);
        return [...unchanged, ...newWords].sort((a, b) => a.start - b.start);
    },

    addNewLine(text, timestamp, audioStart, audioEnd, words) {
        this.transcriptLines.push({
            time: this.getCurrentTime(),
            text: text,
            ts: timestamp,
            audioStart: audioStart,
            audioEnd: audioEnd,
            allWords: words || [{ text, start: audioStart, end: audioEnd }]
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
        
        // RESET state for a fresh session
        this.lastFinalTime = null;
        this.isInterimInActiveParagraph = false;
        this.currentInterim = "";

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
