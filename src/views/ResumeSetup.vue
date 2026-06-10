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
        <!-- Retention warning: at cap. Starting this interview will
             permanently delete the oldest saved one. Surface it before
             the user fills out resume/JD so they can back out cheaply. -->
        <div v-if="atCap && oldestSession" class="setup-warning-banner">
          <i class="el-icon-warning-outline"></i>
          <div class="warning-text">
            You have <strong>{{ MAX_VISIBLE }} saved interviews</strong>, the maximum kept on this device.
            Starting a new interview will permanently delete the oldest —
            <strong>{{ oldestLabel }}</strong> — including its audio, video, transcripts, and analysis.
          </div>
          <el-button size="small" type="warning" @click="goToOldestSession">
            Open &amp; download first
          </el-button>
        </div>

        <!-- Browser storage running low. Best-effort check via
             navigator.storage.estimate(). Surfaces at >80% used so the
             user has time to delete old interviews from My Interviews
             before a recording fails mid-session due to quota. -->
        <div v-if="storageWarning" class="setup-warning-banner storage-warning">
          <i class="el-icon-warning-outline"></i>
          <div class="warning-text">
            Browser storage is <strong>{{ storageWarning.percent }}% full</strong>
            ({{ storageWarning.usedMB }} MB of {{ storageWarning.quotaMB }} MB).
            Consider deleting old interviews from My Interviews to avoid recording failures.
          </div>
        </div>

        <!-- Candidate Section -->
        <div class="setup-card">
          <div class="card-header">
            <i class="el-icon-user"></i>
            <h3>Candidate</h3>
          </div>
          <div class="card-body">
            <div class="setting-field">
              <label>Select Candidate <span class="req">*</span></label>
              <el-select
                class="candidate-select"
                :value="candidateValue"
                filterable
                placeholder="Search candidate by name…"
                @change="onCandidateSelect"
              >
                <el-option label="Not in List" value="none" />
                <el-option
                  v-for="c in practiceRoster"
                  :key="c.enrollmentId"
                  :label="[c.candidateName, maskEmail(c.email)].filter(Boolean).join(' - ')"
                  :value="c.enrollmentId"
                />
              </el-select>
              <p v-if="rosterLoading" class="difficulty-meta"><i class="el-icon-loading"></i> Loading candidates…</p>
              <p v-else-if="rosterError" class="difficulty-meta"><i class="el-icon-warning-outline"></i> {{ rosterError }}</p>
            </div>
          </div>
        </div>

        <!-- Documents Section -->
        <div class="setup-card">
          <div class="card-header">
            <i class="el-icon-document"></i>
            <h3>Documents</h3>
          </div>
          <div class="card-body">
            <div class="upload-group">
              <div class="group-label-row">
                <label class="group-label">Resume <span class="req">*</span></label>
                <label v-if="aiSampleGenerationEnabled" class="ai-toggle">
                  <input type="checkbox" v-model="resumeAiMode" />
                  <span class="ai-toggle-track"><span class="ai-toggle-knob"></span></span>
                  <span class="ai-toggle-text">Generate with AI</span>
                </label>
              </div>
              <FileUpload
                  label="Resume"
                  :value="resumeText"
                  :ai-mode="resumeAiMode"
                  :generating="generatingResume"
                  keywords-example="Jane Doe, senior frontend, 5 years, Acme Inc"
                  @input="resumeText = $event"
                  @generate="handleGenerateResume"
              />
            </div>
            <div class="upload-group">
              <div class="group-label-row">
                <label class="group-label">Job Description (Optional)</label>
                <label v-if="aiSampleGenerationEnabled" class="ai-toggle">
                  <input type="checkbox" v-model="jdAiMode" />
                  <span class="ai-toggle-track"><span class="ai-toggle-knob"></span></span>
                  <span class="ai-toggle-text">Generate with AI</span>
                </label>
              </div>
              <FileUpload
                  label="Job Description"
                  :value="jobDescriptionText"
                  :ai-mode="jdAiMode"
                  :generating="generatingJD"
                  keywords-example="Acme Inc, backend engineer, remote, fintech"
                  @input="jobDescriptionText = $event"
                  @generate="handleGenerateJobDescription"
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
                <div class="voice-row">
                  <div class="select-wrapper">
                    <select v-model="selectedVoice" class="setup-select" @change="onVoiceChange" :disabled="voicesLoading">
                      <option value="" disabled>Select a voice</option>
                      <option v-for="voice in voices" :key="voice.id" :value="voice.id">
                        {{ voice.name }} ({{ voice.gender }})
                      </option>
                    </select>
                    <i class="el-icon-arrow-down select-icon"></i>
                  </div>
                  <button
                    type="button"
                    class="play-sample-btn"
                    :disabled="!selectedVoice || isPlayingSample"
                    @click="playSelectedVoice"
                    :title="selectedVoice ? 'Play voice sample' : 'Select a voice first'"
                  >
                    <i :class="isPlayingSample ? 'el-icon-loading' : 'el-icon-video-play'"></i>
                    <span>{{ isPlayingSample ? 'Playing…' : 'Play' }}</span>
                  </button>
                </div>
              </div>

              <div class="setting-field">
                <div class="difficulty-label-row">
                  <label>Difficulty Level</label>
                  <button
                    type="button"
                    class="difficulty-help-btn"
                    :class="{ active: showDifficultyDetails }"
                    @click="showDifficultyDetails = !showDifficultyDetails"
                    :title="showDifficultyDetails ? 'Hide details' : 'Show details about each level'"
                  >
                    <i class="el-icon-info"></i>
                  </button>
                </div>
                <div class="select-wrapper">
                  <select v-model="interviewDifficulty" class="setup-select" @change="onDifficultyChange">
                    <option v-for="level in difficultyLevels" :key="level" :value="level">{{ level }}</option>
                  </select>
                  <i class="el-icon-arrow-down select-icon"></i>
                </div>
                <p class="difficulty-meta">
                  <i class="el-icon-time"></i> {{ currentDifficulty.DURATION_TEXT }} &middot; {{ currentDifficulty.COUNT_TEXT }}
                </p>
              </div>

              <div v-if="showCategoryField" class="setting-field">
                <label>Question Category</label>
                <div class="select-wrapper">
                  <select v-model="interviewCategory" class="setup-select" @change="onCategoryChange">
                    <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
                  </select>
                  <i class="el-icon-arrow-down select-icon"></i>
                </div>
                <p class="difficulty-meta">
                  <i class="el-icon-collection-tag"></i> {{ currentCategory.DESCRIPTION }}
                </p>
              </div>

              <div v-if="showAnalysisToggle" class="setting-field">
                <label>Analysis For This Interview</label>
                <div class="toggle-wrapper" style="margin: 6px 0 0 0;">
                  <div class="toggle-text">
                    <span class="toggle-main-label">{{ analysisEnabledThisInterview ? 'On' : 'Off' }}</span>
                    <p class="toggle-description">When on, completed interviews get detailed content scoring and feedback. Turn off for a raw simulation with no analysis.</p>
                  </div>
                  <div
                    class="modern-switch"
                    @click="toggleAnalysis"
                    :class="{ 'is-active': analysisEnabledThisInterview }"
                  >
                    <div class="switch-handle">
                      <i :class="analysisEnabledThisInterview ? 'el-icon-data-line' : 'el-icon-close'"></i>
                    </div>
                  </div>
                </div>
              </div>

              <div class="setting-field">
                <label>Preferred Keywords <span class="optional-tag">Optional</span></label>
                <input
                  v-model="preferredKeywords"
                  type="text"
                  class="setup-select"
                  placeholder="e.g., AWS, Kubernetes, microservices, GraphQL"
                  :maxlength="preferredKeywordsMaxLength"
                />
                <p class="difficulty-meta">
                  <i class="el-icon-collection-tag"></i>
                  Comma-separated. The interviewer will pick "what is X" questions from these and weave them into the reference answers when natural.
                </p>
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
              :disabled="isSubmitDisabled || atCap"
              @click="submitSetup">
            Start Generating My Interview
          </el-button>

          <div v-if="atCap" class="mic-warning-hint" style="justify-content: center;">
            <i class="el-icon-warning-outline"></i>
            Delete or open the oldest interview above before starting a new one.
          </div>

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
          :interviewQA="interviewQA"
          :difficulty="interviewDifficulty"
          @update:enableVideo="enableVideo = $event"
          @startInterview="handleStartInterview"
          @cancel="handleCancelInterview"
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

    <!-- Difficulty Details Modal -->
    <transition name="modal-fade">
      <div
        v-if="showDifficultyDetails"
        class="difficulty-modal-overlay"
        @click.self="showDifficultyDetails = false"
      >
        <div class="difficulty-modal" role="dialog" aria-labelledby="difficulty-modal-title">
          <div class="difficulty-modal-header">
            <h3 id="difficulty-modal-title">Difficulty Levels</h3>
            <button
              type="button"
              class="difficulty-modal-close"
              aria-label="Close"
              @click="showDifficultyDetails = false"
            >
              <i class="el-icon-close"></i>
            </button>
          </div>
          <p class="difficulty-modal-sub">Pick the experience level you want to practice. You can change it any time before starting.</p>
          <div class="difficulty-details">
            <div
              v-for="level in difficultyLevels"
              :key="level"
              class="difficulty-detail-card"
              :class="{ active: interviewDifficulty === level }"
              @click="selectDifficultyFromModal(level)"
            >
              <div class="difficulty-detail-head">
                <span class="difficulty-detail-title">{{ level }}</span>
                <span class="difficulty-detail-meta">{{ difficultyConfig[level].DURATION_TEXT }} &middot; {{ difficultyConfig[level].COUNT_TEXT }}</span>
              </div>
              <p class="difficulty-detail-desc">{{ difficultyConfig[level].DESCRIPTION }}</p>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Custom Confirmation Modal -->
    <ConfirmDialog
      :visible.sync="confirmVisible"
      :title="confirmConfig.title"
      :message="confirmConfig.message"
      :type="confirmConfig.type"
      :confirm-text="confirmConfig.confirmText"
      :show-cancel="confirmConfig.showCancel"
      :icon="confirmConfig.icon"
      :loading="confirmConfig.loading"
      @confirm="handleConfirmAction"
    />
  </div>
