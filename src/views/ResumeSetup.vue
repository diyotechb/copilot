<template>
  <div class="setup-page-view">
    <div v-if="!qaReady">
      <div class="setup-view-header">
        <div class="header-main">
          <h2>Resume & Voice Setup</h2>
          <p class="header-subtitle">Configure your documents and interviewer preferences to begin.</p>
        </div>
        <div class="header-badge">
          <span class="step-indicator">STEP 1/3</span>
        </div>
      </div>

      <div class="setup-form-container">
        <!-- Documents Section -->
        <div class="setup-card">
          <div class="card-header">
            <i class="el-icon-document"></i>
            <h3>Documents</h3>
          </div>
          <div class="card-body">
            <div class="upload-group">
              <label class="group-label">Resume</label>
              <FileUpload
                  label="Resume"
                  @input="resumeText = $event"
              />
            </div>
            <div class="upload-group">
              <label class="group-label">Job Description (Optional)</label>
              <FileUpload
                  label="Job Description"
                  @input="jobDescriptionText = $event"
              />
            </div>
          </div>
        </div>

        <!-- Settings Section -->
        <div class="setup-card">
          <div class="card-header">
            <i class="el-icon-setting"></i>
            <h3>Interviewer Settings</h3>
          </div>
          <div class="card-body">
            <div class="settings-grid">
              <div class="setting-field">
                <label>Interviewer Voice</label>
                <div class="select-wrapper">
                  <select v-model="selectedVoice" class="setup-select" @change="onVoiceChange" :disabled="voicesLoading">
                    <option value="" disabled>Select a voice</option>
                    <option v-for="voice in voices" :key="voice.ShortName || voice.shortName" :value="voice.ShortName || voice.shortName">
                      {{ (voice.ShortName || voice.Name || '').split('-').slice(-1)[0] }}<span v-if="voice.Gender || voice.gender"> ({{ voice.Gender || voice.gender }})</span>
                    </option>
                  </select>
                  <i class="el-icon-arrow-down select-icon"></i>
                </div>
              </div>

              <div class="setting-field">
                <label>Difficulty Level</label>
                <div class="select-wrapper">
                  <select v-model="interviewDifficulty" class="setup-select" @change="onDifficultyChange">
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                  </select>
                  <i class="el-icon-arrow-down select-icon"></i>
                </div>
              </div>
            </div>

            <div class="recording-settings">
              <!-- Show Questions Toggle -->
              <div class="toggle-wrapper">
                <div class="toggle-text">
                  <span class="toggle-main-label">Show Questions</span>
                  <p class="toggle-description">Enable this to see the text of each question during the interview.</p>
                </div>
                <div
                    class="modern-switch"
                    @click="toggleShowQuestions"
                    :class="{ 'is-active': showQuestions }"
                >
                  <div class="switch-handle">
                    <i :class="showQuestions ? 'el-icon-view' : 'el-icon-hide'"></i>
                  </div>
                </div>
              </div>
              <div class="status-badge-row">
                <span class="status-badge" :class="showQuestions ? 'active' : 'inactive'">
                  <i class="el-icon-info"></i>
                  {{ showQuestions ? 'Questions will be shown' : 'Questions will be hidden' }}
                </span>
              </div>

              <div class="mic-divider"></div>

              <!-- Video Toggle -->
              <div class="toggle-wrapper">
                <div class="toggle-text">
                  <span class="toggle-main-label">Video Recording</span>
                  <p class="toggle-description">Visualize your performance by recording your webcam during the session.</p>
                </div>
                <div
                    class="modern-switch"
                    @click="toggleVideo"
                    :class="{ 'is-active': enableVideo }"
                >
                  <div class="switch-handle">
                    <i :class="enableVideo ? 'el-icon-video-camera' : 'el-icon-video-camera-solid'"></i>
                  </div>
                </div>
              </div>
              <div class="status-badge-row">
                <span class="status-badge" :class="enableVideo ? 'active' : 'inactive'">
                  <i class="el-icon-info"></i>
                  {{ enableVideo ? 'Video will be recorded' : 'Voice only session' }}
                </span>
              </div>

              <!-- Microphone Status -->
              <div class="mic-divider"></div>
              <div class="toggle-wrapper">
                <div class="toggle-content">
                  <span class="toggle-main-label">Microphone Access</span>
                  <p class="toggle-description">Required to record and transcribe your answers. We use browser-level permissions.</p>
                </div>
                <div class="status-badge-row">
                  <div v-if="micPermission === 'granted'" class="status-badge active">
                    <i class="el-icon-circle-check"></i> Access Granted
                  </div>
                  <div v-else-if="micPermission === 'denied'" class="status-badge denied">
                    <i class="el-icon-circle-close"></i> Access Denied
                  </div>
                  <div v-else class="status-badge inactive">
                    <i class="el-icon-warning-outline"></i> Access Required
                  </div>
                </div>
              </div>

              <!-- Camera Status (Only if video enabled) -->
              <template v-if="enableVideo">
                <div class="mic-divider"></div>
                <div class="toggle-wrapper">
                  <div class="toggle-content">
                    <span class="toggle-main-label">Camera Access</span>
                    <p class="toggle-description">Required for video recording and session summary.</p>
                  </div>
                  <div class="status-badge-row">
                    <div v-if="cameraPermission === 'granted'" class="status-badge active">
                      <i class="el-icon-circle-check"></i> Access Granted
                    </div>
                    <div v-else-if="cameraPermission === 'denied'" class="status-badge denied">
                      <i class="el-icon-circle-close"></i> Access Denied
                    </div>
                    <div v-else class="status-badge inactive">
                      <i class="el-icon-warning-outline"></i> Access Required
                    </div>
                  </div>
                </div>
              </template>

              <!-- Combined Enable Button if needed -->
              <template v-if="micPermission !== 'granted' || (enableVideo && cameraPermission !== 'granted')">
                <div class="mic-divider"></div>
                <div class="toggle-actions centered" style="margin-top: 15px;">
                  <el-button
                      type="primary"
                      size="medium"
                      @click="requestMediaPermissions"
                      :loading="micLoading"
                      class="verify-mic-btn"
                  >
                    Enable Device Access
                  </el-button>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Submission area -->
        <div class="setup-actions">
          <el-button
              type="primary"
              class="setup-submit-btn"
              :disabled="isSubmitDisabled"
              @click="submitSetup">
            Start Generating My Interview
          </el-button>

          <div v-if="micPermission === 'denied' || (enableVideo && cameraPermission === 'denied')" class="mic-warning-hint" style="justify-content: center; flex-direction: column;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <i class="el-icon-warning"></i> Access blocked by browser. Please update site settings to proceed.
            </div>
            <el-button type="text" class="help-link-btn" @click="showHelpModal = true">
              <i class="el-icon-question"></i> How to unblock?
            </el-button>
          </div>
          <div v-else-if="micPermission !== 'granted' || (enableVideo && cameraPermission !== 'granted')" class="mic-warning-hint" style="justify-content: center;">
            <i class="el-icon-warning"></i> Please enable device access to proceed.
          </div>

          <div v-if="isGenerating" class="setup-submit-progress">
            <div class="submit-loader"></div>
            <p>The system is crafting your personalized interview...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 2: Instructions -->
    <div v-else class="setup-view-centered">
      <InterviewInstructions
          :enableVideo="enableVideo"
          :isGenerating="isGenerating"
          :interviewQA="interviewQA"
          @update:enableVideo="enableVideo = $event"
          @startInterview="handleStartInterview"
          @back="qaReady = false"
      />
    </div>

    <!-- Permission Help Modal -->
    <el-dialog
        title="How to Enable Permissions"
        :visible.sync="showHelpModal"
        width="400px"
        custom-class="perm-help-dialog"
        append-to-body>
      <div class="help-steps">
        <div class="help-step">
          <div class="step-num">1</div>
          <div class="step-text">
            <strong>Click the Lock Icon</strong>
            <p>Look for the <i class="el-icon-lock"></i> padlock icon in your browser's address bar (left of the URL).</p>
          </div>
        </div>
        <div class="help-step">
          <div class="step-num">2</div>
          <div class="step-text">
            <strong>Toggle the Switches</strong>
            <p>Ensure both <strong>Microphone</strong> and <strong>Camera</strong> are switched to <span class="text-success">Allow</span> or <span class="text-success">On</span>.</p>
          </div>
        </div>
        <div class="help-step">
          <div class="step-num">3</div>
          <div class="step-text">
            <strong>Refresh or Sync</strong>
            <p>After changing settings, click the button below to update the status.</p>
          </div>
        </div>
      </div>
      <div slot="footer" class="dialog-footer">
        <el-button @click="showHelpModal = false">Close</el-button>
        <el-button type="primary" @click="handlePermissionsCheck">Check Status Again</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import FileUpload from '../components/FileUpload.vue';
