<template>
  <div class="candidate-overview-view">
    <div class="dashboard-header">
      <h2>Available Resumes</h2>
      <el-button type="primary" class="start-btn" @click="goLiveAssist">
        Back to Live Assist
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
      :data="filteredResumes"
      class="candidate-table"
      empty-text="No saved resumes yet."
    >
      <el-table-column prop="name" label="Candidate" min-width="220">
        <template slot-scope="{ row }">{{ row.name }}</template>
      </el-table-column>
      <el-table-column label="Length" width="120" align="center">
        <template slot-scope="{ row }">{{ row.length.toLocaleString() }}</template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="Last updated" min-width="180" sortable>
        <template slot-scope="{ row }">{{ formatDate(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="Actions" width="220" align="right">
        <template slot-scope="{ row }">
          <el-button size="mini" icon="el-icon-view" @click="openView(row)">View</el-button>
          <el-button size="mini" type="primary" plain icon="el-icon-edit" @click="openEdit(row)">Edit</el-button>
          <el-button size="mini" type="danger" plain icon="el-icon-delete" :loading="deletingId === row.enrollmentId" @click="remove(row)">Delete</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      :visible.sync="dialogVisible"
      :title="dialogTitle"
      width="640px"
      append-to-body
    >
      <el-input
        v-if="editing"
        type="textarea"
        v-model="draft"
        :rows="16"
        :maxlength="maxLength"
        show-word-limit
        resize="vertical"
        placeholder="Paste the candidate's resume text…"
      />
      <div v-else-if="current.resumeText" class="resume-text">{{ current.resumeText }}</div>
      <div v-else class="empty">No resume text.</div>
      <span slot="footer" class="dialog-footer">
        <template v-if="editing">
          <el-button size="small" @click="dialogVisible = false">Cancel</el-button>
          <el-button size="small" type="primary" :loading="saving" @click="saveEdit">Save</el-button>
        </template>
        <template v-else>
          <el-button size="small" type="primary" icon="el-icon-edit" @click="editing = true; draft = current.resumeText">Edit</el-button>
          <el-button size="small" @click="dialogVisible = false">Close</el-button>
        </template>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import interviewApi from '@/services/interviewApi';

export default {
  name: 'AvailableResumes',
  data() {
    return {
      resumes: [],
      loading: true,
      search: '',
      dialogVisible: false,
      editing: false,
      saving: false,
      deletingId: '',
      draft: '',
      maxLength: 50000,
      current: { enrollmentId: '', name: '', resumeText: '' }
    };
  },
  computed: {
    dialogTitle() {
      return `${this.current.name || 'Candidate'} — Resume`;
    },
    filteredResumes() {
      const q = this.search.trim().toLowerCase();
      if (!q) return this.resumes;
      return this.resumes.filter(r => (r.name || '').toLowerCase().includes(q) || (r.enrollmentId || '').toLowerCase().includes(q));
    }
  },
  async mounted() {
    await this.refresh();
  },
  methods: {
    async refresh() {
      this.loading = true;
      try {
        const [resumeRes, stats] = await Promise.all([
          interviewApi.listCandidateResumes(),
          interviewApi.listCandidateStats().catch(() => [])
        ]);
        const nameById = {};
        (Array.isArray(stats) ? stats : []).forEach(s => {
          if (s && s.enrollmentId) nameById[s.enrollmentId] = s.candidateName;
        });
        const list = (resumeRes && Array.isArray(resumeRes.resumes)) ? resumeRes.resumes : [];
        this.resumes = list.map(r => ({
          enrollmentId: r.enrollmentId,
          name: nameById[r.enrollmentId] || r.enrollmentId,
          resumeText: r.resumeText || '',
          length: (r.resumeText || '').length,
          updatedAt: r.updatedAt || ''
        })).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      } catch (e) {
        this.resumes = [];
      } finally {
        this.loading = false;
      }
    },
    openView(row) {
      this.current = { enrollmentId: row.enrollmentId, name: row.name, resumeText: row.resumeText };
      this.editing = false;
      this.dialogVisible = true;
    },
    openEdit(row) {
      this.current = { enrollmentId: row.enrollmentId, name: row.name, resumeText: row.resumeText };
      this.draft = row.resumeText;
      this.editing = true;
      this.dialogVisible = true;
    },
    async saveEdit() {
      const text = (this.draft || '').trim();
      if (!text) {
        this.$message.warning('Resume text cannot be empty.');
        return;
      }
      this.saving = true;
      try {
        await interviewApi.saveCandidateResume(this.current.enrollmentId, text);
        this.$message.success('Resume saved.');
        this.dialogVisible = false;
        await this.refresh();
      } catch (e) {
        this.$message.error('Could not save resume.');
      } finally {
        this.saving = false;
      }
    },
    async remove(row) {
      try {
        await this.$confirm(`Delete the saved resume for ${row.name}? This cannot be undone.`, 'Delete resume', {
          confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning'
        });
      } catch (e) { return; }
      this.deletingId = row.enrollmentId;
      try {
        await interviewApi.deleteCandidateResume(row.enrollmentId);
        this.resumes = this.resumes.filter(r => r.enrollmentId !== row.enrollmentId);
        this.$message.success('Resume deleted.');
      } catch (e) {
        this.$message.error('Could not delete resume.');
      } finally {
        this.deletingId = '';
      }
    },
    goLiveAssist() {
      this.$router.push({ name: 'LiveAssist' });
    },
    formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
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

.empty {
  color: #94a3b8;
  text-align: center;
  padding: 24px;
}

.resume-text {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 60vh;
  overflow-y: auto;
  font-size: 0.9rem;
  line-height: 1.55;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
}
</style>
