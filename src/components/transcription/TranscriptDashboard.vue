<template>
  <div class="dashboard-view">
    <div class="dashboard-header">
      <h2>My Transcriptions</h2>
    </div>

    <div class="dashboard-body">
      <transcription-setup
        :mic-permission="micPermission"
        :continue-target="continueTarget"
        @start="$emit('start', $event)"
        @continue="$emit('continue-start', $event)"
        @cancel-continue="$emit('cancel-continue')"
      />

      <div class="recent-header">
        <h3 class="recent-title">Recent Transcriptions</h3>
        <div class="recent-actions">
          <a class="link-action" @click="showLocal = !showLocal">{{ showLocal ? 'Hide' : 'View' }} Local Transcriptions</a>
          <a class="link-action" @click="$emit('view-all')">View All</a>
        </div>
      </div>

      <template v-if="!showLocal">
        <div v-if="cloudRecent.length" class="ts-list">
          <transcription-session-card
            v-for="s in cloudRecent"
            :key="s.sessionId"
            :item="s"
            @open="$emit('open-cloud', $event)"
            @continue="$emit('continue-cloud', $event)"
          />
        </div>
        <div v-else class="empty-dashboard">
          <i class="el-icon-microphone empty-icon"></i>
          <h3>No transcriptions yet</h3>
          <p>Pick a candidate (or just name a session) above and hit Start Recording.</p>
        </div>
      </template>

      <div v-else class="local-section">
        <div class="local-divider">
          <h3 class="local-title">Local Transcriptions <span class="local-tag">legacy</span></h3>
          <el-button v-if="history.length > 1" type="text" class="delete-all-btn" @click="$emit('delete-all')">Delete All</el-button>
        </div>
        <div class="storage-info"><i class="el-icon-info"></i> Older recordings saved only in this browser (max {{ maxHistory }}). Not synced to the cloud.</div>
        <div v-if="!history.length" class="empty-hint">No local recordings.</div>
        <transcript-card
          v-for="(item, index) in history"
          :key="item.id"
          :item="item"
          @click="$emit('open-detail', item)"
          @delete="$emit('delete-item', { item, index })"
        />
      </div>
    </div>
  </div>
</template>

<script>
import TranscriptCard from './TranscriptCard.vue';
import TranscriptionSetup from './TranscriptionSetup.vue';
import TranscriptionSessionCard from './TranscriptionSessionCard.vue';
import { APP_CONFIG } from '@/constants/appConfig';

export default {
  name: 'TranscriptDashboard',
  components: { TranscriptCard, TranscriptionSetup, TranscriptionSessionCard },
  props: {
    history: { type: Array, required: true },
    cloudRecent: { type: Array, default: () => [] },
    micPermission: { type: String, default: 'prompt' },
    continueTarget: { type: Object, default: null }
  },
  data() {
    return { showLocal: false };
  },
  computed: {
    maxHistory() {
      return APP_CONFIG.TRANSCRIPTION.MAX_HISTORY;
    }
  }
};
</script>

<style scoped>
.dashboard-view {
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
  margin: 36px 0 24px 0;
  flex-wrap: wrap;
  gap: 15px;
}

.dashboard-header h2 {
  font-size: 28px;
  color: #2c3e50;
  margin: 0;
  font-weight: 700;
}

.dashboard-body {
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
  margin: 28px 0 6px 0;
}

.recent-title { color: #606266; font-weight: 600; margin: 0; }

.recent-actions { display: flex; align-items: center; gap: 18px; }
.link-action { color: #409eff; font-weight: 600; font-size: 13px; cursor: pointer; }
.link-action:hover { text-decoration: underline; }

.local-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 16px;
}
.local-divider { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.local-title { margin: 0; font-size: 16px; font-weight: 600; color: #606266; display: flex; align-items: center; gap: 8px; }
.local-tag {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  color: #909399; background: #f0f2f5; border-radius: 4px; padding: 2px 6px;
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
}
.delete-all-btn { color: #909399 !important; font-size: 0.85em; }
.delete-all-btn:hover { color: #f56c6c !important; }

.ts-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-dashboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #909399;
}
.empty-icon { font-size: 56px; color: #dcdfe6; margin-bottom: 16px; }
.empty-dashboard h3 { font-size: 18px; margin: 8px 0; color: #606266; }
.empty-hint { color: #c0c4cc; font-size: 13px; padding: 10px 0; }
</style>
