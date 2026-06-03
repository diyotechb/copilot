<template>
  <div class="live-assist-sessions-view">
   <div class="dashboard-view">
    <div class="dashboard-header">
      <h2>Live Assist Sessions</h2>
      <div class="header-actions">
        <el-button type="primary" size="small" class="start-session-btn" @click="$router.push({ name: 'LiveAssist' })">Start New Session</el-button>
      </div>
    </div>

    <div class="layout">
      <div class="list-col">
        <div class="search-row">
          <el-input
            v-model="filters.text"
            size="small"
            clearable
            placeholder="Search name, client, session…"
            prefix-icon="el-icon-search"
          />
          <el-badge :value="activeFilterCount" :hidden="!activeFilterCount" type="primary">
            <el-button
              size="small"
              :type="showFilters ? 'primary' : 'default'"
              icon="el-icon-s-operation"
              @click="showFilters = !showFilters"
            />
          </el-badge>
        </div>

        <div v-show="showFilters" class="filters">
          <div class="filter-row">
            <el-select v-model="filters.status" size="small" clearable placeholder="Status">
              <el-option v-for="o in statusOptions" :key="o" :label="o" :value="o" />
            </el-select>
            <el-select v-model="filters.outcome" size="small" clearable placeholder="Outcome">
              <el-option v-for="o in outcomeOptions" :key="o" :label="o" :value="o" />
            </el-select>
          </div>
          <div class="filter-row">
            <el-select v-model="filters.client" size="small" clearable filterable placeholder="Client">
              <el-option v-for="o in clientOptions" :key="o" :label="o" :value="o" />
            </el-select>
            <el-select v-model="filters.task" size="small" clearable placeholder="Task">
              <el-option v-for="o in taskOptions" :key="o" :label="o" :value="o" />
            </el-select>
          </div>
          <div class="filter-row">
            <el-select v-model="filters.callTaker" size="small" clearable filterable placeholder="Call taker">
              <el-option v-for="o in callTakerOptions" :key="o" :label="o" :value="o" />
            </el-select>
            <el-date-picker
              v-model="filters.date"
              size="small"
              type="date"
              value-format="yyyy-MM-dd"
              placeholder="Interview date"
            />
          </div>
          <div class="filter-actions">
            <el-button type="text" size="mini" @click="clearFilters">Clear filters</el-button>
          </div>
        </div>

        <div v-if="loadingList && !sessions.length" class="empty">Loading…</div>
        <div v-else-if="!sessions.length" class="empty">No saved sessions yet.</div>
        <div v-else-if="!filteredSessions.length" class="empty">No sessions match the filters.</div>
        <ul v-else class="session-list">
          <li
            v-for="s in filteredSessions"
            :key="s.sessionId"
            :class="['session-item', { active: selectedId === s.sessionId }]"
            @click="select(s.sessionId)"
          >
            <div class="item-title">{{ sessionName(s) }}</div>
            <div class="item-meta">
              <span class="item-date">{{ formatDate(s.createdAt) }}</span>
              <span class="item-tags">
                <el-tag :type="statusType(s.status)" size="mini" effect="dark">{{ s.status }}</el-tag>
                <el-tag v-if="s.outcome" size="mini" effect="dark">{{ s.outcome }}</el-tag>
              </span>
            </div>
          </li>
        </ul>
      </div>

      <el-card class="detail-panel" shadow="never">
        <div v-if="!selectedId" class="empty-detail">
          <i class="el-icon-document empty-icon"></i>
          <p>Select a session to view its transcript and evaluation.</p>
        </div>
        <div v-else-if="loadingDetail" class="empty">Loading session…</div>
        <div v-else-if="detail">
        <p class="detail-recorded">
          Created <b>{{ formatDate(detail.createdAt) }}</b>
          <span v-if="detail.updatedAt"> · Last updated <b>{{ formatDate(detail.updatedAt) }}</b></span>
        </p>
          <div class="detail-head">
            <div class="detail-title">
              <h2 v-if="!editingName" @click="startEditName">{{ sessionName(detail) }}</h2>
              <el-input
                v-else
                ref="nameInput"
                v-model="editName"
                size="small"
                class="name-edit"
                @keyup.enter.native="saveName"
                @blur="saveName"
              />
              <el-button type="text" icon="el-icon-edit" class="edit-name-btn" @click="startEditName"></el-button>
            </div>
            <div class="detail-head-right">
              <el-tag :type="statusType(detail.status)" size="small" effect="dark">{{ detail.status }}</el-tag>
              <el-dropdown trigger="click" @command="onItemCommand($event, detail)">
                <i class="el-icon-more detail-menu"></i>
                <el-dropdown-menu slot="dropdown">
                  <el-dropdown-item command="delete" icon="el-icon-delete">Delete</el-dropdown-item>
                </el-dropdown-menu>
              </el-dropdown>
            </div>
          </div>

          <p v-if="detailSublineParts.length" class="detail-subline">
            <template v-for="(seg, i) in detailSublineParts">{{ seg.text }}<b v-if="seg.bold" :key="i">{{ seg.bold }}</b></template>
          </p>

          <div class="detail-meta">
            <span><span class="meta-key">Conversation ID</span> <code>{{ detail.conversationId }}</code></span>
            <span><span class="meta-key">Session ID</span> <code>{{ detail.sessionId }}</code></span>
          </div>

          <div class="outcome-row">
            <span class="outcome-label">Outcome</span>
            <el-select
              v-model="detail.outcome"
              size="small"
              clearable
              placeholder="Set outcome"
              :loading="savingOutcome"
              @change="saveOutcome"
            >
              <el-option v-for="o in outcomeOptions" :key="o" :label="o" :value="o" />
            </el-select>
          </div>

          <div v-if="detail.jobDescription || detail.notes" class="context-box">
            <div v-if="detail.jobDescription" class="context-item">
              <div class="context-label">Job Description</div>
              <p class="context-text">{{ detail.jobDescription }}</p>
            </div>
            <div v-if="detail.notes" class="context-item">
              <div class="context-label">Additional Notes</div>
              <p class="context-text">{{ detail.notes }}</p>
            </div>
          </div>

          <div v-if="summary" class="summary-box">
            <div class="summary-top">
              <strong>AI Evaluation</strong>
              <span class="score-badge">Score: {{ summary.score }}/10</span>
            </div>
            <p v-if="summary.overall" class="overall">{{ summary.overall }}</p>
            <div class="sw">
              <div class="col">
                <div class="col-title strong">Strengths</div>
                <ul><li v-for="(x, i) in summary.strengths" :key="'s' + i">{{ x }}</li></ul>
                <div v-if="!summary.strengths || !summary.strengths.length" class="none">—</div>
              </div>
              <div class="col">
                <div class="col-title weak">Areas to improve</div>
                <ul><li v-for="(x, i) in summary.weaknesses" :key="'w' + i">{{ x }}</li></ul>
                <div v-if="!summary.weaknesses || !summary.weaknesses.length" class="none">—</div>
              </div>
            </div>
          </div>
          <div v-else class="no-summary">
            <div class="no-summary-text">
              <strong>No AI evaluation yet</strong>
              <span>This session wasn't analyzed. Generate the evaluation from its transcript.</span>
            </div>
            <el-button
              type="primary"
              size="small"
              :loading="analyzing"
              :disabled="!pairs.length"
              @click="analyze"
            >Analyze now</el-button>
          </div>

          <div class="qa">
            <div class="qa-header">Transcript</div>
            <div v-if="!pairs.length" class="empty">No transcript recorded for this session.</div>
            <div v-for="(p, i) in pairs" :key="'p' + i" class="pair">
              <div class="q"><span class="tag">Interviewer</span>{{ p.question }}</div>
              <div class="a"><span class="tag tag-a">AI Answer</span>{{ p.answer }}</div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
   </div>

    <ConfirmDialog
      :visible.sync="confirmVisible"
      :title="confirmConfig.title"
      :message="confirmConfig.message"
      :type="confirmConfig.type"
      :confirm-text="confirmConfig.confirmText"
      :cancel-text="confirmConfig.cancelText"
      :icon="confirmConfig.icon"
      @confirm="onConfirmAccept"
      @cancel="onConfirmCancel"
    />
  </div>
