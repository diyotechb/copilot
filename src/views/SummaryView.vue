<template>
  <div class="setup-page-view" :class="{ 'embedded-summary-root': embedded }">
    <!-- Loading / Processing States -->
    <div v-if="isLoading" class="setup-status-view">
      <div class="status-content">
        <div class="main-loader"></div>
        <h3>{{ loadingLabel }}</h3>
        <p>{{ loadingMessage }}</p>
        <p v-if="batchProgress.total > 0" class="batch-progress-line">
          {{ batchProgress.done }} / {{ batchProgress.total }} answers transcribed
          <span v-if="batchProgress.failed > 0">· {{ batchProgress.failed }} failed</span>
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else>
      <div class="setup-view-header">
        <!-- Breadcrumb row: "← My Interviews". Always shown, regardless
             of whether this is a live just-finished summary or a saved
             session opened from history. Gives the user a consistent
             escape hatch to the dashboard from both entry points. -->
        <div v-if="!embedded" class="header-breadcrumb">
          <button
              type="button"
              class="back-link-btn"
              @click="$router.push({ name: 'MyInterviews' })"
          >
            <i class="el-icon-arrow-left"></i>
            <span>My Interviews</span>
          </button>
        </div>

        <div class="header-main-row">
          <div class="header-main">
            <div class="title-row">
              <template v-if="!editingTitle">
                <h2 class="header-title" @click="startEditTitle" title="Click to rename">{{ displayTitle }}</h2>
                <button
                    type="button"
                    class="rename-btn"
                    title="Rename interview"
                    @click="startEditTitle"
                ><i class="el-icon-edit-outline"></i></button>
              </template>
              <input
                  v-else
                  ref="titleInput"
                  v-model="titleDraft"
                  class="header-title-input"
                  @blur="saveTitle"
                  @keyup.enter="saveTitle"
                  @keyup.esc="cancelTitle"
                  placeholder="Untitled interview"
                  maxlength="80"
              />
            </div>
            <p class="header-subtitle">
              <span v-if="difficulty" class="header-tag">{{ difficulty }}</span>
              <span v-if="category && category !== 'All'" class="header-tag">{{ category }}</span>
              <span class="header-tag state-tag" :class="completed ? 'state-complete' : 'state-incomplete'" :title="completed ? 'The candidate answered every question.' : 'The interview was stopped before the end.'">{{ completed ? 'Complete' : 'Incomplete' }}</span>
              <span class="header-tag state-tag" :class="'lc-' + lifecycleStatus.tone" :title="'Interview status'">{{ lifecycleStatus.label }}</span>
              <span v-if="interviewDateLabel" class="header-date">{{ interviewDateLabel }}</span>
            </p>
            <div v-if="createdAtMeta" class="recorded-block">
              <p class="detail-recorded">
                <el-tooltip placement="top" :content="createdByTooltip" :disabled="!createdByTooltip">
                  <span class="recorded-seg">Created <b>{{ fmtDateTime(createdAtMeta) }}</b></span>
                </el-tooltip>
                <template v-if="updatedAtMeta">
                  <span> · </span>
                  <el-tooltip placement="top" :content="updatedByTooltip" :disabled="!updatedByTooltip">
                    <span class="recorded-seg">Last updated <b>{{ fmtDateTime(updatedAtMeta) }}</b></span>
                  </el-tooltip>
                </template>
              </p>
              <p v-if="createdByEmailMeta" class="detail-recorded-by">Session ID <b>{{ activeSessionId }}</b> | Recorded By: <b>{{ createdByEmailMeta }}</b></p>
            </div>
          </div>
          <div class="header-actions">
            <el-dropdown
                v-if="(localInterviewQA && localInterviewQA.length) || transcripts.length"
                trigger="click"
                @command="handleDownloadCommand"
            >
              <el-button size="small" type="primary" plain icon="el-icon-download">
                Download<i class="el-icon-arrow-down el-icon--right"></i>
              </el-button>
              <el-dropdown-menu slot="dropdown">
                <el-dropdown-item command="video" icon="el-icon-video-camera" :disabled="!recordedVideoUrl || !completed">Video / Audio</el-dropdown-item>
                <el-dropdown-item command="transcripts" icon="el-icon-document">Transcripts</el-dropdown-item>
                <el-dropdown-item v-if="llmAnalysis" command="analysis" icon="el-icon-data-analysis">Analysis</el-dropdown-item>
              </el-dropdown-menu>
            </el-dropdown>
            <slot name="header-actions"></slot>
            <el-dropdown
                v-if="!embedded && isStaff"
                trigger="click"
                @command="handleDetailCommand"
            >
              <el-button size="small" plain class="detail-kebab">
                <i class="el-icon-more" style="transform: rotate(90deg);"></i>
              </el-button>
              <el-dropdown-menu slot="dropdown">
                <el-dropdown-item command="delete" icon="el-icon-delete">Delete</el-dropdown-item>
              </el-dropdown-menu>
            </el-dropdown>
          </div>
        </div>
      </div>

      <div class="setup-form-container">

        <div v-if="!completed && !isHistoryView && analysisMode !== 'none'" class="info-banner warning">
          <i class="el-icon-warning-outline"></i>
          <span>This interview was stopped before reaching the end, so transcription and detailed analysis are not available for it.</span>
        </div>

        <div
            v-if="analysisFeatureEnabled && analysisMode !== 'none' && completed && hasUnresolvedTranscripts && hasAnyAudio && !transcribeRecovering"
            class="info-banner action"
        >
          <i class="el-icon-info"></i>
          <span>{{ transcribePromptMessage }}</span>
          <el-button size="small" type="primary" icon="el-icon-microphone" @click="transcribeNow" :loading="transcribeRecovering">
            Transcribe answers
          </el-button>
        </div>
        <div
            v-if="isCandidateSession && allAnswered && hasUnresolvedTranscripts && hasAnyAudio && !transcribeRecovering"
            class="info-banner action"
        >
          <i class="el-icon-info"></i>
          <span v-if="dailyTranscribeUsed">You have already used today's transcription. Please try again tomorrow.</span>
          <span v-else-if="!transcribeAllowanceChecked">Checking your daily transcription…</span>
          <template v-else>
            <span>Transcribe your answers to see your basic analysis. You can do this once per day.</span>
            <el-button size="small" type="primary" icon="el-icon-microphone" @click="candidateTranscribe" :loading="transcribeRecovering">
              Transcribe answers
            </el-button>
          </template>
        </div>

        <ConfirmDialog
            :visible.sync="showTranscribeConfirm"
            type="warning"
            title="Transcribe this session?"
            message-title="You can transcribe only once per day"
            message="Make sure this is the practice session you want analyzed — once you transcribe, that is your run for today."
            confirm-text="Yes, transcribe now"
            cancel-text="Not yet"
            @confirm="confirmCandidateTranscribe"
        />
        <div v-if="transcribeRecovering && (analysisFeatureEnabled || isCandidateSession)" class="info-banner action">
          <i class="el-icon-loading"></i>
          <span>
            Transcribing… {{ batchProgress.done }} / {{ batchProgress.total }} done<span v-if="batchProgress.failed > 0">, {{ batchProgress.failed }} failed</span>. Please keep this page open.
          </span>
        </div>

        <!-- On-demand Detailed Analysis CTA (no saved analysis yet) -->
        <div v-if="canRunLLMOnDemand" class="info-banner action">
          <i class="el-icon-info"></i>
          <span>{{ detailedCtaMessage }}</span>
          <div class="cta-actions">
            <button
                type="button"
                class="info-btn cta-info-btn"
                @click="showFeedbackHelp = true"
                title="What does detailed analysis include?"
            ><i class="el-icon-info"></i></button>
            <el-button size="small" type="primary" @click="openTypeSelector(false)" :disabled="llmLoading || transcribeRecovering">Generate Detailed Analysis</el-button>
          </div>
        </div>

        <!-- Partial-analysis recovery: detailed analysis ran but some
             answered questions came back without scores (LLM truncation
             or network blip). Clicking the button calls the LLM only
             for those missing questions and merges the new entries back
             into the saved analysis, preserving everything already there. -->
        <div
            v-if="analysisFeatureEnabled && hasMissingAnalysis && !llmLoading && !transcribeRecovering"
            class="info-banner action"
        >
          <i class="el-icon-warning-outline"></i>
          <span>
            Detailed analysis is missing for {{ missingAnalysisIndices.length }} answered question<span v-if="missingAnalysisIndices.length !== 1">s</span>.
            We'll only analyze the missing one<span v-if="missingAnalysisIndices.length !== 1">s</span> and keep the rest.
          </span>
          <el-button size="small" type="primary" @click="completeMissingAnalysis" :disabled="llmLoading || transcribeRecovering">
            Analyze {{ missingAnalysisIndices.length }} missing question<span v-if="missingAnalysisIndices.length !== 1">s</span>
          </el-button>
        </div>

        <!-- Processing state — large, prominent, with keep-page-open message.
             Stays additively next to the saved-state banner so the user
             keeps their context while waiting for regenerate. -->
        <div v-if="llmLoading" class="processing-card" ref="processingCard">
          <div class="processing-icon"><i class="el-icon-loading"></i></div>
          <div class="processing-body">
            <div class="processing-headline">{{ llmAnalysis ? 'Regenerating your detailed analysis…' : 'Generating your detailed analysis…' }}</div>
            <p class="processing-message">
              This usually takes between 5 and 30 seconds depending on how many questions you answered.
              <strong>Please keep this page open</strong> while the analysis is being prepared.
              Your results will appear here automatically once ready.
            </p>
            <div class="processing-progress">
              <div class="processing-bar"><div class="processing-bar-fill"></div></div>
              <span class="processing-elapsed">
                {{ llmElapsedLabel }}<template v-if="llmBatchProgress.total"> · {{ llmBatchProgress.done }}/{{ llmBatchProgress.total }} questions</template>
              </span>
            </div>
          </div>
        </div>

        <!-- Detailed analysis failed — keep the user informed and offer
             retry. If a previous analysis is on screen we tell the user
             that's what they're looking at; otherwise the basic
             evaluation below carries the load. -->
        <div
            v-if="!llmLoading && llmError && analysisFeatureEnabled"
            class="info-banner warning analysis-mode-banner"
        >
          <i class="el-icon-warning-outline"></i>
          <span class="banner-text">
            <strong v-if="llmAnalysis">Couldn't regenerate detailed analysis.</strong>
            <strong v-else>Couldn't generate detailed analysis.</strong>
            <span v-if="llmAnalysis">The previous analysis is still shown below. {{ llmError }}</span>
            <span v-else>Showing the basic evaluation only. {{ llmError }}</span>
          </span>
          <div class="banner-actions">
            <el-button size="small" type="primary" plain icon="el-icon-refresh" @click="openTypeSelector(true)">
              Try again
            </el-button>
          </div>
        </div>

        <!-- Detailed analysis saved — Generate Detailed Analysis re-runs it -->
        <div
            v-if="!llmLoading && !llmError && llmAnalysis"
            class="info-banner saved analysis-mode-banner"
        >
          <i class="el-icon-circle-check"></i>
          <span class="banner-text">
            <strong>Detailed analysis is saved with this interview.</strong>
            <span>Per-question feedback and session insights are shown below.</span>
          </span>
          <div v-if="analysisFeatureEnabled" class="banner-actions">
            <el-button size="small" type="primary" plain icon="el-icon-refresh" @click="openTypeSelector(true)" :loading="llmLoading">
              Generate Detailed Analysis
            </el-button>
          </div>
        </div>

        <!-- Overall Performance (basic + full).
             Hidden while ANY analysis-affecting work is in flight:
               - transcribeRecovering → transcripts change → all aggregates change
               - llmLoading → the rating chip is derived from llmAnalysis,
                 so showing the previous run's score while the new one is
                 being generated is misleading. The processing banner at
                 the top tells the user what's happening; we don't need
                 stale numbers competing with it.
             Re-appears the moment whichever job finishes. -->
        <div v-if="hasAnyTranscript && !transcribeRecovering && !llmLoading" class="setup-card overall-card">
          <div class="card-header highlight">
            <i class="el-icon-data-analysis"></i>
            <div class="card-title-cluster">
              <h3>Overall Performance</h3>
              <span class="overall-verdict" :class="'verdict-' + verdict.tone">{{ verdict.label }}</span>
              <span v-if="overallRating !== null" class="overall-rating" :class="'rating-' + overallRatingTone">
                {{ overallRating }} <span class="overall-rating-suffix">/ 10</span>
              </span>
            </div>
            <button
                type="button"
                class="info-btn"
                @click="showMetricsHelp = true"
                title="What do these metrics mean?"
            >
              <i class="el-icon-info"></i>
            </button>
          </div>
          <div class="card-body">
            <p v-if="verdict.description" class="verdict-description">{{ verdict.description }}</p>
            <div class="overall-stats-grid">
              <div class="overall-stat" :class="'tone-' + answeredTone">
                <span class="overall-stat-val">{{ aggregate.answeredCount }} / {{ transcripts.length }}</span>
                <span class="overall-stat-lab">Questions answered</span>
              </div>
              <div class="overall-stat">
                <span class="overall-stat-val">{{ formatDuration(aggregate.totalDurationSec) }}</span>
                <span class="overall-stat-lab">Total speaking time</span>
              </div>
              <div class="overall-stat" :class="'tone-' + paceTileTone">
                <span class="overall-stat-val">{{ aggregate.averagePaceWpm }} WPM</span>
                <span class="overall-stat-lab">Avg pace</span>
              </div>
              <div
                  class="overall-stat"
                  :class="['tone-' + fillerTileTone, { 'overall-stat-clickable': hasSpeakingPatterns, 'is-highlighted': highlightedBlock === 'fillers' }]"
                  @click="onClickFillers"
              >
                <span class="overall-stat-val">{{ aggregate.totalFillers }}<span class="overall-stat-sub"> ({{ aggregate.fillerPercent }}%)</span></span>
                <span class="overall-stat-lab">Filler words</span>
              </div>
              <div class="overall-stat">
                <span class="overall-stat-val">{{ aggregate.totalWords }}</span>
                <span class="overall-stat-lab">Words spoken</span>
              </div>
              <div
                  v-if="extraWordsTotalUses > 0"
                  class="overall-stat"
                  :class="['tone-' + offReferenceTileTone, { 'overall-stat-clickable': sessionExtraWords.length, 'is-highlighted': highlightedBlock === 'extras' }]"
                  @click="onClickExtras"
              >
                <span class="overall-stat-val">{{ extraWordsDistinct }}<span class="overall-stat-sub"> ({{ extraWordsTotalUses }} uses)</span></span>
                <span class="overall-stat-lab">Off-reference words</span>
              </div>
            </div>

            <!-- Session insights pulled from detailed analysis. Lives
                 inside Overall Performance now so the page reads as one
                 cohesive recap instead of two duplicate cards. -->
            <div v-if="showDetailedAnalysis && llmAnalysis && llmAnalysis.session" class="overall-insights">
              <h4 class="overall-insights-title">Session insights</h4>
              <div v-if="llmAnalysis.session.strongestArea" class="insight-row">
                <span class="insight-label">Strongest area</span>
                <p class="insight-text">{{ llmAnalysis.session.strongestArea }}</p>
              </div>
              <div v-if="llmAnalysis.session.growthArea" class="insight-row">
                <span class="insight-label">Growth area</span>
                <p class="insight-text">{{ llmAnalysis.session.growthArea }}</p>
              </div>
              <div v-if="llmAnalysis.session.patterns && llmAnalysis.session.patterns.length" class="insight-row">
                <span class="insight-label">Patterns observed</span>
                <ul class="insight-list">
                  <li v-for="(p, i) in llmAnalysis.session.patterns" :key="i">{{ p }}</li>
                </ul>
              </div>
              <div v-if="llmAnalysis.session.verdict" class="insight-row">
                <span class="insight-label">Verdict</span>
                <p class="insight-verdict">{{ llmAnalysis.session.verdict }}</p>
              </div>
            </div>

            <!-- Top areas to improve, pulled from detailed analysis -->
            <div v-if="showDetailedAnalysis && topImprovementFocus.length" class="overall-improvements">
              <h4 class="overall-improvements-title">Top areas to focus on next</h4>
              <ol class="overall-improvements-list">
                <li v-for="item in topImprovementFocus" :key="'imp-' + item.idx">
                  <span class="overall-improvements-q">Q{{ item.idx + 1 }}</span>
                  <span class="overall-improvements-text">{{ item.text }}</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <!-- Your Speaking Patterns (session-level word patterns).
             Hidden during both transcribe and LLM regen so the section
             tray feels consistent: while any processing card is at the
             top, no stat sections compete with it. Snaps back when
             both jobs are idle. -->
        <div v-if="hasAnyTranscript && hasSpeakingPatterns && !transcribeRecovering && !llmLoading" class="setup-card" ref="speakingPatternsCard">
          <div class="card-header">
            <i class="el-icon-data-line"></i>
            <h3>Your Speaking Patterns</h3>
          </div>
          <div class="card-body">
            <div class="basic-analysis-grid">
              <div
                  v-if="sessionTopFillers.length"
                  class="basic-block"
                  :class="{ 'is-highlighted': highlightedBlock === 'fillers' }"
                  ref="fillersBlock"
              >
                <span class="basic-block-title">
                  Filler words you used
                  <span class="basic-block-total">{{ aggregate.totalFillers }} total uses, {{ sessionTopFillers.length }} distinct</span>
                </span>
                <p class="patterns-block-hint">"Spacer" words you said while thinking. These don't appear in the reference answers. Try a brief pause instead.</p>
                <ul class="chip-list">
                  <li v-for="f in sessionTopFillers" :key="'sf-' + f.filler" class="chip">
                    {{ f.filler }} <em>× {{ f.count }} time{{ f.count === 1 ? '' : 's' }}</em>
                  </li>
                </ul>
              </div>

              <div
                  v-if="sessionExtraWords.length"
                  class="basic-block"
                  :class="{ 'is-highlighted': highlightedBlock === 'extras' }"
                  ref="extrasBlock"
              >
                <span class="basic-block-title">
                  Words you used not in any reference
                  <span class="basic-block-total">{{ extraWordsTotalUses }} total uses, {{ sessionExtraWords.length }} distinct</span>
                </span>
                <p class="patterns-block-hint">Content words you said that don't appear in any expected answer. Could be fresh insight; could be off-topic.</p>
                <ul class="chip-list">
                  <li v-for="w in sessionExtraWords" :key="'sx-' + w.word" class="chip">
                    {{ w.word }}<span v-if="w.count > 1"> <em>× {{ w.count }} times</em></span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Video Recording Card. Visible in both live and history views.
             In history, the video may have been pruned past the 3-session
             video cap — in that case we surface that explicitly so the
             user knows it's not missing, just retired. -->
        <div v-if="enableVideo || isHistoryView" class="setup-card video-card" ref="videoCard">
          <div class="card-header highlight">
            <i class="el-icon-video-camera"></i>
            <h3>Session Recording</h3>
          </div>
          <div class="card-body centered-body">
            <div v-if="recordedVideoUrl" class="video-preview-wrapper">
              <video :src="recordedVideoUrl" controls :controlsList="completed ? null : 'nodownload'" class="summary-video" ref="summaryVideo" @pause="onVideoPaused" @ended="onVideoEnded" @contextmenu="onMediaContextMenu"></video>
            </div>
            <div v-else-if="isHistoryView" class="video-missing-alert">
              <i class="el-icon-warning-outline"></i>
              <p>Video for this session was removed to free up space. Only the most recent 3 interviews keep their video; transcripts and audio are still available below.</p>
            </div>
            <div v-else-if="videoTimeout" class="video-missing-alert">
              <i class="el-icon-warning-outline"></i>
              <p>Video recording was not found, but your transcript is available below.</p>
            </div>
          </div>
        </div>

        <!-- Per-question section header. Downloads live in the page
             header (top-right) for live and history views alike. -->
        <div v-if="transcripts.length" class="questions-header-row">
          <h3 class="questions-header">Question-by-question</h3>
        </div>

        <!-- Filter pills: All + each question. Click a question pill to focus
             on that one only; click All (or Clear selection) to bring back
             the full list. -->
        <div v-if="transcripts.length > 1" class="question-jumper">
          <button
              type="button"
              class="jumper-pill jumper-pill-all"
              :class="{ 'jumper-pill-active': selectedQuestionIdx === null }"
              @click="selectAllQuestions"
          >All</button>
          <button
              v-for="(t, idx) in transcripts"
              :key="'j-' + idx"
              type="button"
              class="jumper-pill"
              :class="jumperPillClass(idx)"
              :title="questionSnippet(idx)"
              @click="selectQuestion(idx)"
          >Q{{ idx + 1 }}</button>
          <button
              v-if="selectedQuestionIdx !== null"
              type="button"
              class="jumper-clear"
              @click="selectAllQuestions"
              title="Show all questions"
          >
            <i class="el-icon-close"></i> Clear selection
          </button>
        </div>

        <!-- Expand-all toolbar — right above the question cards so it's
             always in view when the user starts reading them. -->
        <div v-if="transcripts.length && selectedQuestionIdx === null" class="questions-toolbar">
          <span class="questions-toolbar-hint">Click any question to expand its transcript and feedback.</span>
          <el-button size="small" plain :icon="allExpanded ? 'el-icon-minus' : 'el-icon-plus'" @click="toggleAllExpanded">
            {{ allExpanded ? 'Collapse all' : 'Expand all' }}
          </el-button>
        </div>

        <!-- Transcript Blocks (collapsible) — filtered by selected question -->
        <div
            v-for="(transcriptObj, idx) in transcripts"
            v-show="selectedQuestionIdx === null || selectedQuestionIdx === idx"
            :key="idx"
            class="setup-card transcript-block"
            :class="{ 'is-expanded': isExpanded(idx), 'is-playing-answer': isPlayingAnswerFor(idx) }"
            :ref="'qcard-' + idx"
        >
          <div class="card-header q-card-header" @click="toggleExpanded(idx)">
            <i class="expand-chevron" :class="isExpanded(idx) ? 'el-icon-arrow-down' : 'el-icon-arrow-right'"></i>
            <div class="q-header-main">
              <div class="q-header-title-row">
                <span class="q-number">Q{{ idx + 1 }}</span>
                <span class="q-snippet">{{ questionSnippet(idx) }}</span>
              </div>
              <div class="q-header-meta">
                <span v-if="hasTranscriptContent(transcriptObj)" class="q-meta-pill">{{ wordCount(transcriptObj) }} words</span>
                <span v-if="hasTranscriptContent(transcriptObj)" class="q-meta-pill">{{ formatDuration(answerDurationSec(transcriptObj)) }}</span>
                <span v-if="hasTranscriptContent(transcriptObj)" class="q-meta-pill">{{ fillerCount(transcriptObj) }} fillers</span>
                <span v-if="!hasTranscriptContent(transcriptObj) && analysisMode !== 'none'" class="q-meta-pill" :class="transcriptState(transcriptObj) === 'pending' ? 'q-meta-info' : 'q-meta-warn'">{{ transcriptStateLabel(transcriptObj) }}</span>
                <!-- Score only makes sense next to a real transcript.
                     If the LLM ran on a slot where the candidate didn't
                     actually speak, it returns score=1 with "no answer
                     recorded" weakness — but rendering that 1/10 next
                     to a "No spoken answer" pill reads as a real grade
                     of the question. Gate on transcript content so the
                     pill never appears on no-answer cards. -->
                <span v-if="showDetailedAnalysis && hasTranscriptContent(transcriptObj) && perQuestionLLM(idx) && typeof perQuestionLLM(idx).score === 'number'" class="score-pill" title="Delivery score (out of 10)">
                  {{ perQuestionLLM(idx).score }} / 10
                </span>
              </div>
            </div>
            <div class="header-audio-controls" @click.stop>
              <!-- Both playback buttons only render when there's actually
                   audio for THIS question. Skipped / "no spoken answer"
                   slots have no audio to play and no scoring data — the
                   buttons would be permanently disabled and just add noise. -->
              <el-button
                  v-if="recordedVideoUrl && hasAudioRecorded(idx)"
                  size="mini"
                  :type="isPlayingVideoFor(idx) ? 'danger' : 'primary'"
                  :icon="isPlayingVideoFor(idx) ? 'el-icon-video-pause' : 'el-icon-video-play'"
                  @click="toggleVideoSegment(idx)"
                  :disabled="questionTimestamps[idx] === undefined"
              >
                {{ isPlayingVideoFor(idx) ? 'Stop' : 'Play in Video' }}
              </el-button>
              <el-button
                  v-if="hasAudioRecorded(idx)"
                  size="mini"
                  class="play-answer-btn"
                  :class="{ 'is-playing': isPlayingAnswerFor(idx) }"
                  :type="isPlayingAnswerFor(idx) ? 'danger' : 'default'"
                  :icon="isPlayingAnswerFor(idx) ? 'el-icon-video-pause' : 'el-icon-video-play'"
                  @click="toggleYourAnswer(idx)"
                  title="Listen to your spoken answer"
              >
                {{ isPlayingAnswerFor(idx) ? 'Stop' : 'Play Your Answer' }}
              </el-button>
            </div>
          </div>
          <div v-show="isExpanded(idx)" class="card-body">
            <div class="summary-data-item">
              <label>The Question</label>
              <p class="data-text">{{ localInterviewQA[idx]?.question || '(No question found)' }}</p>
            </div>

            <!-- Transcript (only when transcription was enabled) -->
            <div v-if="analysisMode !== 'none'" class="summary-data-item">
              <label>Your Transcript</label>
              <div v-if="hasTranscriptContent(transcriptObj)" class="transcript-surface" v-html="safeHighlight(transcriptObj)"></div>
              <p v-else class="data-text muted">{{ transcriptStateMessage(transcriptObj) }}</p>
            </div>

            <div class="summary-data-item">
              <label>Reference Answer</label>
              <p class="data-text muted">{{ localInterviewQA[idx]?.answer || '(No answer found)' }}</p>
            </div>

            <!-- Stats + bullets -->
            <div v-if="analysisMode !== 'none' && hasTranscriptContent(transcriptObj)" class="summary-data-item">
              <label>Stats</label>
              <div class="mini-stats">
                <div class="stat-pill">
                  <span class="stat-val">{{ wordCount(transcriptObj) }}</span>
                  <span class="stat-lab">Words</span>
                  <span class="stat-hint">total spoken</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-val">{{ paceWpm(transcriptObj) || 'N/A' }}{{ paceWpm(transcriptObj) ? ' WPM' : '' }}</span>
                  <span class="stat-lab">Pace</span>
                  <span class="stat-hint" :class="paceTone(transcriptObj)">{{ paceHint(transcriptObj) }}</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-val">{{ formatDuration(answerDurationSec(transcriptObj)) }}</span>
                  <span class="stat-lab">Duration</span>
                  <span class="stat-hint">how long you spoke</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-val">{{ fillerCount(transcriptObj) }}<span class="stat-sub"> ({{ fillerPercent(transcriptObj) }}%)</span></span>
                  <span class="stat-lab">Fillers</span>
                  <span class="stat-hint" :class="fillerTone(transcriptObj)">{{ fillerHint(transcriptObj) }}</span>
                </div>
              </div>
              <p class="stats-explainer">
                Good interview pace: 110–180 WPM. Polished delivery: under 5% fillers. Above 15% fillers reads as distracting.
              </p>
            </div>

            <!-- Basic word-level analysis (basic + full) -->
            <div v-if="analysisMode !== 'none' && hasTranscriptContent(transcriptObj)" class="summary-data-item basic-analysis">
              <label>Basic Analysis</label>
              <div class="basic-analysis-grid">
                <div v-if="topWordsFor(idx).length" class="basic-block">
                  <span class="basic-block-title">Most repeated</span>
                  <ul class="chip-list">
                    <li v-for="w in topWordsFor(idx)" :key="w.word" class="chip">{{ w.word }} <em>×{{ w.count }}</em></li>
                  </ul>
                </div>
                <div v-if="topPhrasesFor(idx).length" class="basic-block">
                  <span class="basic-block-title">Repeated phrases</span>
                  <ul class="chip-list">
                    <li v-for="p in topPhrasesFor(idx)" :key="p.phrase" class="chip">"{{ p.phrase }}" <em>×{{ p.count }}</em></li>
                  </ul>
                </div>
                <div v-if="topFillersFor(idx).length" class="basic-block">
                  <span class="basic-block-title">Fillers used</span>
                  <ul class="chip-list">
                    <li v-for="f in topFillersFor(idx)" :key="f.filler" class="chip">{{ f.filler }} <em>×{{ f.count }}</em></li>
                  </ul>
                </div>
                <div v-if="extraWordsFor(idx).length" class="basic-block">
                  <span class="basic-block-title">Words not in reference</span>
                  <ul class="chip-list">
                    <li v-for="w in extraWordsFor(idx)" :key="w.word" class="chip">{{ w.word }}</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Per-question detailed feedback -->
            <div v-if="showDetailedAnalysis && perQuestionLLM(idx)" class="summary-data-item llm-block">
              <label>Detailed Feedback</label>

              <!-- Delivery dimension -->
              <div v-if="showDelivery" class="llm-dimension">
                <div class="llm-dimension-header">
                  <span>Delivery quality</span>
                  <span v-if="typeof perQuestionLLM(idx).deliveryScore === 'number'" class="dimension-score">{{ perQuestionLLM(idx).deliveryScore }} / 10</span>
                </div>
                <div v-if="hasDeliveryNotes(idx)" class="delivery-notes-grid">
                  <div v-if="deliveryNote(idx, 'grammar')" class="delivery-note">
                    <span class="delivery-note-label">Grammar</span>
                    <p>{{ deliveryNote(idx, 'grammar') }}</p>
                  </div>
                  <div v-if="deliveryNote(idx, 'tone')" class="delivery-note">
                    <span class="delivery-note-label">Tone</span>
                    <p>{{ deliveryNote(idx, 'tone') }}</p>
                  </div>
                  <div v-if="deliveryNote(idx, 'fillers')" class="delivery-note">
                    <span class="delivery-note-label">Fillers</span>
                    <p>{{ deliveryNote(idx, 'fillers') }}</p>
                  </div>
                  <div v-if="deliveryNote(idx, 'pace')" class="delivery-note">
                    <span class="delivery-note-label">Pace</span>
                    <p>{{ deliveryNote(idx, 'pace') }}</p>
                  </div>
                  <div v-if="deliveryNote(idx, 'clarity')" class="delivery-note">
                    <span class="delivery-note-label">Clarity</span>
                    <p>{{ deliveryNote(idx, 'clarity') }}</p>
                  </div>
                </div>
              </div>

              <!-- Content dimension -->
              <div v-if="showContent" class="llm-dimension">
                <div class="llm-dimension-header">
                  <span>Answer evaluation</span>
                  <span v-if="typeof perQuestionLLM(idx).contentScore === 'number'" class="dimension-score">{{ perQuestionLLM(idx).contentScore }} / 10</span>
                </div>
                <div v-if="hasContentNotes(idx)" class="content-notes-grid">
                  <div v-if="contentNote(idx, 'correctness')" class="content-note">
                    <span class="content-note-label">Correctness</span>
                    <p>{{ contentNote(idx, 'correctness') }}</p>
                  </div>
                  <div v-if="contentNote(idx, 'completeness')" class="content-note">
                    <span class="content-note-label">Completeness</span>
                    <p>{{ contentNote(idx, 'completeness') }}</p>
                  </div>
                  <div v-if="contentNote(idx, 'structure')" class="content-note">
                    <span class="content-note-label">Structure</span>
                    <p>{{ contentNote(idx, 'structure') }}</p>
                  </div>
                </div>
                <div v-if="(perQuestionLLM(idx).keyPointsHit && perQuestionLLM(idx).keyPointsHit.length) || (perQuestionLLM(idx).keyPointsMissed && perQuestionLLM(idx).keyPointsMissed.length)" class="llm-row">
                  <span class="llm-row-title">Key points vs reference</span>
                  <div class="coverage-row">
                    <div v-if="perQuestionLLM(idx).keyPointsHit && perQuestionLLM(idx).keyPointsHit.length">
                      <strong>Hit:</strong>
                      <ul class="chip-list inline">
                        <li v-for="h in perQuestionLLM(idx).keyPointsHit" :key="'h-' + h" class="chip">{{ h }}</li>
                      </ul>
                    </div>
                    <div v-if="perQuestionLLM(idx).keyPointsMissed && perQuestionLLM(idx).keyPointsMissed.length">
                      <strong>Missed:</strong>
                      <ul class="chip-list inline">
                        <li v-for="m in perQuestionLLM(idx).keyPointsMissed" :key="'m-' + m" class="chip">{{ m }}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Strengths / weaknesses (always show when present) -->
              <div v-if="perQuestionLLM(idx).strengths && perQuestionLLM(idx).strengths.length" class="llm-row">
                <span class="llm-row-title">Strengths</span>
                <ul><li v-for="(b, i) in perQuestionLLM(idx).strengths" :key="i">{{ b }}</li></ul>
              </div>
              <div v-if="perQuestionLLM(idx).weaknesses && perQuestionLLM(idx).weaknesses.length" class="llm-row">
                <span class="llm-row-title">Weaknesses</span>
                <ul><li v-for="(b, i) in perQuestionLLM(idx).weaknesses" :key="i">{{ b }}</li></ul>
              </div>

              <!-- Improvements dimension -->
              <div v-if="showImprovements && perQuestionLLM(idx).improvements && perQuestionLLM(idx).improvements.length" class="llm-row">
                <span class="llm-row-title">Improvement plan</span>
                <ol class="improvement-list">
                  <li v-for="(b, i) in perQuestionLLM(idx).improvements" :key="i">{{ b }}</li>
                </ol>
              </div>
              <div v-if="perQuestionLLM(idx).tryNext" class="llm-row">
                <span class="llm-row-title">Top thing to try next time</span>
                <p>{{ perQuestionLLM(idx).tryNext }}</p>
              </div>
            </div>

            <!-- Stat-derived feedback bullets (Pace / Fillers / Length) -->
            <div v-if="analysisMode !== 'none' && hasTranscriptContent(transcriptObj)" class="summary-data-item">
              <label>Quick Feedback</label>
              <FeedbackSection
                  :transcript="transcriptObj"
                  :reference-answer="localInterviewQA[idx]?.answer || ''"
              />
            </div>

          </div>
        </div>
      </div>
    </div>

    <!-- Analysis-type selector — pops up when the user clicks Generate
         Detailed Analysis. Lets them pick which dimensions to evaluate. -->
    <transition name="modal-fade">
      <div
          v-if="showTypeSelector"
          class="metrics-modal-overlay"
          @click.self="cancelTypeSelector"
      >
        <div class="metrics-modal type-selector-modal" role="dialog">
          <div class="metrics-modal-header">
            <h3>{{ typeSelectorIsRegenerate ? 'Generate detailed analysis again' : 'Generate detailed analysis' }}</h3>
            <button
                type="button"
                class="metrics-modal-close"
                aria-label="Close"
                @click="cancelTypeSelector"
            ><i class="el-icon-close"></i></button>
          </div>
          <div class="metrics-modal-body">
            <p class="type-selector-intro">
              Pick what you want analyzed. You can include one, two, or all three. The more you pick, the slower it runs.
            </p>
            <div class="type-option" :class="{ 'is-checked': selectedAnalysisTypes.delivery }" @click="toggleType('delivery')">
              <input type="checkbox" :checked="selectedAnalysisTypes.delivery" @click.stop @change="toggleType('delivery')" />
              <div class="type-option-body">
                <div class="type-option-title">Delivery quality</div>
                <p class="type-option-desc">Grammar, tone, fillers, pace, and clarity. Evaluates how you spoke, not whether your answer was right.</p>
              </div>
            </div>
            <div class="type-option" :class="{ 'is-checked': selectedAnalysisTypes.content }" @click="toggleType('content')">
              <input type="checkbox" :checked="selectedAnalysisTypes.content" @click.stop @change="toggleType('content')" />
              <div class="type-option-body">
                <div class="type-option-title">Answer evaluation</div>
                <p class="type-option-desc">Whether your answer was correct, complete, and well-structured. Compares against the reference answer.</p>
              </div>
            </div>
            <div class="type-option" :class="{ 'is-checked': selectedAnalysisTypes.improvements }" @click="toggleType('improvements')">
              <input type="checkbox" :checked="selectedAnalysisTypes.improvements" @click.stop @change="toggleType('improvements')" />
              <div class="type-option-body">
                <div class="type-option-title">Improvement plan</div>
                <p class="type-option-desc">Concrete things you should practice next time, ranked by impact.</p>
              </div>
            </div>
            <div class="type-selector-actions">
              <el-button size="small" @click="cancelTypeSelector">Cancel</el-button>
              <el-button
                  size="small"
                  type="primary"
                  :disabled="!hasAnyTypeSelected"
                  @click="confirmTypeSelector"
              >
                Generate
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Detailed-feedback help modal -->
    <transition name="modal-fade">
      <div
          v-if="showFeedbackHelp"
          class="metrics-modal-overlay"
          @click.self="showFeedbackHelp = false"
      >
        <div class="metrics-modal" role="dialog">
          <div class="metrics-modal-header">
            <h3>What detailed analysis covers</h3>
            <button
                type="button"
                class="metrics-modal-close"
                aria-label="Close"
                @click="showFeedbackHelp = false"
            ><i class="el-icon-close"></i></button>
          </div>
          <div class="metrics-modal-body">
            <section class="help-section">
              <h4>What it evaluates</h4>
              <p>Detailed analysis evaluates <strong>how you spoke</strong>, not whether your answer was correct. It listens to your delivery and rates it on the dimensions below. A wrong answer delivered with great composure can still earn a high score.</p>
            </section>
            <section class="help-section">
              <h4>For every question</h4>
              <ul>
                <li><strong>A delivery score from 1 to 10.</strong> Based on grammar, tone, fillers, pace, and clarity. Not based on whether the answer was right.</li>
                <li><strong>Grammar.</strong> Sentence structure, agreement, broken phrases, awkward constructions.</li>
                <li><strong>Tone.</strong> Whether you sounded confident, hesitant, professional, casual, or monotone.</li>
                <li><strong>Fillers.</strong> How filler words and verbal tics affected your answer.</li>
                <li><strong>Pace.</strong> Whether you sounded rushed, slow, choppy, or smooth.</li>
                <li><strong>Clarity.</strong> Structure and organization. Did you ramble or get to the point.</li>
                <li><strong>Try this next time.</strong> One concrete delivery improvement you can practice.</li>
              </ul>
            </section>
            <section class="help-section">
              <h4>For the whole session</h4>
              <ul>
                <li><strong>Strongest area.</strong> One sentence on the strongest aspect of your delivery, with evidence.</li>
                <li><strong>Growth area.</strong> One sentence on the biggest delivery growth area, with evidence.</li>
                <li><strong>Patterns observed.</strong> Delivery habits noticed across multiple answers.</li>
                <li><strong>Overall verdict.</strong> A one-sentence read on your delivery for the session.</li>
              </ul>
            </section>
            <section class="help-section">
              <h4>Once generated</h4>
              <p>Detailed analysis is saved with this interview. You can switch back to the basic view any time, and switch back to detailed without rerunning. Click Regenerate if you want a fresh take.</p>
            </section>
          </div>
        </div>
      </div>
    </transition>

    <!-- Metrics help modal -->
    <transition name="modal-fade">
      <div
          v-if="showMetricsHelp"
          class="metrics-modal-overlay"
          @click.self="showMetricsHelp = false"
      >
        <div class="metrics-modal" role="dialog" aria-labelledby="metrics-modal-title">
          <div class="metrics-modal-header">
            <h3 id="metrics-modal-title">How to read this summary</h3>
            <button
                type="button"
                class="metrics-modal-close"
                aria-label="Close"
                @click="showMetricsHelp = false"
            ><i class="el-icon-close"></i></button>
          </div>

          <div class="metrics-modal-body">
            <section class="help-section">
              <h4>Overall verdict</h4>
              <p>The verdict pill at the top reflects how you delivered, not what you said. It looks at two things: pace and filler-word usage.</p>
              <ul>
                <li><strong class="tone-good">Strong.</strong> Natural pace and low filler usage across the session.</li>
                <li><strong class="tone-ok">Solid.</strong> Mostly steady delivery, with one of the two areas outside the natural range.</li>
                <li><strong class="tone-bad">Needs work.</strong> Both pace and fillers are off in many answers.</li>
              </ul>
              <p class="help-note">The verdict description below the pill tells you exactly which numbers led to that label.</p>
            </section>

            <section class="help-section">
              <h4>Pace (Words Per Minute)</h4>
              <p>How fast you spoke. Calculated as words spoken divided by speaking duration.</p>
              <ul>
                <li><strong class="tone-warn">Below 110 WPM.</strong> Sounds slow or hesitant. Try to commit to your sentences without long pauses mid-thought.</li>
                <li><strong class="tone-good">110 to 180 WPM.</strong> Natural conversational rhythm. This is where you want to be in most interviews.</li>
                <li><strong class="tone-warn">Above 180 WPM.</strong> Sounds rushed. Slow down, especially on technical names and key conclusions.</li>
              </ul>
            </section>

            <section class="help-section">
              <h4>Filler words</h4>
              <p>Words and phrases used as verbal "spacers" when you're thinking. They don't add meaning. Common ones include <em>um, uh, like, you know, kind of, sort of, basically, actually</em>. We count both single words and short phrases.</p>
              <ul>
                <li><strong class="tone-good">Under 5% of your speech.</strong> Polished delivery.</li>
                <li><strong class="tone-warn">5 to 15%.</strong> Noticeable, but not distracting.</li>
                <li><strong class="tone-bad">Over 15%.</strong> Distracting and worth practicing. The fix is usually pausing instead of saying "um".</li>
              </ul>
            </section>

            <section class="help-section">
              <h4>Per-question delivery score (1 to 10)</h4>
              <p>Only shown when detailed analysis has been generated. The score reflects <em>how you spoke</em>, not whether your answer was right. Higher scores mean cleaner grammar, steadier tone, fewer fillers, a natural pace, and a clear structure.</p>
              <ul>
                <li><strong>1 to 3.</strong> Heavy fillers, broken sentences, monotone or rushed. Hard to follow.</li>
                <li><strong>4 to 6.</strong> Understandable but uneven — noticeable fillers, off pace, or weak structure.</li>
                <li><strong>7 to 8.</strong> Confident and clear delivery with only minor delivery hiccups.</li>
                <li><strong>9 to 10.</strong> Polished, composed, well-paced. Sounds practiced and assured.</li>
              </ul>
            </section>

            <section class="help-section">
              <h4>Basic Analysis chips</h4>
              <p>Word-level patterns extracted from your transcript.</p>
              <ul>
                <li><strong>Most repeated.</strong> Content words you used many times. Useful for spotting overuse.</li>
                <li><strong>Repeated phrases.</strong> Two- or three-word phrases you used more than once. Catches verbal tics like "I think" or "kind of like".</li>
                <li><strong>Fillers used.</strong> Actual filler words and phrases you used, ranked by frequency.</li>
                <li><strong>Words not in reference.</strong> Content words you said that aren't in the reference answer. Helpful for spotting tangents.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { getTranscripts, saveTranscripts, getInterviewQA, getQuestionTimestamps, getInterviewMeta, saveInterviewMeta, setAnalysisMode } from '@/store/interviewStore';
