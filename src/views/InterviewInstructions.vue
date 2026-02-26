<template>
  <div class="instructions-page-view">
    <div class="instructions-view-header">
      <div class="header-main">
        <div class="header-top">
          <el-button
              icon="el-icon-back"
              circle
              size="small"
              @click="handleBack"
              class="back-btn"
              title="Back to Setup"
          ></el-button>
          <h2>Before You Begin</h2>
        </div>
        <p class="header-subtitle">Review how the session works, then check your devices.</p>
      </div>
      <div class="header-badge">
        <span class="step-indicator">STEP 2/3</span>
      </div>
    </div>

    <div class="instructions-grid">
      <!-- Left: Guidelines -->
      <div class="instructions-content-container">
        <div class="instructions-card">
          <div class="card-header highlight">
            <i class="el-icon-notebook-2"></i>
            <h3>How the Interview Works</h3>
          </div>
          <div class="card-body">

            <!-- 3-second rule callout -->
            <div class="rule-callout">
              <div class="rule-icon">
                <i class="el-icon-time"></i>
              </div>
              <div class="rule-body">
                <p class="rule-title">The 3-Second Rule</p>
                <p class="rule-desc">
                  After you stop speaking, the system waits <strong>{{ silenceWaitSeconds }} seconds</strong> of silence before automatically moving to the next question. Finish your answer, then simply stay quiet for {{ silenceWaitSeconds }} seconds to advance — or tap <strong>Next</strong> to skip ahead anytime.
                </p>
              </div>
            </div>

            <ul class="instructions-list">
              <li>
                <div class="list-icon step-num">1</div>
                <div>
                  <p class="list-title">Interviewer reads the question aloud</p>
                  <p class="list-sub">You'll hear the question spoken by your selected system voice. The transcript appears in real time.</p>
                </div>
              </li>
              <li>
                <div class="list-icon step-num">2</div>
                <div>
                  <p class="list-title">Answer naturally — your mic records your response</p>
                  <p class="list-sub">Speak clearly. The suggested answer also streams on screen so you can follow along or use it as a guide.</p>
                </div>
              </li>
              <li>
                <div class="list-icon step-num">3</div>
                <div>
                  <p class="list-title">Stay silent for {{ silenceWaitSeconds }}s to auto-advance</p>
                  <p class="list-sub">Once you finish speaking, {{ silenceWaitSeconds }} seconds of silence triggers the next question automatically.</p>
                </div>
              </li>
              <li>
                <div class="list-icon step-num">4</div>
                <div>
                  <p class="list-title">Use the control bar at any time</p>
                  <p class="list-sub">Pause to collect your thoughts, tap Next to skip, or Stop to end the session early. Everything is saved automatically.</p>
                </div>
              </li>
            </ul>

            <div class="tips-row">
              <div class="tip-chip"><i class="el-icon-microphone"></i> Quiet room = better results</div>
              <div class="tip-chip"><i class="el-icon-sunny"></i> Face a light source</div>
              <div class="tip-chip"><i class="el-icon-headset"></i> Headphones recommended</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Device Preview -->
      <div class="preview-section-container">
        <div class="instructions-card preview-card">
          <div class="card-header">
            <i class="el-icon-video-camera"></i>
            <h3>Device Check</h3>
          </div>
          <div class="card-body centered-body">
            <div class="preview-stage">
              <div v-if="localEnableVideo" class="video-preview-window">
                <video ref="previewVideo" autoplay muted playsinline class="preview-video-element"></video>
                <div v-if="!previewStream || !cameraTrackEnabled" class="preview-overlay">
                  <div class="mini-loader"></div>
                  <span>Waiting for camera…</span>
                </div>
                <div class="preview-badge">
                  <span class="badge-dot"></span> Live Preview
                </div>
              </div>
              <div v-else class="voice-only-placeholder">
                <i class="el-icon-microphone"></i>
                <span>Voice-Only Mode</span>
                <p>Camera is disabled for this session.</p>
              </div>
            </div>

            <!-- Camera Toggle -->
            <div class="local-media-controls">
              <div class="local-toggle-row">
                <span class="local-toggle-label">Enable Camera</span>
                <div
                    class="modern-switch small"
                    @click="toggleLocalVideo"
                    :class="{ 'is-active': localEnableVideo }"
                >
                  <div class="switch-handle">
                    <i :class="localEnableVideo ? 'el-icon-video-camera' : 'el-icon-video-camera-solid'"></i>
                  </div>
                </div>
              </div>
            </div>

            <!-- Mic Level -->
            <div class="audio-monitor">
              <div class="monitor-label">
                <span>Microphone Level</span>
                <span class="mic-status-label" :class="{ 'is-active': audioLevel > 5 }">
                  {{ audioLevel > 5 ? '● Detecting Audio' : '○ Silence' }}
                </span>
              </div>
              <div class="volume-bar-container">
                <div class="volume-bar-fill" :style="{ width: audioLevel + '%' }"></div>
              </div>
            </div>

            <div class="preview-info">
              <i class="el-icon-info"></i>
              <p>Be in a quiet, well-lit space for the best experience.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="instructions-actions">
      <el-button
          type="primary"
          class="instructions-start-btn"
          :loading="isGenerating"
          :disabled="isGenerating"
          @click="handleStartInterview">
        {{ isGenerating ? 'Preparing Your Questions…' : "I'm Ready — Start Interview" }}
      </el-button>
      <p v-if="isGenerating" class="generating-hint">
        <i class="el-icon-loading"></i> Personalising questions from your resume. Almost there!
      </p>
      <p v-else class="permissions-hint">
        <i class="el-icon-lock"></i> Your devices are only used during the session and never stored.
      </p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'InterviewInstructions',
  props: {
    enableVideo: { type: Boolean, default: false },
    isGenerating: { type: Boolean, default: false }
  },
  data() {
    return {
      previewStream: null,
      localEnableVideo: this.enableVideo,
      cameraTrackEnabled: false,
      audioLevel: 0,
      audioContext: null,
      analyser: null,
      dataArray: null,
      animationId: null
    };
  },
  computed: {
    // ── ONE place to change the silence rule shown on this page ──
    silenceWaitSeconds() {
      return 3; // ← change this number (e.g. to 2) to update all text on this page
    }
  },
  mounted() {
    this.startMediaPreview();
  },
  beforeDestroy() {
    this.stopMediaPreview();
  },
  methods: {
    async startMediaPreview() {
      try {
        this.previewStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: this.localEnableVideo ? { width: 640, height: 360 } : false
        });
        if (this.$refs.previewVideo && this.localEnableVideo) {
          this.$refs.previewVideo.srcObject = this.previewStream;
          this.cameraTrackEnabled = true;
        }
        this.setupAudioVisualization(this.previewStream);
      } catch (err) {
        console.error('Media preview error:', err);
      }
    },
    async toggleLocalVideo() {
      this.localEnableVideo = !this.localEnableVideo;
      this.$emit('update:enableVideo', this.localEnableVideo);
      this.stopMediaPreview();
      await this.startMediaPreview();
    },
    setupAudioVisualization(stream) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.drawAudioLevel();
      } catch (e) {
        console.warn('Audio viz failed:', e);
      }
    },
    drawAudioLevel() {
      this.animationId = requestAnimationFrame(this.drawAudioLevel);
      this.analyser.getByteFrequencyData(this.dataArray);
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) sum += this.dataArray[i];
      this.audioLevel = Math.min(100, (sum / this.dataArray.length / 128) * 100);
    },
    stopMediaPreview() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.previewStream) this.previewStream.getTracks().forEach(t => t.stop());
      if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close();
    },
    handleBack() {
      this.stopMediaPreview();
      this.$emit('back');
    },
    handleStartInterview() {
      this.stopMediaPreview();
      this.$emit('startInterview');
    }
  }
};
</script>