import InterviewInstructions from './InterviewInstructions.vue';
import { saveSetting, getSetting } from '@/store/settingStore';
import { generateInterviewQA } from '../services/openaiService.js';
import { clearRecordingsStore } from '@/store/recordingStore.js';
import { clearInterviewQAStore, clearTranscriptsStore } from '@/store/interviewStore';

export default {
  name: 'ResumeSetup',
  components: { FileUpload, InterviewInstructions },
  data() {
    return {
      resumeText: '',
      voices: [],
      selectedVoice: '',
      jobDescriptionText: '',
      uploading: false,
      isGenerating: false,
      qaReady: false,
      submitSent: false,
      answerFontSize: 22,
      interviewQA: [],
      enableVideo: false,
      interviewDifficulty: 'Beginner',
      voicesLoading: false,
      micPermission: 'prompt', // 'granted', 'denied', 'prompt'
      cameraPermission: 'prompt',
      micLoading: false,
      showHelpModal: false,
      showQuestions: true,
    };
  },
  computed: {
    isSubmitDisabled() {
      const permsOk = this.micPermission === 'granted' && (!this.enableVideo || this.cameraPermission === 'granted');
      return !this.resumeText || !this.selectedVoice || this.isGenerating || this.voicesLoading || !permsOk;
    }
  },
  async mounted() {
    this.fetchVoices();
    clearRecordingsStore();
    clearInterviewQAStore();
    clearTranscriptsStore();
    this.enableVideo = await getSetting('enableVideo');
    const savedShowQuestions = await getSetting('showQuestions');
    if (savedShowQuestions !== null) {
      this.showQuestions = savedShowQuestions;
    }
    const savedVoice = await getSetting('selectedVoice');
    if (savedVoice) {
      this.selectedVoice = savedVoice;
    }
    const savedDifficulty = await getSetting('interviewDifficulty');
    if (savedDifficulty) {
      this.interviewDifficulty = savedDifficulty;
    }
    this.checkPermissions();
  },
  methods: {
    toggleShowQuestions() {
      this.showQuestions = !this.showQuestions;
      saveSetting('showQuestions', this.showQuestions);
    },
    toggleVideo() {
      this.enableVideo = !this.enableVideo;
      saveSetting('enableVideo', this.enableVideo);
      this.checkPermissions();
    },
    onDifficultyChange() {
      saveSetting('interviewDifficulty', this.interviewDifficulty);
    },
    async checkPermissions() {
      if (!navigator.permissions || !navigator.permissions.query) return;

      try {
        // Microphone check
        const micResult = await navigator.permissions.query({ name: 'microphone' });
        this.micPermission = micResult.state;
        micResult.onchange = () => { this.micPermission = micResult.state; };

        // Camera check
        const camResult = await navigator.permissions.query({ name: 'camera' });
        this.cameraPermission = camResult.state;
        camResult.onchange = () => { this.cameraPermission = camResult.state; };
      } catch (e) {
        console.warn('Permission query not supported:', e);
      }
    },
    handlePermissionsCheck() {
      this.checkPermissions();
      // Logic for providing feedback after manual check
      setTimeout(() => {
        if (this.micPermission === 'granted' && (!this.enableVideo || this.cameraPermission === 'granted')) {
          this.showHelpModal = false;
        }
      }, 500);
    },
    async requestMediaPermissions() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        window.alert('Media access is not supported in this browser or context.');
        return;
      }

      this.micLoading = true;
      try {
        const constraints = {
          audio: true,
          video: this.enableVideo ? { width: 640, height: 360 } : false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        this.micPermission = 'granted';
        if (this.enableVideo) this.cameraPermission = 'granted';

        stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.error('Media access denied:', e);
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          window.alert('Access was denied. Please allow microphone' + (this.enableVideo ? ' and camera' : '') + ' in your browser settings.');
        } else {
          window.alert('Could not start devices: ' + e.message);
        }
        this.checkPermissions();
      } finally {
        this.micLoading = false;
      }
    },
    toggleVideo() {
      this.enableVideo = !this.enableVideo;
      saveSetting('enableVideo', this.enableVideo);
      this.checkPermissions();
    },
    onVoiceChange() {
      if (this.selectedVoice) {
        this.playVoiceSample(this.selectedVoice);
      }
    },
    onDifficultyChange() {
      saveSetting('interviewDifficulty', this.interviewDifficulty);
    },
    async fetchVoices() {
      this.voicesLoading = true;
      const subscriptionKey = process.env.VUE_APP_AZURE_SPEECH_KEY;
      const region = process.env.VUE_APP_AZURE_SPEECH_REGION;
      if (!subscriptionKey || !region) return;
      const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey
          }
        });
        const allVoices = await response.json();
        this.voices = allVoices.filter(v => (v.Locale || v.locale) === 'en-US');
      } catch (e) {
        this.voices = [];
      } finally {
        this.voicesLoading = false;
      }
    },
    async playVoiceSample(voiceName) {
      const subscriptionKey = process.env.VUE_APP_AZURE_SPEECH_KEY;
      const region = process.env.VUE_APP_AZURE_SPEECH_REGION;
      if (!subscriptionKey || !region) return;
      const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
      const ssml = `
        <speak version='1.0' xml:lang='en-US'>
          <voice xml:lang='en-US' name='${voiceName}'>
            This is a sample of the selected Azure voice.
          </voice>
        </speak>
      `;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
            'User-Agent': 'ResumeSetupVue'
          },
          body: ssml
        });
        if (!response.ok) throw new Error('Azure TTS failed');
        const audioData = await response.arrayBuffer();
        const blob = new Blob([audioData], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
      } catch (e) {
        alert('Could not play sample for this voice.');
      }
    },
    async submitSetup() {
      this.isGenerating = true;
      this.qaReady = true;

      await saveSetting('selectedVoice', this.selectedVoice);

      try {
        this.interviewQA = await generateInterviewQA({
          resumeText: this.resumeText,
          jobDescriptionText: this.jobDescriptionText
        });
      } catch (e) {
        console.error('Failed to generate interview questions:', e);
        window.alert('Failed to generate interview questions.');
        this.qaReady = false;
      } finally {
        this.isGenerating = false;
      }
    },
    async handleStartInterview() {
      // Final store sync before navigating
      saveSetting('enableVideo', this.enableVideo);

      const mediaConstraints = this.enableVideo ? { video: true, audio: true } : { audio: true };
      navigator.mediaDevices.getUserMedia(mediaConstraints)
          .then(() => {
            if (!this.interviewQA || this.interviewQA.length === 0) {
              window.alert('Interview questions are not ready. Please try again.');
              return;
            }
            this.$router.push({ name: 'InterviewView' });
          })
          .catch(() => {
            window.alert('Permissions denied or hardware error. Please allow access to start.');
          });
    },
    goToInterview() {
      this.$router.push({ name: 'InterviewView' });
    }
  }
};
</script>

