<template>
  <div class="admin-status">
    <div class="header">
      <div class="title-block">
        <h1>System Status</h1>
        <p class="subtitle" v-if="lastUpdated">
          Updated {{ relativeUpdated }} · auto-refresh
          <span :class="['dot', autoRefresh ? 'dot-on' : 'dot-off']"></span>
          {{ autoRefresh ? 'on' : 'off' }}
        </p>
        <p class="subtitle" v-else>Loading…</p>
      </div>
      <div class="actions">
        <el-button size="small" :icon="autoRefresh ? 'el-icon-video-pause' : 'el-icon-video-play'"
                   @click="toggleAutoRefresh">
          {{ autoRefresh ? 'Pause' : 'Resume' }}
        </el-button>
        <el-button size="small" type="primary" icon="el-icon-refresh" :loading="loading"
                   @click="refresh">
          Refresh
        </el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error-banner" />

    <div v-if="status" class="cards-grid">
      <!-- Uptime -->
      <el-card class="metric-card" shadow="never">
        <div class="metric-label">Uptime</div>
        <div class="metric-value">{{ uptimeFormatted }}</div>
        <div class="metric-sub">Since last deploy or restart</div>
      </el-card>

      <!-- Active WebSocket sessions -->
      <el-card class="metric-card" shadow="never">
        <div class="metric-label">Active Transcription Sessions</div>
        <div class="metric-value">{{ status.active_websocket_sessions }}</div>
        <div class="metric-sub">Live WebSocket connections right now</div>
      </el-card>

      <!-- Active interviews -->
      <el-card class="metric-card" shadow="never">
        <div class="metric-label">Interviews In Progress</div>
        <div class="metric-value">{{ status.active_interviews }}</div>
        <div class="metric-sub">Interview sessions currently active</div>
      </el-card>

      <!-- Live Assist sessions live -->
      <el-card class="metric-card" shadow="never">
        <div class="metric-label">Live Assist Sessions Live</div>
        <div class="metric-value">{{ status.live_assist_live }}</div>
        <div class="metric-sub">Live Assist conversations connected right now</div>
      </el-card>

      <!-- Interview generations -->
      <el-card class="metric-card" shadow="never">
        <div class="metric-label">Interview Generations</div>
        <div class="metric-value">
          {{ status.interview_executor.active }}
          <span class="metric-secondary">/ {{ status.interview_executor.max_pool }}</span>
          <el-tag v-if="status.interview_executor.queued > 0" type="warning" size="mini" class="badge">
            {{ status.interview_executor.queued }} queued
          </el-tag>
        </div>
        <div class="metric-sub">
          Completed: {{ status.interview_executor.completed_total.toLocaleString() }}
        </div>
      </el-card>

      <!-- Memory -->
      <el-card class="metric-card" shadow="never">
        <div class="metric-label">Memory</div>
        <div class="metric-value">
          {{ status.memory.used_mb }} <span class="metric-secondary">/ {{ status.memory.max_mb }} MB</span>
        </div>
        <div class="bar">
          <div class="bar-fill" :class="memoryBarClass"
               :style="{ width: (status.memory.used_fraction * 100).toFixed(1) + '%' }"></div>
        </div>
        <div class="metric-sub">{{ (status.memory.used_fraction * 100).toFixed(1) }}% used</div>
      </el-card>

      <!-- TTS cache -->
      <el-card class="metric-card metric-card-wide" shadow="never">
        <div class="metric-label">TTS Cache</div>
        <div class="kv-grid">
          <div>
            <span class="kv-key">Hit rate</span>
            <span class="kv-value" :class="hitRateClass">
              {{ (status.tts_cache.hit_rate * 100).toFixed(1) }}%
            </span>
          </div>
          <div>
            <span class="kv-key">Entries</span>
            <span class="kv-value">{{ status.tts_cache.size.toLocaleString() }}</span>
          </div>
          <div>
            <span class="kv-key">Hits</span>
            <span class="kv-value">{{ status.tts_cache.hit_count.toLocaleString() }}</span>
          </div>
          <div>
            <span class="kv-key">Misses</span>
            <span class="kv-value">{{ status.tts_cache.miss_count.toLocaleString() }}</span>
          </div>
          <div>
            <span class="kv-key">Evictions</span>
            <span class="kv-value">{{ status.tts_cache.eviction_count.toLocaleString() }}</span>
          </div>
          <div>
            <span class="kv-key">Saved</span>
            <span class="kv-value savings">${{ status.tts_cache.estimated_savings_usd.toFixed(2) }}</span>
          </div>
        </div>
        <div class="metric-sub">
          {{ status.tts_cache.chars_saved.toLocaleString() }} characters served from cache
        </div>
      </el-card>

      <!-- Rate-limit buckets -->
      <el-card class="metric-card" shadow="never">
        <div class="metric-label">Rate-Limit Buckets</div>
        <div class="metric-value">{{ status.rate_limit_buckets }}</div>
        <div class="metric-sub">Distinct (user · route) keys tracked</div>
      </el-card>
    </div>

    <div v-else-if="loading" class="loading-state">
      <i class="el-icon-loading"></i> Loading status…
    </div>
  </div>