</template>

<script>
import FileUpload from '../components/FileUpload.vue';
import { generateSampleResume, generateSampleJobDescription } from '@/services/sampleContentService';
import InterviewInstructions from './InterviewInstructions.vue';
import { saveSetting, getSetting } from '@/store/settingStore';
import { generateInterviewQA } from '../services/openaiService.js';
import { clearRecordingsStore } from '@/store/recordingStore.js';
import { APP_CONFIG } from '@/constants/appConfig';
import authService from '@/services/authService';
import { ROLE_GROUPS, hasAnyRole } from '@/constants/roles';

// Best-effort: pull a candidate name out of the resume text. Looks at the
// first non-empty lines and matches "FirstName LastName" or "FirstName M.
// LastName" capitalized patterns. Returns '' if nothing recognizable.
function extractCandidateName(resumeText) {
  if (!resumeText || typeof resumeText !== 'string') return '';
  const lines = resumeText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // Take the first 5 non-empty lines — name is usually right at the top
  for (const line of lines.slice(0, 5)) {
    // Strip out anything that looks like a separator artifact
    const cleaned = line.replace(/[|•·–—]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    // Match "John Smith" or "John A Smith" or "John A. Smith" — 2 to 3 words,
    // each capitalized, letters only. Reject if any word is a known
    // resume-header term (Resume, Curriculum, etc.).
    const m = cleaned.match(/^([A-Z][a-zA-Z'’-]{1,20})(\s+[A-Z]\.?)?(\s+[A-Z][a-zA-Z'’-]{1,20})(\s+[A-Z][a-zA-Z'’-]{1,20})?$/);
    if (m) {
      const candidate = m[0].trim();
      const lower = candidate.toLowerCase();
      if (/(resume|curriculum vitae|cv|cover letter)/i.test(lower)) continue;
      return candidate;
    }
  }
  return '';
}
import { clearInterviewQAStore, clearTranscriptsStore, saveInterviewQA, saveInterviewMeta } from '@/store/interviewStore';
import { listRecentSessions, MAX_ENTRIES } from '@/store/interviewHistoryStore';
import { fetchEnrollmentsByStatus } from '@/services/candidateService';
import { setActiveEnrollmentId, clearActiveEnrollmentId } from '@/services/activeEnrollment';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { fetchVoices, playVoiceSample, prefetchSpeech } from '@/services/ttsService';
import { INPUT_LIMITS } from '@/constants/inputLimits';

export default {
  name: 'ResumeSetup',
  components: { FileUpload, InterviewInstructions, ConfirmDialog },
  data() {
    return {
      // Retention awareness — populated in mounted() once. We don't refetch
      // because the user can't add a session from this page; the count is
      // either at cap when they land here or it isn't.
      MAX_VISIBLE: MAX_ENTRIES,
      savedSessions: [],
      // null | { used, quota, percent, usedMB, quotaMB }. Surfaces only
      // when used/quota crosses 80%.
      storageWarning: null,
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
      isPlayingSample: false,
      resumeAiMode: false,
      jdAiMode: false,
      generatingResume: false,
      generatingJD: false,
      aiSampleGenerationEnabled: false,
      analysisBetaEnabled: false,
      analysisEnabledThisInterview: true,
      preferredKeywords: '',
      practiceRoster: [],
      rosterLoading: false,
      rosterError: '',
      candidateValue: '',
      selectedEnrollmentId: '',
      selectedCandidateName: '',
      generationProgress: { ready: 0, target: APP_CONFIG.SERVICES.OPENAI.MIN_Q_COUNT, firstBatchDone: false },
      showDifficultyDetails: false,
      interviewCategory: APP_CONFIG.CATEGORY_DEFAULT,
      micPermission: 'prompt', // 'granted', 'denied', 'prompt'
      cameraPermission: 'prompt',
      micLoading: false,
      showHelpModal: false,
      showQuestions: true,
      // Confirmation Modal State
      confirmVisible: false,
      confirmConfig: {
        title: '',
        message: '',
        type: 'primary',
        confirmText: 'Confirm',
        showCancel: true,
        icon: 'el-icon-warning-outline',
        loading: false,
        action: null
      }
    };
  },
  watch: {
    showDifficultyDetails(open) {
      if (open) {
        this._escHandler = (e) => {
          if (e.key === 'Escape') this.showDifficultyDetails = false;
        };
        window.addEventListener('keydown', this._escHandler);
      } else if (this._escHandler) {
        window.removeEventListener('keydown', this._escHandler);
        this._escHandler = null;
      }
    }
  },
  computed: {
    candidateChosen() {
      return this.candidateValue !== '';
    },
    isSubmitDisabled() {
      const permsOk = this.micPermission === 'granted' && (!this.enableVideo || this.cameraPermission === 'granted');
      return !this.resumeText || !this.candidateChosen || !this.selectedVoice || this.isGenerating || this.voicesLoading || !permsOk;
    },
    preferredKeywordsMaxLength() {
      // Conservative cap = N keywords × per-keyword char limit, with slack for separators.
      return INPUT_LIMITS.PREFERRED_KEYWORDS_COUNT * (INPUT_LIMITS.PREFERRED_KEYWORD_CHARS + 2);
    },
    difficultyConfig() {
      return APP_CONFIG.DIFFICULTY;
    },
    difficultyLevels() {
      return Object.keys(APP_CONFIG.DIFFICULTY);
    },
    currentDifficulty() {
      return APP_CONFIG.DIFFICULTY[this.interviewDifficulty] || APP_CONFIG.DIFFICULTY[APP_CONFIG.DIFFICULTY_DEFAULT];
    },
    categoryOptions() {
      return Object.keys(APP_CONFIG.CATEGORY);
    },
    currentCategory() {
      return APP_CONFIG.CATEGORY[this.interviewCategory] || APP_CONFIG.CATEGORY[APP_CONFIG.CATEGORY_DEFAULT];
    },
    showCategoryField() {
      // Category selection is meaningful for Intermediate and Advanced.
      // Beginner is intentionally a broad warm-up so we keep the mix.
      return this.interviewDifficulty === 'Intermediate' || this.interviewDifficulty === 'Advanced';
    },
    showAnalysisToggle() {
      // Per-interview "AI scoring" toggle is obsolete: detailed analysis
      // is now on-demand from the Summary screen, regardless of difficulty.
      return false;
    },
    atCap() {
      return this.savedSessions.length >= this.MAX_VISIBLE;
    },
    oldestSession() {
      if (!this.savedSessions.length) return null;
      return this.savedSessions[this.savedSessions.length - 1];
    },
    oldestLabel() {
      const s = this.oldestSession;
      if (!s) return '';
      const name = s.candidateName ? `${s.candidateName} — ` : '';
      const iso = s.savedAt || '';
      let dateStr = '';
      if (iso) {
        try {
          dateStr = new Date(iso).toLocaleString([], {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
          });
        } catch (e) { /* keep empty */ }
      }
      return `${name}${dateStr}`;
    }
  },
  async mounted() {
    await this.fetchVoices();
    // Selective cleanup for a fresh interview session. We clear the live
    // (un-scoped) interview state — qaList, transcripts, interviewMeta —
    // but DO NOT clear the recordings store: per-session audio and video
    // belong to saved history entries and are pruned by retention logic
    // in interviewHistoryStore.pruneOld, not here.
    const { default: storage } = await import('@/services/storageService');
    await storage.clearInterviewSession();

    // Refresh retention state for the banner + Start gating.
    await this.loadRetentionState();
    this.loadPracticeRoster();

    // Staff-only; re-checked here so a leftover flag from another user on a shared device can't leak.
    const features = storage.getItem(storage.KEYS.USER_FEATURES, true) || {};
    const isStaff = hasAnyRole(authService.getUserRoles(), ROLE_GROUPS.STAFF);
    this.aiSampleGenerationEnabled = isStaff && !!features.aiSampleGenerationEnabled;
    this.analysisBetaEnabled = isStaff && !!features.analysisEnabled;
    // Restore last per-interview analysis preference (default true when beta is on)
    const savedAnalysisChoice = await getSetting('analysisEnabledThisInterview');
    if (savedAnalysisChoice !== null && savedAnalysisChoice !== undefined) {
      this.analysisEnabledThisInterview = savedAnalysisChoice;
    }

    this.enableVideo = await getSetting('enableVideo');
    const savedShowQuestions = await getSetting('showQuestions');
    if (savedShowQuestions !== null) {
      this.showQuestions = savedShowQuestions;
    }
    const savedVoice = await getSetting('selectedVoice');
    if (savedVoice && this.voices.some(v => v.id === savedVoice)) {
      this.selectedVoice = savedVoice;
    } else if (this.voices.some(v => v.id === 'alloy')) {
      this.selectedVoice = 'alloy';
      saveSetting('selectedVoice', this.selectedVoice);
    }
    const savedDifficulty = await getSetting('interviewDifficulty');
    if (savedDifficulty && APP_CONFIG.DIFFICULTY[savedDifficulty]) {
      this.interviewDifficulty = savedDifficulty;
    } else {
      this.interviewDifficulty = APP_CONFIG.DIFFICULTY_DEFAULT;
    }
    const savedCategory = await getSetting('interviewCategory');
    if (savedCategory && APP_CONFIG.CATEGORY[savedCategory]) {
      this.interviewCategory = savedCategory;
    }
    this.checkPermissions();
  },
  beforeRouteLeave(to, from, next) {
    // Step 1's form is cheap to refill; only guard once the user is on
    // Step 2 (qaReady) and hasn't explicitly chosen to leave.
    if (this.qaReady && !this._intentionalLeave) {
      const ok = window.confirm('Leave this page? Your prepared interview will be discarded and you\'ll need to redo setup.');
      if (!ok) return next(false);
    }
    next();
  },
  methods: {
    // Read history + browser storage estimate to drive the retention
    // banner, storage-warning banner, and Start-button gating. Called
    // once on mount; not refetched because the user can't change either
    // value from this screen.
    async loadRetentionState() {
      try {
        this.savedSessions = await listRecentSessions(this.MAX_VISIBLE);
      } catch (e) {
        this.savedSessions = [];
      }
      try {
        if (navigator && navigator.storage && navigator.storage.estimate) {
          const est = await navigator.storage.estimate();
          const used = est.usage || 0;
          const quota = est.quota || 0;
          if (quota > 0) {
            const percent = Math.round((used / quota) * 100);
            if (percent >= 80) {
              this.storageWarning = {
                used, quota, percent,
                usedMB: Math.round(used / (1024 * 1024)),
                quotaMB: Math.round(quota / (1024 * 1024))
              };
            }
          }
        }
      } catch (e) { /* best-effort */ }
    },
    async loadPracticeRoster() {
      this.rosterLoading = true;
      this.rosterError = '';
      try {
        this.practiceRoster = await fetchEnrollmentsByStatus('IN_OTTER');
      } catch (e) {
        this.practiceRoster = [];
        this.rosterError = 'Could not load candidates — you can still continue as "Not in List".';
      } finally {
        this.rosterLoading = false;
      }
    },
    maskEmail(email) {
      if (!email) return '';
      const at = email.indexOf('@');
      if (at < 1) return email;
      const local = email.slice(0, at);
      const domain = email.slice(at);
      if (local.length <= 5) return `${local.slice(0, 2)}****${domain}`;
      return `${local.slice(0, 3)}****${local.slice(-2)}${domain}`;
    },
    onCandidateSelect(value) {
      this.candidateValue = value || '';
      if (value === 'none' || value === '') {
        this.selectedEnrollmentId = '';
        this.selectedCandidateName = '';
        return;
      }
      this.selectedEnrollmentId = value;
      const match = this.practiceRoster.find(c => c.enrollmentId === value);
      this.selectedCandidateName = match ? match.candidateName : '';
    },
    buildPracticeLabel(candidateName) {
      const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return [candidateName, 'Interview Practice', date].filter(Boolean).join(' - ');
    },
    goToOldestSession() {
      if (this.oldestSession) {
        this.$router.push({ name: 'SummaryView', query: { sessionId: this.oldestSession.id } });
      }
    },
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
    onCategoryChange() {
      saveSetting('interviewCategory', this.interviewCategory);
    },
    toggleAnalysis() {
      this.analysisEnabledThisInterview = !this.analysisEnabledThisInterview;
      saveSetting('analysisEnabledThisInterview', this.analysisEnabledThisInterview);
    },
    selectDifficultyFromModal(level) {
      this.interviewDifficulty = level;
      this.onDifficultyChange();
      this.showDifficultyDetails = false;
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
        this.confirmConfig = {
          title: 'Unsupported Browser',
          message: 'Media access is not supported in this browser or context.',
          type: 'danger',
          confirmText: 'Got it',
          showCancel: false,
          icon: 'el-icon-warning',
          action: 'ack'
        };
        this.confirmVisible = true;
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
        let msg = 'Could not start devices: ' + e.message;
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          msg = 'Access was denied. Please allow microphone' + (this.enableVideo ? ' and camera' : '') + ' in your browser settings.';
        }
        
        this.confirmConfig = {
          title: 'Permission Denied',
          message: msg,
          type: 'danger',
          confirmText: 'Understand',
          showCancel: false,
          icon: 'el-icon-lock',
          action: 'ack'
        };
        this.confirmVisible = true;
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
      // Persist immediately; the user can preview via the Play button.
      saveSetting('selectedVoice', this.selectedVoice);
    },
    playSelectedVoice() {
      if (this.selectedVoice && !this.isPlayingSample) {
        this.playVoiceSample(this.selectedVoice);
      }
    },
    async handleGenerateResume({ keywords }) {
      if ((keywords || '').length > INPUT_LIMITS.SAMPLE_KEYWORDS) {
        this.showInputLimitError(`Keywords exceed ${INPUT_LIMITS.SAMPLE_KEYWORDS} characters.`);
        return;
      }
      this.generatingResume = true;
      try {
        this.resumeText = await generateSampleResume(keywords);
      } catch (e) {
        this.showGenerationError('resume');
      } finally {
        this.generatingResume = false;
      }
    },
    async handleGenerateJobDescription({ keywords }) {
      if ((keywords || '').length > INPUT_LIMITS.SAMPLE_KEYWORDS) {
        this.showInputLimitError(`Keywords exceed ${INPUT_LIMITS.SAMPLE_KEYWORDS} characters.`);
        return;
      }
      this.generatingJD = true;
      try {
        this.jobDescriptionText = await generateSampleJobDescription(keywords);
      } catch (e) {
        this.showGenerationError('job description');
      } finally {
        this.generatingJD = false;
      }
    },
    showGenerationError(label) {
      this.confirmConfig = {
        title: 'Generation Failed',
        message: `Could not generate the ${label}. Please try again.`,
        type: 'warning',
        confirmText: 'OK',
        showCancel: false,
        icon: 'el-icon-warning-outline',
        action: 'ack'
      };
      this.confirmVisible = true;
    },
    async fetchVoices() {
      this.voicesLoading = true;
      try {
        this.voices = await fetchVoices();
      } catch (e) {
        this.voices = [];
      } finally {
        this.voicesLoading = false;
      }
    },
    async playVoiceSample(voiceId) {
      this.isPlayingSample = true;
      try {
        await playVoiceSample(voiceId);
      } catch (e) {
        this.confirmConfig = {
          title: 'Playback Error',
          message: 'Could not play sample for this voice.',
          type: 'warning',
          confirmText: 'OK',
          showCancel: false,
          icon: 'el-icon-warning-outline',
          action: 'ack'
        };
        this.confirmVisible = true;
      } finally {
        this.isPlayingSample = false;
      }
    },
    showInputLimitError(message) {
      this.confirmConfig = {
        title: 'Input too large',
        message,
        type: 'warning',
        confirmText: 'OK',
        showCancel: false,
        icon: 'el-icon-warning-outline',
        action: 'ack'
      };
      this.confirmVisible = true;
    },
    validateInputSizes() {
      const resumeLen = (this.resumeText || '').length;
      if (resumeLen > INPUT_LIMITS.RESUME) {
        this.showInputLimitError(`Resume is ${resumeLen.toLocaleString()} characters; the limit is ${INPUT_LIMITS.RESUME.toLocaleString()}. Trim it and try again.`);
        return false;
      }
      const jdLen = (this.jobDescriptionText || '').length;
      if (jdLen > INPUT_LIMITS.JOB_DESCRIPTION) {
        this.showInputLimitError(`Job description is ${jdLen.toLocaleString()} characters; the limit is ${INPUT_LIMITS.JOB_DESCRIPTION.toLocaleString()}. Trim it and try again.`);
        return false;
      }
      const kw = (this.preferredKeywords || '').split(',').map(s => s.trim()).filter(Boolean);
      if (kw.length > INPUT_LIMITS.PREFERRED_KEYWORDS_COUNT) {
        this.showInputLimitError(`Too many preferred keywords (${kw.length}). Limit is ${INPUT_LIMITS.PREFERRED_KEYWORDS_COUNT}.`);
        return false;
      }
      const longKw = kw.find(k => k.length > INPUT_LIMITS.PREFERRED_KEYWORD_CHARS);
      if (longKw) {
        this.showInputLimitError(`Keyword "${longKw.slice(0, 30)}…" exceeds ${INPUT_LIMITS.PREFERRED_KEYWORD_CHARS} characters.`);
        return false;
      }
      return true;
    },
    async submitSetup() {
      if (!this.validateInputSizes()) return;
      this.isGenerating = true;
      this.qaReady = true;
      this.generationProgress = {
        ready: 0,
        target: this.currentDifficulty.MIN_Q,
        firstBatchDone: false
      };

      // analysisMode = 'basic' for every new session. The interview itself
      // doesn't depend on the profile-level Answer Analysis flag — it
      // always records audio and reserves transcript slots so the user
      // can come back later and analyze, even if the flag was off when
      // they ran the interview. The flag is checked only on the Summary
      // screen, where it gates the Transcribe and Generate Detailed
      // Analysis buttons.
      const mode = 'basic';
      // Best-effort candidate name extraction from the first non-empty
      // line of the resume. Looks for 1-3 capitalized words in a row,
      // strips trailing email/phone artifacts. Defaults to '' if nothing
      // recognizable is found — UI uses the date in that case.
      // picked candidate overrides the resume-extracted name; never empty
      const candidateName = this.selectedCandidateName || extractCandidateName(this.resumeText) || 'Candidate';
      const enrollmentId = this.selectedEnrollmentId || '';
      if (enrollmentId) setActiveEnrollmentId(enrollmentId);
      else clearActiveEnrollmentId();

      // Parsed list of preferred keywords (comma-separated → array of trimmed strings)
      const keywordsArr = (this.preferredKeywords || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const sessionMeta = {
        difficulty: this.interviewDifficulty,
        category: this.interviewCategory,
        analysisMode: mode,
        completed: false,
        startedAt: new Date().toISOString(),
        candidateName,
        enrollmentId,
        label: this.buildPracticeLabel(candidateName),
        preferredKeywords: keywordsArr
      };
      await saveInterviewMeta(sessionMeta);

      try {
        this.interviewQA = await generateInterviewQA({
          resumeText: this.resumeText,
          jobDescriptionText: this.jobDescriptionText,
          difficulty: this.interviewDifficulty,
          category: this.showCategoryField ? this.interviewCategory : 'All',
          preferredKeywords: keywordsArr,
          onProgress: (progress) => {
            this.generationProgress = progress;
          },
          onUpdate: (partial) => {
            this.interviewQA = partial;
            // Persist each batch as it arrives. If the user clicks
            // "Start Interview Now" mid-generation, InterviewView reads
            // this growing list — and re-reads on each nextQuestion so
            // later batches land before the user catches up.
            saveInterviewQA(partial).catch((e) => {
              console.warn('Background save of partial qaList failed:', e);
            });
          }
        });
      } catch (e) {
        console.error('Failed to generate interview questions:', e);
        this.confirmConfig = {
          title: 'Generation Failed',
          message: (e && e.message) ? e.message : 'Failed to generate interview questions. Please try again or check your documents.',
          type: 'danger',
          confirmText: 'Dismiss',
          showCancel: false,
          icon: 'el-icon-circle-close',
          action: 'ack'
        };
        this.confirmVisible = true;
        this.qaReady = false;
      } finally {
        this.isGenerating = false;
      }
    },
    async handleStartInterview() {
      // Final store sync before navigating
      saveSetting('enableVideo', this.enableVideo);

      // Persist whatever questions we have right now so InterviewView reads
      // a fresh snapshot (background generation may still be in flight).
      if (this.interviewQA && this.interviewQA.length > 0) {
        await saveInterviewQA(this.interviewQA);
      }

      // Start fetching Q1's TTS audio NOW, before navigation. The cache
      // is module-scoped, so by the time InterviewView mounts and asks
      // for the same text+voice it's either already there or coalesces
      // onto the in-flight request. This converts the perceptible "Q1
      // takes 2-5 seconds to start speaking" wait into a near-instant
      // start, because the network round-trip overlaps with the
      // navigation + mounted lifecycle work.
      if (this.selectedVoice && this.interviewQA && this.interviewQA[0] && this.interviewQA[0].question) {
        prefetchSpeech(this.interviewQA[0].question, this.selectedVoice);
      }

      const mediaConstraints = this.enableVideo ? { video: true, audio: true } : { audio: true };
      navigator.mediaDevices.getUserMedia(mediaConstraints)
          .then(() => {
            // Navigate immediately. Generation may still be in flight —
            // InterviewView's onboarding overlay parks the user on a
            // welcome screen until Q1 lands on disk, so they're never
            // staring at a blank interview waiting for nothing.
            this._intentionalLeave = true;
            this.$router.push({ name: 'InterviewView' });
          })
          .catch(() => {
            this.confirmConfig = {
              title: 'Access Denied',
              message: 'Permissions denied or hardware error. Please allow access to start.',
              type: 'danger',
              confirmText: 'Dismiss',
              showCancel: false,
              icon: 'el-icon-lock',
              action: 'ack'
            };
            this.confirmVisible = true;
          });
    },
    handleCancelInterview() {
      this._intentionalLeave = true;
      this.$router.push({ name: 'MyInterviews' });
    },
    handleConfirmAction() {
      this.confirmVisible = false;
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

.setup-warning-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 10px;
  padding: 14px 18px;
  color: #78350f;
  font-size: 0.92rem;
  line-height: 1.45;
}

.setup-warning-banner .el-icon-warning-outline {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.setup-warning-banner .warning-text {
  flex: 1;
}

.setup-warning-banner.storage-warning {
  background: #fee2e2;
  border-color: #ef4444;
  color: #7f1d1d;
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

.group-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.group-label-row .group-label {
  margin-bottom: 0;
}

.ai-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 0.85rem;
  font-weight: 600;
  color: #4b5563;
}

.ai-toggle input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.ai-toggle-track {
  position: relative;
  width: 34px;
  height: 20px;
  background: #d1d5db;
  border-radius: 999px;
  transition: background-color 0.2s;
}

.ai-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.ai-toggle input[type="checkbox"]:checked + .ai-toggle-track {
  background: #2563eb;
}

.ai-toggle input[type="checkbox"]:checked + .ai-toggle-track .ai-toggle-knob {
  transform: translateX(14px);
}

.ai-toggle input[type="checkbox"]:focus-visible + .ai-toggle-track {
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}

.ai-toggle:hover .ai-toggle-text {
  color: #2563eb;
}

/* Difficulty section */
.difficulty-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  line-height: 1;
}

.difficulty-label-row label {
  display: inline-flex;
  align-items: center;
  margin: 0 !important;
  line-height: 1;
}

.difficulty-help-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}

.difficulty-help-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.difficulty-help-btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.difficulty-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 2px 0;
  font-size: 0.85rem;
  color: #4b5563;
}

.req {
  color: #f56c6c;
}

.optional-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.difficulty-meta i {
  color: #2563eb;
}

.candidate-select {
  width: 100%;
}

/* Difficulty details modal */
.difficulty-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.difficulty-modal {
  width: 100%;
  max-width: 560px;
  background: #fff;
  border-radius: 14px;
  padding: 22px 24px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
  max-height: 90vh;
  overflow-y: auto;
}

.difficulty-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.difficulty-modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  color: #1f2937;
}

.difficulty-modal-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: background-color 0.15s, color 0.15s;
}

.difficulty-modal-close:hover {
  background: #e5e7eb;
  color: #1f2937;
}

.difficulty-modal-sub {
  margin: 0 0 16px;
  font-size: 0.85rem;
  color: #6b7280;
}

.difficulty-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.difficulty-detail-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 14px;
  background: #f9fafb;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, transform 0.1s;
}

.difficulty-detail-card:hover {
  border-color: #93c5fd;
  background: #f0f7ff;
}

.difficulty-detail-card:active {
  transform: scale(0.99);
}

.difficulty-detail-card.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.difficulty-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.difficulty-detail-title {
  font-weight: 700;
  color: #1f2937;
  font-size: 0.95rem;
}

.difficulty-detail-meta {
  font-size: 0.78rem;
  color: #6b7280;
}

.difficulty-detail-desc {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #4b5563;
}

.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.18s ease;
}
.modal-fade-enter-active .difficulty-modal,
.modal-fade-leave-active .difficulty-modal {
  transition: transform 0.18s ease;
}
.modal-fade-enter, .modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter .difficulty-modal,
.modal-fade-leave-to .difficulty-modal {
  transform: translateY(-8px) scale(0.98);
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

.voice-row {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.voice-row .select-wrapper {
  flex: 1;
}

.play-sample-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background-color: #fff;
  color: #374151;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background-color 0.15s;
  white-space: nowrap;
}

.play-sample-btn:hover:not(:disabled) {
  border-color: #2563eb;
  color: #2563eb;
}

.play-sample-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play-sample-btn i {
  font-size: 1.05rem;
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