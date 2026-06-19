<template>
  <div class="my-interviews-container">
    <div class="my-interviews-header">
      <h2>My Interviews</h2>
      <div class="dash-actions">
        <el-button
            type="primary"
            class="primary-hero-btn"
            @click="startNew">
          Start New Interview <i class="el-icon-right"></i>
        </el-button>
      </div>
    </div>

    <div class="interview-list">
      <div class="recent-header">
        <h3 class="recent-title">Recent Interviews</h3>
        <div class="recent-actions">
          <el-button
              v-if="canReview"
              size="small"
              type="primary"
              plain
              @click="goToCandidates">
            Candidate Overview
          </el-button>
          <a v-if="canReview" class="view-all" @click="goToAll">View All</a>
        </div>
      </div>

      <div class="storage-info">
        <i class="el-icon-info"></i> Interviews are saved in the cloud and kept for 30 days.
        Video stays on this device for the {{ MAX_VIDEO_SESSIONS }} most recent only — audio, transcripts, and analysis live in the cloud.
      </div>

      <div v-if="loading" class="loading-center">
        <i class="el-icon-loading"></i>
        <span>Loading…</span>
      </div>

      <div v-else-if="!sessions.length" class="empty-dashboard">
        <i class="el-icon-folder-opened empty-icon"></i>
        <h3>No saved interviews yet</h3>
        <p>Complete an interview from start to finish to save it here.</p>
        <div style="display:flex; gap:10px; margin-top: 24px;">
          <el-button type="primary" class="primary-hero-btn" @click="startNew">
            Start First Interview <i class="el-icon-right"></i>
          </el-button>
        </div>
      </div>

      <div v-else class="interview-cards">
        <div
            v-for="s in sessions"
            :key="s.id"
            class="interview-card"
            @click="open(s.id)"
        >
          <div class="card-row">
            <div class="card-title-wrap">
              <h3 class="card-title">{{ s.candidateName || 'Interview' }}</h3>
              <el-tag v-if="s.status" :type="statusType(s.status)" size="mini" effect="dark">{{ s.status }}</el-tag>
              <el-tooltip placement="top" :content="'Updated: ' + formatDate(lastUpdated(s))" :disabled="!lastUpdated(s)">
                <span class="card-ago">{{ timeAgo(lastUpdated(s)) }}</span>
              </el-tooltip>
            </div>
            <span class="card-top-right">
              <span v-if="cardRating(s) !== null" class="card-score" :class="'score-' + scoreTone(s)" :title="'Overall rating'">
                <i class="el-icon-medal"></i> {{ cardRating(s) }} / 10
              </span>
              <span
                  v-if="hasVideo(s.id)"
                  class="video-availability has-video"
                  title="Video recording available">
                <i class="el-icon-video-camera"></i>
              </span>
            </span>
          </div>
          <div class="card-row card-row-body">
            <p class="card-line-1">
              <span class="card-difficulty">{{ s.difficulty || 'Interview' }}</span>
              <span v-if="s.category && s.category !== 'All'">{{ s.category }}</span>
              <span :class="s.completed ? 'card-complete' : 'card-incomplete'">{{ s.completed ? 'Complete' : 'Incomplete' }}</span>
              <span class="card-count">{{ answeredCount(s) }} / {{ (s.qaList || []).length }} answered</span>
              <template v-if="totalDuration(s)">
                <span class="card-duration"><i class="el-icon-time"></i> {{ totalDuration(s) }} total</span>
              </template>
            </p>
            <span class="card-date">{{ formatDate(s.endedAt || s.startedAt || s.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import {
  listRecentSessions,
  MAX_ENTRIES
} from '@/store/interviewHistoryStore';
import { listSessionsWithVideo, MAX_VIDEO_SESSIONS } from '@/store/recordingStore';
import { wordCount, aggregateStats, overallVerdict, formatDuration, deliveryRating } from '@/utils/summaryStats';
import authService from '@/services/authService';
import { ROLE_GROUPS, hasAnyRole } from '@/constants/roles';

export default {
  name: 'MyInterviews',
  data() {
    return {
      MAX_VISIBLE: MAX_ENTRIES,
      MAX_VIDEO_SESSIONS,
      sessions: [],
      videoSessionIds: [],
      loading: true
    };
  },
  computed: {
    canReview() {
      return hasAnyRole(authService.getUserRoles(), ROLE_GROUPS.INTERVIEW_REVIEW);
    }
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    async refresh() {
      this.loading = true;
      try {
        const [recent, withVideo] = await Promise.all([
          listRecentSessions(this.MAX_VISIBLE),
          listSessionsWithVideo()
        ]);
        const now = Date.now();
        this.sessions = recent.filter(s => {
          if (s.completed) return true;
          if (Array.isArray(s.transcripts) && s.transcripts.some(t => t != null)) return true;
          const ts = s.updatedAt || s.startedAt || s.createdAt;
          const fresh = ts && (now - new Date(ts).getTime()) < 15 * 60 * 1000;
          return s.status === 'ACTIVE' && fresh;
        });
        this.videoSessionIds = withVideo;
      } catch (e) {
        console.error('Failed to load interview history:', e);
        this.sessions = [];
        this.videoSessionIds = [];
      } finally {
        this.loading = false;
      }
    },
    goToCandidates() {
      this.$router.push({ name: 'CandidateOverview' });
    },
    goToAll() {
      this.$router.push({ name: 'AllInterviews' });
    },
    statusType(status) {
      if (status === 'ENDED') return 'warning';
      if (status === 'ANALYZED') return 'primary';
      return 'success';
    },
    lastUpdated(s) {
      return s.updatedAt || s.endedAt || s.startedAt || s.createdAt;
    },
    timeAgo(ts) {
      if (!ts) return '';
      const diff = Date.now() - new Date(ts).getTime();
      if (diff < 60000) return 'just now';
      const m = Math.floor(diff / 60000);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const d = Math.floor(h / 24);
      if (d < 30) return `${d}d ago`;
      const mo = Math.floor(d / 30);
      if (mo < 12) return `${mo}mo ago`;
      return `${Math.floor(mo / 12)}y ago`;
    },
    hasVideo(id) {
      return this.videoSessionIds.includes(id);
    },
    formatDate(iso) {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      } catch (e) {
        return iso;
      }
    },
    modeLabel(mode) {
      if (mode === 'full') return 'Detailed';
      if (mode === 'basic') return 'Basic analysis';
      return 'No analysis';
    },
    answeredCount(s) {
      if (!Array.isArray(s.transcripts)) return 0;
      let count = 0;
      for (const t of s.transcripts) {
        // A slot counts as answered if it has transcribed words OR if it
        // carries the {pending:true} sentinel AnswerRecorder writes when
        // audio is captured but transcription hasn't run yet. Without
        // the pending check the card reads "0 answered" for fresh
        // sessions where the user spoke into every question — misleading.
        if (wordCount(t) > 0) count++;
        else if (t && typeof t === 'object' && t.pending) count++;
      }
      return count;
    },
    // Average per-question delivery score from the saved llmAnalysis. Null
    // when the session has no detailed analysis yet, or none of the per-
    // question entries had a numeric score. One decimal place.
    averageScore(s) {
      const perQ = s && s.llmAnalysis && Array.isArray(s.llmAnalysis.perQuestion)
        ? s.llmAnalysis.perQuestion : [];
      const scores = perQ
        .map(q => (q && typeof q.score === 'number') ? q.score : null)
        .filter(n => n !== null);
      if (!scores.length) return null;
      const sum = scores.reduce((a, b) => a + b, 0);
      return Math.round((sum / scores.length) * 10) / 10;
    },
    cardRating(s) {
      const avg = this.averageScore(s);
      if (avg !== null) return avg;
      if (!Array.isArray(s.transcripts) || !s.transcripts.length) return null;
      return deliveryRating(aggregateStats(s.transcripts));
    },
    scoreTone(s) {
      const v = this.cardRating(s);
      if (v === null) return 'neutral';
      if (v >= 7) return 'good';
      if (v >= 5) return 'ok';
      return 'bad';
    },
    // Total speaking time across all answers in the session, formatted
    // (e.g. "3m 12s"). Returns empty string when there are no transcripts
    // to measure.
    totalDuration(s) {
      if (!Array.isArray(s.transcripts) || !s.transcripts.length) return '';
      const agg = aggregateStats(s.transcripts);
      if (!agg.totalDurationSec) return '';
      return formatDuration(agg.totalDurationSec);
    },
    verdictFor(s) {
      // Quick verdict from the saved transcripts. Returns null for sessions
      // with no analysis (none mode) where there's nothing to verdict on.
      if (!s.analysisMode || s.analysisMode === 'none') return null;
      const agg = aggregateStats(s.transcripts);
      if (!agg.answeredCount) return null;
      return overallVerdict(agg);
    },
    verdictLabel(s) {
      const v = this.verdictFor(s);
      return v ? v.label : '';
    },
    verdictTone(s) {
      const v = this.verdictFor(s);
      return v ? v.tone : 'neutral';
    },
    startNew() {
      this.$router.push({ name: 'ResumeSetup' });
    },
    open(id) {
      this.$router.push({ name: 'SummaryView', query: { sessionId: id } });
    }
  }
};
</script>

<style scoped>
.my-interviews-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 0 40px 40px 40px;
  overflow-y: auto;
}

.my-interviews-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 40px 0 30px 0;
  flex-wrap: wrap;
  gap: 15px;
}

