<template>
  <div class="video-recorder-root">
    <div v-if="isSafari && recordedVideoUrl && !interviewing" class="safari-warning">
      <strong>Note:</strong> Safari has a known issue where the camera may remain active after recording stops. If you see the camera icon, manually refresh the page to fully release camera resources.
    </div>

    <!-- Floating Video Preview -->
    <transition name="fade">
      <div v-if="visible" class="floating-video-container" :class="{ 'minimized': isMinimized }">
        <div class="video-header" @click="isMinimized = !isMinimized">
          <i class="el-icon-video-camera"></i>
          <span>{{ isMinimized ? 'Recording...' : 'Live Preview' }}</span>
          <button class="minimize-btn" @click.stop="$emit('close')">
            <i class="el-icon-close"></i>
          </button>
        </div>
        <div v-show="!isMinimized" class="video-body">
          <video ref="previewVideo" autoplay muted playsinline class="preview-video-element"></video>
        </div>
      </div>
    </transition>
  </div>
</template>


<script>
import { saveVideoRecording } from '@/store/recordingStore';

export default {
  name: 'VideoRecorder',
  props: {
    visible: { type: Boolean, default: true },
    interviewing: { type: Boolean, default: true },
    audioMixStream: { type: MediaStream, default: null }  // mixed TTS+mic stream from InterviewView
  },
  computed: {
    isSafari() {
      return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }
  },
  data() {
    return {
      mediaStream: null,
      recordingStream: null,
      _fallbackAudioStream: null,
      mediaRecorder: null,
      recordedChunks: [],
      recordedVideoUrl: '',
      isMinimized: false,
    };
  },
  watch: {
    // When the preview panel becomes visible, make sure the video element gets the stream
    visible(val) {
      if (val && this.mediaStream) {
        this.$nextTick(() => {
          if (this.$refs.previewVideo && !this.$refs.previewVideo.srcObject) {
            this.$refs.previewVideo.srcObject = this.mediaStream;
          }
        });
      }
    }
  },
  mounted() {
    this.startRecording();
    this._unloadHandler = () => this.forceStopAllTracks();
    window.addEventListener('beforeunload', this._unloadHandler);
  },
  beforeUnmount() {
    if (this._unloadHandler) window.removeEventListener('beforeunload', this._unloadHandler);
    this.forceStopAllTracks();
  },
  methods: {
    forceStopAllTracks() {
      // Immediately kill every track so the camera/mic indicator light turns off
      if (this.recordingStream) {
        this.recordingStream.getTracks().forEach(track => track.stop());
        this.recordingStream = null;
      }
      if (this._fallbackAudioStream) {
        this._fallbackAudioStream.getTracks().forEach(track => track.stop());
        this._fallbackAudioStream = null;
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      if (this.$refs.previewVideo) {
        this.$refs.previewVideo.srcObject = null;
      }
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try { this.mediaRecorder.stop(); } catch (e) {}
      }
    },
    async startRecording() {
      this.recordedVideoUrl = '';
      this.recordedChunks = [];
      try {
        // Get video-only stream for preview; audio comes from the mixed context stream
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.mediaStream = videoStream;

        // Build the recording stream: video track + mixed audio (TTS + mic) if available
        if (this.audioMixStream && this.audioMixStream.getAudioTracks().length > 0) {
          const combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...this.audioMixStream.getAudioTracks()
          ]);
          this.recordingStream = combinedStream;
        } else {
          // Fallback: get audio from the camera stream normally
          const fullStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          this.recordingStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...fullStream.getAudioTracks()
          ]);
          this._fallbackAudioStream = fullStream;
        }

        // Link stream to preview video
        this.$nextTick(() => {
          if (this.$refs.previewVideo) {
            this.$refs.previewVideo.srcObject = this.mediaStream;
          }
        });

        let options = {};
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
          options.mimeType = 'video/webm;codecs=vp8';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          options.mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          options.mimeType = 'video/mp4';
        }

        this.mediaRecorder = new MediaRecorder(this.recordingStream || this.mediaStream, options);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };
        this.mediaRecorder.onstop = async () => {
          const blob = new Blob(this.recordedChunks, { type: options.mimeType });
          await saveVideoRecording(blob);
          if (this.$refs.previewVideo) this.$refs.previewVideo.srcObject = null;
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
          }
        };
        this.mediaRecorder.start();
        this.$emit('recordingStarted', Date.now());
      } catch (err) {
        console.error('Could not start video recording:', err);
      }
    },
    stopRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        setTimeout(() => {
          if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
          }
          // Don't wait for onstop — kill tracks immediately so camera light turns off
          this.forceStopAllTracks();
        }, 200);
      } else {
        this.forceStopAllTracks();
      }
    },
    pauseRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
      }
    },
    resumeRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
      }
    }
  }
};
</script>

<style scoped>
.safari-warning {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #fffbe6;
  color: #b45309;
  border: 1px solid #f59e42;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  z-index: 2000;
}

/* Floating Video */
.floating-video-container {
  position: fixed;
  bottom: 140px;
  right: 40px;
  width: 260px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 15px 40px rgba(0,0,0,0.18);
  overflow: hidden;
  border: 1px solid #e2e8f0;
  z-index: 2100;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.floating-video-container.minimized {
  width: 140px;
}

.video-header {
  padding: 10px 16px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
}

.video-header i { color: #2563eb; font-size: 1rem; }
.video-header span { font-size: 0.85rem; font-weight: 700; color: #334155; flex: 1; text-transform: uppercase; letter-spacing: 0.5px; }

.minimize-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  padding: 4px;
  display: flex;
  align-items: center;
}

.video-body {
  aspect-ratio: 16/9;
  background: #000;
}

.preview-video-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.fade-enter-active, .fade-leave-active { transition: all 0.3s ease; }
.fade-enter, .fade-leave-to { opacity: 0; transform: translateY(20px); }
</style>