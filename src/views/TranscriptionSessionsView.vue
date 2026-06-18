<template>
  <div class="transcription-sessions-view">
   <div class="dashboard-view">
    <div class="dashboard-header">
      <h2>Transcription Sessions</h2>
      <div class="header-actions">
        <el-button type="primary" class="start-session-btn" @click="$router.push({ name: 'TranscriptionsView' })">Start New Session <i class="el-icon-right"></i></el-button>
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

        <div v-if="!loadingList && !showFilters" class="results-count">
          {{ filteredSessions.length }} {{ filteredSessions.length === 1 ? 'result' : 'results' }}
        </div>

        <div v-show="showFilters" class="filters">
          <div class="filter-row">
            <el-select v-model="filters.status" size="small" clearable placeholder="Status">
              <el-option v-for="o in statusOptions" :key="o" :label="o" :value="o" />
            </el-select>
            <el-select v-model="filters.category" size="small" clearable placeholder="Category">
              <el-option v-for="o in categoryOptions" :key="o.value" :label="o.label" :value="o.value" />
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
            <span class="filter-count">{{ filteredSessions.length }} {{ filteredSessions.length === 1 ? 'result' : 'results' }}</span>
            <el-button type="text" size="mini" @click="clearFilters">Clear filters</el-button>
          </div>
        </div>

        <div v-if="loadingList && !sessions.length" class="list-loading"><i class="el-icon-loading"></i><span>Loading…</span></div>
        <div v-else-if="!sessions.length" class="empty">No transcriptions yet.</div>
        <div v-else-if="!filteredSessions.length" class="empty">No transcriptions match the filters.</div>
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
              </span>
            </div>
          </li>
        </ul>
      </div>

      <el-card class="detail-panel" shadow="never">
        <div v-if="!selectedId" class="empty-detail">
          <i class="el-icon-document empty-icon"></i>
          <p>Select a transcription to view its transcript.</p>
        </div>
        <div v-else-if="loadingDetail" class="empty">Loading transcription…</div>
        <div v-else-if="detail">
          <div class="recorded-block">
            <p class="detail-recorded">
              <el-tooltip placement="top" :content="createdByTooltip" :disabled="!createdByTooltip">
                <span class="recorded-seg">Created <b>{{ formatDate(detail.createdAt) }}</b></span>
              </el-tooltip>
              <template v-if="detail.updatedAt">
                <span> · </span>
                <el-tooltip placement="top" :content="updatedByTooltip" :disabled="!updatedByTooltip">
                  <span class="recorded-seg">Last updated <b>{{ formatDate(detail.updatedAt) }}</b></span>
                </el-tooltip>
              </template>
            </p>
            <p v-if="recordedBy" class="detail-recorded-by">Recorded By: <b>{{ recordedBy }}</b></p>
          </div>
          <div class="detail-head">
            <div class="detail-title">
              <h2 v-if="!editingName" :class="{ locked: isActive }" @click="startEditName">{{ sessionName(detail) }}</h2>
              <el-input
                v-else
                ref="nameInput"
                v-model="editName"
                size="small"
                class="name-edit"
                @keyup.enter.native="saveName"
                @blur="saveName"
              />
              <el-button v-if="canModify" type="text" icon="el-icon-edit" class="edit-name-btn" @click="startEditName"></el-button>
            </div>
            <div class="detail-head-right">
              <el-tag :type="statusType(detail.status)" size="small" effect="dark">{{ detail.status }}</el-tag>
              <el-dropdown v-if="canModify" trigger="click" @command="onItemCommand">
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
            <span><span class="meta-key">Session ID</span> <code>{{ detail.sessionId }}</code></span>
          </div>

          <div v-if="detail.notes" class="context-box">
            <div class="context-label">Notes</div>
            <p class="context-text">{{ detail.notes }}</p>
          </div>

          <div class="qa">
            <div class="qa-header">
              <span>Transcript</span>
              <el-button
                type="text"
                icon="el-icon-document-copy"
                class="copy-transcript-btn"
                :disabled="!detailLines.length"
                @click="copyTranscript"
                title="Copy transcript">Copy</el-button>
            </div>
            <div v-if="!detailLines.length" class="empty">No transcript recorded for this session.</div>
            <div v-for="(l, i) in detailLines" :key="i" class="pair">
              <div class="a"><span class="tag tag-time">{{ l.time }}</span>{{ l.text }}</div>
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
import transcriptionApi from '@/services/transcriptionApi';
import authService from '@/services/authService';
import { hasAnyRole, ROLE_GROUPS } from '@/constants/roles';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

