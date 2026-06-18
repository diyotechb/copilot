<template>
  <div class="setup-page-view">
    <!-- Interview Active State. Renders even if interviewQA hasn't
         finished generating yet — the onboarding overlay parks the
         user on a welcome card until the user clicks Begin AND Q1 is
         on disk. -->
    <div v-if="interviewing" class="interview-main">

      <div class="interview-scroll-container" ref="transcriptScroller">

        <!-- Header. Onboarding and live recording share the same shell,
             but the candidate's mental model shifts the moment Begin is
             pressed — title flips to match. -->
        <div class="interview-header">
          <div class="header-left">
            <h2 v-if="showOnboarding" class="onboarding-title">
              <span>Final Setup for</span>
              <input
                  type="text"
                  v-model="candidateName"
                  @blur="persistCandidateName"
                  @keydown.enter.prevent="$event.target.blur()"
                  placeholder="Your Name"
                  class="onboarding-title-name"
                  maxlength="60"
                  aria-label="Candidate name" />
              <span>Before Recording</span>
              <span class="onboarding-title-difficulty">{{ difficultyLabel }}</span>
            </h2>
            <h2 v-else>Live Interview Session</h2>
            <p class="header-subtitle">
              {{ showOnboarding
                ? 'Fine-tune your view and try the controls. Recording starts when you hit “I\'m Ready — Start Interview”.'
                : 'Speak clearly and take your time.' }}
            </p>
          </div>
          <div class="header-right">
            <span v-if="showOnboarding" class="step-indicator">STEP 3/3</span>
          </div>
        </div>

        <!-- Transcript content area. Font scale is driven by a CSS
             custom property bound from the reading-tools rail; no
             resize/move concerns here, layout stays default. -->
        <div
            class="transcript_area"
            ref="transcriptArea"
            :style="transcriptStyle"
        >
          <!-- Onboarding: stays in the regular left-aligned chat layout
               (no centered card). A brief note at the top, sample
               messages in the real chat style, and an "I'm Ready —
               Start Interview" button at the bottom-right. Recording
               stays off until that button is clicked. -->
          <template v-if="showOnboarding">
            <!-- Tab-close heads-up so the user sees it before anything
                 else starts. The prep tip (window/text size, controls)
                 used to live above this — now the welcome TTS speaks
                 the same guidance, so the static tip is redundant. -->
            <div class="info-warn onboarding-warn-top">
              <i class="el-icon-warning-outline"></i>
              <span>If you close the tab mid-interview, completed answers are saved to <strong>My Interviews</strong> but the session can't be continued.</span>
            </div>

            <!-- 2. Sample chat. Sample 1 is always rendered (A−/A+
                 need visible text to scale on); Sample 2 appears
                 only after the user clicks Next. Both the question
                 and the answer slots show placeholder hints so the
                 sample reads as a UI shell rather than real content
                 — TTS audio is the actual demo. -->
            <div v-if="welcomeStarted" class="transcript-line interviewer">
              <div class="avatar-column">
                <div class="user-avatar-small interviewer-avatar">I</div>
              </div>
              <div class="content-column">
                <div class="meta-header">
                  <span class="speaker-label">INTERVIEWER</span>
                  <span class="time-stamp">welcome</span>
                </div>
                <div class="text-container">
                  <span class="text">{{ welcomeDisplayed }}</span>
                </div>
              </div>
            </div>

            <template v-for="(qa, idx) in sampleQA">
              <template v-if="hasStartedSample && idx <= sampleTurn">
                <div :key="'sq-top-' + idx" class="transcript-line interviewer" v-show="showQuestionSection">
                  <div class="avatar-column">
                    <div class="user-avatar-small interviewer-avatar">I</div>
                  </div>
                  <div class="content-column">
                    <div class="meta-header">
                      <span class="speaker-label">INTERVIEWER</span>
                      <span class="time-stamp">sample</span>
                    </div>
                    <div class="text-container">
                      <!-- Placeholder until the user clicks Try Now /
                           Repeat / Next. Once a sample starts playing,
                           the real question text is revealed alongside
                           the TTS audio. -->
                      <span
                          class="text"
                          :class="{ 'sample-placeholder': !sampleDisplayedQ[idx] }">
                        {{ sampleDisplayedQ[idx] || 'Your question will appear here' }}
                      </span>
                    </div>
                  </div>
                </div>

                <div :key="'sa-top-' + idx" class="transcript-line user">
                  <div class="avatar-column">
                    <div class="user-avatar-small">Y</div>
                  </div>
                  <div class="content-column">
                    <div class="meta-header">
                      <span class="speaker-label">YOU</span>
                      <span class="time-stamp">sample</span>
                    </div>
                    <div class="text-container">
                      <!-- Placeholder until the typewriter starts filling
                           the answer in. Once the first word lands, the
                           placeholder is replaced with the streamed text,
                           and once the typewriter finishes, the full
                           answer remains visible (sampleDisplayedA[idx]
                           accumulates the words through to completion). -->
                      <span
                          class="text"
                          :class="{ 'sample-placeholder': !sampleDisplayedA[idx] }">
                        {{ sampleDisplayedA[idx] || 'Your answer will appear here' }}
                      </span>
                    </div>
                  </div>
                </div>
              </template>
            </template>

            <transition name="onboarding-info-fade">
            <div v-if="sampleIntroComplete" class="onboarding-info-block">
            <div class="onboarding-divider"></div>

            <div class="onboarding-info">
              <div class="info-lead">
                <i class="el-icon-info"></i>
                <span>Click any icon to see what it does. Hover for a longer description.</span>
              </div>

              <div class="info-section-title">Controls</div>
              <div class="info-grid">
                <button
                    type="button"
                    class="info-tile info-tile-active"
                    @click="decreaseFontSize"
                    title="Make the transcript text smaller">
                  <span class="info-glyph info-glyph-text">A−</span>
                  <span class="info-label">Smaller text</span>
                </button>
                <button
                    type="button"
                    class="info-tile info-tile-active"
                    :class="{ 'info-tile-highlight': !hasTriedFontUp }"
                    @click="increaseFontSize"
                    title="Make the transcript text larger">
                  <span class="info-glyph info-glyph-text">A+</span>
                  <span class="info-label">Larger text</span>
                </button>
                <button
                    type="button"
                    class="info-tile info-tile-active"
                    :class="{ 'info-tile-highlight': hasTriedFontUp && !hasTriedToggleQs }"
                    @click="toggleShowQuestions"
                    :title="showQuestionSection ? 'Hide the question text in the transcript' : 'Show the question text in the transcript'">
                  <i class="info-glyph" :class="showQuestionSection ? 'el-icon-view' : 'el-icon-document-remove'"></i>
                  <span class="info-label">{{ showQuestionSection ? 'Hide questions' : 'Show questions' }}</span>
                </button>
                <button
                    type="button"
                    class="info-tile info-tile-active"
                    :class="{ 'info-tile-highlight': hasTriedToggleQs && !hasTriedToggleBar }"
                    @click="toggleControlBar"
                    :title="controlBarHidden ? 'Show the bottom controls bar' : 'Hide the bottom controls bar'">
                  <i class="info-glyph" :class="controlBarHidden ? 'el-icon-top' : 'el-icon-bottom'"></i>
                  <span class="info-label">{{ controlBarHidden ? 'Show bottom bar' : 'Hide bottom bar' }}</span>
                </button>
                <button
                    type="button"
                    class="info-tile info-tile-active"
                    @click="onboardingDemo('camera')"
                    title="Opens a small popup showing the camera feed.">
                  <i class="info-glyph el-icon-video-camera"></i>
                  <span class="info-label">Camera preview</span>
                </button>
              </div>

              <!-- Sample-driven controls. Hidden until Play sample is
                   clicked. Stays around afterwards so the user can
                   pause / repeat / advance the sample. -->
              <div v-if="hasStartedSample" class="info-grid info-grid-secondary">
                <button
                    type="button"
                    class="info-tile info-tile-active"
                    :class="{ 'info-tile-highlight': !hasTriedPause }"
                    @click="onboardingDemo('pause')"
                    :title="sampleTTSPaused ? 'Resume the sample' : 'Pause the sample (pauses both audio and the answer typing)'">
                  <i class="info-glyph" :class="sampleTTSPaused ? 'el-icon-video-play' : 'el-icon-video-pause'"></i>
                  <span class="info-label">{{ sampleTTSPaused ? 'Resume' : 'Pause' }}</span>
                </button>
                <button
                    type="button"
                    class="info-tile info-tile-active"
                    :class="{ 'info-tile-highlight': !hasTriedRepeat }"
                    @click="onboardingDemo('repeat')"
                    title="Replay the current sample from the start (resets the answer text and replays the question)">
                  <i class="info-glyph el-icon-refresh-left"></i>
                  <span class="info-label">Repeat question</span>
                </button>
                <button
                    type="button"
                    class="info-tile info-tile-active"
                    :class="{ 'info-tile-highlight': !hasTriedNext }"
                    @click="onboardingDemo('next')"
                    title="Move on to the next sample question">
                  <i class="info-glyph el-icon-right"></i>
                  <span class="info-label">Next question</span>
                </button>
              </div>

              <div class="info-section-title">Indicators</div>
              <div class="info-grid">
                <div class="info-tile info-tile-static" title="Stops the interview and jumps to the summary. Answers already given are saved.">
                  <i class="info-glyph el-icon-close"></i>
                  <span class="info-label">Stop interview</span>
                </div>
                <div class="info-tile info-tile-static" title="Counts down when you stop speaking. After 3 seconds of silence, the next question plays automatically.">
                  <i class="info-glyph el-icon-time"></i>
                  <span class="info-label">Silence timer</span>
                </div>
                <div class="info-tile info-tile-static" title="Elapsed recording time. Pauses when you pause.">
                  <span class="info-glyph info-glyph-text">0:00</span>
                  <span class="info-label">Elapsed time</span>
                </div>
                <div class="info-tile info-tile-static" title="Current question / total questions in this session.">
                  <span class="info-glyph info-glyph-text">N/N</span>
                  <span class="info-label">Question count</span>
                </div>
              </div>

            </div>
            </div>
            </transition>

            <div class="onboarding-cta">
              <button
                  type="button"
                  class="onboarding-try-now"
                  :class="{ 'onboarding-try-now-highlight': hasTriedToggleBar && !hasStartedSample }"
                  @click="onboardingPlaySample"
                  title="Play a sample question — hear the AI read it out loud">
                <i class="el-icon-video-play"></i>
                <span>
                  Want to see how this works?
                  <strong>Try Now</strong>
                </span>
              </button>

              <div class="onboarding-cta-right">
                <button
                    type="button"
                    class="onboarding-cancel"
                    @click="cancelOnboarding"
                    title="Leave without recording. Nothing is saved.">
                  No, Cancel Interview
                </button>
                <el-button
                    type="primary"
                    class="onboarding-cta-btn"
                    @click="beginInterview"
                    :loading="onboardingWaitingForFirst">
                  {{ onboardingWaitingForFirst ? 'Almost ready…' : "I'm Ready — Start Interview" }}
                </el-button>
              </div>
            </div>
          </template>

          <div
              v-else
              v-for="(item, index) in interviewTranscript"
              :key="index"
              v-show="item.type === 'user' || showQuestionSection"
              :class="['transcript-line', item.type]"
          >
            <!-- Avatar Column -->
            <div class="avatar-column">
              <div v-if="item.type === 'user'" class="user-avatar-small">Y</div>
              <div v-else class="user-avatar-small interviewer-avatar">I</div>
            </div>

            <!-- Content Column -->
            <div class="content-column">
              <div class="meta-header">
                <span class="speaker-label">{{ item.type === 'user' ? 'YOU' : 'INTERVIEWER' }}</span>
                <span class="time-stamp">{{ item.time }}</span>
              </div>
              <div class="text-container">
                <span class="text">{{ item.text }}</span>
              </div>
            </div>
          </div>

          <!-- Live status indicator — slim, single-line banner pinned at the
               bottom of the transcript while something is happening.
               Replaces the old per-role placeholder rows that looked like
               ghost messages and shifted the layout when they came/went. -->
          <transition name="live-status-fade">
            <div v-if="liveStatus" class="live-status-row">
              <div class="live-status-banner" :class="'is-' + liveStatus.kind">
                <i v-if="liveStatus.icon" :class="liveStatus.icon"></i>
                <span class="live-status-text">{{ liveStatus.text }}</span>
                <span class="live-status-dots"><span></span><span></span><span></span></span>
              </div>
            </div>
          </transition>

        </div>
      </div>

      <!-- Floating right-side rail.
           Dim by default (opacity 0.35), brightens on hover. Same
           behaviour during onboarding and the live interview — quiet
           until the user reaches for it, so it doesn't compete with
           the welcome message and controls panel for attention. -->
      <div class="reading-tools-rail">
        <!-- Question progress. Pure label, click does nothing. -->
        <div class="rail-progress" :title="`Question ${turn} of ${interviewQA.length}`">
          {{ turn }}/{{ interviewQA.length }}
        </div>

        <div class="rail-sep"></div>

        <!-- Pause / Resume — same button, icon swaps on state. Never
             v-if'd, so its DOM node stays put (no UI flicker on
             pause/resume). -->
        <button
            class="rail-btn"
            :class="{ 'rail-btn-paused-cta': isPaused }"
            @click="togglePause"
            :title="isPaused ? 'Resume the session' : 'Pause the session (Resume replays the current question from the start)'">
          <i :class="isPaused ? 'el-icon-video-play' : 'el-icon-video-pause'"></i>
        </button>

        <div class="rail-sep"></div>

        <!-- Font controls. A+ gets a pulse during onboarding so the
             user knows text size can be adjusted (marker class set
             below). -->
        <button
            class="rail-btn rail-btn-font-up"
            :class="{ 'rail-btn-tried': hasTriedFontUp }"
            :disabled="fontScale >= 1.8"
            @click="increaseFontSize"
            title="Increase transcript text size">A+</button>
        <button
            class="rail-btn rail-btn-label"
            @click="resetFontSize"
            :title="`Reset transcript text size to default (currently ${Math.round(fontScale * 100)}%)`">
          {{ Math.round(fontScale * 100) }}%
        </button>
        <button
            class="rail-btn"
            :disabled="fontScale <= 0.7"
            @click="decreaseFontSize"
            title="Decrease transcript text size">A−</button>

        <div class="rail-sep"></div>

        <!-- Hide / show the bottom action bar. Distinct icons:
             el-icon-bottom = "collapse to bottom" (hide the bar)
             el-icon-top    = "bring up from bottom" (show again).
             Also pulsed during onboarding (marker class). -->
        <button
            class="rail-btn rail-btn-toggle-bar"
            :class="{ 'rail-btn-tried': hasTriedToggleBar }"
            @click="toggleControlBar"
            :title="controlBarHidden ? 'Show the bottom control bar' : 'Hide the bottom control bar (you can still pause and adjust text from here)'">
          <i :class="controlBarHidden ? 'el-icon-top' : 'el-icon-bottom'"></i>
        </button>
      </div>

      <!-- Control Bar. Wrapped in a transition so hide/show animates
           instead of snapping (the snap caused the "flicker" the user
           saw — full layout reflow with no intermediate state). -->
      <transition name="control-bar-slide">
      <div class="control_bar" v-show="!controlBarHidden">

        <!-- 1. Left: Status & Timer -->
        <div class="control-status">
          <div class="status-indicator-wrap">
            <i
                class="el-icon-microphone status-mic-icon"
                :class="{ 'is-recording': footerStatus === 'recording' }"
                title="Recording Status"></i>
            <span
                class="status-label"
                :class="footerStatus + '-text'">
              {{ footerStatusLabel }}
            </span>
          </div>
        </div>

        <!-- 2. Center: Action Buttons -->
        <div class="controls-group">
          <!-- Timers Section in Center -->
          <div class="center-timers">
            <div class="silence-indicator-wrap">
              <!-- Silence Countdown replaces Clock Icon -->
              <div v-if="silenceProgress > 0 && !isPaused" class="circular-timer-wrap mini-timer">
                <svg class="circular-timer" viewBox="0 0 36 36">
                  <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path class="circle-fill" :style="{ strokeDasharray: (silenceProgress * 100) + ', 100' }" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span class="timer-countdown mini-count">{{ countdownSecsLeft }}</span>
              </div>
              <i v-else class="el-icon-time timer-icon" title="Silence Detection Active"></i>
            </div>
            
            <div class="recording-duration">
              {{ formatDuration(currentMediaTime) }}
            </div>
          </div>

          <!-- Stop is the recording-time exit. Hidden during onboarding
               because stopInterview() no-ops there — the onboarding
               card's Cancel button is the proper pre-recording exit. -->
          <div v-if="!showOnboarding" class="controls">
            <el-button
                circle
                class="record-btn minimal-control-btn"
                title="Stop the interview and go to the summary (your answers so far are kept)"
                @click="stopInterview">
              <i class="el-icon-close"></i>
            </el-button>
          </div>

          <div v-if="!showOnboarding && isStaffUser" class="controls">
            <el-button
                circle
                class="record-btn minimal-control-btn cancel-control-btn"
                title="Cancel the interview and discard everything — nothing is saved"
                @click="cancelInterview">
              <i class="el-icon-delete"></i>
            </el-button>
          </div>

          <div class="controls">
            <el-button
                circle
                class="record-btn minimal-control-btn"
                title="Repeat the current question from the start"
                :disabled="!showOnboarding && !canRepeatQuestion"
                @click="repeatCurrentQuestion">
              <i class="el-icon-refresh-left"></i>
            </el-button>
          </div>
          <!-- During onboarding the disabled binding above stays
               false so the button looks normal, and click routes
               into the sample-TTS demo. -->


          <div class="controls video-control-wrap" v-if="enableVideo">
            <transition name="video-pop">
              <div v-if="showVideoPreview" class="video-popup">
                <div class="video-popup-header">
                  <span>Camera Preview</span>
                  <i class="el-icon-close" @click="showVideoPreview = false"></i>
                </div>
                <div class="video-popup-body">
                  <video ref="localVideo" class="inline-preview-video" autoplay muted playsinline></video>
                </div>
              </div>
            </transition>
            <el-button
                circle
                class="record-btn minimal-control-btn"
                :class="{ 'active-video': showVideoPreview }"
                @click="toggleVideoPreview"
                title="Show or hide the camera preview popup">
              <i class="el-icon-video-camera"></i>
            </el-button>
          </div>

          <div class="controls control-pause-wrap">
            <!-- Persistent hint that appears only while paused, so the
                 resume button is unmissable. Disappears the moment the
                 user clicks Resume. -->
            <transition name="resume-hint-fade">
              <span v-if="isPaused" class="resume-hint" @click="togglePause">
                Click to resume
              </span>
            </transition>
            <el-button
                circle
                class="record-btn minimal-control-btn"
                :class="{ 'is-active': !isPaused, 'is-paused-cta': isPaused }"
                @click="togglePause"
                :title="isPaused ? 'Resume the session' : 'Pause the session (Resume replays the current question from the start)'">
              <i :class="isPaused ? 'el-icon-video-play' : 'el-icon-video-pause'"></i>
            </el-button>
          </div>

          <!-- Toggle questions visibility on the fly. The initial value
               comes from difficulty/profile settings, but the user can
               flip it any time during the interview to see how it
               feels with vs. without question text on screen. -->
          <div class="controls">
            <el-button
                circle
                class="record-btn minimal-control-btn"
                :class="{ 'is-active': showQuestionSection }"
                @click="toggleShowQuestions"
                :title="showQuestionSection ? 'Hide question text from the transcript (audio still plays)' : 'Show the question text in the transcript'">
              <i :class="showQuestionSection ? 'el-icon-view' : 'el-icon-document-remove'"></i>
            </el-button>
          </div>

          <div class="controls">
            <el-button
                circle
                class="record-btn minimal-control-btn"
                title="Skip to the next question"
                @click="nextQuestion">
              <i class="el-icon-right"></i>
            </el-button>
          </div>
        </div>

        <!-- 3. Right: Compact Progress -->
        <div class="bar-progress-group">
          <div class="progress-info-row">
            <span class="progress-text">{{ turn }} / {{ interviewQA.length }}</span>
            <span class="progress-percent">{{ Math.round((turn / interviewQA.length) * 100) }}%</span>
          </div>
          <div class="footer-progress-bar">
            <div class="progress-fill" :style="{ width: (turn / interviewQA.length) * 100 + '%' }"></div>
          </div>
        </div>

      </div>
      </transition>
    </div>

    <!-- Summary State -->
    <div v-else-if="!interviewing" class="summary-wrapper">
      <SummaryView />
    </div>

    <!-- Empty State -->
    <div v-else class="setup-status-view">
      <div class="status-content">
        <i class="el-icon-warning-outline empty-icon"></i>
        <h3>No Questions Ready</h3>
        <p>Return to setup to generate your interview questions.</p>
        <el-button type="primary" style="margin-top: 20px;" @click="handleBackToSetup">Back to Setup</el-button>
      </div>
    </div>

    <!-- Background Recorders -->
    <div class="system-recorders">
      <VideoRecorder
          v-if="enableVideo && !showOnboarding"
          ref="videoRecorder"
          :visible="showVideoPreview"
          :interviewing="interviewing"
          :sessionId="sessionId"
          @close="showVideoPreview = false"
          @recordingStarted="onVideoRecordingStarted"
          :audioMixStream="mixDestination ? mixDestination.stream : null"
      />
      <AnswerRecorder
          v-if="interviewing && showAnswer && turn > 0"
          :showAnswer="showAnswer"
          :questionIndex="turn - 1"
          :sessionId="sessionId"
          :isPaused="isPaused"
          @transcript="handleTranscriptReady"
          @silenceDetected="onSilenceDetected"
          @silenceProgress="onSilenceProgress"
          @answerSaved="saveSnapshotToHistory"
          :sharedAudioCtx="sharedAudioCtx"
          :mixDestination="mixDestination"
          ref="answerRecorder"
      />
    </div>

    <!-- Custom Confirmation Modal -->
    <ConfirmDialog
      :visible.sync="confirmVisible"
      :title="confirmConfig.title"
      :message="confirmConfig.message"
      :type="confirmConfig.type"
      :confirm-text="confirmConfig.confirmText"
      :show-cancel="confirmConfig.showCancel"
      :icon="confirmConfig.icon"
      @confirm="handleConfirmAction"
    />
  </div>
