<template>
  <div class="voice-recorder">
    <div v-if="!recording">
      <button @click="startRecording" class="btn">Start Recording</button>
    </div>
    <div v-else>
      <button @click="stopRecording" class="btn">Stop Recording</button>
      <span class="recording-indicator">● Recording...</span>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script>
export default {
  name: 'VoiceRecorder',
  props: {
    silenceThreshold: {
      type: Number,
      default: 5000
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
    handleStop() {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
      this.$emit('audioBlob', audioBlob);
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
    },
    startSilenceDetection() {
      if (!this.mediaStream || !(this.mediaStream instanceof MediaStream)) {
        console.error('No valid mediaStream for silence detection.');
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
          if (!this.silenceStart) this.silenceStart = Date.now();
          if (Date.now() - this.silenceStart > this.silenceThreshold) {
            this.stopRecording();
            this.$emit('silenceDetected');
          }
        } else {
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