.my-interviews-header h2 {
  font-size: 28px;
  color: #2c3e50;
  margin: 0;
  font-weight: 700;
}

.dash-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.loading-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 320px;
  color: #909399;
  font-size: 1rem;
}

.loading-center i {
  font-size: 22px;
}

.retention-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 10px;
  padding: 14px 18px;
  margin: 0 0 24px 0;
  color: #78350f;
  font-size: 0.92rem;
  line-height: 1.45;
}

.retention-banner .el-icon-warning-outline {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.retention-text {
  flex: 1;
}

.video-availability {
  display: inline-flex;
  align-items: center;
  font-size: 0.95rem;
  color: #2563eb;
  line-height: 1;
}

.empty-dashboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #909399;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  color: #dcdfe6;
  margin-bottom: 20px;
}

.empty-dashboard h3 {
  font-size: 20px;
  margin: 10px 0;
  color: #606266;
}

.empty-dashboard p {
  margin: 0;
  color: #909399;
}

.interview-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #e4e7ed;
  margin-bottom: 5px;
}

.recent-title {
  color: #606266;
  font-weight: 500;
  margin: 0;
}

.recent-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.view-all {
  font-size: 0.9em;
  color: #2563eb;
  text-decoration: none;
  cursor: pointer;
}

.storage-info {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 6px;
  padding: 8px 12px;
  color: #0050b3;
  font-size: 0.85em;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

/* Mirrors TranscriptCard styles so the two pages feel identical. */
.interview-cards {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.interview-card {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  min-height: 30px;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.interview-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08);
  border-color: #c6e2ff;
}

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.card-row-body {
  margin-top: 8px;
}

.card-top-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.card-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.card-title {
  font-weight: 700;
  font-size: 1.1em;
  color: #2c3e50;
  margin: 0;
}

.card-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.card-meta-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-date {
  font-size: 0.8em;
  color: #999;
  flex-shrink: 0;
  white-space: nowrap;
}

.card-ago {
  font-size: 12px;
  color: #909399;
}

.icon-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  cursor: pointer;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: 1.05rem;
}