</template>

<script>
import VideoRecorder from '../components/VideoRecorder.vue';
import InterviewInstructions from './InterviewInstructions.vue';
import AnswerRecorder from '../components/AnswerRecorder.vue';
import SummaryView from './SummaryView.vue';
import { getSetting, saveSetting } from '@/store/settingStore';
import { getInterviewQA, getTranscripts, saveQuestionTimestamps, setInterviewCompleted, getOrCreateInterviewSessionId, getInterviewMeta, saveInterviewMeta } from '@/store/interviewStore';
import { listAllSessionIds, saveCompletedSession, deleteSession } from '@/store/interviewHistoryStore';
import interviewApi from '@/services/interviewApi';
import { clearActiveEnrollmentId } from '@/services/activeEnrollment';
import { pruneRecordingsToActiveSessions, deleteSessionRecordings, logStorageEstimate } from '@/store/recordingStore';
import storage from '@/services/storageService';
import { speakWithTTS, speakWithTTSToContext, prefetchSpeech, clearSpeechCache } from '@/services/ttsService';
import FeedbackSection from '../views/FeedbackSection.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { APP_CONFIG } from '@/constants/appConfig';
import authService from '@/services/authService';
import { ROLE_GROUPS, hasAnyRole } from '@/constants/roles';