</template>

<script>
import { fetchAdminStatus } from '@/services/adminService';

const REFRESH_INTERVAL_MS = 10000;

export default {
  name: 'AdminStatus',
  data() {
    return {
      status: null,
      loading: false,
      error: '',
      lastUpdated: null,
      autoRefresh: true,
      _refreshTimer: null,
      _tickTimer: null,
      // Used only to trigger re-render of relativeUpdated each second.
      // eslint-disable-next-line vue/no-unused-properties
      tick: 0
    };
  },
  computed: {
    uptimeFormatted() {
      if (!this.status) return '';
      // Reading `tick` keeps this computed reactive to second-by-second ticks
      // so uptime/relative-updated visibly advance between refreshes.
      // eslint-disable-next-line no-unused-vars
      const _t = this.tick;
      const elapsedSec = this.status.uptime_seconds + Math.floor((Date.now() - this.lastUpdated) / 1000);
      return this.formatDuration(elapsedSec);
    },
    relativeUpdated() {
      // eslint-disable-next-line no-unused-vars
      const _t = this.tick;
      if (!this.lastUpdated) return '';
      const ageSec = Math.floor((Date.now() - this.lastUpdated) / 1000);
      if (ageSec < 5) return 'just now';
      if (ageSec < 60) return `${ageSec}s ago`;
      const mins = Math.floor(ageSec / 60);
      return `${mins}m ago`;
    },
    memoryBarClass() {
      const frac = this.status?.memory?.used_fraction ?? 0;
      if (frac > 0.8) return 'bar-red';
      if (frac > 0.6) return 'bar-yellow';
      return 'bar-green';
    },
    hitRateClass() {
      const rate = this.status?.tts_cache?.hit_rate ?? 0;
      if (rate > 0.5) return 'value-green';
      if (rate > 0.2) return 'value-yellow';
      return 'value-red';
    }
  },
  methods: {
    async refresh() {
      this.loading = true;
      try {
        this.status = await fetchAdminStatus();
        this.lastUpdated = Date.now();
        this.error = '';
      } catch (e) {
        this.error = e.message || 'Failed to load status';
      } finally {
        this.loading = false;
      }
    },
    toggleAutoRefresh() {
      this.autoRefresh = !this.autoRefresh;
      if (this.autoRefresh) this.startAutoRefresh();
      else this.stopAutoRefresh();
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
    // Drives the second-by-second uptime/age text without re-fetching.
    this._tickTimer = setInterval(() => { this.tick++; }, 1000);
  },
  beforeDestroy() {
    this.stopAutoRefresh();
    if (this._tickTimer) clearInterval(this._tickTimer);
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
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 4px;
}
.dot-on { background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18); }
.dot-off { background: #9ca3af; }

.actions {
  display: flex;
  gap: 8px;
}

.error-banner {
  margin-bottom: 16px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.metric-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}

.metric-card-wide {
  grid-column: span 2;
  min-width: 0;
}

.metric-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
  font-weight: 600;
}

.metric-value {
  margin-top: 8px;
  font-size: 1.8rem;
  font-weight: 600;
  color: #111827;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.metric-secondary {
  font-size: 1rem;
  color: #9ca3af;
  font-weight: 500;
}

.metric-sub {
  margin-top: 8px;
  color: #6b7280;
  font-size: 0.8rem;
}

.badge {
  margin-left: 8px;
  align-self: center;
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

.kv-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 16px;
}

.kv-grid > div {
  display: flex;
  flex-direction: column;
}

.kv-key {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #9ca3af;
}

.kv-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: #111827;
  margin-top: 2px;
}

.value-green  { color: #16a34a; }
.value-yellow { color: #ca8a04; }
.value-red    { color: #dc2626; }

.savings {
  color: #16a34a;
}

.loading-state {
  padding: 48px;
  text-align: center;
  color: #6b7280;
  font-size: 0.95rem;
}

@media (max-width: 720px) {
  .metric-card-wide { grid-column: span 1; }
  .kv-grid { grid-template-columns: repeat(2, 1fr); }
  .header { flex-direction: column; align-items: flex-start; }
}
</style>
