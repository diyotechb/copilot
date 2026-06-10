<template>
  <div class="candidate-overview-view">
    <div class="dashboard-header">
      <h2>Candidate Practice</h2>
      <el-button type="primary" class="start-btn" @click="startNew">
        Start Interview <i class="el-icon-right"></i>
      </el-button>
    </div>

    <div class="table-toolbar">
      <el-input
        v-model="search"
        size="small"
        clearable
        class="search-box"
        placeholder="Search candidate…"
        prefix-icon="el-icon-search"
      />
    </div>

    <el-table
      v-loading="loading"
      :data="filteredCandidates"
      class="candidate-table"
      highlight-current-row
      :default-sort="{ prop: 'practiceCount', order: 'descending' }"
      empty-text="No candidate practice yet."
      @row-click="select"
    >
      <el-table-column prop="candidateName" label="Candidate" min-width="180">
        <template slot-scope="{ row }">{{ row.candidateName || 'Candidate' }}</template>
      </el-table-column>
      <el-table-column prop="practiceCount" label="Practices" width="120" sortable align="center" />
      <el-table-column prop="avgScore" label="Avg score" width="130" sortable align="center">
        <template slot-scope="{ row }">{{ row.avgScore != null ? formatScore(row.avgScore) : '—' }}</template>
      </el-table-column>
      <el-table-column prop="bestScore" label="Best" width="100" sortable align="center">
        <template slot-scope="{ row }">{{ row.bestScore != null ? formatScore(row.bestScore) : '—' }}</template>
      </el-table-column>
      <el-table-column prop="lastPracticedAt" label="Last practiced" min-width="180" sortable>
        <template slot-scope="{ row }">{{ formatDate(row.lastPracticedAt) }}</template>
      </el-table-column>
    </el-table>

    <el-card v-if="selectedId" class="detail-card" shadow="never">
      <div class="detail-head">
        <h3>{{ selectedName }} — attempts</h3>
        <el-select v-model="statusFilter" size="mini" clearable placeholder="Status">
          <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </div>
      <div v-if="loadingDetail" class="empty">Loading attempts…</div>
      <div v-else-if="!filteredAttempts.length" class="empty">No attempts found.</div>
      <ul v-else class="attempt-list">
        <li v-for="a in filteredAttempts" :key="a.id" class="attempt-row">
          <span class="attempt-date" @click="openSession(a.id)">{{ formatDate(a.endedAt || a.createdAt) }}</span>
          <span class="attempt-diff">{{ a.difficulty || '—' }}</span>
          <span class="attempt-complete" :class="a.completed ? 'cmp-yes' : 'cmp-no'">{{ a.completed ? 'Complete' : 'Incomplete' }}</span>
          <el-tag :type="statusType(a.status)" size="mini" effect="dark">{{ statusLabel(a.status) }}</el-tag>
          <span v-if="a.avgScore != null" class="attempt-score">{{ formatScore(a.avgScore) }} / 10</span>
          <span v-else class="attempt-score muted">—</span>
          <button v-if="isStaff" class="del-btn" title="Delete attempt" @click.stop="remove(a)"><i class="el-icon-delete"></i></button>
        </li>
      </ul>
    </el-card>
  </div>
</template>

<script>
import interviewApi from '@/services/interviewApi';
import authService from '@/services/authService';
import { ROLE_GROUPS, hasAnyRole } from '@/constants/roles';

export default {
  name: 'CandidateOverview',
  data() {
    return {
      candidates: [],
      loading: true,
      search: '',
      selectedId: '',
      selectedName: '',
      attempts: [],
      loadingDetail: false,
      statusFilter: '',
      statusOptions: [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'ENDED', label: 'Ended' },
        { value: 'ANALYZED', label: 'Analyzed' }
      ]
    };
  },
  computed: {
    isStaff() {
      return hasAnyRole(authService.getUserRoles(), ROLE_GROUPS.STAFF);
    },
    filteredCandidates() {
      const q = this.search.trim().toLowerCase();
      if (!q) return this.candidates;
      return this.candidates.filter(c => (c.candidateName || '').toLowerCase().includes(q));
    },
    filteredAttempts() {
      if (!this.statusFilter) return this.attempts;
      return this.attempts.filter(a => a.status === this.statusFilter);
    }
  },
  async mounted() {
    await this.refresh();
    const pre = this.$route.query.enrollmentId;
    if (pre) this.select({ enrollmentId: String(pre), candidateName: '' });
  },
  methods: {
    async refresh() {
      this.loading = true;
      try {
        const stats = await interviewApi.listCandidateStats();
        this.candidates = Array.isArray(stats) ? stats : [];
      } catch (e) {
        this.candidates = [];
      } finally {
        this.loading = false;
      }
    },
    async select(row) {
      this.selectedId = row.enrollmentId;
      this.selectedName = row.candidateName || (this.candidates.find(c => c.enrollmentId === row.enrollmentId) || {}).candidateName || 'Candidate';
      this.statusFilter = '';
      this.attempts = [];
      this.loadingDetail = true;
      try {
        const list = await interviewApi.listByCandidate(this.selectedId, 50);
        this.attempts = Array.isArray(list) ? list : [];
      } catch (e) {
        this.attempts = [];
      } finally {
        this.loadingDetail = false;
      }
    },
    async remove(a) {
      try {
        await this.$confirm('Delete this practice attempt? This cannot be undone.', 'Delete attempt', {
          confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning'
        });
      } catch (e) { return; }
      try {
        await interviewApi.deleteSession(a.id);
        this.attempts = this.attempts.filter(x => x.id !== a.id);
        await this.refresh();
      } catch (e) { /* best-effort */ }
    },
    startNew() {
      this.$router.push({ name: 'ResumeSetup' });
    },
    openSession(id) {
      this.$router.push({ name: 'SummaryView', query: { sessionId: id } });
    },
    formatScore(v) {
      return (typeof v === 'number' && !isNaN(v)) ? (Math.round(v * 10) / 10) : '—';
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
.candidate-overview-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 0 40px 40px 40px;
  overflow-y: auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 40px 0 20px 0;
  gap: 16px;
}

.dashboard-header h2 {
  font-size: 28px;
  color: #2c3e50;
  margin: 0;
  font-weight: 700;
}

.table-toolbar {
  margin-bottom: 14px;
}

.search-box {
  max-width: 320px;
}

.candidate-table {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  overflow: hidden;
}

.candidate-table >>> th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
}

.candidate-table >>> .el-table__row:hover > td {
  background: #f8fafc;
}

.detail-card {
  margin-top: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.detail-head h3 {
  margin: 0;
  color: #1e293b;
}

.empty {
  color: #94a3b8;
  text-align: center;
  padding: 24px;
}

.attempt-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.attempt-row {
  display: grid;
  grid-template-columns: 1.4fr 0.9fr 1fr 0.9fr 0.8fr 40px;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  font-size: 0.85rem;
  color: #4b5563;
  border-top: 1px solid #eef2f7;
}

.attempt-row:first-child {
  border-top: none;
}

.attempt-date {
  cursor: pointer;
  color: #2563eb;
}

.attempt-complete {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.cmp-yes { color: #16a34a; }
.cmp-no { color: #b45309; }

.attempt-score {
  font-weight: 600;
  color: #2563eb;
  text-align: right;
}

.attempt-score.muted {
  color: #94a3b8;
  font-weight: 500;
}

.del-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  cursor: pointer;
  padding: 4px;
}

.del-btn:hover {
  color: #ef4444;
}
</style>