export default {
  name: 'InterviewView',
  components: { VideoRecorder, InterviewInstructions, AnswerRecorder, SummaryView, FeedbackSection, ConfirmDialog },

  data() {
    return {
      selectedVoice: '',
      sessionId: '',             // scopes saved audio so old sessions never collide
      interviewQA: [],
      interviewTranscript: [],   // full history shown in UI
      turn: 0,
      interviewing: true,
      // AnswerRecorder is mounted ONLY after TTS finishes — silence detection starts then
      showAnswer: false,
      isReading: false,          // TTS in progress → show thinking dots
      silenceProgress: 0,        // 0–1, drives footer countdown bar
      transitioning: false,      // guard: blocks nextQuestion re-entry during advance
      answerTranscripts: [],
      enableVideo: false,
      showVideoPreview: false,
      isPaused: false,
      currentMediaTime: 0,
      lastTickTime: null,
      timerInterval: null,
      questionTimestamps: [],
      activeInterviewerAudio: null,
      interviewStopping: false,
      difficultyLevel: null,
      candidateName: '',
      showInstructions: true,
      showQuestionSection: true,
      lastAudioBlob: null,
      transcriptLoaded: false,
      transcriptLoading: false,
      videoMinimized: false,
      streamTimer: null,
      videoRecordingStartTime: null,
      sharedAudioCtx: null,       // shared Web Audio context for TTS+mic mixing
      mixDestination: null,        // MediaStreamDestination — its stream goes into VideoRecorder
      persistentMicStream: null,   // mic stream held for the entire interview, routed into the recording mix
      persistentMicSource: null,
      // ── Reading-comfort controls ────────────────────────────────
      // fontScale multiplies the transcript text font-size. Stays in
      // memory for the session; not persisted (so a single experiment
      // doesn't override the user's defaults on the next interview).
      fontScale: 1.0,
      // True when the user has clicked the hide-bar toggle. The
      // action bar collapses out of view, leaving the transcript and
      // the floating reading-tools rail. Toggled back via the same
      // rail button.
      controlBarHidden: false,
      // Onboarding overlay shown when InterviewView first mounts.
      // Holds the interview from starting until the user clicks
      // "Begin now" — gives them a moment to read the orientation
      // tips and gives background question-generation time to catch
      // up. Set to false once Begin is clicked; never shown again
      // for this session.
      showOnboarding: true,
      // True while the Begin button is waiting for Q1 to land on
      // disk (background generation hasn't produced one yet). Drives
      // the "Almost ready…" label on the button.
      onboardingWaitingForFirst: false,
      // Sequential onboarding progress flags. The info-section tiles
      // are highlighted one at a time in this order:
      //   1. Larger text (A+)         — !hasTriedFontUp
      //   2. Hide/Show questions      — hasTriedFontUp && !hasTriedToggleQs
      //   3. Hide/Show bottom bar     — hasTriedToggleQs && !hasTriedToggleBar
      //   4. Play sample              — hasTriedToggleBar && !hasStartedSample
      //   5. Pause / Repeat / Next    — hasStartedSample
      // Sample content stays hidden until Play sample is clicked.
      // After Play, the Pause/Repeat/Next tiles appear on a second
      // row inside the info panel — the Play tile itself disappears.
      hasTriedFontUp: false,
      hasTriedToggleQs: false,
      hasTriedToggleBar: false,
      hasStartedSample: false,
      // Individual per-tile flags so each of Pause/Repeat/Next stops
      // pulsing the moment its own button is clicked. Set inside the
      // onboardingDemo dispatcher below.
      hasTriedPause: false,
      hasTriedRepeat: false,
      hasTriedNext: false,
      // Streamed display text for each sample's answer. Used to type
      // the answer out word-by-word when the user kicks off the demo
      // via Try Now / Repeat / Next. When NOT streaming, the template
      // falls back to the full static `qa.a` so the answer is always
      // visible (for A−/A+ to scale on).
      sampleStreamingActive: false,
      sampleDisplayedA: ['', ''],
      sampleDisplayedQ: ['', ''],
      sampleIntroComplete: false,
      welcomeText: "Hello and welcome to the interview! Please adjust the window size and the text size before the interview starts. You can try the controls below to see how everything works.",
      welcomeDisplayed: '',
      welcomeStarted: false,
      // Sample Q/A pairs the onboarding's Pause / Repeat / Next
      // tiles drive. Two pairs is enough to demo "advance" without
      // letting the user run away with the demo. The TTS for these
      // is real (same voice the actual interview will use) so the
      // user hears what the AI sounds like before committing.
      sampleQA: [
        {
          q: "Hi! Let's start with a warm-up — how's your week been going so far?",
          a: "Thanks for having me! It's been a productive week — I shipped a new feature for our API on Tuesday and spent some time reviewing a refactor I've been wanting to tackle."
        },
        {
          q: "That's great. Tell me about a project you're particularly proud of.",
          a: "Recently I led the migration of our authentication system to a new framework. The biggest challenge was zero downtime — we landed it with no incidents."
        }
      ],
      sampleTurn: 0,
      sampleAudio: null,
      sampleTTSPaused: false,
      // Confirmation Modal State
      confirmVisible: false,
      confirmConfig: {
        title: '',
        message: '',
        type: 'primary',
        confirmText: 'Confirm',
        showCancel: true,
        icon: 'el-icon-warning-outline',
        action: null
      }
    };
  },

  computed: {
    isStaffUser() {
      return hasAnyRole(authService.getUserRoles(), ROLE_GROUPS.STAFF);
    },
    nowTime() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    countdownSecsLeft() {
      // silenceWaitMs is the full threshold; show 3→2→1→0 based on wait time
      const waitTimeSecs = APP_CONFIG.INTERVIEW.SILENCE_WAIT_MS / 1000;
      const remaining = Math.ceil((1 - this.silenceProgress) * waitTimeSecs);
      return Math.max(0, remaining);
    },
    levelConfig() {
      return APP_CONFIG.DIFFICULTY[this.difficultyLevel] || APP_CONFIG.DIFFICULTY[APP_CONFIG.DIFFICULTY_DEFAULT];
    },
    difficultyLabel() {
      return (this.levelConfig && this.levelConfig.LABEL) || this.difficultyLevel || '—';
    },
    showAIAnswer() {
      return !!this.levelConfig?.SHOW_AI_ANSWER;
    },
    canRepeatQuestion() {
      // Repeat the current question if we are mid-interview, on a real turn,
      // and not currently in the middle of reading or transitioning.
      return this.interviewing
        && !this.transitioning
        && !this.isReading
        && this.turn > 0
        && this.turn <= this.interviewQA.length;
    },
    // Style bindings for the transcript column — drives the live
    // font-scale only. Layout (width / position) is left at the
    // app's default; the CSS variable is read by .text's font-size
    // calc() so adjustments don't trigger a layout zoom.
    transcriptStyle() {
      return {
        '--transcript-font-scale': this.fontScale
      };
    },
    // Footer status indicator. Three states:
    //   ready     — onboarding overlay is up; nothing is being captured
    //   recording — interview is live and not paused
    //   paused    — interview is live but the user paused it
    // The video recorder runs continuously while interviewing & !paused,
    // so "RECORDING" is accurate as soon as the user clicks Begin.
    footerStatus() {
      if (this.showOnboarding) return 'ready';
      if (!this.interviewing) return 'paused';
      if (this.isPaused) return 'paused';
      return 'recording';
    },
    footerStatusLabel() {
      switch (this.footerStatus) {
        case 'ready': return 'READY';
        case 'paused': return 'PAUSED';
        default: return 'RECORDING';
      }
    },
    liveStatus() {
      // Mutually exclusive — the most relevant state wins. Paused MUST
      // be checked before isReading / showAnswer because pausing while
      // the TTS is mid-sentence doesn't flip those flags off (the audio
      // is suspended, not finished). We deliberately do NOT surface a
      // "transitioning" state here — that window is the millisecond gap
      // between nextQuestion() and audio.onplaying, which the TTS
      // prefetch cache has made effectively invisible. Showing a
      // "Loading next question" banner during that flicker made the
      // transition feel slower than it is. Without a banner, the
      // transition feels instantaneous.
      if (!this.interviewing) return null;
      if (this.isPaused) {
        return { kind: 'paused', icon: 'el-icon-video-pause', text: 'Session paused' };
      }
      if (this.isReading) {
        return { kind: 'speaking', icon: null, text: 'Interviewer is speaking' };
      }
      if (this.showAnswer) {
        return { kind: 'listening', icon: null, text: 'Listening to your answer' };
      }
      return null;
    },
  },

  watch: {
    // Smooth-scroll the transcript when a new paragraph appears. If the
    // newest entry is an interviewer question and questions are hidden,
    // skip — the answer paragraph that follows shortly will trigger
    // its own scroll.
    'interviewTranscript.length'(newLen, oldLen) {
      if (newLen <= oldLen) return;
      const last = this.interviewTranscript[newLen - 1];
      if (last && last.type === 'interviewer' && !this.showQuestionSection) return;
      this.$nextTick(() => this.scrollToLatestTranscriptLine());
    },
    fontScale(val) {
      saveSetting('interviewFontScale', val);
    },
  },

  async created() {
    const storedQA = await getInterviewQA();
    this.interviewQA = Array.isArray(storedQA) ? storedQA : [];
    this.difficultyLevel = await getSetting('interviewDifficulty');
    const savedFontScale = await getSetting('interviewFontScale');
    if (typeof savedFontScale === 'number' && savedFontScale >= 0.7 && savedFontScale <= 1.8) {
      this.fontScale = savedFontScale;
    }
    try {
      const meta = await getInterviewMeta();
      this.candidateName = (meta && meta.candidateName) || '';
    } catch (e) { /* best-effort */ }
  },

  async mounted() {
    this.enableVideo = await getSetting('enableVideo');
    const savedShowQuestions = await getSetting('showQuestions');
    if (savedShowQuestions !== null) this.showQuestionSection = savedShowQuestions;

    // Difficulty hard-overrides the show-questions toggle for Beginner (always on)
    // and Advanced (always off). Intermediate respects the user's saved choice.
    const levelConfig = APP_CONFIG.DIFFICULTY[this.difficultyLevel];
    if (levelConfig?.SHOW_QUESTIONS_MODE === 'always') {
      this.showQuestionSection = true;
    } else if (levelConfig?.SHOW_QUESTIONS_MODE === 'never') {
      this.showQuestionSection = false;
    }

    const savedVoice = await getSetting('selectedVoice');
    this.selectedVoice = savedVoice;
    this.interviewQA = await getInterviewQA();
    if (this.$route && this.$route.name === 'InterviewView') {
      // Lock in a session id BEFORE the first AnswerRecorder mounts so the
      // saved audio is scoped from the very first question. Reusing the id
      // on a mid-interview reload keeps already-saved blobs reachable.
      this.sessionId = await getOrCreateInterviewSessionId();
      // Drop audio whose session is no longer in history (and any legacy
      // un-scoped Recording_<n> keys from before this scheme), but keep
      // the just-minted current session id so its future writes survive.
      try {
        const active = await listAllSessionIds();
        if (!active.includes(this.sessionId)) active.push(this.sessionId);
        await pruneRecordingsToActiveSessions(active);
        logStorageEstimate('interview start');
      } catch (e) { /* best-effort */ }
      this.showInstructions = false;
      this.interviewing = true;
      this.turn = 0;
      this.currentMediaTime = 0;
      this.questionTimestamps = [];
      this.answerTranscripts = [];

      try {
        const [resumeMeta, savedTranscripts] = await Promise.all([getInterviewMeta(), getTranscripts()]);
        const answered = Array.isArray(savedTranscripts) ? savedTranscripts.filter(Boolean).length : 0;
        if (!(resumeMeta && resumeMeta.completed) && answered > 0 && answered < this.interviewQA.length) {
          this._resumeFromTurn = answered;
          this._restoreTranscript(answered);
        }
      } catch (e) { /* best-effort */ }
      // NOTE: startTimer() is intentionally NOT called here. It sets
      // up the persistent mic + the elapsed-time tick, and we want
      // neither to be active during the onboarding read-through.
      // beginInterview() fires startTimer() right before nextQuestion.
      // Pre-warm Q1's TTS as soon as it's available. If qaList[0]
      // already exists at mount time, prefetch right away. Otherwise
      // a watcher fires the first time qaList[0].question lands
      // (questions still streaming in from generateInterviewQA).
      this._maybePrefetchQ1();
      this._unwatchFirstQ = this.$watch(
        () => (this.interviewQA[0] && this.interviewQA[0].question) || null,
        (newQ) => {
          if (newQ) {
            this._maybePrefetchQ1();
            if (this._unwatchFirstQ) { this._unwatchFirstQ(); this._unwatchFirstQ = null; }
          }
        }
      );
      // Warm the cache for both sample questions so Try Now / Next
      // plays audio instantly instead of waiting on a network fetch
      // after the click.
      this._prefetchSampleTTS();
      // Onboarding overlay is shown by default. nextQuestion() is
      // NOT called here — it fires when the user clicks "Begin now"
      // inside the overlay. While the user reads the overlay's
      // orientation tips, background generation finishes off the
      // remaining batches.
      //
      this.$nextTick(() => {
        if (this.showOnboarding && !this.welcomeStarted) {
          this._autoPlayWelcome();
        }
      });
    }
    // Warn on refresh / close while a session is active. In-app
    // Cancel / Stop paths set _intentionalLeave to bypass.
    this._beforeUnloadHandler = (e) => {
      this.releaseMediaDevices();
      if (this.interviewing) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', this._beforeUnloadHandler);
    this._pageHideHandler = () => {
      if (this.interviewing && !this._intentionalLeave && this.sessionId) {
        try { interviewApi.endOnUnload(this.sessionId); } catch (e) { /* best-effort */ }
      }
      clearActiveEnrollmentId();
    };
    window.addEventListener('pagehide', this._pageHideHandler);
  },

  async beforeRouteLeave(to, from, next) {
    const hasActiveSession = this.interviewing;
    if (hasActiveSession && !this._intentionalLeave) {
      const msg = this.showOnboarding
        ? 'Leave the interview setup? You\'ll need to start over from Step 1.'
        : 'Leave the interview? Your in-flight answer for this question will be lost (already-completed answers are saved).';
      const ok = window.confirm(msg);
      if (!ok) return next(false);
      if (this.sessionId) {
        try { await interviewApi.updateSession(this.sessionId, { endedAt: new Date().toISOString() }); } catch (e) { /* best-effort */ }
      }
    }
    clearActiveEnrollmentId();
    this.releaseMediaDevices();
    next();
  },

  beforeDestroy() {
    this.releaseMediaDevices();
    if (this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
    }
    if (this._pageHideHandler) {
      window.removeEventListener('pagehide', this._pageHideHandler);
    }
    this.stopTimer();
    this.clearStream();
    if (this._welcomeStreamTimer) { clearTimeout(this._welcomeStreamTimer); this._welcomeStreamTimer = null; }
    if (this._clearSampleStreamTimer) this._clearSampleStreamTimer();
    if (this._unwatchFirstQ) { this._unwatchFirstQ(); this._unwatchFirstQ = null; }
    clearSpeechCache();
  },

  methods: {
    scrollToLatestTranscriptLine() {
      const scroller = this.$refs.transcriptScroller;
      if (!scroller) return;
      const lines = scroller.querySelectorAll('.transcript-line');
      const last = lines[lines.length - 1];
      if (last && typeof last.scrollIntoView === 'function') {
        last.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },

    // ── Release all media devices (camera + mic) ──────────────────────────
    releaseMediaDevices() {
      // 1. Explicitly stop AnswerRecorder (includes mic tracks)
      if (this.$refs.answerRecorder) {
        try { this.$refs.answerRecorder.stopRecording(); } catch (e) {}
      }
      
      // 2. Explicitly stop VideoRecorder (includes camera tracks)
      if (this.$refs.videoRecorder) {
        try { this.$refs.videoRecorder.stopRecording(); } catch (e) {}
      }

      // 3. Close the shared AudioContext (kills any remaining audio processing)
      if (this.sharedAudioCtx) {
        try {
          if (this.sharedAudioCtx.state !== 'closed') {
            this.sharedAudioCtx.close();
          }
        } catch (e) {}
        this.sharedAudioCtx = null;
        this.mixDestination = null;
      }

      // 4. Cancel any TTS
      if (this.activeInterviewerAudio) {
        try {
          if (typeof this.activeInterviewerAudio.pause === 'function') {
             this.activeInterviewerAudio.pause();
             this.activeInterviewerAudio.src = "";
          }
          else if (window.speechSynthesis) window.speechSynthesis.cancel();
        } catch (e) {}
        this.activeInterviewerAudio = null;
      }

      this.stopTimer();
      this.clearStream();
    },

    toggleVideoPreview() {
      if (this.showOnboarding) return;
      this.showVideoPreview = !this.showVideoPreview;
      if (this.showVideoPreview) {
        this.$nextTick(() => {
          const videoEl = this.$refs.localVideo;
          const recorderStream = this.$refs.videoRecorder && this.$refs.videoRecorder.mediaStream;
          if (videoEl && recorderStream) {
            videoEl.srcObject = recorderStream;
          }
        });
      }
    },

    onVideoRecordingStarted(wallClockMs) {
      this.videoRecordingStartTime = wallClockMs;
    },

    onSilenceProgress(progress) {
      if (this.isPaused || this.transitioning) return;
      this.silenceProgress = progress;
    },

    onSilenceDetected() {
      if (this.isPaused || this.transitioning) return;
      this.silenceProgress = 0;
      this.nextQuestion();
    },

    async nextQuestion() {
      // During onboarding the rail / control-bar Next button drives
      // the sample carousel forward — same as the info tile.
      // beginInterview() flips showOnboarding to false BEFORE calling
      // nextQuestion, so the very first real question still fires.
      if (this.showOnboarding) return this._advanceSample();
      // Hard guard — only one advance at a time
      if (this.transitioning || !this.interviewing || this.interviewStopping) return;
      this.transitioning = true;
      if (this._ttsWatchdog) { clearTimeout(this._ttsWatchdog); this._ttsWatchdog = null; }

      // Tear down current recorder and any streaming
      this.clearStream();
      this.showAnswer = false;
      this.silenceProgress = 0;
      this.isReading = false;

      // Cancel any active TTS
      if (this.activeInterviewerAudio) {
        if (typeof this.activeInterviewerAudio.pause === 'function') this.activeInterviewerAudio.pause();
        else if (window.speechSynthesis) window.speechSynthesis.cancel();
        this.activeInterviewerAudio = null;
      }

      // Pull in any questions that finished generating in the background
      // after we navigated here. Cheap IndexedDB read once per question.
      try {
        const latest = await getInterviewQA();
        if (Array.isArray(latest) && latest.length > this.interviewQA.length) {
          this.interviewQA = latest;
        }
      } catch (e) { /* best-effort */ }

      if (this.turn >= this.interviewQA.length) {
        // No more questions left — play a brief closing message before
        // ending the session, then navigate to the summary.
        this.playClosingMessage();
        return;
      }

      const qa = this.interviewQA[this.turn];
      this.turn++;
      const turnIdx = this.turn - 1;

      // Stream the reference answer such that it BEGINS to appear ~1 second
      // before the TTS reaches the end of the question. That way the
      // candidate gets a brief head start to read along while the
      // interviewer is finishing the last word — not the entire question.
      let streamStarted = false;
      const startAnswerStream = () => {
        if (streamStarted || !this.showAIAnswer || !this.interviewing) return;
        streamStarted = true;
        const answerEntry = {
          type: 'user',
          text: '',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        this.interviewTranscript.push(answerEntry);
        this.streamAnswer(qa.answer, answerEntry);
      };

      // Push the question text and set isReading only when the audio
      // actually starts playing — fixes the "question text shows up several
      // seconds before the interviewer starts speaking" delay caused by the
      // TTS network call. The `transitioning` state stays true until then,
      // which surfaces the "Loading next question" banner during the wait.
      let questionShown = false;
      const showQuestionNow = () => {
        if (questionShown || !this.interviewing) return;
        questionShown = true;
        this.interviewTranscript.push({
          type: 'interviewer',
          text: qa.question,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
        this.isReading = true;
        const videoOffsetMs = this.videoRecordingStartTime
            ? Date.now() - this.videoRecordingStartTime
            : this.currentMediaTime;
        this.questionTimestamps[turnIdx] = videoOffsetMs;
      };

      const ttsFunc = (this.sharedAudioCtx && this.mixDestination)
          ? (text, voice, onEnd) => speakWithTTSToContext(text, voice, this.sharedAudioCtx, this.mixDestination, onEnd)
          : speakWithTTS;
      ttsFunc(qa.question, this.selectedVoice, () => {
        if (this._ttsWatchdog) { clearTimeout(this._ttsWatchdog); this._ttsWatchdog = null; }
        if (!this.interviewing) { this.transitioning = false; return; }
        // Safety nets if the `playing` event never fired (e.g., browser
        // fallback synthesis): make sure the question text and answer have
        // been shown before we move on.
        showQuestionNow();
        startAnswerStream();
        this.isReading = false;
        this.showAnswer = true;     // mounts AnswerRecorder → mic on → silence detection starts
        this.transcriptLoaded = true;
        this.transitioning = false;
      }).then(audio => {
        this.activeInterviewerAudio = audio;
        // Show the question text + capture the video timestamp at the
        // exact moment the TTS audio starts playing, so the on-screen
        // text and the interviewer's voice arrive together (no more
        // "question shows up but interviewer is several seconds late").
        if (audio && typeof audio.addEventListener === 'function') {
          const onPlaying = () => {
            audio.removeEventListener('playing', onPlaying);
            if (this._ttsWatchdog) { clearTimeout(this._ttsWatchdog); this._ttsWatchdog = null; }
            showQuestionNow();
            // Warm the speech cache for the next question while the
            // user is hearing this one. Audio fetch typically takes
            // 2-5s; answers run 30-90s. So by the time silence detect
            // fires after a 3s pause, the next question's audio is
            // already decoded and ready to play with zero added wait.
            this.prefetchNextQuestionTTS();
          };
          audio.addEventListener('playing', onPlaying);

          // Pre-trigger: when the TTS audio is ~2 seconds from finishing,
          // start the answer streaming. The browser fires `timeupdate` at
          // ~250ms granularity and Vue takes another tick to render, so a
          // 2-second lead lands the first word ~5-6 words before the
          // question's last word at typical speech rate.
          const onTimeUpdate = () => {
            if (!audio.duration || isNaN(audio.duration)) return;
            if (audio.currentTime >= audio.duration - 2) {
              audio.removeEventListener('timeupdate', onTimeUpdate);
              startAnswerStream();
            }
          };
          audio.addEventListener('timeupdate', onTimeUpdate);
        }
      });

      const TTS_REVEAL_WATCHDOG_MS = 12000;
      this._ttsWatchdog = setTimeout(() => {
        this._ttsWatchdog = null;
        if (!this.interviewing) return;
        if (this.turn - 1 !== turnIdx) return;
        if (questionShown || !this.transitioning) return;
        showQuestionNow();
        startAnswerStream();
        this.isReading = false;
        this.showAnswer = true;
        this.transcriptLoaded = true;
        this.transitioning = false;
      }, TTS_REVEAL_WATCHDOG_MS);
    },

    streamAnswer(text, entry) {
      const WPM = APP_CONFIG.INTERVIEW.WPM;
      const BASE_DELAY = (60 / WPM) * 1000;
      const words = (text || '').split(' ');
      let i = 0;
      const typeWord = () => {
        if (!this.interviewing) return;
        // If paused mid-stream, park here and wait for resumeStream() to call us
        if (this.isPaused) {
          this.streamTimer = null;
          this._streamResumeCallback = typeWord;
          return;
        }
        if (i >= words.length) {
          this.streamTimer = null;
          this._streamResumeCallback = null;
          return;
        }
        entry.text += (i === 0 ? '' : ' ') + words[i];
        i++;
        const lastChar = words[i - 1].slice(-1);
        const delay = ['.', '!', '?'].includes(lastChar)
            ? BASE_DELAY * 1.4 + Math.random() * 50
            : [',', ';', ':'].includes(lastChar)
                ? BASE_DELAY * 1.1 + Math.random() * 30
                : BASE_DELAY * (0.9 + Math.random() * 0.2);
        this.streamTimer = setTimeout(typeWord, delay);
      };
      this._streamResumeCallback = null;
      typeWord();
    },

    clearStream() {
      if (this.streamTimer) { clearTimeout(this.streamTimer); this.streamTimer = null; }
      if (this._ttsWatchdog) { clearTimeout(this._ttsWatchdog); this._ttsWatchdog = null; }
      this._streamResumeCallback = null;
      this._pausedStreamTimer = false;
    },

    playClosingMessage() {
      // Avoid double-firing if nextQuestion gets called more than once
      // after the last question (e.g. silence detection + manual Next).
      if (this._closingPlayed) return;
      this._closingPlayed = true;

      const closingText = "That brings us to the end of our session. Thank you so much for your time today — it was great learning about your background and experience. Someone from our team will be in touch with next steps within the next few business days. Have a wonderful rest of your day.";

      this.interviewTranscript.push({
        type: 'interviewer',
        text: closingText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      this.isReading = true;
      this.showAnswer = false;

      const ttsFunc = (this.sharedAudioCtx && this.mixDestination)
          ? (text, voice, onEnd) => speakWithTTSToContext(text, voice, this.sharedAudioCtx, this.mixDestination, onEnd)
          : speakWithTTS;
      const finishUp = () => {
        this.isReading = false;
        this.transitioning = false;
        // Mark this session as naturally completed (closing message finished).
        // The Stop button path does NOT come through here.
        this._naturalCompletion = true;
        this.stopInterview();
      };
      const audioOrPromise = ttsFunc(closingText, this.selectedVoice, finishUp);
      Promise.resolve(audioOrPromise).then(audio => {
        this.activeInterviewerAudio = audio;
      });
    },

    // Checkpoint a "stopped early" history entry on every answer that
    // gets saved. This is what makes abandoned interviews recoverable:
    // if the user closes the tab mid-interview, the questions they
    // already answered are already saved as a history entry with
    // completed:false — the user finds it in My Interviews and can
    // still transcribe + analyze what they've got. The natural-
    // completion path on SummaryView eventually overwrites the same
    // entry with completed:true (id-stable via the session id).
    async saveSnapshotToHistory() {
      if (!this.sessionId) return;
      try {
        const [meta, transcripts, qaList] = await Promise.all([
          getInterviewMeta(),
          getTranscripts(),
          getInterviewQA()
        ]);
        await saveCompletedSession({
          id: this.sessionId,
          difficulty: (meta && meta.difficulty) || this.difficultyLevel || '',
          category: (meta && meta.category) || 'All',
          analysisMode: (meta && meta.analysisMode) || 'basic',
          candidateName: (meta && meta.candidateName) || '',
          enrollmentId: (meta && meta.enrollmentId) || '',
          label: (meta && meta.label) || '',
          startedAt: (meta && meta.startedAt) || '',
          qaList: Array.isArray(qaList) ? qaList : [],
          transcripts: Array.isArray(transcripts) ? transcripts : [],
          questionTimestamps: Array.isArray(this.questionTimestamps) ? this.questionTimestamps : [],
          completed: false,
          llmAnalysis: null
        });
      } catch (e) {
        // Best-effort. If the snapshot fails the interview keeps
        // running — the Summary page's final save still has a chance.
        console.warn('[InterviewView] snapshot to history failed:', e);
      }
    },

    // Fire-and-forget prefetch of the audio for whichever question
    // will be played NEXT. `turn` has already been incremented to
    // point at the upcoming question by the time this runs from the
    // onPlaying handler, so qaList[turn] is the right one to warm.
    prefetchNextQuestionTTS() {
      if (!this.selectedVoice) return;
      const next = this.interviewQA && this.interviewQA[this.turn];
      if (next && next.question) {
        prefetchSpeech(next.question, this.selectedVoice);
      }
    },

    repeatCurrentQuestion() {
      // During onboarding the rail / control-bar Repeat button drives
      // the sample TTS — same as the info tile.
      if (this.showOnboarding) return this._replaySample();
      if (!this.canRepeatQuestion) return;
      const qa = this.interviewQA[this.turn - 1];
      if (!qa || !qa.question) return;

      // Cancel any stale TTS audio just in case
      if (this.activeInterviewerAudio) {
        if (typeof this.activeInterviewerAudio.pause === 'function') this.activeInterviewerAudio.pause();
        else if (window.speechSynthesis) window.speechSynthesis.cancel();
        this.activeInterviewerAudio = null;
      }

      this.isReading = true;
      const ttsFunc = (this.sharedAudioCtx && this.mixDestination)
          ? (text, voice, onEnd) => speakWithTTSToContext(text, voice, this.sharedAudioCtx, this.mixDestination, onEnd)
          : speakWithTTS;
      const audioOrPromise = ttsFunc(qa.question, this.selectedVoice, () => {
        this.isReading = false;
      });
      // speakWithTTS returns the audio element directly; speakWithTTSToContext returns a Promise.
      Promise.resolve(audioOrPromise).then(audio => {
        this.activeInterviewerAudio = audio;
      });
    },


    handleTranscriptReady() {
      this.transcriptLoading = false;
    },

    async stopInterview() {
      if (this.showOnboarding) return;
      this.transitioning = true; // prevent any queued advance
      this.clearStream();

      // Stop the answer recorder + audio context immediately, but await the
      // video recorder's stop separately so its blob is fully saved before
      // we navigate (otherwise the SummaryView's polling sometimes finds
      // nothing in IndexedDB and falls back to the "Video not found" warning).
      if (this.$refs.answerRecorder) {
        try { this.$refs.answerRecorder.stopRecording(); } catch (e) { /* noop */ }
      }
      const videoStopPromise = this.$refs.videoRecorder
        ? Promise.resolve().then(() => this.$refs.videoRecorder.stopRecording()).catch(() => {})
        : Promise.resolve();

      // Free the audio graph + cancel TTS
      if (this.sharedAudioCtx) {
        try {
          if (this.sharedAudioCtx.state !== 'closed') this.sharedAudioCtx.close();
        } catch (e) { /* noop */ }
        this.sharedAudioCtx = null;
        this.mixDestination = null;
      }
      if (this.activeInterviewerAudio) {
        try {
          if (typeof this.activeInterviewerAudio.pause === 'function') {
            this.activeInterviewerAudio.pause();
            this.activeInterviewerAudio.src = '';
          } else if (window.speechSynthesis) window.speechSynthesis.cancel();
        } catch (e) { /* noop */ }
        this.activeInterviewerAudio = null;
      }

      this.stopTimer();
      await saveQuestionTimestamps(this.questionTimestamps);
      // Persist completion status: only true if the closing message played
      // through (set by playClosingMessage's finishUp callback). Manual Stop
      // button → completed: false → no LLM analysis on the Summary screen.
      try {
        await setInterviewCompleted(!!this._naturalCompletion);
      } catch (e) { /* noop */ }

      if (this.sessionId) {
        try {
          await interviewApi.updateSession(this.sessionId, {
            completed: !!this._naturalCompletion,
            endedAt: new Date().toISOString()
          });
        } catch (e) { /* best-effort */ }
      }

      // Transcription is now manual: the Summary page shows a Transcribe
      // button. We don't auto-trigger AssemblyAI here, so abandoned and
      // completed sessions both behave the same way — no spend until the
      // candidate decides to analyze.

      // Wait for the video blob to land in IndexedDB before navigating away
      await videoStopPromise;
      this.interviewing = false;
      this.showAnswer = false;
      this._intentionalLeave = true;
      this.$router.push({ name: 'SummaryView' });
    },

    // Discard-and-exit. Unlike stopInterview which keeps captured
    // answers and routes to Summary, this drops every blob, transcript,
    // QA, and history entry for the current session, then routes out.
    async cancelInterview() {
      if (this.showOnboarding) return;
      this.transitioning = true;
      this.clearStream();

      if (this.$refs.answerRecorder) {
        try { this.$refs.answerRecorder.discardRecording(); } catch (e) { /* noop */ }
      }
      const videoStopPromise = this.$refs.videoRecorder
        ? Promise.resolve().then(() => this.$refs.videoRecorder.stopRecording()).catch(() => {})
        : Promise.resolve();

      if (this.sharedAudioCtx) {
        try {
          if (this.sharedAudioCtx.state !== 'closed') this.sharedAudioCtx.close();
        } catch (e) { /* noop */ }
        this.sharedAudioCtx = null;
        this.mixDestination = null;
      }
      if (this.activeInterviewerAudio) {
        try {
          if (typeof this.activeInterviewerAudio.pause === 'function') {
            this.activeInterviewerAudio.pause();
            this.activeInterviewerAudio.src = '';
          } else if (window.speechSynthesis) window.speechSynthesis.cancel();
        } catch (e) { /* noop */ }
        this.activeInterviewerAudio = null;
      }
      this.stopTimer();

      // Wait for video stop before deleting the blob so we don't race
      // with the recorder's final IndexedDB write.
      await videoStopPromise;

      try {
        if (this.sessionId) await deleteSession(this.sessionId);
      } catch (e) { /* best-effort */ }
      try {
        if (this.sessionId) await deleteSessionRecordings(this.sessionId);
      } catch (e) { /* best-effort */ }
      try { await storage.clearInterviewSession(); } catch (e) { /* best-effort */ }

      this.interviewing = false;
      this.showAnswer = false;
      this._intentionalLeave = true;
      this.$router.push({ name: 'MyInterviews' });
    },


    // Flip on-screen question visibility mid-interview. Doesn't touch
    // the saved 'showQuestions' setting — this is an in-session toggle
    // so a single trial doesn't accidentally change the user's default.
    // Also advances the onboarding tour step.
    toggleShowQuestions() {
      this.showQuestionSection = !this.showQuestionSection;
      this.hasTriedToggleQs = true;
    },

    // ── Reading-comfort controls ─────────────────────────────────
    // Font size adjustments stay between 70% and 180%. The values are
    // exposed to CSS via the --transcript-font-scale custom property,
    // which .text's font-size: calc() reads — text changes in size,
    // page layout / column position stay put.
    increaseFontSize() {
      this.fontScale = Math.min(1.8, Math.round((this.fontScale + 0.1) * 10) / 10);
      this.hasTriedFontUp = true;
    },
    decreaseFontSize() {
      this.fontScale = Math.max(0.7, Math.round((this.fontScale - 0.1) * 10) / 10);
      // Decrease also counts as a font-tried interaction — either
      // direction tells us the user understood the control.
      this.hasTriedFontUp = true;
    },
    resetFontSize() {
      this.fontScale = 1.0;
      this.hasTriedFontUp = true;
    },
    toggleControlBar() {
      this.controlBarHidden = !this.controlBarHidden;
      this.hasTriedToggleBar = true;
    },

    // Onboarding demo handlers — these wire the four "Other controls"
    // tiles to real behavior on the sample Q/A: TTS plays the question
    // out loud, advances through the two sample pairs, and pauses /
    // resumes the audio. None of these touch the actual interview
    // state — they live in their own `sample*` data fields.
    onboardingDemo(name) {
      switch (name) {
        case 'pause':  this.hasTriedPause  = true; return this._toggleSamplePause();
        case 'repeat': this.hasTriedRepeat = true; return this._replaySample();
        case 'next':   this.hasTriedNext   = true; return this._advanceSample();
        case 'camera': {
          // Camera preview has no side effect on recording state
          // (just shows the live feed in a popup). It IS safe to
          // wire to the real handler — but only if video is enabled
          // for this session. Fall back to a toast otherwise.
          if (this.enableVideo) {
            this.showVideoPreview = !this.showVideoPreview;
          } else {
            this.$message({
              message: 'Camera preview is available only when you enable video on Setup.',
              type: 'info',
              duration: 3000,
              offset: 80
            });
          }
          return;
        }
      }
    },

    async _autoPlayWelcome() {
      if (this.welcomeStarted) return;
      this.welcomeStarted = true;
      this.welcomeDisplayed = '';
      try {
        await this.$nextTick();
        await this._streamWelcome();
      } finally {
        this.sampleIntroComplete = true;
      }
    },

    // Aborts mid-stream if showOnboarding flips false so a click on
    // Start Interview doesn't leave a setTimeout chain ticking.
    _streamWelcome() {
      return new Promise((resolve) => {
        const text = this.welcomeText;
        if (!text) { resolve(); return; }
        const WPM = APP_CONFIG.INTERVIEW.WPM || 200;
        const BASE_DELAY = (60 / WPM) * 1000;
        const words = text.split(' ').filter(Boolean);
        let i = 0;
        const typeNext = () => {
          if (!this.showOnboarding) {
            this._welcomeStreamTimer = null;
            resolve();
            return;
          }
          if (i >= words.length) {
            this._welcomeStreamTimer = null;
            resolve();
            return;
          }
          this.welcomeDisplayed = words.slice(0, i + 1).join(' ');
          i++;
          this._welcomeStreamTimer = setTimeout(typeNext, BASE_DELAY);
        };
        typeNext();
      });
    },

    // Entry point for the onboarding sample demo (Try Now button).
    // Flips `hasStartedSample` to true so the Pause/Repeat/Next tiles
    // appear, then plays the current sample's question via TTS AND
    // streams the answer word-by-word like the live interview's
    // typewriter. The sample answer text was already visible above
    // (for A−/A+ to scale on) — we replace it with the streamed
    // version while playing, then it settles back to the same text.
    async onboardingPlaySample() {
      this._stopSampleTTS();
      this._clearSampleStreamTimer();
      this.isPaused = false;
      this.sampleTurn = 0;
      this.hasStartedSample = true;
      this.sampleDisplayedA = this.sampleQA.map(() => '');
      this.sampleDisplayedQ = this.sampleQA.map(() => '');
      this.sampleStreamingActive = true;
      try {
        await this.$nextTick();
        this._playSampleQuestionTTS(0);
        await this._waitUntilQuestionNearEnd();
        if (!this.sampleStreamingActive || !this.showOnboarding) return;
        await this._streamSampleAnswer(0);
      } finally {
        this.sampleStreamingActive = false;
        this._clearSampleStreamTimer();
      }
    },

    // Resolves when the sample question audio has `leadOutMs` left
    // (~1s ≈ 2-3 spoken words). Polls audio.duration while it
    // becomes available; bails after a safety window so a blocked
    // or failed fetch doesn't stall the demo.
    _waitUntilQuestionNearEnd(leadOutMs = 1000) {
      return new Promise((resolve) => {
        const SAFETY_MS = 3000;
        const startedAt = Date.now();
        const tick = () => {
          const audio = this.sampleAudio;
          if (audio && audio.duration && isFinite(audio.duration)) {
            const totalMs = audio.duration * 1000;
            const elapsedMs = (audio.currentTime || 0) * 1000;
            const triggerInMs = Math.max(0, totalMs - leadOutMs - elapsedMs);
            setTimeout(resolve, triggerInMs);
            return;
          }
          if (Date.now() - startedAt > SAFETY_MS) { resolve(); return; }
          setTimeout(tick, 50);
        };
        tick();
      });
    },

    // Read the current sample's question out loud via the real TTS
    // pipeline (same voice the user picked on Setup). Cancels any
    // sample audio already playing so back-to-back clicks don't
    // overlap.
    async _playSampleTTS() {
      const qa = this.sampleQA[this.sampleTurn];
      if (!qa || !this.selectedVoice) return;
      this._stopSampleTTS();
      try {
        const audio = await speakWithTTS(qa.q, this.selectedVoice, () => {
          if (this.sampleAudio === audio) {
            this.sampleAudio = null;
            this.sampleTTSPaused = false;
          }
        });
        this.sampleAudio = audio;
        this.sampleTTSPaused = false;
      } catch (e) { /* best-effort */ }
    },
    _stopSampleTTS() {
      if (this.sampleAudio) {
        try {
          if (typeof this.sampleAudio.pause === 'function') this.sampleAudio.pause();
          this.sampleAudio.src = '';
        } catch (e) { /* noop */ }
      }
      this.sampleAudio = null;
      this.sampleTTSPaused = false;
      // Stop the typewriter too so a half-streamed answer doesn't
      // keep ticking after the user pauses / repeats / begins.
      this.sampleStreamingActive = false;
      this._clearSampleStreamTimer && this._clearSampleStreamTimer();
    },
    _toggleSamplePause() {
      // Nothing playing — kick off the current sample so the user has
      // something to pause/resume. Also flip isPaused so the control
      // bar's pause button mirrors what just happened (icon swap + the
      // orange-pulse paused state, exactly like the real interview).
      if (!this.sampleAudio) {
        this.isPaused = false;
        return this._playSampleTTS();
      }
      try {
        if (this.sampleTTSPaused) {
          this.sampleAudio.play();
          this.sampleTTSPaused = false;
          this.isPaused = false;
        } else {
          this.sampleAudio.pause();
          this.sampleTTSPaused = true;
          this.isPaused = true;
        }
      } catch (e) { /* noop */ }
    },
    // Replay the CURRENT sample from the top: clear its streamed
    // answer text, replay the TTS, then re-stream the answer.
    async _replaySample() {
      if (!this.hasStartedSample) return;
      this._stopSampleTTS();
      this._clearSampleStreamTimer();
      this.isPaused = false;
      const idx = this.sampleTurn;
      this.$set(this.sampleDisplayedA, idx, '');
      this.sampleStreamingActive = true;
      try {
        await this.$nextTick();
        this._playSampleQuestionTTS(idx);
        await this._waitUntilQuestionNearEnd();
        if (!this.sampleStreamingActive || !this.showOnboarding) return;
        await this._streamSampleAnswer(idx);
      } finally {
        this.sampleStreamingActive = false;
        this._clearSampleStreamTimer();
      }
    },
    // Advance to the next sample (if any) and play it the same way
    // Try Now plays the first. Toast if we're already at the end.
    async _advanceSample() {
      if (!this.hasStartedSample) return;
      if (this.sampleTurn >= this.sampleQA.length - 1) {
        this.$message({
          message: 'No more sample questions — click "I\'m ready, let\'s go" to begin the real interview.',
          type: 'info',
          duration: 3000,
          offset: 80
        });
        return;
      }
      this._stopSampleTTS();
      this._clearSampleStreamTimer();
      this.isPaused = false;
      this.sampleTurn += 1;
      const idx = this.sampleTurn;
      this.$set(this.sampleDisplayedA, idx, '');
      this.sampleStreamingActive = true;
      try {
        await this.$nextTick();
        this._playSampleQuestionTTS(idx);
        await this._waitUntilQuestionNearEnd();
        if (!this.sampleStreamingActive || !this.showOnboarding) return;
        await this._streamSampleAnswer(idx);
      } finally {
        this.sampleStreamingActive = false;
        this._clearSampleStreamTimer();
      }
    },

    // Word-by-word typewriter for the sample answer. Uses the same
    // WPM the live interview uses so the demo matches the real UX.
    // Pauses cleanly when sampleTTSPaused flips true (the user's
    // pause button), resumes when it flips back. Aborts cleanly if
    // the user clicks Begin or unmounts the view mid-stream.
    _streamSampleAnswer(idx) {
      return new Promise((resolve) => {
        const qa = this.sampleQA[idx];
        if (!qa) { resolve(); return; }
        const WPM = APP_CONFIG.INTERVIEW.WPM || 200;
        const BASE_DELAY = (60 / WPM) * 1000;
        const words = (qa.a || '').split(' ').filter(Boolean);
        let i = 0;
        const typeNext = () => {
          if (!this.sampleStreamingActive || !this.showOnboarding) {
            this._sampleStreamTimer = null;
            resolve();
            return;
          }
          // Pause halts the typewriter mid-stream; resume continues.
          if (this.sampleTTSPaused) {
            this._sampleStreamTimer = setTimeout(typeNext, 120);
            return;
          }
          if (i >= words.length) {
            this._sampleStreamTimer = null;
            resolve();
            return;
          }
          const prev = this.sampleDisplayedA[idx] || '';
          const next = (i === 0 ? '' : prev + ' ') + words[i];
          this.$set(this.sampleDisplayedA, idx, next);
          i++;
          this._sampleStreamTimer = setTimeout(typeNext, BASE_DELAY);
        };
        typeNext();
      });
    },

    _clearSampleStreamTimer() {
      if (this._sampleStreamTimer) {
        clearTimeout(this._sampleStreamTimer);
        this._sampleStreamTimer = null;
      }
    },

    // Plays a sample question's TTS and resolves when audio.onended
    // fires (or immediately on error, so the demo doesn't get stuck
    // when TTS is unavailable).
    _playSampleQuestionTTS(idx) {
      return new Promise((resolve) => {
        const qa = this.sampleQA[idx];
        if (!qa || !this.selectedVoice) { resolve(); return; }
        // Reveal the real question text alongside the TTS audio —
        // before this, the bubble shows the "Your question will appear
        // here" placeholder so the sample reads as a blank UI shell.
        this.$set(this.sampleDisplayedQ, idx, qa.q);
        let settled = false;
        const done = () => { if (settled) return; settled = true; resolve(); };
        try {
          speakWithTTS(qa.q, this.selectedVoice, done)
            .then((audio) => { this.sampleAudio = audio; })
            .catch(() => done());
        } catch (e) { done(); }
      });
    },


    // Fire-and-forget prefetch of Q1's TTS audio. Safe to call any
    // number of times — internal cache coalesces duplicate requests
    // for the same text+voice.
    _maybePrefetchQ1() {
      if (this.selectedVoice && this.interviewQA[0] && this.interviewQA[0].question) {
        prefetchSpeech(this.interviewQA[0].question, this.selectedVoice);
      }
    },

    // Prefetch the TTS audio for every sample question. Called at
    // mount time so the click-to-speak latency on Try Now / Next is
    // gone — by the time the user clicks, the audio is already in
    // memory.
    _prefetchSampleTTS() {
      if (!this.selectedVoice) return;
      for (const qa of this.sampleQA) {
        if (qa && qa.q) prefetchSpeech(qa.q, this.selectedVoice);
      }
    },

    // Pre-recording exit. Live qaList stays in IDB for the next mount
    // but the session never gets checkpointed to history (that only
    // happens on the first answerSaved), so there's nothing to clean up
    // explicitly here. beforeRouteLeave releases mic/camera.
    cancelOnboarding() {
      this._intentionalLeave = true;
      this.$router.push({ name: 'MyInterviews' });
    },

    async persistCandidateName() {
      const trimmed = (this.candidateName || '').trim();
      this.candidateName = trimmed;
      try {
        const meta = await getInterviewMeta();
        if (meta && typeof meta === 'object') {
          meta.candidateName = trimmed;
          await saveInterviewMeta(meta);
        }
      } catch (e) { /* best-effort */ }
    },
    handleBackToSetup() {
      this._intentionalLeave = true;
      this.$router.push({ name: 'ResumeSetup' });
    },

    // Called when the user clicks "Begin now" in the onboarding card.
    // Waits briefly for Q1 to arrive if background generation hasn't
    // produced it yet (polls every 250ms, max 30s). Optionally puts
    // the page into fullscreen mode, then dismisses the overlay and
    // kicks off the first question.
    async beginInterview() {
      // Pull the freshest qaList from disk in case generation
      // finished while the user was reading the onboarding card but
      // before any watcher updated the local copy.
      try {
        const latest = await getInterviewQA();
        if (Array.isArray(latest) && latest.length > this.interviewQA.length) {
          this.interviewQA = latest;
        }
      } catch (e) { /* best-effort */ }

      if (this.interviewQA.length === 0) {
        this.onboardingWaitingForFirst = true;
        const startedAt = Date.now();
        const MAX_WAIT_MS = 30000;
        while (this.interviewQA.length === 0 && (Date.now() - startedAt) < MAX_WAIT_MS) {
          await new Promise(r => setTimeout(r, 250));
          try {
            const latest = await getInterviewQA();
            if (Array.isArray(latest) && latest.length > 0) {
              this.interviewQA = latest;
            }
          } catch (e) { /* keep polling */ }
        }
        this.onboardingWaitingForFirst = false;
        if (this.interviewQA.length === 0) {
          // Generation truly failed — surface a confirm so the user
          // doesn't stare at a stuck button.
          this.confirmConfig = {
            title: 'Could not prepare questions',
            message: 'Question generation timed out. Please go back to setup and try again.',
            type: 'danger',
            confirmText: 'Go back',
            showCancel: false,
            icon: 'el-icon-warning-outline',
            action: 'back-to-setup'
          };
          this.confirmVisible = true;
          return;
        }
      }

      await this.persistCandidateName();

      this._stopSampleTTS();
      this._clearSampleStreamTimer();
      if (this._welcomeStreamTimer) {
        clearTimeout(this._welcomeStreamTimer);
        this._welcomeStreamTimer = null;
      }
      this.isPaused = false;

      this.showOnboarding = false;
      // Bring the recording stack online NOW — persistent mic, the
      // shared AudioContext, the elapsed-time tick. VideoRecorder
      // mounts itself because its v-if is gated on !showOnboarding.
      this.startTimer();
      if (this._resumeFromTurn) this.turn = this._resumeFromTurn;
      this.saveSnapshotToHistory();
      this.nextQuestion();
    },

    _restoreTranscript(count) {
      const restored = [];
      for (let i = 0; i < count; i++) {
        const qa = this.interviewQA[i];
        if (!qa) continue;
        restored.push({ type: 'interviewer', text: qa.question, time: '' });
        if (this.showAIAnswer && qa.answer) restored.push({ type: 'user', text: qa.answer, time: '' });
      }
      this.interviewTranscript = restored;
    },

    togglePause() {
      // During onboarding the rail / control-bar pause button drives
      // the sample-TTS pause/resume (not the real session, which
      // hasn't started). _toggleSamplePause also flips isPaused so
      // the control-bar button's own icon swap still works as a
      // visual demo.
      if (this.showOnboarding) {
        return this._toggleSamplePause();
      }
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        // ── PAUSE ──
        // Reset the silence countdown indicator so the circular timer
        // doesn't sit stuck at its last value while the session is
        // paused. The countdown re-arms naturally on resume once the
        // user goes quiet again.
        this.silenceProgress = 0;
        // 1. Pause TTS audio
        if (this.activeInterviewerAudio) {
          if (typeof this.activeInterviewerAudio.pause === 'function') this.activeInterviewerAudio.pause();
          else if (window.speechSynthesis) window.speechSynthesis.pause();
        }
        // 2. Stop the answer-typewriter (it'll resume from the same word)
        if (this.streamTimer) {
          clearTimeout(this.streamTimer);
          this.streamTimer = null;
        }
        // 3. Pause the AnswerRecorder. Critical: without this the
        //    silence-detection interval keeps measuring, eventually
        //    fires after 3s of paused silence, internally calls
        //    stopRecording() which kills the mediaStream, and then
        //    resumeRecording has nothing to restart from. The result
        //    was the "stuck at 1, can't resume" state.
        if (this.$refs.answerRecorder) {
          try { this.$refs.answerRecorder.pauseRecording(); } catch (e) { /* noop */ }
        }
        // 4. Pause the VideoRecorder so the recording stops appending
        //    frames while paused. Video resumes seamlessly.
        if (this.$refs.videoRecorder) {
          try { this.$refs.videoRecorder.pauseRecording(); } catch (e) { /* noop */ }
        }
      } else {
        // ── RESUME = restart the current question from the beginning ──
        // The user pressed Resume after pausing mid-question or
        // mid-answer. Rather than picking up exactly where they left
        // off, the question is re-asked from the top: TTS plays again,
        // the reference answer streams again, and the answer recorder
        // is re-mounted clean. The in-progress recording (if any) is
        // thrown away. This gives a "fresh take" feel — pause is
        // effectively a do-over for the current question only.
        this.restartCurrentQuestion();
      }
    },

    // Tear down the in-flight question state and re-trigger nextQuestion
    // for the same question. Called from togglePause's resume branch.
    async restartCurrentQuestion() {
      // 1. Throw away any partial audio captured for this question.
      //    The AnswerRecorder will stop without saving and clear its
      //    chunks; the transcripts array slot stays untouched (it was
      //    only going to get a pending marker, which never landed).
      if (this.$refs.answerRecorder) {
        try { this.$refs.answerRecorder.discardRecording(); } catch (e) { /* noop */ }
      }

      // 2. Cancel any in-flight TTS so the upcoming re-ask plays from
      //    its first syllable, not the syllable where the user paused.
      if (this.activeInterviewerAudio) {
        try {
          if (typeof this.activeInterviewerAudio.pause === 'function') {
            this.activeInterviewerAudio.pause();
            this.activeInterviewerAudio.src = '';
          } else if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
        } catch (e) { /* noop */ }
        this.activeInterviewerAudio = null;
      }

      // 3. The video recorder still has all previously-captured frames;
      //    we want the re-asked segment captured too, so resume it.
      if (this.$refs.videoRecorder) {
        try { this.$refs.videoRecorder.resumeRecording(); } catch (e) { /* noop */ }
      }

      // 4. Strip the on-screen chat entries for the question we're
      //    about to re-ask, so the rendered transcript shows it only
      //    once. nextQuestion will push fresh entries when it runs.
      const currentQuestionText = this.interviewQA[this.turn - 1]
        && this.interviewQA[this.turn - 1].question;
      while (this.interviewTranscript.length > 0) {
        const last = this.interviewTranscript[this.interviewTranscript.length - 1];
        // The user-typed reference answer entry (if any) always sits
        // right after its interviewer entry — drop it first.
        if (last && last.type === 'user') {
          this.interviewTranscript.pop();
          continue;
        }
        // Then drop the trailing interviewer entry if it matches the
        // question we're about to re-ask. Stop after that — don't
        // walk further back into prior questions.
        if (last && last.type === 'interviewer' && last.text === currentQuestionText) {
          this.interviewTranscript.pop();
        }
        break;
      }

      // 5. Reset transient flags. transitioning must be false so
      //    nextQuestion's hard guard doesn't reject the call.
      this.isReading = false;
      this.showAnswer = false;
      this.transitioning = false;
      this.silenceProgress = 0;

      // 6. Rewind so nextQuestion re-asks this same question. The
      //    function reads interviewQA[turn] then increments — so turn
      //    needs to point at the index we want to re-ask.
      if (this.turn > 0) this.turn -= 1;

      // 7. Let Vue unmount the old AnswerRecorder (driven by
      //    showAnswer=false) before nextQuestion re-mounts it.
      await this.$nextTick();
      this.nextQuestion();
    },

    startTimer() {
      // Set up shared AudioContext for TTS + mic mixing into video recording
      this.sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.mixDestination = this.sharedAudioCtx.createMediaStreamDestination();

      // Persistent mic capture for the *entire* interview — keeps the
      // candidate's voice in the recording mix regardless of when
      // AnswerRecorder mounts/unmounts. AnswerRecorder still does its own
      // getUserMedia for transcription, which is independent.
      this._setupPersistentMic();

      this.lastTickTime = Date.now();
      this.timerInterval = setInterval(() => {
        const now = Date.now();
        if (!this.isPaused) this.currentMediaTime += (now - this.lastTickTime);
        this.lastTickTime = now;
      }, APP_CONFIG.INTERVIEW.TIMER_TICK_MS);
    },
    async _setupPersistentMic() {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Bail if interview ended while we were awaiting permission
        if (!this.sharedAudioCtx || this.sharedAudioCtx.state === 'closed' || !this.mixDestination) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        this.persistentMicSource = this.sharedAudioCtx.createMediaStreamSource(stream);
        this.persistentMicSource.connect(this.mixDestination);
        this.persistentMicStream = stream;
      } catch (e) {
        console.error('Could not capture persistent mic for video mix:', e);
        if (this.persistentMicSource) {
          try { this.persistentMicSource.disconnect(); } catch (err) { /* noop */ }
          this.persistentMicSource = null;
        }
        if (stream) {
          try { stream.getTracks().forEach(t => t.stop()); } catch (err) { /* noop */ }
        }
      }
    },
    stopTimer() {
      if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
      // Tear down persistent mic before closing the audio context
      if (this.persistentMicSource) {
        try { this.persistentMicSource.disconnect(); } catch (e) { /* noop */ }
        this.persistentMicSource = null;
      }
      if (this.persistentMicStream) {
        this.persistentMicStream.getTracks().forEach(t => t.stop());
        this.persistentMicStream = null;
      }
      if (this.sharedAudioCtx) {
        this.sharedAudioCtx.close();
        this.sharedAudioCtx = null;
        this.mixDestination = null;
      }
    },
    formatDuration(ms) {
      if (!ms) return '00:00';
      const s   = Math.floor(ms / 1000);
      const m   = Math.floor(s / 60);
      const sec = s % 60;
      return `${m < 10 ? '0' + m : m}:${sec < 10 ? '0' + sec : sec}`;
    },

    async startInterview() {
      try {
        const constraints = this.enableVideo ? { video: true, audio: true } : { audio: true };
        await navigator.mediaDevices.getUserMedia(constraints);
        this.showInstructions = false;
        this.interviewing = true;
        this.turn = 0;
        this.currentMediaTime = 0;
        this.questionTimestamps = [];
        this.answerTranscripts = [];
        this.startTimer();
        this.nextQuestion();
      } catch (err) {
        this.confirmConfig = {
          title: 'Permission Denied',
          message: 'Microphone permission denied. Please allow access to start the interview.',
          type: 'danger',
          confirmText: 'Dismiss',
          showCancel: false,
          icon: 'el-icon-lock',
          action: 'ack'
        };
        this.confirmVisible = true;
      }
    },
    handleConfirmAction() {
      const action = this.confirmConfig && this.confirmConfig.action;
      this.confirmVisible = false;
      if (action === 'back-to-setup') {
        this._intentionalLeave = true;
        this.$router.push({ name: 'ResumeSetup' });
      }
    }
  },
};
</script>

<style scoped>
.setup-page-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.interview-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  background: white;
  height: 100vh;
}

/* Scrollable zone */
.interview-scroll-container {
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
}

.interview-header {
  padding: 18px 60px;
  background: white;
  border-bottom: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.interview-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #1e293b;
}
.header-subtitle {
  color: #64748b;
  margin: 2px 0 0 0;
  font-size: 0.85rem;
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

.onboarding-title {
  line-height: 1.3;
}
.onboarding-title-name {
  appearance: none;
  border: none;
  background: transparent;
  font: inherit;
  font-weight: 700;
  color: #1d4ed8;
  padding: 0 6px;
  margin: 0 2px;
  /* field-sizing: Chromium 123+ / Safari 18+; Firefox falls back to
     the default ~150px width — usable, just not as tight. */
  field-sizing: content;
  min-width: 6ch;
  border-bottom: 2px dashed transparent;
  transition: border-color 0.15s ease, background 0.15s ease;
  font-family: inherit;
}
.onboarding-title-name:hover {
  border-bottom-color: #cbd5e1;
}
.onboarding-title-name:focus {
  outline: none;
  border-bottom-color: #2563eb;
  background: rgba(37, 99, 235, 0.05);
}
.onboarding-title-name::placeholder {
  color: #94a3b8;
  font-weight: 500;
  font-style: italic;
}
.onboarding-title-difficulty {
  display: inline-block;
  padding: 3px 11px;
  background: #eff6ff;
  color: #1e40af;
  border-radius: 999px;
  font-size: 0.65em;
  font-weight: 700;
  letter-spacing: 0.3px;
  vertical-align: middle;
  margin-left: 4px;
}

.transcript_area {
  padding: 30px 60px;
  padding-bottom: 55vh;
  background: white;
}

.transcript-line {
  display: flex;
  gap: 12px;
  margin: 1.25rem 0;
  align-items: flex-start;
  scroll-margin-top: 24px;
}

.avatar-column {
  flex-shrink: 0;
  width: 24px;
}

.content-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-avatar-small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #94a3b8;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
}

.interviewer-avatar {
  background: #64748b;
}

.time-stamp {
  font-size: 0.65rem;
  color: #b0b7c3;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.meta-header {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 24px; /* Match avatar height */
  margin-bottom: 2px;
}

.speaker-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
}

.transcript-line.user .speaker-label {
  color: #94a3b8;
  opacity: 0.8;
}

.text-container {
  flex: 1;
  margin-top: -2px; /* Pull text closer to time */
}

.text {
  /* Base font-size is multiplied by the reading-comfort scale var
     so the A-/A+ buttons can adjust it live without a re-render. */
  font-size: calc(1.30em * var(--transcript-font-scale, 1));
  color: #0f172a;
  line-height: 1.65;
  /* Soft word breaks so resized columns never produce a horizontal
     scrollbar — long URLs / unbroken tokens wrap instead. */
  overflow-wrap: anywhere;
}

/* Floating reading-tools rail, fixed to the right edge of the
   viewport. Dim by default so it doesn't compete with the transcript;
   brightens to full opacity on hover. Contains the font-size adjusters
   and the show/hide-controls toggle. Layout-neutral — it overlays the
   page, doesn't push content. */
.reading-tools-rail {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 6px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 999px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
  opacity: 0.15;
  transition: opacity 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}
.reading-tools-rail:hover {
  opacity: 1;
  background: #ffffff;
  border-color: #cbd5e1;
}

.rail-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}
.rail-btn:hover:not(:disabled) {
  background: #e2e8f0;
  color: #1e293b;
}
.rail-btn:disabled {
  opacity: 0.15;
  cursor: default;
}
.rail-btn-label {
  font-variant-numeric: tabular-nums;
  font-size: 0.7rem;
  color: #64748b;
}
.rail-btn i { font-size: 0.95rem; }

.rail-sep {
  width: 18px;
  height: 1px;
  background: #e2e8f0;
  margin: 4px 0;
}

/* Question progress pill at the top of the rail. Single line —
   the rail widens just enough for the longest "X/Y" we expect
   (e.g. 35/35), but the font is tuned down so 2-digit counts still
   fit without wrapping. */
.rail-progress {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  color: #1e293b;
  font-size: 0.72rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  line-height: 1;
}

/* Paused CTA — pulse the resume button so the user can spot it
   even when the rail is in its dim state. */
.rail-btn-paused-cta {
  color: #b45309;
  animation: rail-pulse 1.5s ease-in-out infinite;
}
.reading-tools-rail:hover .rail-btn-paused-cta {
  background: #fde68a;
  color: #7c2d12;
  animation: none;
}
@keyframes rail-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50%      { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
}

/* Single neutral info panel. Soft grey background instead of blue
   so it reads as a calm orientation note rather than a notification.
   Tiles arranged in a responsive grid so 2–4 sit side by side
   depending on viewport — never lengthy. */
.onboarding-info {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 1.5rem;
}

.onboarding-info-fade-enter-active {
  transition: opacity 0.7s cubic-bezier(0.0, 0.0, 0.2, 1),
              transform 0.7s cubic-bezier(0.0, 0.0, 0.2, 1);
}
.onboarding-info-fade-enter {
  opacity: 0;
  transform: translateY(14px);
}
.onboarding-info-fade-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.info-lead {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  font-size: 0.86rem;
  font-weight: 500;
  margin-bottom: 10px;
}
.info-lead > i { font-size: 1.05rem; color: #2563eb; }


/* Tiny section header above each group of tiles. */
.info-section-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #94a3b8;
  margin: 12px 0 6px;
  padding: 0 2px;
}
.info-section-title:first-of-type { margin-top: 4px; }

/* Tile grid — auto-fits 2–4 tiles per row depending on container
   width. Each tile is icon-on-left + short label, fixed height so
   the rows stay tidy. */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 6px;
}
.info-tile {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #334155;
  font-size: 0.82rem;
  line-height: 1.2;
  text-align: left;
  width: 100%;
}
.info-tile-active {
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, transform 0.08s ease;
}
.info-tile-active:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}
.info-tile-active:active {
  transform: scale(0.98);
}
.info-tile-static {
  cursor: default;
  background: transparent;
  border-style: dashed;
}
.info-tile button { all: unset; }