<style scoped>
.setup-page-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 0 40px;
  overflow-y: auto;
  height: calc(100vh - 60px);
  background-color: #f9fafe;
  font-family: var(--font-family);
}

.setup-view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin: 40px 0 30px 0;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
}

.header-main h2 {
  font-size: 28px;
  color: #1a1a1a;
  margin: 0;
  font-weight: 700;
}

.header-subtitle {
  color: #666;
  margin-top: 5px;
  font-size: 1.05rem;
}

.step-indicator {
  background: #e6f0ff;
  color: #2563eb;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.setup-form-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  padding-bottom: 80px;
}

.setup-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  border: 1px solid #f0f2f5;
}

.group-label {
  display: block;
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 25px;
  background: #fcfcfd;
  border-bottom: 1px solid #f0f2f5;
}

.card-header i {
  font-size: 1.25rem;
  color: #2563eb;
}

.card-header h3 {
  margin: 0;
  font-size: 1.15rem;
  color: #1a1a1a;
  font-weight: 600;
}

.card-body {
  padding: 25px;
}

.upload-group {
  margin-bottom: 25px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 25px;
  margin-bottom: 25px;
}

.setting-field label {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
}

.select-wrapper {
  position: relative;
  width: 100%;
}

.setup-select {
  width: 100%;
  appearance: none;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 1rem;
  color: #1f2937;
  cursor: pointer;
  transition: all 0.2s;
}

