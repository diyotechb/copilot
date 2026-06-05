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

      <template v-if="!continueTarget">
      <div class="recent-header">
        <h3 class="recent-title">Recent Transcriptions</h3>
        <div class="recent-actions">
          <a class="link-action" @click="$emit('view-all')">View All</a>
        </div>
      </div>

      <div v-if="loadingCloud" class="empty-dashboard">Loading…</div>
      <div v-else-if="cloudRecent.length" class="ts-list">
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
    </div>
  </div>
</template>

<script>
import TranscriptionSetup from './TranscriptionSetup.vue';
import TranscriptionSessionCard from './TranscriptionSessionCard.vue';

export default {
  name: 'TranscriptDashboard',
  components: { TranscriptionSetup, TranscriptionSessionCard },
  props: {
    cloudRecent: { type: Array, default: () => [] },
    micPermission: { type: String, default: 'prompt' },
    continueTarget: { type: Object, default: null },
    loadingCloud: { type: Boolean, default: false }
  },
  watch: {
    continueTarget(val) {
      if (!val) return;
      this.$nextTick(() => {
        if (this.$el && this.$el.scrollTo) this.$el.scrollTo({ top: 0 });
        else if (this.$el) this.$el.scrollTop = 0;
      });
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
.link-action { color: #2563eb; font-weight: 600; font-size: 13px; cursor: pointer; }
.link-action:hover { text-decoration: underline; }

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
</style>