.info-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  color: #1d4ed8;
  font-weight: 700;
  flex-shrink: 0;
}
.info-glyph.info-glyph-text {
  font-size: 0.92rem;
}
.info-glyph[class*="el-icon-"] {
  font-size: 1.1rem;
}
.info-label {
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Heads-up about closing the tab. Distinct from the regular tiles —
   amber tint, full width below the grids. */
.info-warn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  margin-top: 12px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  color: #78350f;
  font-size: 0.82rem;
  line-height: 1.45;
}
.info-warn > i { font-size: 1rem; margin-top: 1px; flex-shrink: 0; color: #b45309; }
.info-warn strong { color: #78350f; }

/* CTA row — Try Now on the left, the big "I'm Ready — Start Interview"
   on the right. Try Now starts the sample play (same as Pause /
   Repeat / Next in the info panel after the user begins). */
.onboarding-cta {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px dashed #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

/* Secondary "Try Now" outline pill on the left. Brightens to blue
   when it's the user's next step in the sequential tour. */
.onboarding-try-now {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 11px 20px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  color: #475569;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
}
.onboarding-try-now:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}
.onboarding-try-now:active:not(:disabled) { transform: scale(0.98); }
.onboarding-try-now:disabled { opacity: 0.7; cursor: progress; }
.onboarding-try-now > i { font-size: 1rem; color: #2563eb; }
.onboarding-try-now strong { color: #2563eb; font-weight: 700; margin-left: 4px; }
.onboarding-try-now-highlight {
  border-color: #3b82f6 !important;
  background: #eff6ff !important;
  animation: info-tile-pulse 1.5s ease-in-out infinite;
}

/* Cancel + primary grouped on the right side of the CTA row. Keeps
   the destructive action next to the decision the user is about to
   make, instead of hiding it in the header. */
.onboarding-cta-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

/* Plain text-button Cancel — deliberately quiet so it doesn't compete
   with the primary CTA. Visible only while showOnboarding is true. */
.onboarding-cancel {
  background: transparent;
  border: none;
  padding: 8px 12px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-radius: 8px;
  transition: color 0.15s ease, background 0.15s ease;
}
.onboarding-cancel:hover { color: #ef4444; background: #fef2f2; }
.onboarding-cancel:active { transform: scale(0.98); }

/* Tab-close warning anchored at the top of the onboarding flow. */
.onboarding-warn-top {
  margin-bottom: 1.25rem;
}

/* Small italic note above the sample chat lines so the user knows
   the messages are example content, not the real interview. */
/* "Your question / answer will appear here" placeholder text inside
   the sample interviewer- and user-bubble slots. Lighter and italic
   so it reads as a hint rather than real content — still uses the
   same .text font-size so A−/A+ scale it the same way they scale
   real content. */
.text.sample-placeholder {
  color: #94a3b8;
  font-style: italic;
}

/* Dashed separator between the sample area and the info panel
   below it. Top margin is generous so the transcription stays
   visually the focus — the info panel and CTAs below sit clearly
   in a "secondary helper" zone rather than competing with the
   sample for attention. */
.onboarding-divider {
  margin: 3rem 0;
  border-top: 1px dashed #e2e8f0;
}

.onboarding-info-block {
  display: block;
}

/* Primary "I'm Ready — Start Interview" — bigger than before, larger
   shadow, sits on the right of the CTA row. */
.onboarding-cta-btn {
  border-radius: 999px !important;
  padding: 18px 44px !important;
  font-size: 1.05rem !important;
  font-weight: 600 !important;
  letter-spacing: 0.2px;
  box-shadow: 0 12px 26px rgba(37, 99, 235, 0.32) !important;
  transition: transform 0.15s ease, box-shadow 0.15s ease !important;
}
.onboarding-cta-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(37, 99, 235, 0.42) !important;
}

/* Sequential tour highlight on info-section tiles. A soft blue
   pulse on whichever tile is the user's "next step" in the
   onboarding tour. Clicking it advances the highlight to the next
   tile (handled via the hasTried* flags in template bindings). */
/* Highlight = pulse the glyph only, not the whole tile. The tile
   itself stays in its default frame so the row reads as a calm grid
   with one icon drawing the eye, instead of a button-shaped beacon. */
.info-tile-highlight .info-glyph {
  animation: info-glyph-pulse 1.5s ease-in-out infinite;
  border-radius: 50%;
}
@keyframes info-glyph-pulse {
  0%, 100% { box-shadow: 0 0 0 0   rgba(59, 130, 246, 0.55); }
  60%      { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);    }
}
/* Legacy keyframe name still referenced by .onboarding-try-now-highlight. */
@keyframes info-tile-pulse {
  0%, 100% { box-shadow: 0 0 0 0   rgba(59, 130, 246, 0.4); }
  60%      { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);   }
}

/* Second-row grid below the main controls — pause/repeat/next
   tiles that only appear once the user has clicked Play sample. */
.info-grid-secondary {
  margin-top: 8px;
}

/* Smooth slide-down for the control bar when hidden. Avoids the
   abrupt layout reflow that read as a flicker. The transition's
   own properties drive the duration; v-show toggles display:none
   AFTER the leave transition completes. */
.control-bar-slide-enter-active,
.control-bar-slide-leave-active {
  transition: max-height 0.25s ease, opacity 0.18s ease, transform 0.25s ease;
  overflow: hidden;
}
.control-bar-slide-enter-from,
.control-bar-slide-leave-to {
  max-height: 0 !important;
  opacity: 0;
  transform: translateY(20%);
}
.control-bar-slide-enter-to,
.control-bar-slide-leave-from {
  max-height: 200px;
  opacity: 1;
  transform: translateY(0);
}

/* Typing indicator */
.typing-indicator { display: flex; gap: 4px; padding: 8px 0; }
.typing-indicator span {
  width: 6px; height: 6px;
  background: #94a3b8;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}
.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40%           { transform: scale(1.0); }
}

/* ── Control Bar ── */
.control_bar {
  background: white;
  padding: 10px 25px;
  border-top: 1px solid #f0f2f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  flex-shrink: 0;
  z-index: 20;
  min-height: 65px;
}

.control-status {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 220px; /* Fixed width to prevent flickering */
}

.status-indicator-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 170px; /* Adjusted for circular timer and icon */
}

/* Circular Timer Styles */
.circular-timer-wrap {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circular-timer-wrap.mini-timer {
  width: 32px;
  height: 32px;
}

.circular-timer {
  width: 100%;
  height: 100%;
}

.circle-bg {
  fill: none;
  stroke: #f1f5f9;
  stroke-width: 3.8;
}

.circle-fill {
  fill: none;
  stroke: #059669;
  stroke-width: 3.8;
  stroke-linecap: round;
  transition: stroke-dasharray 0.1s linear;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}

.timer-countdown {
  position: absolute;
  font-size: 0.7rem;
  font-weight: 800;
  color: #059669;
}

.mini-count {
  font-size: 0.6rem !important;
}

.center-timers {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  padding: 6px 16px;
  border-radius: 24px;
  border: 1px solid #f1f5f9;
  margin-right: 12px;
}

.silence-indicator-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.timer-icon {
  font-size: 1.1rem;
  color: #64748b;
}

.status-mic-icon {
  font-size: 1.2rem;
  transition: all 0.3s ease;
  color: #94a3b8; /* Default dimmed color */
}

.status-mic-icon.is-recording {
  color: #dc2626;
  animation: mic-pulse 1.5s infinite;
}

@keyframes mic-pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}

.status-label {
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.8px;
  text-transform: uppercase;
}

.recording-text { color: #dc2626; }

.recording-duration {
  font-weight: 800;
  font-size: 0.92rem;
  color: #1e293b;
  font-variant-numeric: tabular-nums;
  min-width: 48px;
  border-left: 1px solid #e2e8f0;
  padding-left: 12px;
}

.controls-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex: 1;
}

.bar-progress-group {
  flex: 0 0 130px; /* More compact */
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}

.progress-info-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.progress-text { font-size: 0.75rem; font-weight: 700; color: #64748b; }
.progress-percent { font-size: 0.75rem; font-weight: 700; color: #2563eb; }

.footer-progress-bar {
  width: 100%;
  height: 4px;
  background: #f1f5f9;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #2563eb;
  transition: width 0.3s ease;
}

.progress-fill {
  height: 100%;
  background: #2563eb;
  transition: width 0.3s ease;
}

.controls-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  flex: 1; /* Center section takes available space */
}
.controls {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Video control with anchored popup */
.video-control-wrap {
  position: relative;
}
.video-popup {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 50%;
  transform: translateX(-50%);
  width: clamp(200px, 15vw, 260px);
  background: white;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  z-index: 3000;
}
.video-popup::after {
  content: '';
  position: absolute;
  bottom: -7px;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 14px;
  background: white;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  transform: translateX(-50%) rotate(45deg);
}
.video-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.8rem;
  font-weight: 700;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.video-popup-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  padding: 2px 4px;
  font-size: 0.9rem;
  line-height: 1;
}
.video-popup-close:hover { color: #475569; }
.video-popup-body {
  aspect-ratio: 1 / 1;
  background: #000;
  overflow: hidden;
}
.inline-preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
  display: block;
}
.record-btn.video-active {
  background-color: #2563eb;
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}
/* Popup transition */
.video-pop-enter-active, .video-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.video-pop-enter-from, .video-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
.video-pop-enter-to, .video-pop-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.record-btn {
  width: 30px;
  height: 30px;
  font-size: 14px;
  margin-bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 !important;
}

.cancel-control-btn {
  color: #b91c1c !important;
  border-color: #fecaca !important;
}
.cancel-control-btn:hover,
.cancel-control-btn:focus {
  color: #ffffff !important;
  background: #dc2626 !important;
  border-color: #dc2626 !important;
}
.record-btn i {
  margin: 0 !important;
  line-height: normal !important;
}

/* Paused resume CTA: button itself pulses + glows, and a hint bubble
   sits next to it telling the user what to do. Both go away the
   moment the session is unpaused. */
.control-pause-wrap {
  position: relative;
}
.record-btn.is-paused-cta {
  background: #fde68a !important;
  border-color: #f59e0b !important;
  color: #7c2d12 !important;
  animation: resume-pulse 1.4s ease-in-out infinite;
}
.record-btn.is-paused-cta i {
  color: #7c2d12 !important;
}
@keyframes resume-pulse {
  0%   { box-shadow: 0 0 0 0   rgba(245, 158, 11, 0.55); }
  60%  { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0);    }
  100% { box-shadow: 0 0 0 0   rgba(245, 158, 11, 0);    }
}
.resume-hint {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #fde68a;
  color: #7c2d12;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 8px;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.resume-hint::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #fde68a;
}
.resume-hint-fade-enter-active,
.resume-hint-fade-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.resume-hint-fade-enter,
.resume-hint-fade-leave-to { opacity: 0; transform: translate(-50%, 4px); }
.done-btn { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02); }
.control-text { display: none; }