.setup-select:hover {
  border-color: #9ca3af;
}

.setup-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.select-icon {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: #6b7280;
}

.recording-settings {
  padding-top: 20px;
  border-top: 1px dashed #e5e7eb;
}

.toggle-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.toggle-text {
  flex: 1;
}

.toggle-main-label {
  display: block;
  font-weight: 700;
  color: #1a1a1a;
  font-size: 1.05rem;
  margin-bottom: 4px;
}

.toggle-description {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
}

.modern-switch {
  width: 68px;
  height: 36px;
  background-color: #e5e7eb;
  border-radius: 30px;
  position: relative;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  flex-shrink: 0;
}

.modern-switch.is-active {
  background-color: #10b981; /* Success Green */
}

.switch-handle {
  width: 28px;
  height: 28px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 4px;
  left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  color: #6b7280;
  font-size: 1rem;
}

.modern-switch.is-active .switch-handle {
  left: 36px;
  color: #10b981;
}

.status-badge-row {
  margin-top: 12px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-badge.active {
  background: #ecfdf5;
  color: #059669;
}

.status-badge.inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.denied {
  background: #fff1f2;
  color: #e11d48;
}

.mic-divider {
  margin: 25px 0;
  border-top: 1px dashed #e5e7eb;
}

.toggle-actions.centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.verify-mic-btn {
  padding: 10px 24px !important;
  font-weight: 600 !important;
  border-radius: 12px !important;
}

.mic-warning-hint {
  margin-top: 12px;
  color: #e11d48;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.setup-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.setup-submit-btn {
  padding: 18px 60px !important;
  font-size: 1.2rem !important;
  font-weight: 700 !important;
  border-radius: 16px !important;
  height: auto !important;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
  transition: all 0.3s;
}

.setup-submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.3);
}

