<template>
  <div class="dashboard-view">
    <div class="dashboard-header">
      <h2>Transcripts</h2>
      <div class="dash-actions">
        <el-button type="primary" class="primary-hero-btn" @click="$emit('start-new')">
          Start Recording <i class="el-icon-right"></i>
        </el-button>
      </div>
    </div>
    
      <div v-if="history.length === 0" class="empty-dashboard">
        <i class="el-icon-microphone-off empty-icon"></i>
        <h3>No transcripts yet</h3>
        <p>Capture your thoughts or meetings with real-time transcription.</p>
        <el-button type="primary" class="primary-hero-btn" style="margin-top: 24px;" @click="$emit('start-new')">
          Start First Recording <i class="el-icon-right"></i>
        </el-button>
      </div>
      
      <div v-else class="transcript-list">
        <div class="recent-header">
          <h3 class="recent-title">Recent Transcripts</h3>
          <el-button v-if="history.length > 1" type="text" class="delete-all-btn" @click="$emit('delete-all')">Delete All</el-button>
        </div>

        <div class="storage-info">
          <i class="el-icon-info"></i> Only the 10 most recent recordings are saved locally.
        </div>

        <transcript-card 
          v-for="(item, index) in history" 
          :key="item.id" 
          :item="item"
          @click="$emit('open-detail', item)"
          @delete="$emit('delete-item', { item, index })"
        />
    </div>
  </div>
</template>

<script>
import TranscriptCard from './TranscriptCard.vue';

export default {
  name: 'TranscriptDashboard',
  components: { TranscriptCard },
  props: {
    history: {
      type: Array,
      required: true
    }
  }
}
</script>

<style scoped>
.dashboard-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 0 40px;
  overflow-y: auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 40px 0 30px 0;
  flex-wrap: wrap;
  gap: 15px;
}

.dashboard-header h2 {
  font-size: 28px;
  color: #2c3e50;
  margin: 0;
  font-weight: 700;
}

.dash-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #e4e7ed;
  margin-bottom: 15px;
}

.recent-title {
  color: #606266;
  font-weight: 500;
}

.delete-all-btn {
  color: #909399 !important;
  font-size: 0.85em;
}

.delete-all-btn:hover {
  color: #f56c6c !important;
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
  margin-bottom: 10px;
}

.dashboard-content {
  flex-grow: 1;
  padding-bottom: 40px;
}

.empty-dashboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #909399;
}

.empty-icon {
  font-size: 64px;
  color: #dcdfe6;
  margin-bottom: 20px;
}

.empty-dashboard h3 {
  font-size: 20px;
  margin: 10px 0;
  color: #606266;
}

.transcript-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}
</style>
