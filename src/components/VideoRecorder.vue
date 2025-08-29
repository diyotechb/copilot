<template>
  <div class="video-corner">
    <video ref="videoPreview" autoplay playsinline muted width="220" height="160" style="border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.12);" v-show="interviewing"></video>
    <div v-if="recordedVideoUrl && !interviewing" class="center-actions">
      <video :src="recordedVideoUrl" controls width="220" height="160" style="border-radius:12px;"></video>
      <button class="btn download-btn" :disabled="!recordedVideoUrl" @click="handleDownload" style="width:220px; margin-top:8px;"
        ref="downloadBtn">
        <span style="font-size:1.5rem; margin-right:8px;">⬇️</span> Download
      </button>
      <button class="btn home-btn" @click="goHome" style="width:220px; margin-top:12px;">
        <span style="font-size:1.5rem; margin-right:8px;">🏠</span> Home
      </button>
    </div>
  </div>
</template>


<script>
export default {
  name: 'VideoRecorder',
  props: {
    interviewing: Boolean
  },
  data() {
    return {
      mediaStream: null,
      mediaRecorder: null,
      recordedChunks: [],
      recordedVideoUrl: '',
      videoPreview: null,
      audioContext: null,
      mediaStreamSource: null,
      analyser: null,
      silenceTimer: null,
      silenceThreshold: 5000,
      silenceStart: null
    };
  },
  watch: {
    interviewing(newVal, oldVal) {
      if (newVal && !oldVal) {
        this.startRecording();
      } else if (!newVal && oldVal) {
        this.stopRecording();
      }
    }
  },
  mounted() {
    this.videoPreview = this.$refs.videoPreview;
    this.$emit('video-mounted', this.videoPreview);
    // Debug button state
    this.$nextTick(() => {
      const btn = this.$refs.downloadBtn;
      if (btn) {
        console.log('[Download Button Rendered]', {
          disabled: btn.disabled,
          recordedVideoUrl: this.recordedVideoUrl,
          interviewing: this.interviewing
        });
      }
    });
    if (this.interviewing) {
      this.startRecording();
    }
  },
  beforeUnmount() {
    this.stopRecording();
    this.clearSilenceDetection();
  },
  methods: {
    async startRecording() {
      this.recordedVideoUrl = '';
      this.recordedChunks = [];
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (this.videoPreview) {
          this.videoPreview.srcObject = this.mediaStream;
        }
        let options = {};
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          options.mimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          options.mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          options.mimeType = 'video/mp4';
        }
        this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks);
          this.recordedVideoUrl = URL.createObjectURL(blob);
          this.$emit('videoUrl', this.recordedVideoUrl);
          if (this.videoPreview) this.videoPreview.srcObject = null;
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
          }
        };
        this.mediaRecorder.start();
        this.startSilenceDetection();
      } catch (err) {
        console.error('Could not start video recording:', err);
      }
    },
    stopRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        setTimeout(() => {
          this.mediaRecorder.stop();
        }, 500);
      }
      this.clearSilenceDetection();
    },
    goHome() {
      this.$router.push({ name: 'ResumeSetup' });
    },
    handleDownload() {
      console.log('[Download Button Click]', {
        recordedVideoUrl: this.recordedVideoUrl,
        interviewing: this.interviewing,
        disabled: !this.recordedVideoUrl
      });
      if (!this.recordedVideoUrl) return;
      this.$emit('download', this.recordedVideoUrl);
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
            this.$emit('silenceDetected');
            this.silenceStart = null;
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
  }
};
</script>

<style scoped>
.center-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 2rem;
}
.home-btn {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1.1rem;
  padding: 0.75rem 0;
  transition: background 0.2s;
}
.home-btn:hover {
  background: #e0e0e0;
}
.video-corner {
  width: 220px;
  margin: 2rem auto 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
