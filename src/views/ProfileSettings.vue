<template>
  <div class="settings-container">
    <div class="settings-card">
      <div class="settings-header">
        <h1>Profile Settings</h1>
        <p>Customize your application experience. <span class="autosave-hint"><i class="el-icon-circle-check"></i> Changes save automatically.</span></p>
      </div>

      <div class="settings-content">
        <div class="setting-item" v-if="isStaff">
          <label>Beta Features</label>
          <p class="setting-description">Enable experimental features. These are actively developed and may change.</p>

          <div class="feature-toggle-list">
            <div class="feature-toggle-row">
              <div class="feature-toggle-info">
                <span class="feature-name">AI Sample Resume &amp; Job Description</span>
                <span class="feature-desc">Adds a "Generate with AI" toggle on the Resume Setup page so you can create sample resumes and job descriptions for practice. Uses your OpenAI key.</span>
              </div>
              <el-switch v-model="features.aiSampleGenerationEnabled" @change="saveFeatures"></el-switch>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <label>Storage Management</label>
          <p class="setting-description">Recordings (audio and video) are stored locally in this browser, not in the cloud. Clear them to free up space on this device.</p>

          <div class="storage-stats-container" v-if="storageStats">
            <div class="storage-stat-card">
              <div class="stat-info">
                <span class="stat-name">Recordings</span>
                <span class="stat-val">{{ formatSize(storageStats.recordings.size) }}</span>
              </div>
              <button @click="clearRecordings" class="clear-btn secondary">Clear</button>
            </div>
          </div>
          <div v-else class="stats-loading">
            <span class="spinner dark"></span> Calculating usage...
          </div>
        </div>

      </div>
    </div>

    <ConfirmDialog
      :visible.sync="confirmVisible"
      :title="confirmConfig.title"
      :message="confirmConfig.message"
      :type="confirmConfig.type"
      :confirm-text="confirmConfig.confirmText"
      :icon="confirmConfig.icon"
      :loading="confirmConfig.loading"
      @confirm="handleConfirmAction"
    />
  </div>
</template>

<script>
import authService from '@/services/authService';
import { hasAnyRole, ROLE_GROUPS } from '@/constants/roles';
import realStorageService from '@/services/storageService';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

export default {
  name: 'ProfileSettings',
  components: {
    ConfirmDialog
  },
  data() {
    return {
      features: {
        aiSampleGenerationEnabled: false
      },
      storageStats: null,
      confirmVisible: false,
      confirmConfig: {
        title: '',
        message: '',
        type: 'primary',
        confirmText: 'Confirm',
        icon: 'el-icon-warning-outline',
        loading: false
      }
    };
  },
  computed: {
    isStaff() {
      return hasAnyRole(authService.getUserRoles(), ROLE_GROUPS.STAFF);
    }
  },
  created() {
    const savedFeatures = realStorageService.getItem(realStorageService.KEYS.USER_FEATURES, true);
    if (savedFeatures) this.features = { ...this.features, ...savedFeatures };

    this.refreshStorageStats();
  },
  methods: {
    saveFeatures() {
      try {
        realStorageService.setItem(realStorageService.KEYS.USER_FEATURES, this.features);
        this.flashSaved();
      } catch (error) {
        console.error('Failed to save features:', error);
        this.$message.error('Could not save your preference. Please try again.');
      }
    },
    flashSaved() {
      this.$message({
        message: 'Saved',
        type: 'success',
        duration: 1200,
        showClose: false
      });
    },
    async refreshStorageStats() {
      this.storageStats = await realStorageService.getStorageUsage();
    },
    formatSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    clearRecordings() {
      this.confirmConfig = {
        title: 'Delete All Recordings',
        message: 'This will permanently delete all locally stored video and audio recordings on this device. Make sure you have downloaded any you want to keep. Proceed?',
        type: 'danger',
        confirmText: 'Delete All',
        icon: 'el-icon-video-camera',
        loading: false
      };
      this.confirmVisible = true;
    },
    async handleConfirmAction() {
      this.confirmConfig.loading = true;
      try {
        await realStorageService.clearRecordingData();
        this.$message.success('Recordings cleared');
        await this.refreshStorageStats();
        this.confirmVisible = false;
      } catch (error) {
        console.error('Action failed:', error);
        this.$message.error('Failed to clear recordings.');
      } finally {
        this.confirmConfig.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.settings-container {
  padding: 40px 20px;
  background-color: #f9fafe;
  min-height: calc(100vh - 80px);
  display: flex;
  justify-content: center;
}

.settings-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 10, 30, 0.05);
  width: 100%;
  max-width: 600px;
  padding: 40px;
  height: fit-content;
}

.settings-header {
  margin-bottom: 32px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 20px;
}

.settings-header h1 {
  font-size: 1.8rem;
  color: #1e293b;
  margin: 0 0 8px;
}

.settings-header p {
  color: #64748b;
  margin: 0;
}

.setting-item {
  margin-bottom: 32px;
}

.setting-item label {
  display: block;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
  font-size: 1rem;
}

.setting-description {
  font-size: 0.9rem;
  color: #64748b;
  margin-bottom: 16px;
}

.autosave-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
  font-size: 0.82rem;
  color: #16a34a;
  font-weight: 600;
}

.autosave-hint i {
  font-size: 0.95rem;
}

.feature-toggle-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.feature-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  padding-right: 16px;
}

.feature-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1e293b;
}

.feature-desc {
  font-size: 0.82rem;
  color: #64748b;
}

.storage-stats-container {
  background: #f8fafc;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.storage-stat-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #475569;
}

.stat-val {
  font-size: 0.85rem;
  color: #94a3b8;
}

.clear-btn {
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid #ef4444;
  background: white;
  color: #ef4444;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn.secondary:hover {
  background: #ef4444;
  color: white;
}

.stats-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: #64748b;
  padding: 12px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #2563eb;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