export default {
  name: 'TranscriptionSessionsView',
  components: { ConfirmDialog },
  data() {
    return {
      sessions: [],
      loadingList: false,
      selectedId: '',
      detail: null,
      detailLines: [],
      loadingDetail: false,
      editingName: false,
      editName: '',
      statusOptions: ['ACTIVE', 'ENDED'],
      categoryOptions: [
        { value: 'INTERVIEW', label: 'Interview' },
        { value: 'OTTER_PRACTICE', label: 'Otter Practice' },
        { value: 'NONE', label: 'No Selection' }
      ],
      showFilters: false,
      filters: { text: '', status: '', category: '', client: '', task: '', callTaker: '', date: '' },
      confirmVisible: false,
      confirmConfig: { title: '', message: '', type: 'warning', confirmText: 'Confirm', cancelText: 'Cancel', icon: 'el-icon-warning-outline' },
      confirmResolver: null
    };
  },
  computed: {
    isStaff() {
      return hasAnyRole(authService.getUserRoles(), ROLE_GROUPS.STAFF);
    },
    canManage() {
      return !!this.detail && (this.isStaff || !!this.detail.isOwner);
    },
    isActive() {
      return !!this.detail && this.detail.status === 'ACTIVE';
    },
    canModify() {
      return this.canManage && !this.isActive;
    },
    createdByTooltip() {
      const d = this.detail;
      const who = d && (d.createdByEmail || d.createdBy);
      return who ? `Created by: ${who}` : '';
    },
    updatedByTooltip() {
      const d = this.detail;
      const who = d && (d.updatedByEmail || d.updatedBy);
      return who ? `Updated by: ${who}` : '';
    },
    recordedBy() {
      const d = this.detail;
      return d ? (d.createdByEmail || d.createdBy || '') : '';
    },
    activeFilterCount() {
      const f = this.filters;
      return ['status', 'category', 'client', 'task', 'callTaker', 'date'].filter(k => f[k]).length;
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
      const text = (f.text || '').trim().toLowerCase();
      return this.sessions.filter(s => {
        if (f.status && s.status !== f.status) return false;
        if (f.category && s.category !== f.category) return false;
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
      const lead = d.task ? this.sentenceCase(d.task) : 'Interview';
      if (d.vendor) {
        parts.push({ text: '', bold: lead });
        parts.push({ text: ' through ', bold: d.vendor });
      }
      if (d.client) parts.push({ text: ' with ', bold: this.toTitleCase(d.client) });
      if (d.interviewDateTime) parts.push({ text: ' on ', bold: this.formatEt(d.interviewDateTime) });
      return parts;
    }
  },
  async mounted() {
    await this.loadList();
    const id = this.$route.query.sessionId;
    if (id) this.select(id);
  },
  watch: {
    '$route.query.sessionId'(id) {
      if (id && id !== this.selectedId) this.select(id);
      else if (!id) { this.selectedId = ''; this.detail = null; }
    }
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
        const list = await transcriptionApi.list();
        this.sessions = Array.isArray(list) ? list : [];
      } catch (e) {
        this.$message.error(e.message || 'Could not load transcriptions');
      } finally {
        this.loadingList = false;
      }
    },
    async select(id) {
      this.selectedId = id;
      this.detail = null;
      this.detailLines = [];
      this.loadingDetail = true;
      if (this.$route.query.sessionId !== id) {
        this.$router.push({ query: { ...this.$route.query, sessionId: id } }).catch(() => {});
      }
      try {
        const data = await transcriptionApi.get(id);
        if (data && data.ok) {
          this.detail = data;
          this.detailLines = (data.lines || []).map(l => ({ time: l.time, text: l.text }));
        } else {
          this.$message.error((data && data.error) || 'Could not load transcription');
        }
      } catch (e) {
        this.$message.error(e.message || 'Could not load transcription');
      } finally {
        this.loadingDetail = false;
      }
    },
    startEditName() {
      if (!this.canManage) return;
      if (this.isActive) {
        this.$message.info('This transcription is live. You can rename it after it ends.');
        return;
      }
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
        const res = await transcriptionApi.rename(this.selectedId, newName);
        if (!res || !res.ok) { this.$message.error((res && res.error) || 'Rename failed'); return; }
        this.detail.label = res.label;
        const s = this.sessions.find(x => x.sessionId === this.selectedId);
        if (s) s.label = res.label;
        this.$message.success('Renamed');
      } catch (e) {
        this.$message.error(e.message || 'Rename failed');
      }
    },
    async remove() {
      if (this.isActive) {
        this.$message.info('This transcription is live. End it before deleting.');
        return;
      }
      const ok = await this.askConfirm({
        title: 'Delete transcription?',
        message: 'Delete this transcription and its transcript? This cannot be undone.',
        type: 'danger', confirmText: 'Delete', cancelText: 'Cancel', icon: 'el-icon-delete'
      });
      if (!ok) return;
      try {
        const res = await transcriptionApi.remove(this.selectedId);
        if (!res || !res.ok) { this.$message.error((res && res.error) || 'Delete failed'); return; }
        this.selectedId = '';
        this.detail = null;
        await this.loadList();
        this.$message.success('Deleted');
      } catch (e) {
        this.$message.error(e.message || 'Delete failed');
      }
    },
    onItemCommand(command) {
      if (command === 'delete') this.remove();
    },
    clearFilters() {
      this.filters.status = '';
      this.filters.category = '';
      this.filters.client = '';
      this.filters.task = '';
      this.filters.callTaker = '';
      this.filters.date = '';
    },
    sessionName(s) {
      if (s && s.label) return s.label;
      const ts = (s && s.createdAt) || (this.detail && this.detail.createdAt);
      if (!ts) return 'Transcription';
      return `Transcription - ${new Date(ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`;
    },
    toTitleCase(str) {
      if (!str) return '';
      return str.replace(/_/g, ' ').toLowerCase().trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    },
    sentenceCase(str) {
      if (!str) return '';
      const s = String(str).replace(/_/g, ' ').trim().toLowerCase();
      return s.charAt(0).toUpperCase() + s.slice(1);
    },
    statusType(status) {
      if (status === 'ENDED') return 'warning';
      return 'success';
    },
    copyTranscript() {
      const text = this.detailLines.map(l => l.text).filter(Boolean).join('\n\n');
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        this.$message({ message: 'Transcript copied to clipboard', type: 'success', duration: 2000 });
      }).catch(() => {
        this.$message({ message: 'Could not copy — try selecting the text manually', type: 'error', duration: 3000 });
      });
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
.transcription-sessions-view {
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
.start-session-btn { font-weight: 700; border-radius: 8px; padding: 13px 26px; font-size: 15px; }

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
.filter-actions { display: flex; justify-content: space-between; align-items: center; }
.filter-count { font-size: 12px; color: #909399; }
.results-count { font-size: 12px; color: #909399; margin: 0 2px 10px; padding-top: 2px; }

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
.session-item.active { border-color: #2563eb; box-shadow: 0 2px 10px rgba(37,99,235,0.15); }

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
.detail-title h2:hover { color: #2563eb; }
.detail-title h2.locked { cursor: default; }
.detail-title h2.locked:hover { color: #2c3e50; }
.name-edit { width: 360px; }
.edit-name-btn { padding: 0; color: #c0c4cc; }
.edit-name-btn:hover { color: #2563eb; }
.detail-head-right { display: flex; align-items: center; gap: 10px; }

.detail-subline { margin: 5px 0 15px; font-size: 13px; color: #64666b; }
.recorded-block { margin: 0 0 18px; }
.detail-recorded { margin: 0 0 4px; font-size: 12px; color: #909399; }
.recorded-seg { cursor: pointer; }
.detail-recorded-by { margin: 0; font-size: 12px; color: #909399; }

.detail-meta { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 0 0 18px; font-size: 13px; color: #5c6b7a; }
.detail-meta .meta-key { color: #5c6b7a; margin-right: 4px; }
.detail-meta code { background: #fff; border: 1px solid #d9ecff; border-radius: 4px; padding: 1px 6px; color: #2563eb; font-weight: 600; }

.context-box { background: #fafafa; border: 1px solid #ebeef5; border-radius: 12px; padding: 18px; margin-bottom: 16px; }
.context-label { font-size: 13px; font-weight: 600; color: #2c3e50; margin-bottom: 6px; }
.context-text { margin: 0; font-size: 13px; color: #606266; line-height: 1.6; white-space: pre-wrap; }

.qa-header { font-weight: 600; color: #606266; font-size: 14px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e4e7ed; display: flex; align-items: center; justify-content: space-between; }
.copy-transcript-btn { padding: 0; font-weight: 600; }
.pair { padding: 14px 0; border-bottom: 1px solid #f0f2f5; }
.a { color: #303133; line-height: 1.6; white-space: pre-wrap; }
.tag {
  display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; padding: 3px 10px; border-radius: 6px; margin-right: 8px;
  background: #2563eb; color: #fff; vertical-align: middle;
}
.tag-time { background: #909399; }

.empty { color: #c0c4cc; font-style: italic; text-align: center; padding: 32px 0; }
.list-loading { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 200px; color: #909399; }
.list-loading i { font-size: 20px; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
}
</style>