/* Audio Wave */
.audio-wave { display: flex; align-items: center; gap: 2px; height: 12px; }
.bar { width: 3px; background-color: #f56c6c; border-radius: 2px; animation: wave 1s ease-in-out infinite; }
.paused-wave .bar { background-color: #e6a23c; animation: none; }
.bar:nth-child(1) { height: 60%; animation-delay: 0.0s; }
.bar:nth-child(2) { height: 80%; animation-delay: 0.1s; }
.bar:nth-child(3) { height: 100%; animation-delay: 0.2s; }
.bar:nth-child(4) { height: 70%; animation-delay: 0.3s; }
.bar:nth-child(5) { height: 50%; animation-delay: 0.4s; }
@keyframes wave {
  0%, 100% { transform: scaleY(1); }
  50%       { transform: scaleY(0.4); }
}
.recording-text { color: #f56c6c; transition: color 0.3s; }
.paused-text { color: #e6a23c; transition: color 0.3s; }
.ready-text { color: #2563eb; transition: color 0.3s; }

.summary-wrapper, .setup-status-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}
.system-recorders { display: none; }

/* ── Live status banner ──
   Slim, inline, single-line indicator pinned to the bottom of the
   transcript area. Replaces the old per-role placeholder rows that
   looked like ghost messages. */
/* Banner sits flush with the transcript's left edge — same x as the
   avatar in any transcript line. Previously the empty .avatar-column
   pushed it inward to line up with the message text; the user
   preferred the flush look, so the gutter was dropped. */
.live-status-row {
  display: flex;
  margin: 0.75rem 0 0.25rem;
  align-items: flex-start;
}

.live-status-banner {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.2px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  width: fit-content;
}

.live-status-banner i {
  font-size: 1rem;
}

.live-status-banner.is-speaking {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.live-status-banner.is-listening {
  background: #f0fdf4;
  color: #15803d;
  border-color: #bbf7d0;
}

.live-status-banner.is-thinking {
  background: #fefce8;
  color: #a16207;
  border-color: #fde68a;
}

.live-status-banner.is-paused {
  background: #fafafa;
  color: #64748b;
  border-color: #e2e8f0;
}

/* Three-dot wave next to the label, gives it a "live" feel */
.live-status-dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 2px;
}

.live-status-dots span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.4;
  animation: liveStatusDot 1.2s ease-in-out infinite;
}

.live-status-dots span:nth-child(2) { animation-delay: 0.2s; }
.live-status-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes liveStatusDot {
  0%, 100% { opacity: 0.25; transform: translateY(0); }
  50%      { opacity: 1;    transform: translateY(-2px); }
}

/* Hide the dots when paused — paused isn't actively "live" */
.live-status-banner.is-paused .live-status-dots {
  display: none;
}

.live-status-fade-enter-active,
.live-status-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.live-status-fade-enter,
.live-status-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* ── Status indicator wrapper ── */
.status-indicator-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 130px; /* Fixed width for pill area */
}
.session-timer {
  font-weight: 700;
  font-size: 0.9rem;
  color: #64748b;
  font-variant-numeric: tabular-nums;
  margin-left: 4px;
  width: 50px; /* Fixed width for timer */
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .interview-header { padding: 14px 30px; }
  .transcript_area  { padding: 24px 30px; padding-bottom: 55vh; }
}

@media (max-width: 768px) {
  .interview-header {
    padding: 12px 16px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .interview-header h2 { font-size: 1rem; }
  .header-subtitle { font-size: 0.78rem; }

  /* Transcript: timestamp on its own line above text */
  .transcript_area  { padding: 14px 14px; padding-bottom: 55vh; }
  .transcript-line {
    gap: 10px;
  }
  .avatar-column, .user-avatar-small {
    width: 22px;
    height: 22px;
  }
  .user-avatar-small { font-size: 0.6rem; }
  .time-stamp {
    font-size: 0.6rem;
    line-height: 22px;
  }
  /* Keep the scale variable in the responsive override so the
     reading-tools A−/A+ rail still works at narrow widths. */
  .text { font-size: calc(1em * var(--transcript-font-scale, 1)); }

  /* Control bar - responsive layout */
  .control_bar {
    height: auto !important;
    min-height: 70px;
    flex-wrap: wrap;
    padding: 15px !important;
    gap: 15px;
    justify-content: center;
  }
  .control-status   { 
    flex: 1 1 100%; 
    justify-content: center; 
    order: 1; 
  }
  .controls-group   { 
    flex: 1 1 auto; 
    order: 2; 
    gap: 16px; 
  }
  .bar-progress-group { 
    flex: 1 1 100%; 
    order: 3; 
    max-width: 100%; 
    align-items: center;
  }
  .status-indicator-wrap { min-width: 0; justify-content: center; }

  .record-btn   { width: 36px !important; height: 36px !important; font-size: 16px !important; }
  .control-text { display: none !important; }

  /* Video popup: anchor to right edge */
  .video-popup {
    left: auto;
    right: 0;
    transform: none;
    width: clamp(180px, 40vw, 220px);
  }
  .video-popup::after {
    left: auto;
    right: 22px;
    transform: rotate(45deg);
  }
  .video-pop-enter-from, .video-pop-leave-to { transform: translateY(8px); }
  .video-pop-enter-to, .video-pop-leave-from { transform: translateY(0); }

  .cbar-track { width: 60px; }
  .session-timer { font-size: 0.78rem; }
}

@media (max-width: 480px) {
  .interview-header h2 { font-size: 0.92rem; }
  .transcript_area { padding: 10px 10px; padding-bottom: 55vh; }
  .text { font-size: calc(0.95em * var(--transcript-font-scale, 1)); }

  .control_bar { 
    padding: 12px 10px !important; 
    gap: 10px; 
  }
  .controls-group { gap: 12px; }
  .record-btn { width: 32px !important; height: 32px !important; font-size: 14px !important; }
  .control-text { display: none !important; }
  .bar-progress-group { display: flex; } /* Show progress on mobile but at the bottom */
  .status-label { font-size: 0.82rem; }
}
</style>