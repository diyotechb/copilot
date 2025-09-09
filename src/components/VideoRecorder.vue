<template>
  <div>
    <div v-if="isSafari && recordedVideoUrl && !interviewing" class="safari-warning">
      <strong>Note:</strong> Safari has a known issue where the camera may remain active after recording stops. If you see the camera icon, manually refresh the page to fully release camera resources.
    </div>
    <div class="video-corner">
      <!-- Hide video preview during interview -->
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
  </div>
</template>


<script>
export default {
  name: 'VideoRecorder',
  computed: {
    isSafari() {
      return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }
  },
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
        console.log('[VideoRecorder] Download Button Rendered', {
          disabled: btn.disabled,
          recordedVideoUrl: this.recordedVideoUrl,
          interviewing: this.interviewing
        });
      }
    });
    if (this.interviewing) {
      console.log('[VideoRecorder] Interviewing is true, starting recording and requesting camera/mic permissions.');
      this.startRecording();
    } else {
      console.log('[VideoRecorder] Interviewing is false, NOT requesting camera/mic permissions.');
    }
  },
  beforeUnmount() {
    this.stopRecording();
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
    },
    goHome() {
      this.stopRecording();
      // Reload the page to fully release camera/mic in Safari
      setTimeout(() => {
        window.location.href = this.$router.resolve({ name: 'ResumeSetup' }).href;
      }, 300);
    },
    handleDownload() {
      console.log('[Download Button Click]', {
        recordedVideoUrl: this.recordedVideoUrl,
        interviewing: this.interviewing,
        disabled: !this.recordedVideoUrl
      });
      if (!this.recordedVideoUrl) return;
      this.$emit('download', this.recordedVideoUrl);
    }
  }
};
</script>

<style scoped>
.safari-warning {
  background: #fffbe6;
  color: #b45309;
  border: 2px solid #f59e42;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(245, 158, 66, 0.08);
}
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