import { highlightTranscript } from '@/utils/transcriptUtils';
import {
  wordCount,
  fillerCount,
  fillerPercent,
  paceWpm,
  answerDurationSec,
  formatDuration,
  aggregateStats,
  overallVerdict,
  deliveryRating,
  scoreBand
} from '@/utils/summaryStats';
import {
  topRepeatedWords,
  topRepeatedPhrases,
  topFillerWordsUsed,
  extraWordsNotInReference,
  sessionTopFillerWords,
  sessionExtraWordsNotInReference
} from '@/utils/basicAnalysis';
import { getSetting } from '@/store/settingStore';
import { getVideoForSession, getRecordingForSession, listRecordedAnswerIndices } from '@/store/recordingStore.js';
import { analyzeInterviewSession } from '@/services/openaiAnalysisService';
import { saveCompletedSession, updateHistoryEntry, getSessionById, deleteSession } from '@/store/interviewHistoryStore';
import interviewApi from '@/services/interviewApi';
import { transcribeAllAnswers, hasPendingTranscriptions } from '@/services/batchTranscribeService';
import { claimDailyTranscribe, checkDailyTranscribeAllowance } from '@/services/interviewApi';
import { setActiveEnrollmentId, clearActiveEnrollmentId } from '@/services/activeEnrollment';
import authService from '@/services/authService';
import { ROLE_GROUPS, hasAnyRole } from '@/constants/roles';
import FeedbackSection from '@/views/FeedbackSection.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

