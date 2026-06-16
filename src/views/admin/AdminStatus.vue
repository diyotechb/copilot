<template>
  <div class="admin-status">
    <div class="header">
      <div class="title-block">
        <h1>System Status</h1>
        <p class="subtitle" v-if="lastUpdated">Updated: {{ updatedLabel }}</p>
      </div>
      <div class="actions">
        <el-button size="small" type="primary" icon="el-icon-refresh" :loading="loading" @click="refresh">
          Refresh
        </el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error-banner" />

    <template v-if="status">
      <div class="cards-grid">
        <div
          v-for="c in cards"
          :key="c.key"
          class="metric-card"
          :class="{ clickable: c.rich, active: selectedCard === c.key }"
          @click="c.rich && selectCard(c.key)"
        >
          <div class="metric-head">
            <span class="metric-label">{{ c.label }}</span>
            <el-tooltip :content="c.info" placement="top" :open-delay="150">
              <i class="el-icon-info metric-info"></i>
            </el-tooltip>
          </div>
          <div class="metric-value">{{ c.value }}</div>
          <div v-if="c.bar != null" class="bar">
            <div class="bar-fill" :class="c.barClass" :style="{ width: (c.bar * 100).toFixed(1) + '%' }"></div>
          </div>
          <div class="metric-sub">
            {{ c.sub }}
            <span v-if="c.rich" class="metric-cta">{{ selectedCard === c.key ? 'Showing below ↓' : 'View details ›' }}</span>
          </div>
        </div>
      </div>

      <div v-if="selectedCard" class="detail-panel">
        <div class="detail-head">
          <h2>{{ detailTitle }}</h2>
          <i class="el-icon-close detail-close" @click="selectedCard = ''"></i>
        </div>

        <div v-if="detailLoading && !details" class="detail-loading">
          <i class="el-icon-loading"></i> Loading…
        </div>

        <template v-else-if="selectedCard === 'rateLimits'">
          <p class="detail-lead">Who is using the system right now, and how much of each limit they have left.</p>
          <el-table v-if="rlBuckets.length" :data="rlBuckets" size="small" stripe class="detail-table">
            <el-table-column label="Who" min-width="320">
              <template slot-scope="{ row }">
                <el-tag size="mini" :type="clientTagType(row.clientType)" effect="plain">{{ row.clientType }}</el-tag>
                <span class="who-id">{{ row.clientId || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="route" label="Action" width="150" />
            <el-table-column label="Used" min-width="170">
              <template slot-scope="{ row }">
                <div class="use-cell">
                  <div class="use-bar">
                    <div class="use-fill" :class="useClass(row)" :style="{ width: usePct(row) + '%' }"></div>
                  </div>
                  <span class="use-text">{{ row.used }} / {{ row.capacity }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="available" label="Remaining" width="110" align="right" />
          </el-table>
          <p v-else class="detail-empty">No active usage right now.</p>

          <h3 class="detail-subhead">What the system allows</h3>
          <p class="detail-lead">Every action each kind of user can do, the limit, and what that limit means in plain terms.</p>
          <el-table :data="rlCapabilities" size="small" class="detail-table">
            <el-table-column prop="action" label="Action" width="200" />
            <el-table-column prop="scope" label="Who" width="130" />
            <el-table-column prop="limit" label="Limit" width="160" />
            <el-table-column prop="plain" label="What it means" min-width="320" />
          </el-table>
          <p class="detail-note">At the same time: up to {{ maxGenerations }} interviews can be generated across everyone (shared pool) — extras queue rather than fail. Live transcription and Live Assist sessions each close automatically after {{ sessionMaxHours }} hours.</p>
        </template>

        <template v-else-if="selectedCard === 'interviews'">
          <p class="detail-lead">Interview practice sessions that are active right now.</p>
          <el-table v-if="activeInterviews.length" :data="activeInterviews" size="small" stripe class="detail-table">
            <el-table-column prop="name" label="Candidate" min-width="180" show-overflow-tooltip />
            <el-table-column prop="difficulty" label="Difficulty" width="140">
              <template slot-scope="{ row }">{{ row.difficulty || '—' }}</template>
            </el-table-column>
            <el-table-column label="Started" min-width="170">
              <template slot-scope="{ row }">{{ formatTime(row.startedAt) }}</template>
            </el-table-column>
            <el-table-column prop="by" label="By" min-width="180" show-overflow-tooltip>
              <template slot-scope="{ row }">{{ row.by || '—' }}</template>
            </el-table-column>
          </el-table>
          <p v-else class="detail-empty">No interviews in progress.</p>

          <h3 class="detail-subhead">What the system allows</h3>
          <p class="detail-lead">How many interviews each kind of user can start, per person.</p>
          <el-table :data="startInterviewLimits" size="small" class="detail-table">
            <el-table-column prop="scope" label="Who" width="160" />
            <el-table-column prop="limit" label="Limit" width="170" />
            <el-table-column prop="plain" label="What it means" min-width="320" />
          </el-table>
          <p class="detail-note">At the same time: up to {{ maxGenerations }} interviews can be generated across everyone (shared pool) — extras queue rather than fail.</p>
        </template>

        <template v-else-if="selectedCard === 'transcription'">
          <p class="detail-lead">Live recording connections streaming audio for transcription right now. Each live session closes automatically after {{ sessionMaxHours }} hours.</p>
          <el-table v-if="transcriptionList.length" :data="transcriptionList" size="small" stripe class="detail-table">
            <el-table-column prop="id" label="Connection" min-width="220" show-overflow-tooltip />
            <el-table-column label="Connected" min-width="170">
              <template slot-scope="{ row }">{{ formatTime(row.startedAt) }}</template>
            </el-table-column>
            <el-table-column />
          </el-table>
          <p v-else class="detail-empty">No live transcriptions right now.</p>

          <h3 class="detail-subhead">What the system allows</h3>

          <p class="detail-grouplabel">Live transcription — recording in real time (limited by time, not a count):</p>
          <el-table :data="liveTranscriptionLimits" size="small" class="detail-table">
            <el-table-column prop="aspect" label="What" min-width="200" />
            <el-table-column prop="value" label="Allowed" min-width="320" />
          </el-table>

          <p class="detail-grouplabel">Answer transcription — turning recorded answers into text afterwards (counted per answer):</p>
          <el-table :data="transcribeLimits" size="small" class="detail-table">
            <el-table-column prop="scope" label="Who" width="160" />
            <el-table-column prop="limit" label="Limit" width="170" />
            <el-table-column prop="plain" label="What it means" min-width="320" />
          </el-table>
        </template>

        <template v-else-if="selectedCard === 'liveAssist'">
          <p class="detail-lead">Live Assist helper sessions connected right now.</p>
          <el-table v-if="liveAssistList.length" :data="liveAssistList" size="small" stripe class="detail-table">
            <el-table-column prop="name" label="Session" min-width="200" show-overflow-tooltip />
            <el-table-column prop="status" label="Status" width="140">
              <template slot-scope="{ row }">{{ row.status || 'LIVE' }}</template>
            </el-table-column>
            <el-table-column prop="by" label="By" min-width="180" show-overflow-tooltip>
              <template slot-scope="{ row }">{{ row.by || '—' }}</template>
            </el-table-column>
          </el-table>
          <p v-else class="detail-empty">No live sessions.</p>

          <h3 class="detail-subhead">What the system allows</h3>
          <p class="detail-lead">Live Assist runs over a live connection rather than per-request, so it has no usage quota.</p>
          <el-table :data="liveAssistLimits" size="small" class="detail-table">
            <el-table-column prop="aspect" label="What" min-width="200" />
            <el-table-column prop="value" label="Allowed" min-width="220" />
            <el-table-column />
          </el-table>
        </template>

        <template v-else-if="selectedCard === 'questionCache'">
          <p class="detail-lead">Shared question banks generated today. Each interview type builds its bank once, then every candidate of that type reuses it for the day — cutting AI generation calls. A small per-candidate set tailored to the resume and keywords is added on top.</p>
          <div class="qc-summary">
            <div class="qc-stat"><span class="qc-stat-value">{{ questionCache.banks_built_today ?? 0 }}</span><span class="qc-stat-label">Banks built today</span></div>
            <div class="qc-stat"><span class="qc-stat-value">{{ questionCache.interviews_served_from_cache ?? 0 }}</span><span class="qc-stat-label">Interviews served from cache</span></div>
            <div class="qc-stat"><span class="qc-stat-value">{{ (questionCache.estimated_openai_calls_saved ?? 0).toLocaleString() }}</span><span class="qc-stat-label">Est. AI calls saved</span></div>
            <div class="qc-stat"><span class="qc-stat-value">~${{ (questionCache.estimated_savings_usd ?? 0).toFixed(2) }}</span><span class="qc-stat-label">Est. savings</span></div>
            <div class="qc-stat"><span class="qc-stat-value">{{ questionCache.fully_personalized_bypass ?? 0 }}</span><span class="qc-stat-label">Fully-personalized (staff)</span></div>
          </div>

          <h3 class="detail-subhead">Today's banks by interview type</h3>
          <el-table v-if="questionBanks.length" :data="questionBanks" size="small" stripe class="detail-table">
            <el-table-column prop="category" label="Category" min-width="140">
              <template slot-scope="{ row }">{{ row.category || '—' }}</template>
            </el-table-column>
            <el-table-column prop="difficulty" label="Difficulty" width="140" />
            <el-table-column prop="status" label="Status" width="120">
              <template slot-scope="{ row }">
                <el-tag size="mini" :type="row.status === 'READY' ? 'success' : 'info'" effect="plain">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="count" label="Questions" width="110" align="right" />
            <el-table-column label="Built" min-width="170">
              <template slot-scope="{ row }">{{ formatTime(row.generatedAt) }}</template>
            </el-table-column>
          </el-table>
          <p v-else class="detail-empty">No question banks built today yet — the first interview of each type builds one.</p>
        </template>
      </div>
    </template>

    <div v-else-if="loading" class="loading-center">
      <i class="el-icon-loading"></i>
      <span>Loading…</span>
    </div>
  </div>
</template>

<script>
import { fetchAdminStatus, fetchAdminDetails } from '@/services/adminService';

const REFRESH_INTERVAL_MS = 10000;

export default {
  name: 'AdminStatus',
  data() {
    return {
      status: null,
      details: null,
      selectedCard: '',
      loading: false,
      detailLoading: false,
      error: '',
      lastUpdated: null,
      autoRefresh: true,
      _refreshTimer: null,
      _tickTimer: null,
      _onVisibilityChange: null,
      // eslint-disable-next-line vue/no-unused-properties
      tick: 0
    };
  },
  computed: {
    cards() {
      const s = this.status;
      if (!s) return [];
      const ex = s.interview_executor || {};
      const mem = s.memory || {};
      const tts = s.tts_cache || {};
      const qc = s.question_cache || {};
      const qcBank = qc.bank || {};
      return [
        {
          key: 'uptime',
          label: 'Uptime',
          value: this.uptimeFormatted,
          sub: 'Since last deploy or restart',
          info: 'How long the server has been running without a restart or redeploy.'
        },
        {
          key: 'transcription',
          label: 'Active Transcriptions',
          value: s.active_websocket_sessions,
          sub: 'Live recording connections',
          info: 'People recording a live transcription this very moment. Click to see live connections and who can transcribe how much.',
          rich: true
        },
        {
          key: 'interviews',
          label: 'Interviews In Progress',
          value: s.active_interviews,
          sub: 'Practice sessions running',
          info: 'Interview practice sessions that are active now. Click to see which candidates are practising.',
          rich: true
        },
        {
          key: 'liveAssist',
          label: 'Live Assist Live',
          value: s.live_assist_live,
          sub: 'Helper sessions connected',
          info: 'Live Assist interview-helper sessions connected right now. Click to see who.',
          rich: true
        },
        {
          key: 'generations',
          label: 'Interview Generations',
          value: `${ex.active ?? 0} / ${ex.max_pool ?? 0}`,
          sub: `Completed so far: ${(ex.completed_total ?? 0).toLocaleString()}`,
          info: 'AI question-generation jobs running now vs. the max that can run at once. "Completed" resets on restart.'
        },
        {
          key: 'memory',
          label: 'Memory',
          value: `${mem.used_mb ?? 0} / ${mem.max_mb ?? 0} MB`,
          sub: `${((mem.used_fraction ?? 0) * 100).toFixed(1)}% used`,
          info: 'Server memory (JVM heap) in use vs. the maximum available.',
          bar: mem.used_fraction ?? 0,
          barClass: this.memoryBarClass
        },
        {
          key: 'tts',
          label: 'Voice Cache Hit Rate',
          value: `${((tts.hit_rate ?? 0) * 100).toFixed(0)}%`,
          sub: `Saved ~$${(tts.estimated_savings_usd ?? 0).toFixed(2)} on voices`,
          info: 'How often spoken-question audio is reused from cache instead of regenerated — higher means lower voice cost.'
        },
        {
          key: 'questionCache',
          label: 'Question Cache Hit Rate',
          value: `${((qcBank.hit_rate ?? 0) * 100).toFixed(0)}%`,
          sub: `${qc.banks_built_today ?? 0} banks today · saved ~$${(qc.estimated_savings_usd ?? 0).toFixed(2)}`,
          info: 'How often interview questions are reused from the shared daily cache instead of generated fresh. Click to see today\'s question banks per interview type.',
          rich: true
        },
        {
          key: 'rateLimits',
          label: 'Rate Limits',
          value: s.rate_limit_buckets,
          sub: 'Active usage buckets',
          info: 'Distinct people/actions currently tracked against limits. Click to see who is using what and the system caps.',
          rich: true
        }
      ];
    },
    detailTitle() {
      switch (this.selectedCard) {
        case 'rateLimits': return 'Rate limits & current usage';
        case 'interviews': return 'Interviews in progress';
        case 'liveAssist': return 'Live Assist sessions';
        case 'transcription': return 'Active transcriptions';
        case 'questionCache': return 'Daily question cache';
        default: return '';
      }
    },
    rlBuckets() {
      return this.details?.rateLimits?.buckets || [];
    },
    rlCapabilities() {
      return this.details?.rateLimits?.capabilities || [];
    },
    activeInterviews() {
      return this.details?.interviews || [];
    },
    transcriptionList() {
      return this.details?.transcriptions || [];
    },
    startInterviewLimits() {
      return this.rlCapabilities.filter(c => /start interview/i.test(c.action));
    },
    transcribeLimits() {
      return this.rlCapabilities.filter(c => /transcribe/i.test(c.action));
    },
    maxGenerations() {
      return this.status?.interview_executor?.max_pool ?? 0;
    },
    sessionMaxHours() {
      return this.status?.session_max_hours ?? 4;
    },
    liveTranscriptionLimits() {
      return [
        { aspect: 'Who can use it', value: 'Staff and reviewers' },
        { aspect: 'At the same time', value: 'Multiple sessions — no concurrency limit' },
        { aspect: 'Session length', value: `Up to ${this.sessionMaxHours} hours each` },
        { aspect: 'Per-request limit', value: 'None — not metered' }
      ];
    },
    liveAssistLimits() {
      return [
        { aspect: 'Who can use it', value: 'Staff only' },
        { aspect: 'Session length', value: `Up to ${this.sessionMaxHours} hours each` },
        { aspect: 'Per-request limit', value: 'None — not metered' }
      ];
    },
    liveAssistList() {
      return this.details?.liveAssist || [];
    },
    questionCache() {
      return this.status?.question_cache || {};
    },
    questionBanks() {
      return this.details?.questionBanks || [];
    },
    uptimeFormatted() {
      if (!this.status) return '';
      // eslint-disable-next-line no-unused-vars
      const _t = this.tick;
      const elapsedSec = this.status.uptime_seconds + Math.floor((Date.now() - this.lastUpdated) / 1000);
      return this.formatDuration(elapsedSec);
    },
    updatedLabel() {
      // eslint-disable-next-line no-unused-vars
      const _t = this.tick;
      if (!this.lastUpdated) return '';
      const ageSec = Math.floor((Date.now() - this.lastUpdated) / 1000);
      if (ageSec < 5) return 'Just now';
      if (ageSec < 60) return `${ageSec}s ago`;
      const mins = Math.floor(ageSec / 60);
      return `${mins}m ago`;
    },
    memoryBarClass() {
      const frac = this.status?.memory?.used_fraction ?? 0;
      if (frac > 0.8) return 'bar-red';
      if (frac > 0.6) return 'bar-yellow';
      return 'bar-green';
    }
  },
  methods: {
    async refresh() {
      this.loading = true;
      try {
        this.status = await fetchAdminStatus();
        this.lastUpdated = Date.now();
        this.error = '';
        if (this.selectedCard) await this.loadDetails();
      } catch (e) {
        this.error = e.message || 'Failed to load status';
      } finally {
        this.loading = false;
      }
    },
    async loadDetails() {
      this.detailLoading = true;
      try {
        this.details = await fetchAdminDetails();
      } catch (e) {
        this.error = e.message || 'Failed to load details';
      } finally {
        this.detailLoading = false;
      }
    },
    selectCard(key) {
      if (this.selectedCard === key) {
        this.selectedCard = '';
        return;
      }
      this.selectedCard = key;
      this.loadDetails();
    },
    clientTagType(type) {
      if (type === 'Candidate') return 'success';
      if (type === 'Device') return 'info';
      return 'primary';
    },
    usePct(row) {
      if (!row.capacity) return 0;
      return Math.min(100, Math.round((row.used / row.capacity) * 100));
    },
    useClass(row) {
      const pct = this.usePct(row);
      if (pct >= 90) return 'use-red';
      if (pct >= 60) return 'use-yellow';
      return 'use-green';
    },
    formatTime(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    },
    startAutoRefresh() {
      this.stopAutoRefresh();
      this._refreshTimer = setInterval(() => this.refresh(), REFRESH_INTERVAL_MS);
    },
    stopAutoRefresh() {
      if (this._refreshTimer) {
        clearInterval(this._refreshTimer);
        this._refreshTimer = null;
      }
    },
    handleVisibilityChange() {
      if (!this.autoRefresh) return;
      if (document.hidden) {
        this.stopAutoRefresh();
      } else {
        this.refresh();
        this.startAutoRefresh();
      }
    },
    formatDuration(totalSec) {
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const parts = [];
      if (d > 0) parts.push(d + 'd');
      if (h > 0 || d > 0) parts.push(h + 'h');
      if (m > 0 || h > 0 || d > 0) parts.push(m + 'm');
      parts.push(s + 's');
      return parts.join(' ');
    }
  },
  mounted() {
    this.refresh();
    this.startAutoRefresh();
    this._tickTimer = setInterval(() => { this.tick++; }, 1000);
    this._onVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  },
  beforeDestroy() {
    this.stopAutoRefresh();
    if (this._tickTimer) clearInterval(this._tickTimer);
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      this._onVisibilityChange = null;
    }
  }
};
</script>

<style scoped>
.admin-status {
  padding: 24px 28px;
  max-width: 1280px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.title-block h1 {
  margin: 0 0 4px 0;
  font-size: 1.5rem;
  color: #1f2937;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.85rem;
}

.actions {
  display: flex;
  gap: 8px;
}

.error-banner {
  margin-bottom: 16px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 14px;
}

.metric-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 16px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.metric-card.clickable {
  cursor: pointer;
}

.metric-card.clickable:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.1);
  transform: translateY(-1px);
}

.metric-card.active {
  border-color: #2563eb;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.18);
}

.metric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.metric-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
  font-weight: 600;
}

