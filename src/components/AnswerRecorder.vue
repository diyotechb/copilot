<template>
  <div class="voice-recorder" style="display:none">
    <!-- UI hidden, recording is triggered programmatically -->
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script>
import { sendToAssemblyAI } from '../services/assemblyAISpeechService';
import { saveRecording } from '@/store/audioStore';
import { getTranscripts, saveTranscripts, saveTranscriptionStatus } from '@/store/interviewStore';
import { getSetting } from '@/store/settingStore';

export default {
  mounted() {
    if (this.showAnswer && !this.recording) {
      this.startRecording();
    }
  },
  name: 'AnswerRecorder',
  props: {
    showAnswer: {
      type: Boolean,
      default: false
    },
    questionIndex: { 
      type: Number, 
      required: true 
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
      silenceStart: null,
      difficultyLevel: null,
      silenceThreshold: Number(process.env.VUE_APP_SILENCE_WAIT_MS) || 3000, 
    };
  },
  watch: {
    showAnswer(newVal) {
      if (newVal && !this.recording) {
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
        // Choose a supported format
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
        this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : undefined);
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
        setTimeout(() => {
        this.mediaRecorder.stop();
        this.recording = false;
        this.clearSilenceDetection();
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          this.mediaStream = null;
        }
      }, 500); 
      }
    },
    async handleStop() {
      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else {
        mimeType = '';
      }
      const audioBlob = new Blob(this.audioChunks, mimeType ? { type: mimeType } : undefined);
      if (!audioBlob || audioBlob.size === 0) {
        await saveTranscriptionStatus(false);
        return;
      }
      await saveRecording(`Recording_${this.questionIndex}`, audioBlob);
      await saveTranscriptionStatus(true);
      let transcript = '';
      try {
        transcript = await sendToAssemblyAI(audioBlob);
        await saveTranscriptionStatus(false);
      } catch (err) {
        console.error('[AnswerRecorder] AssemblyAI transcription error:', err);
        transcript = '[Transcription error]';
      }
      let transcripts = await getTranscripts();
      if (!transcripts) {
        transcripts = [];
      }
      const difficultyLevel = await getSetting('interviewDifficulty');
      if (difficultyLevel === 'Beginner') {
        this.$emit('transcript', transcript);
      }
      transcripts[this.questionIndex] = transcript;
      await saveTranscripts(transcripts);
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