.icon-btn.delete-btn:hover {
  color: #f56c6c;
}

.card-body {
  display: flex;
  flex-direction: column;
}

.card-line-1 {
  margin: 0;
  font-size: 0.9rem;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.card-difficulty { font-weight: 600; color: #475569; }

.meta-sep { color: #cbd5e1; }

.card-incomplete {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #fdf0dc;
  color: #b45309;
}

.card-complete {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #dcfce7;
  color: #15803d;
}

.card-verdict {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.card-verdict.verdict-good { color: #15803d; }
.card-verdict.verdict-ok   { color: #a16207; }
.card-verdict.verdict-bad  { color: #b91c1c; }
.card-verdict.verdict-neutral { color: #64748b; }

.card-count {
  color: #909399;
  font-size: 0.82rem;
  font-weight: 500;
}

.card-duration {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 500;
}
.card-duration i { font-size: 0.95em; color: #94a3b8; }

.card-score {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f5f3ff;
  color: #6d28d9;
}
.card-score i { font-size: 0.95em; }
.card-score.score-good { background: #ecfdf5; color: #047857; }
.card-score.score-ok   { background: #fef9c3; color: #854d0e; }
.card-score.score-bad  { background: #fee2e2; color: #b91c1c; }
.card-score.score-neutral { background: #f1f5f9; color: #475569; }
</style>
