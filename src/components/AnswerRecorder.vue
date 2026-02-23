<template>
  <div class="voice-recorder" style="display:none">
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script>
import { sendToAssemblyAI } from '../services/assemblyAISpeechService';
import { saveRecording } from '@/store/recordingStore';
import { getTranscripts, saveTranscripts, saveTranscriptionStatus } from '@/store/interviewStore';
import { getSetting } from '@/store/settingStore';

export default {
  mounted() {
    // Only auto-start if interview is not paused; if paused, wait for resumeRecording() call
    if (this.showAnswer && !this.recording && !this.isPaused) {
      this.startRecording();
    }
    this._unloadHandler = () => {
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }
    };
    window.addEventListener('beforeunload', this._unloadHandler);
  },
  name: 'AnswerRecorder',
  props: {
    showAnswer: { type: Boolean, default: false },
    questionIndex: { type: Number, required: true },
    sharedAudioCtx: { default: null },    // shared AudioContext from InterviewView
    mixDestination: { default: null },    // MediaStreamDestination to route mic into recording
    isPaused: { type: Boolean, default: false }, // interview-level pause state
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
      silenceThreshold: Number(process.env.VUE_APP_SILENCE_WAIT_MS) || 2500,
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
        // Stop silence detection immediately
        this.clearSilenceDetection();
        this.recording = false;
        // Stop mic tracks right away so the mic indicator light turns off
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          this.mediaStream = null;
        }
        // Stop the recorder after a short delay to flush last audio chunk
        setTimeout(() => {
          if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
          }
        }, 300);
      }
    },
    pauseRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
      }
      // Just stop the silence interval — keep audio nodes alive so resume works cleanly
      if (this.silenceTimer) {
        clearInterval(this.silenceTimer);
        this.silenceTimer = null;
      }
      this.silenceStart = null;
      this.$emit('silenceProgress', 0);
    },
    resumeRecording() {
      // If recording never started (paused before AnswerRecorder was mounted), start now
      if (!this.mediaRecorder && !this.recording) {
        this.startRecording();
        return;
      }
      if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
      }
      // Ensure the shared AudioContext is running (it may have been suspended for TTS pause)
      const ctx = this.audioContext || this.sharedAudioCtx;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => this._restartSilenceInterval());
      } else {
        this._restartSilenceInterval();
      }
    },
    _restartSilenceInterval() {
      // If audio nodes don't exist yet, do full init
      if (!this.analyser) {
        this.startSilenceDetection();
        return;
      }
      // Nodes already wired up — just restart the polling interval
      if (this.silenceTimer) { clearInterval(this.silenceTimer); }
      this.silenceStart = null;
      const data = new Uint8Array(this.analyser.fftSize);
      this.silenceTimer = setInterval(() => {
        this.analyser.getByteTimeDomainData(data);
        const isSilent = data.every(v => Math.abs(v - 128) < 2);
        if (isSilent) {
          if (!this.silenceStart) this.silenceStart = Date.now();
          const elapsed = Date.now() - this.silenceStart;
          this.$emit('silenceProgress', Math.min(elapsed / this.silenceThreshold, 1));
          if (elapsed > this.silenceThreshold) {
            this.clearSilenceDetection();
            this.stopRecording();
            this.$emit('silenceProgress', 0);
            this.$emit('silenceDetected');
          }
        } else {
          if (this.silenceStart) this.$emit('silenceProgress', 0);
          this.silenceStart = null;
        }
      }, 100);
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
        console.log("[DEBUG] No audio recorded or audio blob is empty, setting transcriptionStatus to false.");
        await saveTranscriptionStatus(false);
        return;
      }
      await saveRecording(`Recording_${this.questionIndex}`, audioBlob);
      await saveTranscriptionStatus(true);
      let transcript = '';
      try {
        transcript = await sendToAssemblyAI(audioBlob);
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
      await saveTranscriptionStatus(false);
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
      // Use shared AudioContext if provided (routes mic into video recording mix)
      this.audioContext = this.sharedAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
      this._ownContext = !this.sharedAudioCtx; // only close if we created it
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.mediaStreamSource.connect(this.analyser);
      // Route mic audio into the recording mix destination
      if (this.mixDestination) {
        this.mediaStreamSource.connect(this.mixDestination);
      }
      const data = new Uint8Array(this.analyser.fftSize);
      this.silenceStart = null;
      this.silenceTimer = setInterval(() => {
        this.analyser.getByteTimeDomainData(data);
        const isSilent = data.every(v => Math.abs(v - 128) < 2);
        if (isSilent) {
          if (!this.silenceStart) this.silenceStart = Date.now();
          const elapsed = Date.now() - this.silenceStart;
          this.$emit('silenceProgress', Math.min(elapsed / this.silenceThreshold, 1));
          if (elapsed > this.silenceThreshold) {
            // Stop everything FIRST before emitting — prevents re-entry
            this.clearSilenceDetection();
            this.stopRecording();
            this.$emit('silenceProgress', 0);
            this.$emit('silenceDetected');
          }
        } else {
          if (this.silenceStart) this.$emit('silenceProgress', 0);
          this.silenceStart = null;
        }
      }, 100);
    },
    clearSilenceDetection() {
      if (this.silenceTimer) {
        clearInterval(this.silenceTimer);
        this.silenceTimer = null;
      }
      if (this.audioContext && this._ownContext) {
        this.audioContext.close();
        this.audioContext = null;
      } else {
        this.audioContext = null; // don't close shared context
      }
      this.mediaStreamSource = null;
      this.analyser = null;
      this.silenceStart = null;
    }
  },
  beforeUnmount() {
    if (this._unloadHandler) window.removeEventListener('beforeunload', this._unloadHandler);
    this.clearSilenceDetection();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch (e) {}
    }
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