</template>

<script>
import { backendUrl, authHeaders, assertOk } from '@/services/backendApi';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

export default {
  name: 'LiveAssistSessionsView',
  components: { ConfirmDialog },
  data() {
    return {
      sessions: [],
      loadingList: false,
      selectedId: '',
      detail: null,
      loadingDetail: false,
      analyzing: false,
      savingOutcome: false,
      editingName: false,
      editName: '',
      outcomeOptions: ['OFFERED', 'REJECTED', 'ADVANCED', 'WAITING', 'GHOSTED', 'NA'],
      statusOptions: ['ACTIVE', 'ENDED', 'COMPLETED'],
      showFilters: false,
      filters: { text: '', status: '', outcome: '', client: '', task: '', callTaker: '', date: '' },
      confirmVisible: false,
      confirmConfig: { title: '', message: '', type: 'warning', confirmText: 'Confirm', cancelText: 'Cancel', icon: 'el-icon-warning-outline' },
      confirmResolver: null
    };
  },
  computed: {
    activeFilterCount() {
      const f = this.filters;
      return ['status', 'outcome', 'client', 'task', 'callTaker', 'date'].filter(k => f[k]).length;
    },
    clientOptions() {
      return [...new Set(this.sessions.map(s => s.client).filter(Boolean))].sort();
    },
    taskOptions() {
      return [...new Set(this.sessions.map(s => s.task).filter(Boolean))].sort();
    },
    callTakerOptions() {
      return [...new Set(this.sessions.map(s => s.callTaker).filter(Boolean))].sort();
    },
    filteredSessions() {
      const f = this.filters;
      const text = f.text.trim().toLowerCase();
      return this.sessions.filter(s => {
        if (f.status && s.status !== f.status) return false;
        if (f.outcome && s.outcome !== f.outcome) return false;
        if (f.client && s.client !== f.client) return false;
        if (f.task && s.task !== f.task) return false;
        if (f.callTaker && s.callTaker !== f.callTaker) return false;
        if (f.date && (s.interviewDateTime || '').slice(0, 10) !== f.date) return false;
        if (text) {
          const hay = [s.label, s.candidateName, s.client].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(text)) return false;
        }
        return true;
      });
    },
    detailSublineParts() {
      const d = this.detail;
      if (!d) return [];
      const parts = [];
      if (d.vendor) parts.push({ text: 'Interview through ', bold: d.vendor });
      if (d.client) parts.push({ text: ' with ', bold: this.toTitleCase(d.client) });
      if (d.interviewDateTime) parts.push({ text: ' on ', bold: this.formatEt(d.interviewDateTime) });
      return parts;
    },
    summary() {
      if (!this.detail || !this.detail.summary) return null;
      try {
        return typeof this.detail.summary === 'string'
          ? JSON.parse(this.detail.summary)
          : this.detail.summary;
      } catch (e) {
        return null;
      }
    },
    pairs() {
      const msgs = (this.detail && this.detail.messages) || [];
      const out = [];
      for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].role === 'user') {
          const next = msgs[i + 1];
          out.push({
            question: msgs[i].content,
            answer: next && next.role === 'assistant' ? next.content : ''
          });
          if (next && next.role === 'assistant') i++;
        }
      }
      return out;
    }
  },
  async mounted() {
    await this.loadList();
    const id = this.$route.query.sessionId;
    if (id) this.select(id);
  },
  methods: {
    askConfirm(config) {
      this.confirmConfig = {
        title: config.title || 'Confirm',
        message: config.message || '',
        type: config.type || 'warning',
        confirmText: config.confirmText || 'Confirm',
        cancelText: config.cancelText || 'Cancel',
        icon: config.icon || 'el-icon-warning-outline'
      };
      this.confirmVisible = true;
      return new Promise((resolve) => { this.confirmResolver = resolve; });
    },
    onConfirmAccept() {
      this.confirmVisible = false;
      if (this.confirmResolver) { this.confirmResolver(true); this.confirmResolver = null; }
    },
    onConfirmCancel() {
      this.confirmVisible = false;
      if (this.confirmResolver) { this.confirmResolver(false); this.confirmResolver = null; }
    },
    async loadList() {
      this.loadingList = true;
      try {
        const res = await fetch(backendUrl('/ws/live-assist/sessions'), { headers: authHeaders() });
        await assertOk(res, 'Load sessions');
        this.sessions = await res.json();
      } catch (e) {
        this.$message.error(e.message);
      } finally {
        this.loadingList = false;
      }
    },
    async select(id) {
      this.selectedId = id;
      this.detail = null;
      this.loadingDetail = true;
      if (this.$route.query.sessionId !== id) {
        this.$router.push({ query: { ...this.$route.query, sessionId: id } }).catch(() => {});
      }
      try {
        const res = await fetch(backendUrl(`/ws/live-assist/session/${encodeURIComponent(id)}`), { headers: authHeaders() });
        await assertOk(res, 'Load session');
        const data = await res.json();
        if (data.ok) this.detail = data;
        else this.$message.error(data.error || 'Could not load session');
      } catch (e) {
        this.$message.error(e.message);
      } finally {
        this.loadingDetail = false;
      }
    },
    startEditName() {
      this.editName = this.sessionName(this.detail);
      this.editingName = true;
      this.$nextTick(() => {
        const el = this.$refs.nameInput;
        if (el && el.focus) el.focus();
      });
    },
    async saveName() {
      if (!this.editingName) return;
      this.editingName = false;
      const newName = (this.editName || '').trim();
      if (!newName || newName === this.sessionName(this.detail)) return;
      try {
        const res = await fetch(backendUrl(`/ws/live-assist/session/${encodeURIComponent(this.selectedId)}/rename`), {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ label: newName })
        });
        await assertOk(res, 'Rename session');
        const data = await res.json();
        if (!data.ok) { this.$message.error(data.error || 'Rename failed'); return; }
        this.detail.label = data.label;
        const s = this.sessions.find(x => x.sessionId === this.selectedId);
        if (s) s.label = data.label;
        this.$message.success('Session renamed');
      } catch (e) {
        this.$message.error(e.message);
      }
    },
    async saveOutcome(value) {
      if (!this.selectedId) return;
      this.savingOutcome = true;
      try {
        const res = await fetch(backendUrl(`/ws/live-assist/session/${encodeURIComponent(this.selectedId)}/outcome`), {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ outcome: value || '' })
        });
        await assertOk(res, 'Save outcome');
        const s = this.sessions.find(x => x.sessionId === this.selectedId);
        if (s) s.outcome = value || '';
        this.$message.success('Outcome saved');
      } catch (e) {
        this.$message.error(e.message);
      } finally {
        this.savingOutcome = false;
      }
    },
    async analyze() {
      if (!this.selectedId || !this.pairs.length) return;
      this.analyzing = true;
      try {
        const res = await fetch(backendUrl('/ws/live-assist/session/complete'), {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ sessionId: this.selectedId })
        });
        await assertOk(res, 'Analyze interview');
        const data = await res.json();
        if (!data.ok) {
          this.$message.error(data.error || 'Analysis failed');
          return;
        }
        await this.select(this.selectedId);
        await this.loadList();
        this.$message.success('Session analyzed');
      } catch (e) {
        this.$message.error(e.message);
      } finally {
        this.analyzing = false;
      }
    },
    async remove(s) {
      const ok = await this.askConfirm({
        title: 'Delete session?',
        message: 'Delete this session and its transcript? This cannot be undone.',
        type: 'danger',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        icon: 'el-icon-delete'
      });
      if (!ok) return;
      try {
        const res = await fetch(backendUrl(`/ws/live-assist/session/${encodeURIComponent(s.sessionId)}`), {
          method: 'DELETE',
          headers: authHeaders()
        });
        await assertOk(res, 'Delete interview');
        if (this.selectedId === s.sessionId) {
          this.selectedId = '';
          this.detail = null;
        }
        await this.loadList();
        this.$message.success('Session deleted');
      } catch (e) {
        this.$message.error(e.message);
      }
    },
    onItemCommand(command, s) {
      if (command === 'delete') this.remove(s);
    },
    clearFilters() {
      this.filters.status = '';
      this.filters.outcome = '';
      this.filters.client = '';
      this.filters.task = '';
      this.filters.callTaker = '';
      this.filters.date = '';
    },
    sessionName(s) {
      if (s && s.label) return s.label;
      const ts = (s && s.createdAt) || (this.detail && this.detail.createdAt);
      if (!ts) return 'Session';
      return `Session - ${new Date(ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`;
    },
    toTitleCase(str) {
      if (!str) return '';
      return str.replace(/_/g, ' ').toLowerCase().trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    },
    statusType(status) {
      if (status === 'COMPLETED') return 'success';
      if (status === 'ENDED') return 'warning';
      return 'info';
    },
    formatDate(ts) {
      if (!ts) return '';
      return new Date(ts).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    },
    formatEt(dt) {
      if (!dt) return '';
      const [datePart, timePart = ''] = dt.split('T');
      const [y, m, d] = datePart.split('-').map(Number);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      let label = `${months[(m || 1) - 1]} ${d}, ${y}`;
      const [hh, mm] = timePart.split(':').map(Number);
      if (!isNaN(hh)) {
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const h12 = hh % 12 === 0 ? 12 : hh % 12;
        label += `, ${h12}:${String(mm || 0).padStart(2, '0')} ${ampm} ET`;
      }
      return label;
    }
  }
};
</script>

