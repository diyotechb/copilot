<template>
  <div>
    <div v-if="isSafari && recordedVideoUrl && !interviewing" class="safari-warning">
      <strong>Note:</strong> Safari has a known issue where the camera may remain active after recording stops. If you see the camera icon, manually refresh the page to fully release camera resources.
    </div>
  </div>
</template>


<script>
import { saveSetting } from '@/store/settingStore';

export default {
  name: 'VideoRecorder',
  computed: {
    isSafari() {
      return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }
  },
  props: {
    interviewStopped: {
      type: Boolean,
      default: false
    }
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
    interviewStopped(newVal, oldVal) {
        if (oldVal != newVal) {
          console.log('[DEBUG] Interview stopped by user, interviewStopped: ', this.interviewStopped);
          this.stopRecording();
        }
    }
  },
  mounted() {
    this.startRecording();
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
          console.log('[DEBUG] MediaRecorder stopped, processing video...');
          const blob = new Blob(this.recordedChunks);
          this.recordedVideoUrl = URL.createObjectURL(blob);
          console.log('[DEBUG] Recorded video URL:', this.recordedVideoUrl);
          saveSetting('lastRecordedVideo', this.recordedVideoUrl);
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
      console.log('[DEBUG] stopRecording called');
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        setTimeout(() => {
          this.mediaRecorder.stop();
        }, 200);
      }
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