.setup-submit-progress {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 25px;
  background: white;
  padding: 15px 25px;
  border-radius: 50px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid #f0f2f5;
}

.submit-loader {
  width: 20px;
  height: 20px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.setup-submit-progress p {
  margin: 0;
  color: #2563eb;
  font-weight: 600;
}

.setup-status-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 85vh;
}

.status-content {
  text-align: center;
  background: white;
  padding: 40px 60px;
  border-radius: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05);
  border: 1px solid #f0f2f5;
  max-width: 450px;
}

.main-loader {
  border: 5px solid #f3f3f3;
  border-top: 5px solid #2563eb;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  animation: spin 2s linear infinite;
  margin: 0 auto 25px auto;
}

.status-content h3 {
  font-size: 1.5rem;
  color: #1a1a1a;
  margin-bottom: 12px;
}

.status-content p {
  color: #666;
  line-height: 1.5;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.setup-view-centered {
  max-width: 1000px;
  margin: 40px auto;
  width: 90%;
}

/* Permission Help Styles */
.help-link-btn {
  padding: 0 !important;
  font-size: 0.9rem !important;
  font-weight: 600 !important;
  margin-top: 5px !important;
  color: #2563eb !important;
}

.help-steps {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 10px 0;
}

.help-step {
  display: flex;
  gap: 15px;
  align-items: flex-start;
}

.step-num {
  width: 28px;
  height: 28px;
  background: #2563eb;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.step-text strong {
  display: block;
  font-size: 1rem;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.step-text p {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
  line-height: 1.5;
}

.text-success {
  color: #10b981;
  font-weight: 700;
}

.perm-help-dialog {
  border-radius: 16px !important;
  overflow: hidden;
}

@media (max-width: 900px) {
  .setup-page-view {
    padding: 0 20px;
  }
}

@media (max-width: 768px) {
  .setup-page-view {
    padding: 0 14px;
    height: auto;
    overflow-y: visible;
  }

  .setup-view-header {
    flex-direction: column;
    align-items: flex-start;
    margin: 20px 0 18px 0;
    gap: 10px;
  }

  .header-badge {
    align-self: flex-start;
  }

  .header-main h2 { font-size: 1.35rem; }
  .header-subtitle { font-size: 0.9rem; }

  .setup-form-container {
    gap: 16px;
    padding-bottom: 40px;
  }

  .card-header { padding: 14px 18px; }
  .card-body   { padding: 18px 14px; }

  .settings-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .toggle-wrapper {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .modern-switch { align-self: flex-end; }

  .setup-submit-btn {
    width: 100%;
    padding: 15px 20px !important;
    font-size: 1.05rem !important;
  }

  .mic-warning-hint { text-align: center; }
}

@media (max-width: 480px) {
  .setup-page-view { padding: 0 10px; }
  .header-main h2  { font-size: 1.2rem; }
  .header-subtitle { font-size: 0.85rem; }
  .card-header h3  { font-size: 0.95rem; }
  .card-header     { padding: 12px 14px; }
  .card-body       { padding: 14px 12px; }
}
</style>