<style scoped>
.live-assist-sessions-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  background-color: #f9fafe;
  color: #333;
}

.dashboard-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 0 40px 40px 40px;
  overflow: hidden;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 40px 0 20px 0;
}

.dashboard-header h2 {
  font-size: 28px;
  color: #2c3e50;
  margin: 0;
  font-weight: 700;
}

.header-actions { display: flex; gap: 10px; }
.start-session-btn { font-weight: 700; border-radius: 10px; }

.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  flex-grow: 1;
  min-height: 0;
}

.list-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.search-row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-shrink: 0; }
.search-row .el-input { flex: 1; }
.filters {
  display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; flex-shrink: 0;
  background: #fff; border: 1px solid #e4e7ed; border-radius: 10px; padding: 12px;
}
.filter-row { display: flex; gap: 8px; }
.filter-row > * { flex: 1; min-width: 0; }
.filter-actions { display: flex; justify-content: flex-end; }

.session-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex-grow: 1;
}

.session-item {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.session-item:hover { border-color: #c6e2ff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.session-item.active { border-color: #409eff; box-shadow: 0 2px 10px rgba(64,158,255,0.15); }

.item-title { font-weight: 600; color: #2c3e50; font-size: 14px; line-height: 1.4; }
.item-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.item-date { color: #909399; font-size: 11px; }
.item-tags { margin-left: auto; display: flex; gap: 6px; }
.detail-menu { color: #c0c4cc; cursor: pointer; padding: 2px; font-size: 18px; transform: rotate(90deg); }
.detail-menu:hover { color: #606266; }

.detail-panel {
  overflow-y: auto;
  border-radius: 12px;
}
.detail-panel >>> .el-card__body { height: 100%; }

.empty-detail {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; min-height: 300px; color: #909399;
}
.empty-detail .empty-icon { font-size: 56px; color: #dcdfe6; margin-bottom: 16px; }

.detail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.detail-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.detail-title h2 { margin: 0; font-size: 20px; color: #2c3e50; cursor: pointer; }
.detail-title h2:hover { color: #409eff; }
.name-edit { width: 360px; }
.edit-name-btn { padding: 0; color: #c0c4cc; }
.edit-name-btn:hover { color: #409eff; }
.detail-head-right { display: flex; align-items: center; gap: 10px; }

.detail-subline { margin: 5px 0 15px; font-size: 13px; color: #64666b; }
.detail-recorded { margin: 0 0 18px; font-size: 12px; color: #909399; }

.detail-meta { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 0 0 18px; font-size: 13px; color: #5c6b7a; }
.detail-meta .meta-key { color: #5c6b7a; margin-right: 4px; }
.detail-meta code { background: #fff; border: 1px solid #d9ecff; border-radius: 4px; padding: 1px 6px; color: #409eff; font-weight: 600; }

.outcome-row { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
.outcome-label { font-size: 13px; font-weight: 600; color: #606266; }

.no-summary {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: #f8fafc; border: 1px solid #e4e7ed; border-radius: 12px;
  padding: 16px; margin-bottom: 20px;
}
.no-summary-text { display: flex; flex-direction: column; gap: 2px; }
.no-summary-text strong { color: #2c3e50; }
.no-summary-text span { color: #909399; font-size: 13px; }

.context-box { background: #fafafa; border: 1px solid #ebeef5; border-radius: 12px; padding: 18px; margin-bottom: 16px; }
.context-item + .context-item { margin-top: 14px; }
.context-label { font-size: 13px; font-weight: 600; color: #2c3e50; margin-bottom: 6px; }
.context-text { margin: 0; font-size: 13px; color: #606266; line-height: 1.6; white-space: pre-wrap; }
.summary-box { background: #f5f9ff; border: 1px solid #d9ecff; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
.summary-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.summary-top strong { color: #2c3e50; font-size: 15px; }
.overall { margin: 4px 0 14px; color: #475569; line-height: 1.6; }
.sw { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.col-title { font-weight: 600; font-size: 13px; margin-bottom: 6px; }
.col-title.strong { color: #67c23a; }
.col-title.weak { color: #e6a23c; }
.col ul { margin: 0; padding-left: 18px; }
.col li { margin: 3px 0; font-size: 13px; line-height: 1.5; }
.none { color: #c0c4cc; }

.qa-header { font-weight: 600; color: #606266; font-size: 14px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e4e7ed; }
.pair { padding: 14px 0; border-bottom: 1px solid #f0f2f5; }
.q { font-weight: 500; margin-bottom: 8px; line-height: 1.6; color: #2c3e50; }
.a { color: #303133; line-height: 1.6; white-space: pre-wrap; }
.tag {
  display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; padding: 3px 10px; border-radius: 6px; margin-right: 8px;
  background: #409eff; color: #fff; vertical-align: middle;
}
.tag-a { background: #67c23a; }

.score-badge {
  background: #409eff; color: #fff; font-weight: 700; font-size: 13px;
  padding: 4px 12px; border-radius: 6px;
}

.empty { color: #c0c4cc; font-style: italic; text-align: center; padding: 32px 0; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .sw { grid-template-columns: 1fr; }
}
</style>
