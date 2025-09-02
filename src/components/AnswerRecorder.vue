<template>
  <div class="voice-recorder" style="display:none">
    <!-- UI hidden, recording is triggered programmatically -->
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script>
import { sendToAssemblyAI } from '../services/assemblyAISpeechService';
export default {
  created() {
    console.log('%c[AnswerRecorder] created. Initial showAnswer:','color: #2563eb; font-weight: bold;', this.showAnswer);
  },
  updated() {
  // console.log('%c[AnswerRecorder] created. Initial showAnswer:','color: #2563eb; font-weight: bold;', this.showAnswer);
  },
  mounted() {
  // console.log('%c[AnswerRecorder] updated. showAnswer:','color: #2563eb; font-weight: bold;', this.showAnswer);
    if (this.showAnswer && !this.recording) {
      console.log('[AnswerRecorder] mounted: showAnswer is true, starting recording immediately.');
      this.startRecording();
    }
  },
  name: 'AnswerRecorder',
  props: {
    silenceThreshold: {
      type: Number,
      default: 5000
    },
    showAnswer: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      recording: false,
      mediaRecorder: null,
      mediaStream: null,
      audioChunks: [],
      error: '',
      audioContext: null,
      mediaStreamSource: null,
      analyser: null,
      silenceTimer: null,
      silenceStart: null
    };
  },
  watch: {
    showAnswer(newVal, oldVal) {
      console.log('%c[AnswerRecorder] showAnswer watcher triggered. Old value:','color: #f59e42; font-weight: bold;', oldVal, 'New value:', newVal);
      if (newVal && !this.recording) {
        console.log('%c[AnswerRecorder] showAnswer is true, starting recording automatically.','color: #059669; font-weight: bold;');
        this.startRecording();
      }
    }
  },
  methods: {
    async startRecording() {
      this.error = '';
      this.audioChunks = [];
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            this.audioChunks.push(e.data);
          }
        };
        this.mediaRecorder.onstop = this.handleStop;
        this.mediaRecorder.start();
        this.recording = true;
        this.startSilenceDetection();
      } catch (err) {
        console.error('%c[AnswerRecorder] Could not access microphone','color: #dc2626; font-weight: bold;', err);
        this.error = 'Could not access microphone.';
      }
    },
    stopRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
        this.recording = false;
        this.clearSilenceDetection();
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          this.mediaStream = null;
        }
      }
    },
    async handleStop() {
      console.log('[AnswerRecorder] Audio recording stopped.');
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
      console.log('[AnswerRecorder] Sending audioBlob to AssemblyAI for transcription:', audioBlob);
      let transcript = '';
      try {
        transcript = await sendToAssemblyAI(audioBlob);
        console.log('[AnswerRecorder] Transcript received:', transcript);
      } catch (err) {
        console.error('[AnswerRecorder] AssemblyAI transcription error:', err);
        transcript = '[Transcription error]';
      }
      this.$emit('transcript', transcript);
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
    },
    startSilenceDetection() {
      if (!this.mediaStream || !(this.mediaStream instanceof MediaStream)) {
        console.error('%c[AnswerRecorder] No valid mediaStream for silence detection','color: #dc2626; font-weight: bold;');
        return;
      }
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.mediaStreamSource.connect(this.analyser);
      const data = new Uint8Array(this.analyser.fftSize);
      this.silenceStart = null;
      this.silenceTimer = setInterval(() => {
        this.analyser.getByteTimeDomainData(data);
        const isSilent = data.every(v => Math.abs(v - 128) < 2);
        if (isSilent) {
          if (!this.silenceStart) {
            this.silenceStart = Date.now();
          }
          if (Date.now() - this.silenceStart > this.silenceThreshold) {
            this.stopRecording();
            this.$emit('silenceDetected');
          }
        } else {
          if (this.silenceStart) {
          }
          this.silenceStart = null;
        }
      }, 250);
    },
    clearSilenceDetection() {
      if (this.silenceTimer) {
        clearInterval(this.silenceTimer);
        this.silenceTimer = null;
      }
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
      this.mediaStreamSource = null;
      this.analyser = null;
      this.silenceStart = null;
    }
  },
  beforeUnmount() {
    this.clearSilenceDetection();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }
};
</script>

<style scoped>
.voice-recorder {
  padding: 1.5rem;
  border-radius: 8px;
  background: #f8fafc;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  max-width: 400px;
  margin: 2rem auto;
}
.btn {
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  margin-bottom: 1rem;
}
.btn:hover {
  background: #1d4ed8;
}
.recording-indicator {
  color: #dc2626;
  font-weight: bold;
  margin-left: 1rem;
}
.error {
  color: #dc2626;
  margin-top: 1rem;
}
</style>