.metric-info {
  color: #cbd5e1;
  cursor: help;
  font-size: 0.95rem;
}
.metric-info:hover { color: #6b7280; }

.metric-value {
  margin-top: 8px;
  font-size: 1.8rem;
  font-weight: 600;
  color: #111827;
}

.metric-sub {
  margin-top: 8px;
  color: #6b7280;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.metric-cta {
  color: #2563eb;
  font-weight: 600;
  white-space: nowrap;
}

.bar {
  margin-top: 10px;
  background: #f3f4f6;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  transition: width 0.35s ease, background-color 0.25s ease;
}
.bar-green  { background: #22c55e; }
.bar-yellow { background: #eab308; }
.bar-red    { background: #ef4444; }

.detail-panel {
  margin-top: 22px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 20px 22px;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.detail-head h2 {
  margin: 0;
  font-size: 1.15rem;
  color: #1f2937;
}

.detail-close {
  cursor: pointer;
  color: #9ca3af;
  font-size: 1.1rem;
}
.detail-close:hover { color: #4b5563; }

.detail-lead {
  margin: 0 0 14px;
  color: #6b7280;
  font-size: 0.85rem;
}

.detail-grouplabel {
  margin: 18px 0 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
}

.detail-note {
  margin: 10px 0 0;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  color: #475569;
  font-size: 0.82rem;
}

.detail-subhead {
  margin: 22px 0 10px;
  font-size: 0.95rem;
  color: #374151;
}

.detail-table {
  border: 1px solid #eef0f3;
  border-radius: 8px;
  overflow: hidden;
}

.detail-empty {
  color: #9ca3af;
  font-size: 0.9rem;
  padding: 16px;
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
}

.qc-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 8px 0 4px;
}

.qc-stat {
  display: flex;
  flex-direction: column;
  min-width: 130px;
  padding: 10px 14px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.qc-stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
}

.qc-stat-label {
  font-size: 0.78rem;
  color: #6b7280;
  margin-top: 2px;
}

.detail-loading {
  color: #909399;
  padding: 24px;
  text-align: center;
}

.col-info {
  color: #cbd5e1;
  cursor: help;
  font-size: 0.85rem;
  margin-left: 2px;
}
.col-info:hover { color: #6b7280; }

.who-id {
  margin-left: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
  color: #374151;
}

.use-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.use-bar {
  flex: 1;
  background: #f1f5f9;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  min-width: 60px;
}

.use-fill { height: 100%; }
.use-green  { background: #22c55e; }
.use-yellow { background: #eab308; }
.use-red    { background: #ef4444; }

.use-text {
  font-size: 0.8rem;
  color: #4b5563;
  white-space: nowrap;
}

.loading-center {
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

@media (max-width: 720px) {
  .header { flex-direction: column; align-items: flex-start; }
}
</style>