<style scoped>
/* ── Base ── */
.instructions-page-view {
  width: 100%;
  font-family: var(--font-family);
}

/* ── Header ── */
.instructions-view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 28px;
}
.header-top {
  display: flex;
  align-items: center;
  gap: 14px;
}
.back-btn {
  border: 1px solid #e5e7eb !important;
  color: #6b7280 !important;
  flex-shrink: 0;
}
.back-btn:hover {
  background: #f3f4f6 !important;
  color: #1a1a1a !important;
}
.header-main h2 {
  font-size: 1.55rem;
  color: #1a1a1a;
  margin: 0;
  font-weight: 700;
}
.header-subtitle {
  color: #666;
  margin: 5px 0 0 0;
  font-size: 0.95rem;
}
.step-indicator {
  background: #e6f0ff;
  color: #2563eb;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

/* ── Grid ── */
.instructions-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 24px;
  margin-bottom: 28px;
}
.instructions-content-container { display: flex; flex-direction: column; gap: 20px; }

/* ── Card ── */
.instructions-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
  border: 1px solid #f0f2f5;
  overflow: hidden;
  height: 100%;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 22px;
  background: #fcfcfd;
  border-bottom: 1px solid #f0f2f5;
}
.card-header.highlight { background: #f0f7ff; }
.card-header i { font-size: 1.2rem; color: #2563eb; }
.card-header h3 { margin: 0; font-size: 1rem; color: #1a1a1a; font-weight: 600; }
.card-body { padding: 22px; }
.centered-body { display: flex; flex-direction: column; align-items: stretch; }

/* ── 3-Second Rule Callout ── */
.rule-callout {
  display: flex;
  gap: 16px;
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 24px;
}
.rule-icon {
  width: 40px;
  height: 40px;
  background: #f59e0b;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
  font-size: 1.2rem;
}
.rule-body { flex: 1; }
.rule-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: #92400e;
  margin: 0 0 6px 0;
}
.rule-desc {
  font-size: 0.875rem;
  color: #78350f;
  margin: 0;
  line-height: 1.55;
}

/* ── Steps List ── */
.instructions-list {
  list-style: none;
  padding: 0;
  margin: 0 0 22px 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.instructions-list li {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.list-icon {
  width: 28px;
  height: 28px;
  background: #2563eb;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 700;
  margin-top: 1px;
}
.list-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: #1e293b;
  margin: 0 0 3px 0;
}
.list-sub {
  font-size: 0.83rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

/* ── Tips ── */
.tips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tip-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 20px;
}
.tip-chip i { color: #2563eb; }

/* ── Preview ── */
.preview-stage { width: 100%; margin-bottom: 16px; }
.video-preview-window {
  width: 100%;
  aspect-ratio: 16/9;
  background: #0f172a;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 6px 20px rgba(0,0,0,0.15);
}
.preview-video-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  display: block;
}
.preview-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  background: rgba(0,0,0,0.5);
  gap: 12px;
  font-size: 0.85rem;
}
.preview-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0,0,0,0.55);
  color: white;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.badge-dot {
  width: 7px;
  height: 7px;
  background: #ef4444;
  border-radius: 50%;
  animation: blink 1.2s infinite;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

.voice-only-placeholder {
  width: 100%;
  aspect-ratio: 16/9;
  background: #f8fafc;
  border: 2px dashed #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
  text-align: center;
  padding: 20px;
}
.voice-only-placeholder i { font-size: 2.2rem; margin-bottom: 10px; color: #cbd5e1; }
.voice-only-placeholder span { font-weight: 700; font-size: 1rem; margin-bottom: 4px; }
.voice-only-placeholder p { font-size: 0.82rem; margin: 0; }

.local-media-controls {
  background: #f9fafb;
  padding: 11px 16px;
  border-radius: 10px;
  border: 1px solid #f1f5f9;
  margin-bottom: 14px;
}
.local-toggle-row { display: flex; justify-content: space-between; align-items: center; }
.local-toggle-label { font-size: 0.88rem; font-weight: 600; color: #475569; }

.modern-switch {
  width: 52px; height: 28px;
  background: #e2e8f0;
  border-radius: 30px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s;
  flex-shrink: 0;
}
.modern-switch.is-active { background: #10b981; }
.switch-handle {
  width: 20px; height: 20px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 4px; left: 4px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.12);
  transition: left 0.3s;
  font-size: 0.75rem;
  color: #64748b;
}
.modern-switch.small .switch-handle { width: 20px; height: 20px; }
.modern-switch.is-active .switch-handle { left: 28px; color: #10b981; }

.audio-monitor {
  background: #f8fafc;
  padding: 13px 16px;
  border-radius: 10px;
  border: 1px solid #f1f5f9;
  margin-bottom: 14px;
}
.monitor-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
}
.mic-status-label { color: #94a3b8; transition: color 0.3s; }
.mic-status-label.is-active { color: #10b981; }
.volume-bar-container {
  width: 100%; height: 6px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}
.volume-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  transition: width 0.1s ease-out;
}

.preview-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #64748b;
  font-size: 0.82rem;
  line-height: 1.4;
}
.preview-info i { color: #94a3b8; flex-shrink: 0; margin-top: 1px; }
.preview-info p { margin: 0; }

.mini-loader {
  width: 22px; height: 22px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Actions ── */
.instructions-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 30px;
}
.instructions-start-btn {
  padding: 16px 56px !important;
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  border-radius: 14px !important;
  height: auto !important;
  box-shadow: 0 4px 14px rgba(37,99,235,0.25);
  transition: all 0.3s !important;
}
.instructions-start-btn:hover:not([disabled]) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37,99,235,0.35) !important;
}
.generating-hint {
  margin-top: 14px;
  color: #2563eb;
  font-size: 0.88rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.permissions-hint {
  margin-top: 12px;
  color: #9ca3af;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Responsive ── */
@media (max-width: 960px) {
  .instructions-grid {
    grid-template-columns: 1fr;
  }
  .preview-section-container {
    order: -1;
  }
  .video-preview-window, .voice-only-placeholder {
    max-width: 480px;
    margin: 0 auto;
  }
}

@media (max-width: 640px) {
  .instructions-view-header {
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }
  .header-main h2 { font-size: 1.25rem; }
  .header-subtitle { font-size: 0.88rem; }
  .card-body { padding: 16px; }
  .card-header { padding: 13px 16px; }
  .rule-callout { flex-direction: column; gap: 10px; padding: 14px 16px; }
  .rule-icon { width: 34px; height: 34px; font-size: 1rem; }
  .tips-row { gap: 6px; }
  .tip-chip { font-size: 0.75rem; padding: 5px 10px; }
  .instructions-start-btn {
    width: 100%;
    padding: 14px 20px !important;
    font-size: 1rem !important;
  }
}

@media (max-width: 400px) {
  .header-main h2 { font-size: 1.1rem; }
  .list-title { font-size: 0.85rem; }
  .list-sub { font-size: 0.8rem; }
}
</style>