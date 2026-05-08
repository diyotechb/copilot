<template>
  <div class="my-interviews-container">
    <div class="my-interviews-header">
      <h2>My Interviews</h2>
      <div class="dash-actions">
        <el-button type="primary" class="primary-hero-btn" @click="startNew">
          Start New Interview <i class="el-icon-right"></i>
        </el-button>
      </div>
    </div>

    <div v-if="loading" class="status-row">
      <i class="el-icon-loading"></i> Loading…
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

    <div v-else class="interview-list">
      <div class="recent-header">
        <h3 class="recent-title">Recent Interviews</h3>
      </div>

      <div class="storage-info">
        <i class="el-icon-info"></i> Only the {{ MAX_VISIBLE }} most recent completed interviews are saved locally on this device.
      </div>

      <div class="interview-cards">
        <div
            v-for="s in sessions"
            :key="s.id"
            class="interview-card"
            @click="open(s.id)"
        >
          <div class="card-header">
            <div class="card-title-wrap">
              <h3 class="card-title">{{ s.candidateName || 'Interview' }}</h3>
              <span v-if="averageScore(s) !== null" class="card-score" :class="'score-' + scoreTone(s)" :title="'Average delivery score'">
                <i class="el-icon-medal"></i> {{ averageScore(s) }} / 10
              </span>
            </div>
            <div class="card-meta">
              <span class="card-date">{{ formatDate(s.savedAt) }}</span>
              <i class="el-icon-delete delete-btn" @click.stop="remove(s.id)" title="Delete"></i>
            </div>
          </div>
          <div class="card-body">
            <p class="card-line-1">
              <span class="card-difficulty">{{ s.difficulty || 'Interview' }}</span>
              <span v-if="s.category && s.category !== 'All'" class="meta-sep">·</span>
              <span v-if="s.category && s.category !== 'All'">{{ s.category }}</span>
              <span class="meta-sep">·</span>
              <span class="card-state" :class="'state-' + sessionState(s).tone">{{ sessionState(s).label }}</span>
              <span v-if="verdictLabel(s)" class="meta-sep">·</span>
              <span v-if="verdictLabel(s)" class="card-verdict" :class="'verdict-' + verdictTone(s)">{{ verdictLabel(s) }}</span>
              <span class="meta-sep">·</span>
              <span class="card-count">{{ answeredCount(s) }} / {{ (s.qaList || []).length }} answered</span>
              <template v-if="totalDuration(s)">
                <span class="meta-sep">·</span>
                <span class="card-duration"><i class="el-icon-time"></i> {{ totalDuration(s) }} total</span>
              </template>
            </p>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
        :visible.sync="confirmVisible"
        :title="confirmConfig.title"
        :message="confirmConfig.message"
        :type="confirmConfig.type"
        :confirm-text="confirmConfig.confirmText"
        :icon="confirmConfig.icon"
        @confirm="onConfirm"
    />
  </div>
</template>

<script>
import { listRecentSessions, deleteSession } from '@/store/interviewHistoryStore';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { wordCount, aggregateStats, overallVerdict, formatDuration } from '@/utils/summaryStats';

export default {
  name: 'MyInterviews',
  components: { ConfirmDialog },
  data() {
    return {
      MAX_VISIBLE: 5,
      sessions: [],
      loading: true,
      pendingDeleteId: '',
      confirmVisible: false,
      confirmConfig: { title: '', message: '', type: 'warning', confirmText: 'Delete', icon: 'el-icon-delete' }
    };
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    async refresh() {
      this.loading = true;
      try {
        this.sessions = await listRecentSessions(this.MAX_VISIBLE);
      } catch (e) {
        console.error('Failed to load interview history:', e);
        this.sessions = [];
      } finally {
        this.loading = false;
      }
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
    // One-word status reflecting what the saved entry actually contains.
    // Pending = audio recorded but not transcribed yet (next action:
    // open and click Transcribe). Basic = transcripts done, no detailed
    // analysis. Detailed = LLM analysis saved. Errors = transcription
    // failed for one or more answers. None = analysis was off.
    sessionState(s) {
      if (!s.analysisMode || s.analysisMode === 'none') {
        return { label: 'No analysis', tone: 'none' };
      }
      const transcripts = Array.isArray(s.transcripts) ? s.transcripts : [];
      const pending = transcripts.some(t => t && typeof t === 'object' && t.pending);
      const failed = transcripts.some(t => typeof t === 'string' && t === '[Transcription error]');
      if (pending) return { label: 'Pending', tone: 'pending' };
      if (s.llmAnalysis) return { label: 'Detailed', tone: 'detailed' };
      if (failed) return { label: 'Errors', tone: 'failed' };
      if (transcripts.length === 0) return { label: 'No data', tone: 'none' };
      return { label: 'Basic', tone: 'basic' };
    },
    answeredCount(s) {
      if (!Array.isArray(s.transcripts)) return 0;
      let count = 0;
      for (const t of s.transcripts) {
        if (wordCount(t) > 0) count++;
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
    scoreTone(s) {
      const v = this.averageScore(s);
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
    },
    remove(id) {
      this.pendingDeleteId = id;
      this.confirmConfig = {
        title: 'Delete this saved interview?',
        message: 'This removes the saved transcripts and feedback for this interview from your device. Cannot be undone.',
        type: 'danger',
        confirmText: 'Delete',
        icon: 'el-icon-delete'
      };
      this.confirmVisible = true;
    },
    async onConfirm() {
      if (!this.pendingDeleteId) {
        this.confirmVisible = false;
        return;
      }
      try {
        await deleteSession(this.pendingDeleteId);
      } catch (e) {
        console.error('Failed to delete session:', e);
      }
      this.pendingDeleteId = '';
      this.confirmVisible = false;
      await this.refresh();
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

.status-row {
  padding: 24px;
  color: #909399;
  font-size: 0.95rem;
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
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
  align-items: center;
  gap: 10px;
}

.card-date {
  font-size: 0.8em;
  color: #999;
}

.delete-btn {
  color: #e4e7ed;
  cursor: pointer;
  padding: 5px;
}

.delete-btn:hover {
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
}

.card-difficulty { font-weight: 600; color: #475569; }

.meta-sep { color: #cbd5e1; }

.card-state {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #475569;
}
.card-state.state-detailed { background: #ecfdf5; color: #047857; }
.card-state.state-basic    { background: #eff6ff; color: #1e40af; }
.card-state.state-pending  { background: #fef9c3; color: #854d0e; }
.card-state.state-failed   { background: #fee2e2; color: #b91c1c; }
.card-state.state-none     { background: #f1f5f9; color: #475569; }

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
