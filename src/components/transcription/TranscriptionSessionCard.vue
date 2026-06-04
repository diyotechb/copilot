<template>
  <div class="transcript-card" @click="$emit('open', item)">
    <div class="card-topline">
      <div class="card-title-group">
        <h3 class="card-title">{{ item.label || 'Untitled' }}</h3>
        <el-tag :type="statusType" size="mini" effect="dark">{{ item.status }}</el-tag>
        <el-tooltip v-if="relativeTime" placement="top" :content="agoTooltip" :disabled="!agoTooltip">
          <span class="card-ago hoverable">{{ relativeTime }}</span>
        </el-tooltip>
      </div>
      <el-button
        v-if="canContinue"
        type="text"
        class="continue-btn"
        @click.stop="$emit('continue', item)"
      >
        Continue Session <i class="el-icon-right"></i>
      </el-button>
    </div>

    <div class="card-subline-row">
      <span class="card-subline-text">
        <template v-for="(seg, i) in infoParts">{{ seg.text }}<b v-if="seg.bold" :key="i">{{ seg.bold }}</b></template>
      </span>
      <el-tooltip placement="top" :content="dateTooltip" :disabled="!dateTooltip">
        <span class="card-date hoverable">{{ absoluteDate }}</span>
      </el-tooltip>
    </div>

    <div class="card-body">
      <p :class="{ 'empty-preview': !item.preview }">{{ item.preview || 'No responses yet' }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TranscriptionSessionCard',
  props: {
    item: { type: Object, required: true }
  },
  computed: {
    canContinue() {
      return !!this.item.isOwner;
    },
    statusType() {
      return this.item.status === 'ENDED' ? 'warning' : 'success';
    },
    infoParts() {
      const it = this.item;
      const parts = [];
      const lead = it.task ? this.sentenceCase(it.task) : 'Interview';
      if (it.vendor) {
        parts.push({ text: '', bold: lead });
        parts.push({ text: ' through ', bold: it.vendor });
      }
      if (it.client) parts.push({ text: ' with ', bold: this.toTitleCase(it.client) });
      return parts;
    },
    relativeTime() {
      const ts = this.item.updatedAt || this.item.createdAt;
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
    absoluteDate() {
      const ts = this.item.createdAt;
      if (!ts) return '';
      return new Date(ts).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    },
    agoTooltip() {
      const ts = this.item.updatedAt || this.item.createdAt;
      return ts ? `Updated at: ${this.formatFull(ts)}` : '';
    },
    dateTooltip() {
      const ts = this.item.createdAt;
      return ts ? `Created at: ${this.formatFull(ts)}` : '';
    }
  },
  methods: {
    formatFull(ts) {
      return new Date(ts).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
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
    }
  }
};
</script>

<style scoped>
.transcript-card {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.transcript-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08);
  border-color: #c6e2ff;
}

.card-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-ago {
  font-size: 12px;
  color: #909399;
}

.card-title {
  font-weight: 700;
  font-size: 1.1em;
  color: #2c3e50;
  margin: 0;
}

.card-subline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 4px 0 12px;
  font-size: 12px;
  color: #64666b;
}

.card-date {
  font-size: 12px;
  color: #999;
}

.hoverable { cursor: pointer; }

.continue-btn {
  padding: 0;
  font-weight: 600;
}

.card-body p {
  margin: 0;
  color: #606266;
  font-size: 1.05rem;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-preview {
  color: #c0c4cc !important;
  font-style: italic;
}
</style>