export default {
  name: 'SummaryView',
  components: { FeedbackSection, ConfirmDialog },
  props: {
    sessionId: { type: String, default: '' },
    embedded: { type: Boolean, default: false }
  },
  data() {
    return {
      transcripts: [],
      localInterviewQA: [],
      loadingTranscripts: true,
      enableVideo: false,
      recordedVideoUrl: '',
      videoTimeout: false,
      questionTimestamps: [],
      selectedVoice: '',
      analysisMode: 'none', // 'none' | 'basic' | 'full'
      completed: false,
      difficulty: '',
      category: 'All',
      candidateName: '',
      enrollmentId: '',
      sessionLabel: '',
      sessionStatus: '',
      createdAtMeta: '',
      updatedAtMeta: '',
      createdByMeta: '',
      updatedByMeta: '',
      createdByEmailMeta: '',
      updatedByEmailMeta: '',
      startedAt: '',
      endedAt: '',
      preferredKeywords: [],
      // Date the interview happened. ISO string. Comes from history
      // entry.savedAt on saved sessions, or live meta.startedAt for the
      // freshly-completed flow.
      interviewDate: '',
      editingTitle: false,
      titleDraft: '',
      expandedSet: {},      // map: idx → true when that card is open
      selectedQuestionIdx: null, // null = show all; number = show only that one
      showMetricsHelp: false,
      showFeedbackHelp: false,
      llmAnalysis: null,
      llmLoading: false,
      llmError: '',
      llmElapsedSec: 0,
      llmBatchProgress: { done: 0, total: 0 },
      ANALYSIS_BATCH_SIZE: 10,
      _llmTimerId: null,
      analysisFeatureEnabled: false,
      // Analysis-type selector modal state
      showTypeSelector: false,
      selectedAnalysisTypes: { delivery: true, content: true, improvements: true },
      // Captures what was actually generated, so the UI shows only the
      // sections the user asked for the last time they ran the analysis.
      activeAnalysisTypes: null,
      // Block to flash when the user clicks a corresponding stat tile.
      // Cleared after a short delay.
      highlightedBlock: '',
      _highlightTimerId: null,
      // Live progress of the batch transcription job. `total` is 0 when
      // there's nothing to do; non-zero values mean the batch is running.
      batchProgress: { done: 0, failed: 0, total: 0, complete: false },
      // True while a manual "Transcribe now" recovery is in flight, so the
      // recovery banner can show its own loading state.
      transcribeRecovering: false,
      historyEntryId: '',
      showTranscribeConfirm: false,
      dailyTranscribeUsed: false,
      recordedIndices: [],
      transcribeAllowanceChecked: false,
      // Session id for the audio currently being viewed. Set in
      // loadFromLiveSession (from interview meta) and loadFromHistory
      // (from the history entry id, which is the same value). Used to
      // scope the recording-store reads for recovery and playback.
      activeSessionId: '',
      isHistoryView: false,
      // Central playback state
      playback: { kind: null, idx: null },
      _segmentEnd: null,
      _segmentTimeUpdate: null,
      _currentAnswerAudio: null,
      _currentAnswerUrl: null,
    };
  },
  computed: {
    isStaff() {
      return hasAnyRole(authService.getUserRoles(), ROLE_GROUPS.STAFF);
    },
    isCandidateSession() {
      return !this.isStaff && !!this.enrollmentId;
    },
    hasAnyAudio() {
      return this.recordedIndices.length > 0;
    },
    allAnswered() {
      const total = (this.localInterviewQA && this.localInterviewQA.length) || this.transcripts.length;
      if (!total) return false;
      for (let i = 0; i < total; i++) {
        const t = this.transcripts[i];
        if (!t) return false;
        if (typeof t === 'object' && t.skipped) return false;
      }
      return true;
    },
    isLoading() {
      if (this.isHistoryView) return false; // history loads synchronously
      // Only block the page on the initial metadata + transcripts read.
      // Transcription itself is now manual via the Transcribe button.
      return this.loadingTranscripts;
    },
    loadingLabel() {
      return 'Loading your interview…';
    },
    loadingMessage() {
      return 'Reading your session data. This will only take a moment.';
    },
    displayTitle() {
      const name = (this.candidateName || '').trim();
      return name || 'Interview Summary';
    },
    interviewDateLabel() {
      const iso = this.interviewDate;
      if (!iso) return '';
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      } catch (e) {
        return '';
      }
    },
    aggregate() {
      return aggregateStats(this.transcripts);
    },
    verdict() {
      if (this.showDetailedAnalysis && this.averageContentScore !== null) {
        const band = scoreBand(this.averageContentScore);
        return {
          label: band.label,
          tone: band.tone,
          description: `Overall answer quality scored ${this.averageContentScore}/10 across the answered questions, graded against the reference answers.`
        };
      }
      return overallVerdict(this.aggregate);
    },
    hasAnyTranscript() {
      return this.analysisMode !== 'none' && this.aggregate.answeredCount > 0;
    },
    // True when detailed delivery analysis should be visible. Gates per-
    // question feedback, session insights, score pills, average delivery
    // score, and the focus list. Also hidden during regen so the previous
    // report doesn't flash next to the processing card.
    showDetailedAnalysis() {
      return !!this.llmAnalysis && !this.llmLoading;
    },
    lifecycleStatus() {
      const map = {
        ANALYZED: { label: 'Analyzed', tone: 'analyzed' },
        ENDED: { label: 'Ended', tone: 'ended' },
        ACTIVE: { label: 'Active', tone: 'active' }
      };
      const transcripts = Array.isArray(this.transcripts) ? this.transcripts : [];
      const analyzed = !!this.llmAnalysis || transcripts.some(t => {
        if (typeof t === 'string') return t && t !== '[Transcription error]';
        if (t && typeof t === 'object') return !t.pending && (!!t.text || (Array.isArray(t.words) && t.words.length > 0));
        return false;
      });
      if (analyzed) return map.ANALYZED;
      if (this.sessionStatus && map[this.sessionStatus]) return map[this.sessionStatus];
      return map.ENDED;
    },
    createdByTooltip() {
      const who = this.createdByEmailMeta || this.createdByMeta;
      return who ? `Created by: ${who}` : '';
    },
    updatedByTooltip() {
      const who = this.updatedByEmailMeta || this.updatedByMeta;
      return who ? `Updated by: ${who}` : '';
    },
    // CTA visible only when every prerequisite is satisfied:
    //   - feature enabled in profile,
    //   - the session has answers,
    //   - transcripts have been generated (no pending / errored slots),
    //   - no detailed analysis is already saved or running.
    // Hiding the button until transcripts exist makes the flow strictly
    // sequential — the user can't click into a state that needs work it
    // hasn't done yet.
    canRunLLMOnDemand() {
      const hasTranscripts = Array.isArray(this.transcripts) && this.transcripts.length > 0;
      return this.analysisFeatureEnabled
        && this.analysisMode !== 'none'
        && this.completed
        && hasTranscripts
        && !this.hasUnresolvedTranscripts
        && this.aggregate.answeredCount > 0
        && !this.llmAnalysis
        && !this.llmLoading
        && !this.llmError;
    },
    perQuestionScores() {
      if (!this.llmAnalysis || !Array.isArray(this.llmAnalysis.perQuestion)) return [];
      return this.llmAnalysis.perQuestion
        .map(q => (q && typeof q.score === 'number') ? q.score : null)
        .filter(s => s !== null);
    },
    averageContentScore() {
      const scores = this.perQuestionScores;
      if (!scores.length) return null;
      const sum = scores.reduce((a, b) => a + b, 0);
      return Math.round((sum / scores.length) * 10) / 10; // one decimal
    },
    averageContentScoreTone() {
      return scoreBand(this.averageContentScore).tone;
    },
    llmElapsedLabel() {
      const s = Math.max(0, this.llmElapsedSec);
      return `${s}s elapsed`;
    },
    hasAnyTypeSelected() {
      const t = this.selectedAnalysisTypes || {};
      return !!(t.delivery || t.content || t.improvements);
    },
    typeSelectorIsRegenerate() {
      return !!this.llmAnalysis;
    },
    activeTypes() {
      // Either the types saved with the last analysis, or default-on for
      // backwards-compat with sessions saved before multi-type.
      return this.activeAnalysisTypes
        || (this.llmAnalysis && this.llmAnalysis.analysisTypes)
        || { delivery: true, content: false, improvements: true };
    },
    showDelivery() { return !!this.activeTypes.delivery; },
    showContent() { return !!this.activeTypes.content; },
    showImprovements() { return !!this.activeTypes.improvements; },
    // Top three improvement focuses, pulled from the per-question
    // "tryNext" suggestions. Falls back to the session-level "growthArea"
    // sentence when those bullets aren't available.
    topImprovementFocus() {
      if (!this.llmAnalysis) return [];
      const out = [];
      const seen = new Set();
      const perQ = Array.isArray(this.llmAnalysis.perQuestion) ? this.llmAnalysis.perQuestion : [];
      // Collect the lowest-scored questions first so the most-needed
      // improvements bubble up.
      const ranked = perQ
        .map((q, idx) => ({ q, idx, score: (q && typeof q.score === 'number') ? q.score : 10 }))
        .sort((a, b) => a.score - b.score);
      for (const r of ranked) {
        const next = r.q && r.q.tryNext;
        if (!next || typeof next !== 'string') continue;
        const key = next.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ idx: r.idx, score: r.score, text: next.trim() });
        if (out.length >= 3) break;
      }
      return out;
    },
    allExpanded() {
      if (!this.transcripts.length) return false;
      for (let i = 0; i < this.transcripts.length; i++) {
        if (!this.expandedSet[i]) return false;
      }
      return true;
    },
    sessionTopFillers() {
      return sessionTopFillerWords(this.transcripts, 8);
    },
    sessionExtraWords() {
      return sessionExtraWordsNotInReference(this.transcripts, this.localInterviewQA, 12);
    },
    extraWordsDistinct() {
      return this.sessionExtraWords.length;
    },
    extraWordsTotalUses() {
      return this.sessionExtraWords.reduce((sum, w) => sum + (w.count || 0), 0);
    },
    // True when at least one answer is still pending or had a transcription
    // error. The recovery banner uses this to offer Transcribe-now.
    // Skipped slots are NOT unresolved — they're a deliberate "no audio"
    // marker, not something to retry.
    hasUnresolvedTranscripts() {
      if (!Array.isArray(this.transcripts) || !this.transcripts.length) return false;
      return this.transcripts.some(t => {
        if (typeof t === 'string' && t === '[Transcription error]') return true;
        if (t && typeof t === 'object' && t.pending) return true;
        return false;
      });
    },
    // Indices of slots that were ANSWERED (not skipped) but where the
    // LLM analysis is either missing or marked unavailable. Detected
    // post-hoc by reading the defensive fallback shape produced by
    // analyzeInterviewSession when the model returned fewer entries
    // than expected. Drives the "Complete missing analysis" banner.
    missingAnalysisIndices() {
      if (!this.llmAnalysis || !Array.isArray(this.llmAnalysis.perQuestion)) return [];
      const out = [];
      for (let i = 0; i < this.localInterviewQA.length; i++) {
        const t = this.transcripts[i];
        // Skipped slots are intentionally not analyzed — don't flag them.
        if (t && typeof t === 'object' && t.skipped) continue;
        // Need to be answered (real text or transcript object) to count
        // as eligible for analysis. Unanswered slots can't be analyzed.
        const isAnswered = wordCount(t) > 0;
        if (!isAnswered) continue;
        const slot = this.llmAnalysis.perQuestion[i];
        const slotMissing = !slot
          || slot.skipped
          || slot.score === null
          || (Array.isArray(slot.weaknesses)
              && slot.weaknesses.length === 1
              && slot.weaknesses[0] === 'Analysis unavailable for this question.');
        if (slotMissing) out.push(i);
      }
      return out;
    },
    hasMissingAnalysis() {
      return this.missingAnalysisIndices.length > 0;
    },
    // ─── Tile tones ─────────────────────────────────────────────────
    // Each tile in the Overall Performance grid gets a tone (good / ok /
    // bad / neutral) so the user can scan the numbers without reading
    // the values. Thresholds mirror what overallVerdict() already uses
    // so the tile colors and the verdict text stay in sync.

    // % of questions actually answered. With heavy skipped/no-answer
    // counts the rest of the aggregates are less meaningful, so we
    // colour this prominently.
    answeredTone() {
      const total = this.transcripts.length;
      if (!total) return 'neutral';
      const pct = (this.aggregate.answeredCount / total) * 100;
      if (pct >= 80) return 'good';
      if (pct >= 50) return 'ok';
      return 'bad';
    },
    // Pace: 110-180 WPM is the natural conversational band used by
    // overallVerdict. Drift far outside and the answer reads as rushed
    // or laboured.
    paceTileTone() {
      const wpm = this.aggregate.averagePaceWpm;
      if (!wpm) return 'neutral';
      if (wpm >= 110 && wpm <= 180) return 'good';
      if ((wpm >= 90 && wpm < 110) || (wpm > 180 && wpm <= 200)) return 'ok';
      return 'bad';
    },
    // Filler percentage. <5% reads as polished, <15% is acceptable,
    // anything above is a real delivery issue.
    fillerTileTone() {
      const pct = this.aggregate.fillerPercent;
      if (!this.aggregate.totalWords) return 'neutral';
      if (pct < 5) return 'good';
      if (pct < 15) return 'ok';
      return 'bad';
    },
    // Off-reference words count is informational — moderate counts often
    // mean fresh insight, very high counts mean off-topic. No "good"
    // because more isn't better.
    offReferenceTileTone() {
      const total = this.extraWordsTotalUses;
      if (!total) return 'neutral';
      if (total <= 10) return 'neutral';
      if (total <= 25) return 'ok';
      return 'bad';
    },
    detailedCtaMessage() {
      return 'Get detailed feedback on how you answered — grammar, tone, fillers, structure, plus correctness vs. the reference. Generated once, then saved.';
    },
    transcribePromptMessage() {
      const pending = this.transcripts.filter(t => t && typeof t === 'object' && t.pending).length;
      const failed = this.transcripts.filter(t => typeof t === 'string' && t === '[Transcription error]').length;
      const incomplete = !this.completed
        ? ' Your interview was stopped early — only the answers you recorded will be transcribed.'
        : '';
      if (failed && !pending) {
        return `${failed} answer${failed === 1 ? '' : 's'} couldn't be transcribed last time. Run them again to see your basic analysis.${incomplete}`;
      }
      if (pending && !failed) {
        return `Transcribe ${pending} recorded answer${pending === 1 ? '' : 's'} to unlock your basic analysis.${incomplete}`;
      }
      return `${pending} pending and ${failed} failed transcription${(pending + failed) === 1 ? '' : 's'}. Run them now?${incomplete}`;
    },
    // Compact 1-10 rating shown next to the Overall Performance title.
    // Falls back to a rule-based score (pace + fillers) when no detailed
    // analysis is available, so the chip is always present once any
    // answer has been transcribed.
    overallRating() {
      if (this.showDetailedAnalysis && this.averageContentScore !== null) {
        return this.averageContentScore;
      }
      return deliveryRating(this.aggregate);
    },
    overallRatingTone() {
      return scoreBand(this.overallRating).tone;
    },
    hasSpeakingPatterns() {
      return this.sessionTopFillers.length || this.sessionExtraWords.length;
    }
  },
  async mounted() {
    this.analysisFeatureEnabled = this.isStaff;

    if (this.sessionId) {
      await this.loadFromHistory(this.sessionId);
    } else {
      await this.loadFromLiveSession();
    }
    try {
      this.recordedIndices = await listRecordedAnswerIndices(this.activeSessionId);
    } catch (e) {
      this.recordedIndices = [];
    }
    if (this.isCandidateSession && this.allAnswered && this.hasUnresolvedTranscripts) {
      await this.refreshDailyTranscribeAllowance();
    }
  },
  watch: {
    showMetricsHelp(open) {
      if (open) {
        this._metricsEscHandler = (e) => { if (e.key === 'Escape') this.showMetricsHelp = false; };
        window.addEventListener('keydown', this._metricsEscHandler);
      } else if (this._metricsEscHandler) {
        window.removeEventListener('keydown', this._metricsEscHandler);
        this._metricsEscHandler = null;
      }
    },
    showFeedbackHelp(open) {
      if (open) {
        this._feedbackEscHandler = (e) => { if (e.key === 'Escape') this.showFeedbackHelp = false; };
        window.addEventListener('keydown', this._feedbackEscHandler);
      } else if (this._feedbackEscHandler) {
        window.removeEventListener('keydown', this._feedbackEscHandler);
        this._feedbackEscHandler = null;
      }
    }
  },
  beforeDestroy() {
    this.stopAllPlayback();
    this.stopLLMTimer();
    if (this._highlightTimerId) clearTimeout(this._highlightTimerId);
    if (this._metricsEscHandler) window.removeEventListener('keydown', this._metricsEscHandler);
    if (this._feedbackEscHandler) window.removeEventListener('keydown', this._feedbackEscHandler);
    if (this.recordedVideoUrl) {
      try { URL.revokeObjectURL(this.recordedVideoUrl); } catch (e) { /* noop */ }
      this.recordedVideoUrl = '';
    }
  },
  methods: {
    handleDetailCommand(cmd) {
      if (cmd === 'delete') this.confirmDelete();
    },
    async confirmDelete() {
      try {
        await this.$confirm('Delete this interview? This cannot be undone.', 'Delete interview', {
          confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning'
        });
      } catch (e) {
        return;
      }
      try {
        await deleteSession(this.activeSessionId);
        this.$router.push({ name: 'MyInterviews' });
      } catch (e) {
        if (this.$message) this.$message.error('Failed to delete interview.');
      }
    },
    fmtDateTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    },
    // Stat passthroughs for the template
    wordCount, fillerCount, fillerPercent, paceWpm, answerDurationSec, formatDuration,

    hasTranscriptContent(transcriptObj) {
      return wordCount(transcriptObj) > 0;
    },
    // True when an audio blob was recorded for this question, regardless
    // of whether it's been transcribed yet. The transcripts array slot
    // serves as a marker — AnswerRecorder writes a pending object only
    // after a non-empty MediaRecorder blob lands. This is what gates the
    // "Play Your Answer" button so it works before transcription too.
    hasAudioRecorded(idx) {
      return this.recordedIndices.includes(idx);
    },
    // Reduces the rich transcript shape to one of a handful of states so
    // the UI can render an accurate label + hint per question card. The
    // template uses this for both the meta pill and the empty-body line.
    transcriptState(t) {
      if (t === undefined || t === null) return 'missing';
      if (typeof t === 'string') {
        return t === '[Transcription error]' ? 'error' : 'missing';
      }
      if (t.skipped) return 'skipped';
      if (t.pending) return 'pending';
      if (t.text || (Array.isArray(t.words) && t.words.length)) return 'transcribed';
      // Transcription ran but AssemblyAI returned no speech — common when
      // the recorder captured background noise / breathing but no words.
      return 'empty';
    },
    transcriptStateLabel(t) {
      switch (this.transcriptState(t)) {
        case 'pending': return 'Awaiting transcription';
        case 'error': return 'Transcription failed';
        case 'skipped': return 'No spoken answer';
        case 'empty': return 'No spoken answer';
        default: return 'No answer';
      }
    },
    // Body line shown in place of the transcript when there's no real
    // text yet. For pending and error states it explicitly directs the
    // user to the Transcribe button at the top of the page — the most
    // common confusion was "audio plays but card says no answer".
    transcriptStateMessage(t) {
      switch (this.transcriptState(t)) {
        case 'pending':
          return 'Audio was recorded for this question. Click "Transcribe answers" at the top of the page to convert it to text.';
        case 'error':
          return 'Transcription failed for this question. Click "Transcribe answers" at the top to retry.';
        case 'empty':
          return 'No spoken answer was detected in the recording.';
        case 'skipped':
        default:
          return 'No spoken answer was recorded for this question.';
      }
    },
    isExpanded(idx) {
      return !!this.expandedSet[idx];
    },
    toggleExpanded(idx) {
      // Use $set so Vue's reactivity catches the new key.
      this.$set(this.expandedSet, idx, !this.expandedSet[idx]);
    },
    toggleAllExpanded() {
      const next = !this.allExpanded;
      const map = {};
      for (let i = 0; i < this.transcripts.length; i++) {
        if (next) map[i] = true;
      }
      this.expandedSet = map;
    },
    questionSnippet(idx) {
      const text = (this.localInterviewQA[idx] && this.localInterviewQA[idx].question) || '';
      if (text.length <= 90) return text;
      return text.slice(0, 87).trim() + '…';
    },
    selectQuestion(idx) {
      this.selectedQuestionIdx = idx;
      // Auto-expand the selected card so the user lands on its details.
      this.$set(this.expandedSet, idx, true);
    },
    selectAllQuestions() {
      this.selectedQuestionIdx = null;
    },
    jumperPillClass(idx) {
      const t = this.transcripts[idx];
      const cls = [];
      if (this.selectedQuestionIdx === idx) cls.push('jumper-pill-active');
      if (!this.hasTranscriptContent(t) && this.analysisMode !== 'none') cls.push('jumper-pill-empty');
      return cls.join(' ');
    },
    paceHint(transcriptObj) {
      const wpm = paceWpm(transcriptObj);
      if (!wpm) return '—';
      if (wpm < 110) return 'a bit slow';
      if (wpm > 180) return 'a bit rushed';
      return 'natural rhythm';
    },
    paceTone(transcriptObj) {
      const wpm = paceWpm(transcriptObj);
      if (!wpm) return 'tone-neutral';
      if (wpm < 110 || wpm > 180) return 'tone-warn';
      return 'tone-good';
    },
    fillerHint(transcriptObj) {
      const pct = fillerPercent(transcriptObj);
      if (pct < 5) return 'polished';
      if (pct < 15) return 'noticeable';
      return 'too many';
    },
    fillerTone(transcriptObj) {
      const pct = fillerPercent(transcriptObj);
      if (pct < 5) return 'tone-good';
      if (pct < 15) return 'tone-warn';
      return 'tone-bad';
    },
    safeHighlight(transcriptObj) {
      return highlightTranscript(transcriptObj);
    },

    async loadFromLiveSession() {
      this.isHistoryView = false;
      this.localInterviewQA = await getInterviewQA() || [];
      this.enableVideo = await getSetting('enableVideo');
      this.selectedVoice = (await getSetting('selectedVoice')) || '';
      this.questionTimestamps = await getQuestionTimestamps();

      const meta = await getInterviewMeta();
      this.analysisMode = (meta && meta.analysisMode) || 'none';
      this.completed = !!(meta && meta.completed);
      this.difficulty = (meta && meta.difficulty) || '';
      this.category = (meta && meta.category) || 'All';
      this.candidateName = (meta && meta.candidateName) || '';
      this.enrollmentId = (meta && meta.enrollmentId) || '';
      this.sessionLabel = (meta && meta.label) || '';
      this.startedAt = (meta && meta.startedAt) || '';
      this.endedAt = (meta && meta.endedAt) || '';
      this.preferredKeywords = (meta && Array.isArray(meta.preferredKeywords)) ? meta.preferredKeywords : [];
      this.interviewDate = (meta && (meta.endedAt || meta.startedAt)) || '';
      this.activeSessionId = (meta && meta.sessionId) || '';

      // Live flow: VideoRecorder writes the blob async in onstop, so we
      // poll briefly. Without a sessionId we skip polling (there's no
      // scoped key to look for).
      this.loadVideoForActiveSession({ poll: !!this.activeSessionId });
      this.checkTranscriptionStatus();
    },

    async loadFromHistory(id) {
      this.isHistoryView = true;
      const entry = await getSessionById(id);
      if (!entry) {
        this.loadingTranscripts = false;
        return;
      }
      this.historyEntryId = entry.id;
      // History entry id IS the session id — they're minted from the same
      // value at interview start (see getOrCreateInterviewSessionId).
      // Older entries written before that change still match because
      // saveCompletedSession's id field has always been the session key.
      this.activeSessionId = entry.id || '';
      this.localInterviewQA = entry.qaList || [];
      this.transcripts = entry.transcripts || [];
      this.questionTimestamps = entry.questionTimestamps || [];
      this.analysisMode = entry.analysisMode || 'none';
      this.completed = entry.completed === true;
      this.sessionStatus = entry.status || '';
      this.createdAtMeta = entry.createdAt || '';
      this.updatedAtMeta = entry.updatedAt || '';
      this.createdByMeta = entry.createdBy || '';
      this.updatedByMeta = entry.updatedBy || '';
      this.createdByEmailMeta = entry.createdByEmail || '';
      this.updatedByEmailMeta = entry.updatedByEmail || '';
      this.candidateName = entry.candidateName || '';
      this.enrollmentId = entry.enrollmentId || '';
      this.preferredKeywords = Array.isArray(entry.preferredKeywords) ? entry.preferredKeywords : [];
      this.difficulty = entry.difficulty || '';
      this.category = entry.category || 'All';
      this.interviewDate = entry.endedAt || entry.startedAt || entry.createdAt || '';
      this.llmAnalysis = entry.llmAnalysis || null;
      this.activeAnalysisTypes = (this.llmAnalysis && this.llmAnalysis.analysisTypes) || null;
      this.selectedVoice = (await getSetting('selectedVoice')) || '';

      // Retroactive: legacy/broken interviews left undefined slots within
      // qaList range when AnswerRecorder bailed on a 0-size blob. Backfill
      // them as {skipped: true} so the cards render "No spoken answer"
      // instead of empty gaps, and persist the patch on the history entry.
      const patched = this.backfillSkippedSlots(this.transcripts, this.localInterviewQA.length);
      if (patched.changed) {
        this.transcripts = patched.transcripts;
        try {
          await updateHistoryEntry(this.historyEntryId, { transcripts: this.transcripts });
        } catch (e) { /* best-effort */ }
      }

      // Load this session's video (may be absent if pruned past the
      // 3-session video cap, in which case enableVideo stays false and
      // the UI shows "Video purged" instead of the player).
      await this.loadVideoForActiveSession({ poll: false });
      this.loadingTranscripts = false;
    },

    // Pure helper: fill `undefined` / `null` slots within the qaList range
    // with a `{skipped: true}` marker. Returns a new array if anything
    // changed plus a flag so callers know whether to persist.
    backfillSkippedSlots(transcripts, totalQuestions) {
      const src = Array.isArray(transcripts) ? transcripts : [];
      const out = src.slice();
      let changed = false;
      for (let i = 0; i < totalQuestions; i++) {
        if (out[i] === undefined || out[i] === null) {
          out[i] = { text: '', words: [], sentiment_analysis_results: [], skipped: true };
          changed = true;
        }
      }
      return { transcripts: out, changed };
    },

    // Load the video for the currently-displayed session. Works for both
    // the live summary (where the blob may still be writing — poll up to
    // 20s) and the history view (where it's either there or it isn't —
    // it might have been pruned past the video retention cap).
    async loadVideoForActiveSession({ poll = false, retries = 20, interval = 1000 } = {}) {
      // Always revoke any prior blob URL before reassigning — otherwise a
      // 200 MB video stays pinned in memory until the tab closes.
      const releasePrior = () => {
        if (this.recordedVideoUrl) {
          try { URL.revokeObjectURL(this.recordedVideoUrl); } catch (e) { /* noop */ }
        }
      };
      if (!this.activeSessionId) {
        releasePrior();
        this.recordedVideoUrl = '';
        this.videoTimeout = !poll ? false : true;
        return;
      }
      const attempts = poll ? retries : 1;
      for (let i = 0; i < attempts; i++) {
        const videoBlob = await getVideoForSession(this.activeSessionId);
        if (videoBlob) {
          releasePrior();
          this.recordedVideoUrl = URL.createObjectURL(videoBlob);
          this.enableVideo = true;
          return;
        }
        if (poll && i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }
      releasePrior();
      this.recordedVideoUrl = '';
      // Only flag a "timeout" in live mode — in history a missing video
      // just means it was pruned, which we render differently.
      this.videoTimeout = !!poll;
    },
    async checkTranscriptionStatus() {
      // No more auto-polling. Transcription is purely manual now —
      // whatever transcripts are already on disk get rendered, and the
      // Transcribe button drives any new work. We just read the current
      // state once and hand off.
      this.transcripts = (await getTranscripts()) || [];
      this.loadingTranscripts = false;
      await this.afterTranscriptsReady();
    },

    // Once transcripts have landed (or we know there won't be any),
    // save to history and trigger LLM analysis if applicable.
    async afterTranscriptsReady() {
      if (this.isHistoryView) return;

      // Save to history regardless of completion. Incomplete sessions
      // still preserve whatever was answered + recorded so the candidate
      // can come back, transcribe later, and review.
      if (this.localInterviewQA && this.localInterviewQA.length) {
        try {
          this.historyEntryId = await saveCompletedSession({
            // Reuse the session id minted at interview start so the
            // history entry's id matches the recording keys on disk.
            id: this.activeSessionId || undefined,
            difficulty: this.difficulty,
            category: this.category,
            analysisMode: this.analysisMode,
            candidateName: this.candidateName,
            enrollmentId: this.enrollmentId,
            label: this.sessionLabel,
            startedAt: this.startedAt,
            endedAt: this.endedAt,
            qaList: this.localInterviewQA,
            transcripts: this.transcripts,
            questionTimestamps: this.questionTimestamps,
            completed: !!this.completed,
            llmAnalysis: null
          });
          if (!this.activeSessionId) this.activeSessionId = this.historyEntryId;
        } catch (e) {
          console.error('Failed to save session to history:', e);
        }
      }

      // Detailed (LLM) analysis is now strictly on-demand for every
      // interview type. The user triggers it from the Summary screen via
      // the Generate Detailed Analysis button.
    },

    // Opens the analysis-type selector modal. `isRegen` is informational;
    // the modal title changes but the underlying flow is the same — the
    // user picks types, confirms, and runLLMAnalysis(force=true) runs.
    openTypeSelector(isRegen) {
      if (this.llmLoading) return;
      // Pre-fill the checkboxes with the most recent selection if we have
      // one, otherwise default to all-on.
      const last = this.activeAnalysisTypes
        || (this.llmAnalysis && this.llmAnalysis.analysisTypes)
        || null;
      this.selectedAnalysisTypes = last
        ? { delivery: !!last.delivery, content: !!last.content, improvements: !!last.improvements }
        : { delivery: true, content: true, improvements: true };
      // If for some reason all three end up unchecked (legacy data),
      // default to delivery so the Generate button is enabled.
      if (!this.selectedAnalysisTypes.delivery
          && !this.selectedAnalysisTypes.content
          && !this.selectedAnalysisTypes.improvements) {
        this.selectedAnalysisTypes.delivery = true;
      }
      this.showTypeSelector = true;
      // isRegen is implied by !!this.llmAnalysis; nothing to store here.
      void isRegen;
    },
    cancelTypeSelector() {
      this.showTypeSelector = false;
    },
    toggleType(key) {
      this.selectedAnalysisTypes = {
        ...this.selectedAnalysisTypes,
        [key]: !this.selectedAnalysisTypes[key]
      };
    },
    confirmTypeSelector() {
      if (!this.hasAnyTypeSelected) return;
      this.showTypeSelector = false;
      const types = { ...this.selectedAnalysisTypes };
      this.runLLMAnalysis(true, types);
    },
    async runLLMAnalysis(force = false, analysisTypes = null) {
      if (this.llmLoading) return;
      if (!force && this.llmAnalysis) return;
      const isRegenerate = !!this.llmAnalysis;
      // Default to all-on if the caller didn't pass anything (e.g. legacy
      // entry point). The modal always passes an explicit choice now.
      const types = analysisTypes
        || this.activeAnalysisTypes
        || (this.llmAnalysis && this.llmAnalysis.analysisTypes)
        || { delivery: true, content: true, improvements: true };

      // Defensive gate: refuse to call the LLM without transcripts. The
      // CTA is hidden in this state, but we double-check here so a stale
      // open type-selector modal can't dispatch a no-op request.
      if (!this.isHistoryView && this.hasUnresolvedTranscripts) {
        this.notify('Transcribe your answers first.', 'warning');
        return;
      }
      this.llmLoading = true;
      this.llmError = '';
      this.llmBatchProgress = { done: 0, total: 0 };
      this.startLLMTimer();
      // Make the processing card visible immediately so the user sees
      // something happen, even if they were scrolled down.
      this.$nextTick(() => {
        const node = this.$refs.processingCard;
        if (node && node.scrollIntoView) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      this.notify(isRegenerate ? 'Regenerating detailed analysis…' : 'Generating detailed analysis…', 'info');
      try {
        const total = (this.localInterviewQA && this.localInterviewQA.length) || 0;
        // Long interviews exceed the proxy's per-request timeout in one call,
        // so analyze in batches that each finish well under it.
        const result = total > this.ANALYSIS_BATCH_SIZE
          ? await this.analyzeInBatches(types)
          : await analyzeInterviewSession({
              qaList: this.localInterviewQA,
              transcripts: this.transcripts,
              difficulty: this.difficulty,
              category: this.category,
              analysisTypes: types
            });
        // Tag the result with the types we actually requested so the UI
        // knows which sections to show, even on subsequent page loads.
        if (result && typeof result === 'object') {
          result.analysisTypes = { ...types };
        }
        this.activeAnalysisTypes = { ...types };
        this.llmAnalysis = result;
        // Promote the session to 'full' analysis mode. This is what makes
        // the on-demand CTA path stick — once detailed runs, the session
        // is treated as detailed everywhere (header chip, MyInterviews
        // mode label, future page loads).
        const wasUpgrade = this.analysisMode !== 'full';
        if (wasUpgrade) {
          this.analysisMode = 'full';
          if (!this.isHistoryView) {
            setAnalysisMode('full').catch(() => {});
          }
        }
        if (this.historyEntryId) {
          const patch = { llmAnalysis: result };
          if (wasUpgrade) patch.analysisMode = 'full';
          try {
            await interviewApi.updateSession(this.historyEntryId, patch);
          } catch (e) {
            this.notify('Analysis generated but could not be saved — please try again.', 'error');
            return;
          }
        }
        this.notify(isRegenerate ? 'Detailed analysis regenerated.' : 'Detailed analysis is ready.', 'success');
      } catch (e) {
        console.error('LLM analysis failed:', e);
        this.llmError = e.message || 'Unknown error';
        this.notify(`Could not generate detailed analysis. ${this.llmError}`, 'error');
      } finally {
        this.llmLoading = false;
        this.stopLLMTimer();
      }
    },
    // Runs analyze in sequential batches so each request stays under the
    // proxy timeout, then assembles a whole-interview result. perQuestion is
    // index-aligned to the full qaList; session insights are derived locally
    // since no single call sees the whole interview.
    async analyzeInBatches(types) {
      const total = this.localInterviewQA.length;
      const size = this.ANALYSIS_BATCH_SIZE;
      const perQuestion = new Array(total).fill(null);
      this.llmBatchProgress = { done: 0, total };
      for (let start = 0; start < total; start += size) {
        const idxs = [];
        for (let i = start; i < Math.min(start + size, total); i++) idxs.push(i);
        const partial = await analyzeInterviewSession({
          qaList: idxs.map(i => this.localInterviewQA[i]),
          transcripts: idxs.map(i => this.transcripts[i]),
          difficulty: this.difficulty,
          category: this.category,
          analysisTypes: types
        });
        (partial.perQuestion || []).forEach((slot, j) => {
          if (idxs[j] !== undefined) perQuestion[idxs[j]] = slot || null;
        });
        this.llmBatchProgress = { done: Math.min(start + size, total), total };
      }
      return { perQuestion, session: this.deriveSessionInsights(perQuestion) };
    },
    // Whole-interview insights rebuilt from the merged per-question results:
    // recurring weaknesses become patterns, delivery stats drive the verdict.
    deriveSessionInsights(perQuestion) {
      const counts = {};
      perQuestion.forEach(q => {
        if (q && Array.isArray(q.weaknesses)) {
          q.weaknesses.forEach(w => {
            if (w && w !== 'Analysis unavailable for this question.') {
              counts[w] = (counts[w] || 0) + 1;
            }
          });
        }
      });
      const patterns = Object.entries(counts)
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([w]) => w);
      const verdict = overallVerdict(aggregateStats(this.transcripts)).description;
      return { patterns, verdict };
    },
    startLLMTimer() {
      this.llmElapsedSec = 0;
      if (this._llmTimerId) clearInterval(this._llmTimerId);
      this._llmTimerId = setInterval(() => {
        this.llmElapsedSec += 1;
      }, 1000);
    },
    stopLLMTimer() {
      if (this._llmTimerId) {
        clearInterval(this._llmTimerId);
        this._llmTimerId = null;
      }
    },
    notify(message, type) {
      if (this.$message) {
        this.$message({ message, type, duration: type === 'error' ? 5000 : 2500 });
      }
    },

    // Refill missing per-question analysis by calling the LLM ONLY for
    // the questions that lack analysis, then MERGING those new entries
    // back into the existing llmAnalysis.perQuestion. Two properties
    // this gives us that a full re-run did not:
    //   1) Already-good entries are preserved verbatim, so the count of
    //      missing slots only ever decreases — a non-deterministic LLM
    //      response cannot remove data the user already had.
    //   2) Cost is roughly proportional to the gap, not the whole session
    //      (sending 2 questions ≈ 1/15th of sending 30).
    // The session-level summary (strongestArea, patterns, etc.) is left
    // alone for the same reason: it was generated from the full session
    // originally, and re-deriving it from a 1-question slice would be
    // worse than keeping the original.
    async completeMissingAnalysis() {
      if (this.llmLoading || this.transcribeRecovering) return;
      const missingIndices = [...this.missingAnalysisIndices];
      if (!missingIndices.length) return;

      const types = this.activeAnalysisTypes
        || (this.llmAnalysis && this.llmAnalysis.analysisTypes)
        || { delivery: true, content: true, improvements: true };

      this.llmLoading = true;
      this.llmError = '';
      this.startLLMTimer();
      this.notify(`Analyzing ${missingIndices.length} missing question${missingIndices.length === 1 ? '' : 's'}…`, 'info');

      try {
        const partialQaList = missingIndices.map(i => this.localInterviewQA[i]);
        const partialTranscripts = missingIndices.map(i => this.transcripts[i]);

        const partialResult = await analyzeInterviewSession({
          qaList: partialQaList,
          transcripts: partialTranscripts,
          difficulty: this.difficulty,
          category: this.category,
          analysisTypes: types
        });

        const existing = this.llmAnalysis || {};
        const mergedPerQuestion = Array.isArray(existing.perQuestion)
          ? existing.perQuestion.slice()
          : new Array(this.localInterviewQA.length).fill(null);

        // Only overwrite the missing slots, and only if the new entry is
        // an actual analysis (not another "unavailable" stub). This is
        // the property that makes the count monotonically decrease.
        let filled = 0;
        (partialResult.perQuestion || []).forEach((slot, j) => {
          const origIdx = missingIndices[j];
          if (!slot || slot.skipped) return;
          const stillUnavailable = Array.isArray(slot.weaknesses)
            && slot.weaknesses.length === 1
            && slot.weaknesses[0] === 'Analysis unavailable for this question.';
          if (slot.score === null || stillUnavailable) return;
          mergedPerQuestion[origIdx] = slot;
          filled++;
        });

        this.llmAnalysis = {
          ...existing,
          perQuestion: mergedPerQuestion,
          analysisTypes: existing.analysisTypes || types
        };
        this.activeAnalysisTypes = this.llmAnalysis.analysisTypes;

        if (this.historyEntryId) {
          updateHistoryEntry(this.historyEntryId, { llmAnalysis: this.llmAnalysis }).catch(() => {});
        }

        const remaining = missingIndices.length - filled;
        if (filled === 0) {
          this.notify('Could not analyze those questions this time. Try again in a moment.', 'warning');
        } else if (remaining > 0) {
          this.notify(`Filled ${filled} — ${remaining} still missing. Try again to retry the rest.`, 'warning');
        } else {
          this.notify('All missing analysis filled in.', 'success');
        }
      } catch (e) {
        console.error('completeMissingAnalysis failed:', e);
        this.llmError = e.message || 'Unknown error';
        this.notify(`Could not complete missing analysis. ${this.llmError}`, 'error');
      } finally {
        this.llmLoading = false;
        this.stopLLMTimer();
      }
    },

    // User-driven transcription. Called from the Transcribe button in the
    // primary banner, and indirectly from runLLMAnalysis when the user
    // jumps straight to detailed analysis without transcribing first.
    async transcribeNow() {
      const ok = await this._ensureTranscribed({ silent: false });
      if (ok) {
        await this.refreshHistorySnapshot();
      }
    },
    async refreshDailyTranscribeAllowance() {
      if (!this.isCandidateSession || !this.enrollmentId) return;
      setActiveEnrollmentId(this.enrollmentId);
      try {
        const allowed = await checkDailyTranscribeAllowance();
        this.dailyTranscribeUsed = !allowed;
        this.transcribeAllowanceChecked = true;
      } catch (e) {
        this.transcribeAllowanceChecked = true;
      } finally {
        clearActiveEnrollmentId();
      }
    },
    candidateTranscribe() {
      if (this.transcribeRecovering) return;
      if (!this.allAnswered) {
        this.notify('Please answer every question before transcribing.', 'warning');
        return;
      }
      this.showTranscribeConfirm = true;
    },
    async confirmCandidateTranscribe() {
      this.showTranscribeConfirm = false;
      setActiveEnrollmentId(this.enrollmentId);
      try {
        let allowed;
        try {
          allowed = await claimDailyTranscribe();
        } catch (e) {
          this.notify('The system is temporarily unavailable. Please try again in a little while.', 'error');
          return;
        }
        if (!allowed) {
          this.dailyTranscribeUsed = true;
          this.notify('You can transcribe once per day. Please try again tomorrow.', 'warning');
          return;
        }
        this.dailyTranscribeUsed = true;
        const ok = await this._ensureTranscribed({ silent: false });
        if (ok) await this.refreshHistorySnapshot();
      } finally {
        clearActiveEnrollmentId();
      }
    },
    // Internal helper. Runs the batch transcribe job, updates state, and
    // returns true on success. `silent` suppresses the success toast (used
    // when called as part of the Generate Detailed flow so we don't
    // double-notify).
    async _ensureTranscribed({ silent = false } = {}) {
      if (this.transcribeRecovering) return false;
      if (!this.analysisFeatureEnabled && !this.isCandidateSession) {
        this.notify('Transcription is not available for this session.', 'warning');
        return false;
      }
      this.transcribeRecovering = true;
      try {
        const total = (this.localInterviewQA && this.localInterviewQA.length) || this.transcripts.length;
        if (!total) {
          this.notify('No questions to transcribe.', 'warning');
          return false;
        }
        // In history view the live transcripts store may hold stale data
        // from a different session — pre-seed it with this entry's
        // snapshot so transcribeAllAnswers sees the right pending slots
        // and writes alongside (not overtop of) what's already here.
        if (this.isHistoryView) {
          await saveTranscripts([...this.transcripts]);
        }
        const pending = await hasPendingTranscriptions(total);
        if (!pending) {
          this.transcripts = (await getTranscripts()) || [];
          return true;
        }
        await transcribeAllAnswers({
          totalQuestions: total,
          sessionId: this.activeSessionId,
          onProgress: (p) => { this.batchProgress = { ...p }; }
        });
        this.transcripts = (await getTranscripts()) || [];
        const failed = this.batchProgress.failed || 0;
        if (failed > 0) {
          this.notify(`Transcription finished, but ${failed} answer${failed === 1 ? '' : 's'} couldn't be processed.`, 'warning');
        } else if (!silent) {
          this.notify('Transcription complete. Basic analysis is ready.', 'success');
        }
        return true;
      } catch (e) {
        console.error('[SummaryView] transcribeNow failed:', e);
        this.notify(e && e.message ? e.message : 'Transcription failed. Check your connection and try again.', 'error');
        return false;
      } finally {
        this.transcribeRecovering = false;
      }
    },
    // Refreshes the saved history entry with the latest transcripts so the
    // MyInterviews list (and any future re-open of this session) sees the
    // updated text + basic-analysis-derived numbers.
    async refreshHistorySnapshot() {
      if (!this.historyEntryId) return;
      try {
        await updateHistoryEntry(this.historyEntryId, {
          transcripts: this.transcripts,
          analysisMode: this.analysisMode
        });
      } catch (e) {
        console.warn('Could not refresh history snapshot:', e);
      }
    },

    // ─── Title rename ───────────────────────────────────────────────
    startEditTitle() {
      this.titleDraft = this.candidateName || '';
      this.editingTitle = true;
      this.$nextTick(() => {
        const inp = this.$refs.titleInput;
        if (inp && inp.focus) {
          inp.focus();
          if (inp.select) inp.select();
        }
      });
    },
    cancelTitle() {
      this.editingTitle = false;
      this.titleDraft = '';
    },
    async saveTitle() {
      if (!this.editingTitle) return; // already saved (blur fires after Enter)
      const next = (this.titleDraft || '').trim();
      this.editingTitle = false;
      this.titleDraft = '';
      if (next === (this.candidateName || '').trim()) return;
      this.candidateName = next;
      try {
        if (!this.isHistoryView) {
          // Live session — patch the meta we already loaded.
          const meta = await getInterviewMeta();
          await saveInterviewMeta({ ...(meta || {}), candidateName: next });
        }
      } catch (e) {
        console.warn('Failed to persist title to live meta:', e);
      }
      try {
        if (this.historyEntryId) {
          await updateHistoryEntry(this.historyEntryId, { candidateName: next });
        }
      } catch (e) {
        console.warn('Failed to persist title to history:', e);
      }
    },
    onClickFillers() {
      if (!this.hasSpeakingPatterns) return;
      this.scrollAndHighlight('fillers', this.$refs.fillersBlock);
    },
    onClickExtras() {
      if (!this.sessionExtraWords.length) return;
      this.scrollAndHighlight('extras', this.$refs.extrasBlock);
    },
    scrollAndHighlight(key, node) {
      const target = node || this.$refs.speakingPatternsCard;
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      this.highlightedBlock = key;
      if (this._highlightTimerId) clearTimeout(this._highlightTimerId);
      this._highlightTimerId = setTimeout(() => {
        this.highlightedBlock = '';
        this._highlightTimerId = null;
      }, 1800);
    },

    // ─── Basic analysis cached lookups ───
    topWordsFor(idx) {
      return topRepeatedWords(this.transcripts[idx]);
    },
    topPhrasesFor(idx) {
      return topRepeatedPhrases(this.transcripts[idx]);
    },
    topFillersFor(idx) {
      return topFillerWordsUsed(this.transcripts[idx]);
    },
    extraWordsFor(idx) {
      const ref = this.localInterviewQA[idx]?.answer || '';
      return extraWordsNotInReference(this.transcripts[idx], ref);
    },
    perQuestionLLM(idx) {
      if (!this.llmAnalysis || !Array.isArray(this.llmAnalysis.perQuestion)) return null;
      return this.llmAnalysis.perQuestion[idx] || null;
    },
    deliveryNote(idx, key) {
      const q = this.perQuestionLLM(idx);
      if (!q || !q.deliveryNotes) return '';
      const v = q.deliveryNotes[key];
      return typeof v === 'string' ? v.trim() : '';
    },
    hasDeliveryNotes(idx) {
      const q = this.perQuestionLLM(idx);
      if (!q || !q.deliveryNotes) return false;
      return ['grammar', 'tone', 'fillers', 'pace', 'clarity']
        .some(k => typeof q.deliveryNotes[k] === 'string' && q.deliveryNotes[k].trim());
    },
    contentNote(idx, key) {
      const q = this.perQuestionLLM(idx);
      if (!q || !q.contentNotes) return '';
      const v = q.contentNotes[key];
      return typeof v === 'string' ? v.trim() : '';
    },
    hasContentNotes(idx) {
      const q = this.perQuestionLLM(idx);
      if (!q || !q.contentNotes) return false;
      return ['correctness', 'completeness', 'structure']
        .some(k => typeof q.contentNotes[k] === 'string' && q.contentNotes[k].trim());
    },

    // ─── Playback management ───
    isPlayingVideoFor(idx) {
      return this.playback.kind === 'video' && this.playback.idx === idx;
    },
    isPlayingAnswerFor(idx) {
      return this.playback.kind === 'answer' && this.playback.idx === idx;
    },
    stopAllPlayback() {
      const video = this.$refs.summaryVideo;
      if (video) {
        if (!video.paused) video.pause();
        if (this._segmentTimeUpdate) {
          video.removeEventListener('timeupdate', this._segmentTimeUpdate);
        }
      }
      this._segmentTimeUpdate = null;
      this._segmentEnd = null;
      if (this._currentAnswerAudio) {
        try { this._currentAnswerAudio.pause(); } catch (e) { /* noop */ }
        this._currentAnswerAudio = null;
      }
      if (this._currentAnswerUrl) {
        try { URL.revokeObjectURL(this._currentAnswerUrl); } catch (e) { /* noop */ }
        this._currentAnswerUrl = null;
      }
      this.playback = { kind: null, idx: null };
    },
    toggleVideoSegment(idx) {
      if (this.isPlayingVideoFor(idx)) { this.stopAllPlayback(); return; }
      this.stopAllPlayback();
      const video = this.$refs.summaryVideo;
      if (!video) return;
      if (this.$refs.videoCard && this.$refs.videoCard.scrollIntoView) {
        this.$refs.videoCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const startSec = (this.questionTimestamps[idx] || 0) / 1000;
      const nextTs = this.questionTimestamps[idx + 1];
      const endSec = typeof nextTs === 'number' ? nextTs / 1000 : Infinity;
      this._segmentEnd = endSec;
      this._segmentTimeUpdate = () => {
        if (video.currentTime >= this._segmentEnd) this.stopAllPlayback();
      };
      video.addEventListener('timeupdate', this._segmentTimeUpdate);
      video.currentTime = startSec;
      video.play().catch(e => console.error('Video play error:', e));
      this.playback = { kind: 'video', idx };
    },
    async toggleYourAnswer(idx) {
      if (this.isPlayingAnswerFor(idx)) { this.stopAllPlayback(); return; }
      this.stopAllPlayback();
      try {
        const blob = await getRecordingForSession(this.activeSessionId, idx);
        if (!blob) {
          // No saved recording for this question — silently no-op.
          return;
        }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          if (this.isPlayingAnswerFor(idx)) this.stopAllPlayback();
        };
        audio.onerror = () => {
          if (this.isPlayingAnswerFor(idx)) this.stopAllPlayback();
        };
        this._currentAnswerAudio = audio;
        this._currentAnswerUrl = url;
        this.playback = { kind: 'answer', idx };
        await audio.play();
      } catch (e) {
        console.error('Could not play your answer:', e);
        this.stopAllPlayback();
      }
    },
    onVideoPaused() { if (this.playback.kind === 'video') this.stopAllPlayback(); },
    onVideoEnded() { if (this.playback.kind === 'video') this.stopAllPlayback(); },

    onMediaContextMenu(e) {
      if (!this.completed) e.preventDefault();
    },
    // ─── Downloads ───
    // Returns a filesystem-safe base name derived from the candidate
    // name (with whitespace collapsed to hyphens). Falls back to a
    // generic "interview" when no candidate name is set.
    fileBaseName() {
      const raw = (this.candidateName || 'interview').trim();
      const cleaned = raw
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
      return cleaned || 'interview';
    },
    handleDownloadCommand(cmd) {
      switch (cmd) {
        case 'video': this.handleDownloadVideo(); break;
        case 'transcripts': this.downloadTranscripts(); break;
        case 'analysis': this.downloadAnalysis(); break;
      }
    },
    handleDownloadVideo() {
      if (!this.recordedVideoUrl || !this.completed) return;
      const link = document.createElement('a');
      link.href = this.recordedVideoUrl;
      link.download = `${this.fileBaseName()}-recording.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    // Transcripts: the question + what the candidate actually said
    // (verbatim). No scores, no stats — purely "what was the
    // conversation". Skipped / pending / error states are marked
    // explicitly so the file is self-documenting.
    downloadTranscripts() {
      if (!this.localInterviewQA || !this.localInterviewQA.length) return;
      const sep = '='.repeat(60);
      const dash = '-'.repeat(40);
      const lines = [];
      lines.push('INTERVIEW TRANSCRIPTS');
      lines.push(sep);
      lines.push(`Candidate: ${this.candidateName || '—'}`);
      lines.push(`Date: ${this.interviewDateLabel || '—'}`);
      lines.push(`Difficulty: ${this.difficulty || '—'}`);
      lines.push(`Category: ${this.category || 'All'}`);
      lines.push(`Answered: ${this.aggregate.answeredCount} / ${this.localInterviewQA.length}`);
      lines.push('');

      this.localInterviewQA.forEach((qa, idx) => {
        lines.push(`QUESTION ${idx + 1}`);
        lines.push(dash);
        lines.push(`Q: ${qa.question || ''}`);
        const t = this.transcripts[idx];
        let answer;
        if (t == null) {
          answer = '[no spoken answer]';
        } else if (typeof t === 'string') {
          answer = t === '[Transcription error]' ? '[transcription failed]' : t;
        } else if (t.skipped) {
          answer = '[no spoken answer]';
        } else if (t.pending) {
          answer = '[pending — not yet transcribed]';
        } else {
          answer = (t.text || '').trim() || '[no spoken answer detected]';
        }
        lines.push(`Your answer: ${answer}`);
        if (qa.answer) {
          lines.push('');
          lines.push(`Reference answer: ${qa.answer}`);
        }
        lines.push('');
        lines.push('');
      });

      this._downloadTextFile(lines.join('\n'), `${this.fileBaseName()}-transcripts.txt`);
    },
    // Analysis: aggregate stats, verdict, and per-question LLM scoring
    // (when available). NO transcripts here — readers who want both
    // should download all, or use the transcripts-only file.
    downloadAnalysis() {
      const sep = '='.repeat(60);
      const dash = '-'.repeat(40);
      const lines = [];
      lines.push('INTERVIEW ANALYSIS');
      lines.push(sep);
      lines.push(`Candidate: ${this.candidateName || '—'}`);
      lines.push(`Date: ${this.interviewDateLabel || '—'}`);
      lines.push(`Difficulty: ${this.difficulty || '—'}`);
      lines.push(`Category: ${this.category || 'All'}`);
      lines.push(`Completed: ${this.completed ? 'yes' : 'no (stopped early)'}`);
      lines.push('');

      if (this.aggregate.answeredCount > 0) {
        lines.push('OVERALL');
        lines.push(dash);
        lines.push(`Questions answered: ${this.aggregate.answeredCount} / ${this.localInterviewQA.length || this.transcripts.length}`);
        lines.push(`Total speaking time: ${formatDuration(this.aggregate.totalDurationSec)}`);
        lines.push(`Avg pace: ${this.aggregate.averagePaceWpm} WPM`);
        lines.push(`Filler words: ${this.aggregate.totalFillers} (${this.aggregate.fillerPercent}%)`);
        lines.push(`Words spoken: ${this.aggregate.totalWords}`);
        lines.push(`Verdict: ${this.verdict.label}${this.verdict.description ? ' — ' + this.verdict.description : ''}`);
        lines.push('');
      } else {
        lines.push('No spoken answers were recorded — no aggregate stats available.');
        lines.push('');
      }

      if (this.llmAnalysis && this.llmAnalysis.session) {
        const s = this.llmAnalysis.session;
        lines.push('SESSION INSIGHTS');
        lines.push(dash);
        if (s.strongestArea) lines.push(`Strongest area: ${s.strongestArea}`);
        if (s.growthArea) lines.push(`Growth area: ${s.growthArea}`);
        if (Array.isArray(s.patterns) && s.patterns.length) {
          lines.push('Patterns:');
          for (const p of s.patterns) lines.push(`  - ${p}`);
        }
        if (s.verdict) lines.push(`Verdict: ${s.verdict}`);
        lines.push('');
      }

      if (this.llmAnalysis && Array.isArray(this.llmAnalysis.perQuestion)) {
        lines.push('PER-QUESTION SCORES');
        lines.push(sep);
        this.llmAnalysis.perQuestion.forEach((q, idx) => {
          const qText = (this.localInterviewQA[idx] && this.localInterviewQA[idx].question) || '';
          lines.push(`Q${idx + 1}: ${qText}`);
          if (!q || q.skipped) {
            lines.push('  (skipped — no spoken answer)');
          } else {
            if (q.score !== null && q.score !== undefined) lines.push(`  Score: ${q.score} / 10`);
            const dn = q.deliveryNotes || {};
            if (dn.grammar) lines.push(`  Grammar: ${dn.grammar}`);
            if (dn.tone) lines.push(`  Tone: ${dn.tone}`);
            if (dn.fillers) lines.push(`  Fillers: ${dn.fillers}`);
            if (dn.pace) lines.push(`  Pace: ${dn.pace}`);
            if (dn.clarity) lines.push(`  Clarity: ${dn.clarity}`);
            if (Array.isArray(q.strengths) && q.strengths.length) {
              lines.push('  Strengths:');
              for (const b of q.strengths) lines.push(`    + ${b}`);
            }
            if (Array.isArray(q.weaknesses) && q.weaknesses.length) {
              lines.push('  Weaknesses:');
              for (const b of q.weaknesses) lines.push(`    - ${b}`);
            }
            if (q.tryNext) lines.push(`  Try next: ${q.tryNext}`);
            if (Array.isArray(q.improvements) && q.improvements.length) {
              lines.push('  Improvements:');
              for (const b of q.improvements) lines.push(`    > ${b}`);
            }
          }
          lines.push('');
        });
      } else {
        lines.push('Detailed analysis has not been generated for this session yet.');
      }

      this._downloadTextFile(lines.join('\n'), `${this.fileBaseName()}-analysis.txt`);
    },
    _downloadTextFile(content, filename) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
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
  flex-direction: column;
  gap: 14px;
  margin: 32px auto 24px;
  max-width: 1000px;
  width: 100%;
}

.embedded-summary-root {
  height: auto;
  overflow-y: visible;
  padding: 0 24px 24px;
  background: transparent;
}

.embedded-summary-root .setup-view-header {
  margin-top: 12px;
}

.embedded-summary-root .header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.recorded-block {
  margin: 8px 0 0;
}

.detail-recorded { margin: 0 0 4px; font-size: 12px; color: #909399; }
.detail-recorded b { color: #606266; }
.recorded-seg { cursor: pointer; }
.detail-recorded-by { margin: 0; font-size: 12px; color: #909399; }
.detail-recorded-by b { color: #606266; }

.em-sessionid {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
}

.em-sessionid .sid-chip {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  font-family: monospace;
}

.header-breadcrumb { margin-bottom: -4px; }

.back-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 6px 6px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.back-link-btn:hover { background: #f1f5f9; color: #0f172a; }
.back-link-btn i { font-size: 1.05rem; }

.header-main-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.header-main h2 {
  font-size: 28px;
  color: #1a1a1a;
  margin: 0;
  font-weight: 700;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  min-width: 0;
}
.header-title {
  font-size: 28px;
  color: #0f172a;
  margin: 0;
  font-weight: 700;
  letter-spacing: -0.015em;
  cursor: text;
  border-radius: 6px;
  padding: 2px 4px;
  margin-left: -4px;
  transition: background 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.header-title:hover { background: rgba(99, 102, 241, 0.06); }

.header-title-input {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: #0f172a;
  border: 1px solid #c7d2fe;
  background: #ffffff;
  border-radius: 8px;
  padding: 4px 10px;
  outline: none;
  width: min(480px, 90%);
  font-family: inherit;
}
.header-title-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15); }

/* Rename pencil sits next to the title but only fades in on hover so
   it doesn't compete with the title at rest. */
.rename-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}
.rename-btn i { font-size: 0.9rem; }
.rename-btn:focus,
.title-row:hover .rename-btn { opacity: 1; }
.rename-btn:hover { background: #f1f5f9; color: #4f46e5; }

.header-subtitle {
  color: #666;
  margin-top: 5px;
  font-size: 1.05rem;
}

.setup-form-container {
  display: flex;
  flex-direction: column;
  gap: 25px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
  padding-bottom: 60px;
}

.info-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  border-radius: 12px;
  font-size: 0.92rem;
}

.info-banner.warning {
  background: #fefce8;
  border-color: #fde68a;
  color: #92400e;
}

.info-banner.action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  background: #f5f3ff;
  border-color: #ddd6fe;
  color: #5b21b6;
}

.info-banner.action span { flex: 1; min-width: 200px; }

.cta-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.cta-info-btn {
  width: 26px;
  height: 26px;
}

.info-banner.saved {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  background: #ecfdf5;
  border-color: #bbf7d0;
  color: #047857;
}
.info-banner.saved span { flex: 1; min-width: 200px; }

/* Analysis-mode banner — wraps the active mode label, the switch link,
   and the always-visible Generate Detailed Analysis button. */
.info-banner.analysis-mode-banner {
  align-items: center;
}
.info-banner.analysis-mode-banner .banner-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 220px;
  gap: 2px;
}
.info-banner.analysis-mode-banner .banner-text strong { font-weight: 700; }
.info-banner.analysis-mode-banner .banner-text span { flex: none; min-width: 0; }
.info-banner.analysis-mode-banner .banner-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
/* Processing card — shown while detailed analysis is being generated.
   Big, calm, and explicit about asking the user to keep the page open. */
.processing-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 24px;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  border-radius: 12px;
}

.processing-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #ede9fe;
  color: #7c3aed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.processing-body { flex: 1; min-width: 0; }
.processing-headline {
  font-size: 1.05rem;
  font-weight: 700;
  color: #4c1d95;
  margin-bottom: 6px;
}
.processing-message {
  margin: 0;
  font-size: 0.92rem;
  color: #5b21b6;
  line-height: 1.55;
}
.processing-message strong { color: #4c1d95; }

.processing-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.processing-bar {
  flex: 1;
  height: 6px;
  background: #ede9fe;
  border-radius: 999px;
  overflow: hidden;
}
.processing-bar-fill {
  height: 100%;
  width: 35%;
  background: linear-gradient(90deg, #c4b5fd, #7c3aed, #c4b5fd);
  background-size: 200% 100%;
  border-radius: 999px;
  animation: processing-shimmer 1.4s linear infinite;
}
@keyframes processing-shimmer {
  0%   { background-position: 200% 0; transform: translateX(-30%); }
  50%  { background-position: 0 0;   transform: translateX(50%); }
  100% { background-position: -200% 0; transform: translateX(220%); }
}
.processing-elapsed {
  font-size: 0.82rem;
  font-weight: 600;
  color: #6d28d9;
  white-space: nowrap;
}


.info-banner i { font-size: 1.05rem; margin-top: 2px; }

.setup-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e7eaf0;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px -12px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.setup-card:hover {
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.05),
    0 12px 28px -10px rgba(15, 23, 42, 0.12);
  border-color: #dde1e8;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 28px;
  background: #ffffff;
  border-bottom: 1px solid #eef0f4;
}

.card-header.highlight {
  background: linear-gradient(180deg, #fafbff 0%, #ffffff 100%);
}

.card-header i {
  font-size: 1.05rem;
  color: #475569;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: 8px;
  flex-shrink: 0;
}
.card-header h3 {
  margin: 0;
  font-size: 1.08rem;
  color: #0f172a;
  font-weight: 700;
  letter-spacing: -0.01em;
  flex: 1;
}

/* Title + inline chip cluster — keeps the rating glued to the title
   instead of floating it to the right edge of the header. */
.card-title-cluster {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.card-title-cluster h3 { flex: 0 0 auto; }

.card-body { padding: 24px 28px; }

.centered-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* Insights card */
.insights-card .card-header.highlight { background: #f8fafc; }
.insights-spinner { font-size: 0.85rem; color: #64748b; }
.insight-row { margin-bottom: 14px; }
.insight-row:last-child { margin-bottom: 0; }
.insight-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #94a3b8;
  margin-bottom: 4px;
}
.insight-text { margin: 0; font-size: 1rem; color: #1e293b; line-height: 1.55; }
.insight-list { margin: 0; padding-left: 20px; color: #1e293b; }
.insight-list li { margin-bottom: 4px; line-height: 1.5; }
.insight-verdict {
  margin: 0;
  font-size: 1rem;
  color: #1e293b;
  font-weight: 600;
  line-height: 1.5;
}

/* Overall card */
.info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  margin-right: 8px;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}
.info-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.metrics-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.metrics-modal {
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}
.metrics-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 12px;
  border-bottom: 1px solid #f1f5f9;
}
.metrics-modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  color: #1f2937;
}
.metrics-modal-close {
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
.metrics-modal-close:hover { background: #e5e7eb; color: #1f2937; }

.metrics-modal-body {
  padding: 8px 24px 24px;
}
.help-section {
  padding: 16px 0;
  border-bottom: 1px solid #f1f5f9;
}
.help-section:last-child { border-bottom: none; }
.help-section h4 {
  margin: 0 0 6px 0;
  font-size: 1rem;
  color: #1f2937;
  font-weight: 700;
}
.help-section p {
  margin: 0 0 10px 0;
  font-size: 0.92rem;
  color: #475569;
  line-height: 1.55;
}
.help-section ul {
  margin: 0;
  padding-left: 22px;
  color: #475569;
}
.help-section ul li {
  margin-bottom: 6px;
  font-size: 0.92rem;
  line-height: 1.5;
}
.help-note {
  margin-top: 8px;
  font-size: 0.85rem !important;
  color: #64748b !important;
  font-style: italic;
}
.help-section .tone-good { color: #15803d; }
.help-section .tone-ok   { color: #a16207; }
.help-section .tone-warn { color: #a16207; }
.help-section .tone-bad  { color: #b91c1c; }

/* Analysis-type selector modal */
.type-selector-modal { width: 480px; max-width: 90vw; }
.type-selector-intro {
  margin: 14px 0 16px 0;
  font-size: 0.92rem;
  color: #475569;
}
.type-option {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 10px;
  cursor: pointer;
  background: #fff;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.type-option:hover { border-color: #cbd5e1; }
.type-option.is-checked {
  border-color: #c4b5fd;
  background: #faf5ff;
  box-shadow: 0 0 0 1px #c4b5fd inset;
}
.type-option input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: #7c3aed;
  cursor: pointer;
}
.type-option-body { flex: 1; min-width: 0; }
.type-option-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: #1f2937;
  font-size: 0.98rem;
  margin-bottom: 4px;
}
.type-option-title i { color: #7c3aed; }
.type-option-desc {
  margin: 0;
  font-size: 0.88rem;
  color: #64748b;
  line-height: 1.45;
}
.type-selector-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.18s ease; }
.modal-fade-enter-active .metrics-modal,
.modal-fade-leave-active .metrics-modal { transition: transform 0.18s ease; }
.modal-fade-enter, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter .metrics-modal,
.modal-fade-leave-to .metrics-modal { transform: translateY(-8px) scale(0.98); }

.overall-verdict {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #f1f5f9;
  color: #475569;
}
.overall-verdict.verdict-good { background: #dcfce7; color: #15803d; }
.overall-verdict.verdict-ok   { background: #fef9c3; color: #a16207; }
.overall-verdict.verdict-warn { background: #ffedd5; color: #c2410c; }
.overall-verdict.verdict-bad  { background: #fee2e2; color: #b91c1c; }
.overall-verdict.verdict-neutral { background: #f1f5f9; color: #64748b; }

/* Numeric rating chip in the Overall Performance header. Sits next to
   the title; tone matches the rule-based or LLM-derived score. */
.overall-rating {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-size: 1.05rem;
  font-weight: 800;
  padding: 4px 12px;
  border-radius: 999px;
  letter-spacing: -0.01em;
  background: #f1f5f9;
  color: #475569;
}
.overall-rating-suffix {
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.7;
}
.overall-rating.rating-good { background: #dcfce7; color: #15803d; }
.overall-rating.rating-ok   { background: #fef9c3; color: #a16207; }
.overall-rating.rating-warn { background: #ffedd5; color: #c2410c; }
.overall-rating.rating-bad  { background: #fee2e2; color: #b91c1c; }
.overall-rating.rating-neutral { background: #f1f5f9; color: #64748b; }

.verdict-description {
  margin: 0 0 18px 0;
  padding: 12px 14px;
  background: #f8fafc;
  border-left: 3px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
  line-height: 1.55;
  color: #334155;
}

.overall-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.overall-stat {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.overall-stat-clickable {
  cursor: pointer;
}
.overall-stat-clickable:hover {
  background: #eef2ff;
  border-color: #c7d2fe;
}
.overall-stat-hint {
  margin-top: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #6366f1;
  letter-spacing: 0.2px;
}

.overall-stat.is-highlighted,
.basic-block.is-highlighted {
  animation: stat-pulse 1.6s ease-out;
}
@keyframes stat-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.45); }
  40%  { box-shadow: 0 0 0 10px rgba(124, 58, 237, 0); }
  100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
}

.overall-stat-val { font-size: 1.35rem; font-weight: 700; color: #1a1a1a; }
.overall-stat-val.tone-good { color: #15803d; }
.overall-stat-val.tone-ok   { color: #a16207; }
.overall-stat-val.tone-bad  { color: #b91c1c; }
.overall-stat-val.tone-neutral { color: #475569; }

/* Tile-level tone — tints the whole tile so the user can scan the
   grid without reading every number. The value text inherits the
   tone colour for extra emphasis. */
.overall-stat.tone-good {
  background: #f0fdf4;
  border-color: #86efac;
}
.overall-stat.tone-good .overall-stat-val { color: #15803d; }

.overall-stat.tone-ok {
  background: #fefce8;
  border-color: #fde68a;
}
.overall-stat.tone-ok .overall-stat-val { color: #a16207; }

.overall-stat.tone-bad {
  background: #fef2f2;
  border-color: #fecaca;
}
.overall-stat.tone-bad .overall-stat-val { color: #b91c1c; }

.overall-stat.tone-neutral {
  /* Falls back to the default tile look — no override. */
}

.overall-stat-score {
  background: #f5f3ff;
  border-color: #ddd6fe;
}

.overall-insights {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #f1f5f9;
}
.overall-insights-title,
.overall-improvements-title {
  margin: 0 0 12px 0;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #475569;
}

.overall-improvements {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid #f1f5f9;
}
.overall-improvements-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.overall-improvements-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.95rem;
  line-height: 1.5;
  color: #1e293b;
}
.overall-improvements-q {
  flex-shrink: 0;
  font-weight: 700;
  color: #475569;
  background: #f1f5f9;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  margin-top: 2px;
}
.overall-improvements-text { flex: 1; }
.overall-stat-sub { font-size: 0.85rem; font-weight: 600; color: #64748b; }
.overall-stat-lab {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  font-weight: 700;
  margin-top: 4px;
}

/* Reports & Downloads card */
.reports-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.reports-hint {
  margin: 14px 0 0 0;
  font-size: 0.85rem;
  color: #64748b;
}

/* Video Section */
.video-preview-wrapper { width: 100%; max-width: 800px; }
.summary-video {
  width: 100%;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  background: black;
}
.video-missing-alert { padding: 30px; color: #64748b; }
.video-missing-alert i { font-size: 2rem; margin-bottom: 10px; color: #cbd5e1; }

/* Transcript */
.summary-data-item { margin-bottom: 22px; }
.summary-data-item:last-child { margin-bottom: 0; }
.summary-data-item label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #94a3b8;
  margin-bottom: 8px;
}
.data-text { font-size: 1.02rem; color: #1e293b; line-height: 1.6; margin: 0; }
.data-text.muted { color: #64748b; }
.transcript-surface {
  background: #f8fafc;
  padding: 18px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  font-size: 1.02rem;
  line-height: 1.7;
  color: #334155;
  white-space: pre-wrap;
}

.mini-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.stat-pill {
  background: #fff;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  min-width: 100px;
}
.stat-val { font-size: 1.12rem; font-weight: 700; color: #1a1a1a; }
.stat-sub { font-size: 0.78rem; color: #64748b; font-weight: 600; }
.stat-lab {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #94a3b8;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.stat-hint {
  display: block;
  margin-top: 4px;
  font-size: 0.78rem;
  font-weight: 500;
  color: #64748b;
}
.stat-hint.tone-good { color: #15803d; }
.stat-hint.tone-warn { color: #a16207; }
.stat-hint.tone-bad  { color: #b91c1c; }
.stat-hint.tone-neutral { color: #64748b; }

.stats-explainer {
  margin: 12px 0 0 0;
  font-size: 0.82rem;
  color: #64748b;
  line-height: 1.5;
}

/* Basic analysis */
.basic-analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

/* Hint paragraph used inside the session-level Speaking Patterns blocks
   (which otherwise reuse the per-question `.basic-block` styling). */
.patterns-block-hint {
  margin: 0 0 10px 0;
  font-size: 0.82rem;
  color: #64748b;
  line-height: 1.45;
}
.basic-block {
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fafbfc;
}
.basic-block-title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #64748b;
  margin-bottom: 8px;
}
.basic-block-total {
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.72rem;
  font-weight: 600;
  color: #94a3b8;
}
.chip-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip-list.inline { gap: 6px; margin-top: 4px; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  font-size: 0.85rem;
  color: #1e293b;
}
.chip em { color: #64748b; font-style: normal; font-weight: 600; }
.chip.muted { background: #f8fafc; color: #64748b; }

/* LLM block */
/* ── Detailed Feedback (LLM) — unified slate + indigo palette ────── */
.llm-block {
  background: #ffffff;
  padding: 22px 24px;
  border-radius: 12px;
  border: 1px solid #e7eaf0;
}
.llm-block > label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: #64748b;
  margin-bottom: 4px;
}
.ai-section-icon { color: #6366f1 !important; font-size: 0.9rem; }

.llm-block-hint {
  margin: 4px 0 18px 0;
  font-size: 0.88rem;
  color: #64748b;
  line-height: 1.55;
}

/* Section divider between dimensions */
.llm-dimension {
  margin: 0 0 24px 0;
  padding-top: 22px;
  border-top: 1px solid #eef0f4;
}
.llm-dimension:first-of-type { border-top: none; padding-top: 4px; }
.llm-dimension:last-child { margin-bottom: 12px; }

.llm-dimension-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 1rem;
  color: #0f172a;
  letter-spacing: -0.01em;
  margin-bottom: 14px;
}
.llm-dimension-header i {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 8px;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.dimension-score {
  margin-left: auto;
  background: #eef2ff;
  color: #3730a3;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 3px 11px;
  border-radius: 999px;
  letter-spacing: -0.01em;
}

/* Notes grids — same look for delivery and content */
.delivery-notes-grid,
.content-notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.delivery-note,
.content-note {
  background: #f8fafc;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  padding: 12px 14px;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.delivery-note:hover,
.content-note:hover {
  background: #ffffff;
  border-color: #dbe1ea;
}
.delivery-note-label,
.content-note-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #64748b;
  margin-bottom: 6px;
}
.delivery-note p,
.content-note p {
  margin: 0;
  font-size: 0.92rem;
  color: #1e293b;
  line-height: 1.55;
}

/* Sub-rows (Strengths, Weaknesses, Improvement plan, Top thing to try…) */
.llm-row { margin-bottom: 18px; }
.llm-row:last-child { margin-bottom: 0; }
.llm-row-title {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #64748b;
  margin-bottom: 8px;
}
.llm-row p { margin: 0; font-size: 0.94rem; color: #1e293b; line-height: 1.55; }
.llm-row ul { margin: 0; padding-left: 20px; color: #1e293b; }
.llm-row ul li { margin-bottom: 6px; line-height: 1.55; font-size: 0.94rem; }

.coverage-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  font-size: 0.9rem;
  color: #1e293b;
}
.coverage-row strong {
  display: inline-block;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #64748b;
  font-weight: 700;
  margin-right: 4px;
}

.improvement-list {
  margin: 0;
  padding-left: 20px;
  color: #1e293b;
}
.improvement-list li {
  margin-bottom: 8px;
  line-height: 1.55;
  font-size: 0.94rem;
}

/* Per-question score pill in the Q card header */
.score-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  font-weight: 700;
  background: #eef2ff;
  color: #3730a3;
  padding: 4px 10px;
  border-radius: 999px;
}
.score-pill i { font-size: 0.85rem; }

.header-audio-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* "Play Your Answer" button — when active, a small red pulsing dot sits
   to the left of the label so the playing state is unmistakable, even
   at the small button size. */
.play-answer-btn .playing-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffffff;
  margin-right: 6px;
  vertical-align: middle;
  animation: play-dot-pulse 1.1s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
}
@keyframes play-dot-pulse {
  0%   { transform: scale(1);   opacity: 1; box-shadow: 0 0 0 0    rgba(255, 255, 255, 0.7); }
  60%  { transform: scale(1.1); opacity: 0.85; box-shadow: 0 0 0 6px rgba(255, 255, 255, 0); }
  100% { transform: scale(1);   opacity: 1; box-shadow: 0 0 0 0    rgba(255, 255, 255, 0); }
}

/* Subtle highlight on the question card whose audio is currently playing
   so the user knows where the sound is coming from at a glance. */
.transcript-block.is-playing-answer {
  border-color: #fecaca;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.05),
    0 0 0 3px rgba(239, 68, 68, 0.12);
}
.transcript-block.is-playing-answer .q-card-header {
  background: linear-gradient(180deg, #fef2f2 0%, #ffffff 100%);
}

/* ── Header tags (under page title) ── */
.header-subtitle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.header-subtitle-text {
  font-size: 0.95rem;
  color: #64748b;
}
.header-date {
  font-size: 0.85rem;
  font-weight: 500;
  color: #64748b;
  margin-left: 4px;
}
.header-tag {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
}
.header-tag-full { background: #ecfdf5; color: #047857; }
.header-tag-basic { background: #eff6ff; color: #1e40af; }
.header-tag-none { background: #f1f5f9; color: #64748b; }

.state-tag.state-complete   { background: #e3f5e9; color: #16a34a; }
.state-tag.state-incomplete { background: #fdf0dc; color: #b45309; }
.state-tag.lc-analyzed { background: #e0edff; color: #2563eb; }
.state-tag.lc-ended    { background: #eef2f7; color: #475569; }
.state-tag.lc-active   { background: #fdf0dc; color: #b45309; }

/* ── Per-question section header + collapsible card header ── */
.questions-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 14px 4px 0;
}
.questions-header {
  margin: 0;
  font-size: 1.05rem;
  color: #1e293b;
  font-weight: 700;
}
.questions-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.questions-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin: 4px 4px 0;
  background: #f8fafc;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  flex-wrap: wrap;
}
.questions-toolbar-hint {
  font-size: 0.85rem;
  color: #64748b;
}

.question-jumper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  margin: 0 4px;
}
.jumper-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  margin-right: 6px;
}
.jumper-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #475569;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  cursor: pointer;
  transition: background-color 0.12s, border-color 0.12s, color 0.12s;
}
.jumper-pill:hover {
  border-color: #2563eb;
  color: #2563eb;
}
.jumper-pill-active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.jumper-pill-active:hover {
  background: #1d4ed8;
  color: #fff;
}
.jumper-pill-empty {
  color: #cbd5e1;
  background: #fff;
  border-style: dashed;
}

.jumper-pill-all {
  margin-right: 4px;
}

.jumper-clear {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  transition: color 0.12s, background-color 0.12s;
}
.jumper-clear:hover {
  background: #f1f5f9;
  color: #b91c1c;
}
.jumper-clear i { font-size: 0.85rem; }

.q-card-header {
  cursor: pointer;
  align-items: center;
  user-select: none;
  transition: background-color 0.12s;
}
.q-card-header:hover { background: #f8fafc; }
.transcript-block.is-expanded .q-card-header { border-bottom: 1px solid #f0f2f5; }

.expand-chevron {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 0.95rem;
  width: 14px;
  text-align: center;
}

.q-header-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.q-header-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.q-number {
  font-weight: 700;
  color: #475569;
  font-size: 0.85rem;
  flex-shrink: 0;
}
.q-snippet {
  color: #1f2937;
  font-size: 0.95rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.q-header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.q-meta-pill {
  font-size: 0.72rem;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
}
.q-meta-pill.q-meta-warn {
  background: #fef9c3;
  color: #a16207;
}
.q-meta-pill.q-meta-info {
  background: #dbeafe;
  color: #1d4ed8;
}

.setup-status-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80vh;
}
.main-loader {
  border: 4px solid #f3f4f6;
  border-top: 4px solid #475569;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px auto;
}
.batch-progress-line {
  margin-top: 4px !important;
  font-size: 0.88rem;
  color: #64748b;
  font-weight: 600;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 900px) { .setup-page-view { padding: 0 20px; } }
@media (max-width: 768px) {
  .setup-page-view { padding: 0 14px; height: auto; overflow-y: visible; }
  .setup-view-header { flex-direction: column; align-items: flex-start; margin: 20px 0 18px 0; gap: 12px; }
  .header-main h2  { font-size: 1.35rem; }
  .header-subtitle { font-size: 0.9rem; }
  .header-actions, .header-actions .el-button { width: 100%; }
  .setup-form-container { gap: 16px; }
  .card-header { padding: 14px 18px; }
  .card-body   { padding: 18px 14px; }
  .summary-video { border-radius: 8px; }
  .reports-grid { flex-direction: column; }
  .reports-grid .el-button { width: 100%; }
  .mini-stats { flex-direction: column; gap: 8px; }
  .stat-pill   { width: 100%; }
  .transcript-surface { padding: 14px; font-size: 0.95rem; }
  .summary-data-item { flex-direction: column; gap: 4px; }
  .header-audio-controls { width: 100%; }
  .header-audio-controls .el-button { flex: 1; }
}
</style>
