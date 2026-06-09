<template>
  <div class="all-interviews-view">
    <div class="dashboard-header">
      <div class="header-left">
        <el-button size="small" icon="el-icon-back" @click="goBack">Back</el-button>
        <h2>All Interviews</h2>
      </div>
    </div>

    <div class="layout">
      <div class="list-col">
        <div class="search-row">
          <el-input v-model="search" size="small" clearable placeholder="Search name…" prefix-icon="el-icon-search" />
          <el-badge :value="activeFilterCount" :hidden="!activeFilterCount" type="primary">
            <el-button size="small" :type="showFilters ? 'primary' : 'default'" icon="el-icon-s-operation" @click="showFilters = !showFilters" />
          </el-badge>
        </div>

        <div v-show="showFilters" class="filters">
          <el-select v-model="filters.status" size="small" clearable placeholder="Status">
            <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-select v-model="filters.completion" size="small" clearable placeholder="Completion">
            <el-option label="Complete" value="complete" />
            <el-option label="Incomplete" value="incomplete" />
          </el-select>
          <el-select v-model="filters.difficulty" size="small" clearable placeholder="Difficulty">
            <el-option v-for="d in difficultyOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </div>

        <div v-if="loading && !sessions.length" class="empty">Loading…</div>
        <div v-else-if="!sessions.length" class="empty">No interviews yet.</div>
        <div v-else-if="!filteredSessions.length" class="empty">No interviews match the filters.</div>
        <ul v-else class="session-list">
          <li
            v-for="s in filteredSessions"
            :key="s.id"
            :class="['session-item', { active: selectedId === s.id }]"
            @click="select(s)"
          >
            <div class="item-title">{{ s.candidateName || 'Interview' }}</div>
            <div class="item-meta">
              <span class="item-date">{{ formatDate(s.endedAt || s.createdAt) }}</span>
              <el-tag :type="statusType(s.status)" size="mini" effect="dark">{{ statusLabel(s.status) }}</el-tag>
            </div>
          </li>
        </ul>
      </div>

      <div class="detail-panel">
        <div v-if="!selectedId" class="empty-detail">
          <i class="el-icon-document empty-icon"></i>
          <p>Select an interview to view its details.</p>
        </div>
        <div v-else class="detail-wrap">
          <SummaryView :session-id="selectedId" :key="selectedId" embedded class="embedded-summary">
            <template #header-actions>
              <el-dropdown trigger="click" @command="onCommand">
                <i class="el-icon-more detail-menu"></i>
                <el-dropdown-menu slot="dropdown">
                  <el-dropdown-item v-if="detail && detail.enrollmentId" command="candidate" icon="el-icon-data-line">View candidate history</el-dropdown-item>
                  <el-dropdown-item command="delete" icon="el-icon-delete">Delete</el-dropdown-item>
                </el-dropdown-menu>
              </el-dropdown>
            </template>
          </SummaryView>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { listRecentSessions, deleteSession } from '@/store/interviewHistoryStore';
import SummaryView from './SummaryView.vue';

export default {
  name: 'AllInterviews',
  components: { SummaryView },
  data() {
    return {
      sessions: [],
      loading: true,
      search: '',
      showFilters: false,
      filters: { status: '', completion: '', difficulty: '' },
      selectedId: '',
      detail: null,
      statusOptions: [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'ENDED', label: 'Ended' },
        { value: 'ANALYZED', label: 'Analyzed' }
      ]
    };
  },
  computed: {
    activeFilterCount() {
      return Object.values(this.filters).filter(Boolean).length;
    },
    difficultyOptions() {
      return [...new Set(this.sessions.map(s => s.difficulty).filter(Boolean))];
    },
    filteredSessions() {
      const q = this.search.trim().toLowerCase();
      return this.sessions.filter(s => {
        if (q && !(s.candidateName || '').toLowerCase().includes(q)) return false;
        if (this.filters.status && s.status !== this.filters.status) return false;
        if (this.filters.difficulty && s.difficulty !== this.filters.difficulty) return false;
        if (this.filters.completion === 'complete' && !s.completed) return false;
        if (this.filters.completion === 'incomplete' && s.completed) return false;
        return true;
      });
    }
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    async refresh() {
      this.loading = true;
      try {
        const list = await listRecentSessions(null);
        this.sessions = Array.isArray(list) ? list : [];
      } catch (e) {
        this.sessions = [];
      } finally {
        this.loading = false;
      }
    },
    select(s) {
      this.selectedId = s.id;
      this.detail = s;
    },
    async remove(s) {
      try {
        await this.$confirm('Delete this interview? This cannot be undone.', 'Delete interview', {
          confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning'
        });
      } catch (e) { return; }
      try {
        await deleteSession(s.id);
        this.sessions = this.sessions.filter(x => x.id !== s.id);
        if (this.selectedId === s.id) { this.selectedId = ''; this.detail = null; }
      } catch (e) { /* best-effort */ }
    },
    onCommand(cmd) {
      if (cmd === 'delete') this.remove(this.detail);
      else if (cmd === 'candidate' && this.detail) this.viewCandidate(this.detail.enrollmentId);
    },
    goBack() {
      this.$router.push({ name: 'MyInterviews' });
    },
    viewCandidate(enrollmentId) {
      this.$router.push({ name: 'CandidateOverview', query: { enrollmentId } });
    },
    formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    },
    statusLabel(status) {
      if (status === 'ANALYZED') return 'Analyzed';
      if (status === 'ENDED') return 'Ended';
      if (status === 'ACTIVE') return 'Active';
      return status || '—';
    },
    statusType(status) {
      if (status === 'ANALYZED') return 'primary';
      if (status === 'ACTIVE') return 'warning';
      return 'info';
    }
  }
};
</script>

<style scoped>
.all-interviews-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 0 40px 40px 40px;
  overflow: hidden;
}

.dashboard-header {
  display: flex;
  align-items: center;
  margin: 40px 0 20px 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h2 {
  font-size: 28px;
  color: #2c3e50;
  margin: 0;
  font-weight: 700;
}

.layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.list-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
}

.search-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.session-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}

.session-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
}

.session-item:hover { background: #f8fafc; }
.session-item.active { background: #eff6ff; border-color: #bfdbfe; }

.item-title { font-weight: 600; color: #1e293b; margin-bottom: 4px; }

.item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-date { font-size: 0.78rem; color: #94a3b8; }

.detail-panel {
  min-height: 0;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
}

.empty, .empty-detail { color: #94a3b8; text-align: center; padding: 40px 20px; }
.empty-icon { font-size: 44px; color: #cbd5e1; display: block; margin-bottom: 12px; }

.detail-menu {
  font-size: 20px;
  color: #94a3b8;
  cursor: pointer;
}

.embedded-summary {
  display: block;
}
</style>
