<template>
  <div class="settings-container">
    <div class="settings-card">
      <div class="settings-header">
        <h1>Profile Settings</h1>
        <p>Customize your application experience.</p>
      </div>

      <div class="settings-content">
        <div class="setting-item">
          <label for="landing-page">Default Landing Page</label>
          <p class="setting-description">Select the page you want to see immediately after logging in.</p>
          
          <div class="select-wrapper">
            <select id="landing-page" v-model="selectedLandingPage" class="styled-select">
              <option v-for="item in availablePages" :key="item.routeName" :value="item.routeName">
                {{ item.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="setting-item">
          <label>Storage Management</label>
          <p class="setting-description">Manage the data stored locally in your browser. Large recordings and old interview data can be cleared to free up space.</p>
          
          <div class="storage-stats-container" v-if="storageStats">
            <div class="storage-stat-card">
              <div class="stat-info">
                <span class="stat-name">Interview Data</span>
                <span class="stat-val">{{ formatSize(storageStats.interviews.size + storageStats.transcripts.size) }}</span>
              </div>
              <button @click="clearInterviews" class="clear-btn" :disabled="isClearingInterviews">
                {{ isClearingInterviews ? 'Clearing...' : 'Clear' }}
              </button>
            </div>

            <div class="storage-stat-card">
              <div class="stat-info">
                <span class="stat-name">Saved Transcripts</span>
                <span class="stat-val">{{ formatSize(storageStats.history.size) }} ({{ storageStats.history.count }} items)</span>
              </div>
              <button @click="clearHistory" class="clear-btn" :disabled="isClearingHistory">
                {{ isClearingHistory ? 'Clearing...' : 'Clear' }}
              </button>
            </div>

            <div class="storage-stat-card">
              <div class="stat-info">
                <span class="stat-name">Recordings</span>
                <span class="stat-val">{{ formatSize(storageStats.recordings.size) }}</span>
              </div>
              <button @click="clearRecordings" class="clear-btn secondary" :disabled="isClearingRecordings">
                {{ isClearingRecordings ? 'Clearing...' : 'Clear' }}
              </button>
            </div>
          </div>
          <div v-else class="stats-loading">
            <span class="spinner dark"></span> Calculating usage...
          </div>
        </div>

        <div class="settings-actions">
          <button @click="saveSettings" class="save-btn" :disabled="isSaving">
            <i v-if="!isSaving" class="el-icon-check"></i>
            <span v-if="isSaving" class="spinner"></span>
            {{ isSaving ? 'Saving...' : 'Save Preferences' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Custom Confirmation Modal -->
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
import storageService from '@/services/authService'; // Note: authService.getUserRoles relies on storageService internally
import authService from '@/services/authService';
import { NAVIGATION_ITEMS } from '@/config/navigation';
import { hasAnyRole } from '@/constants/roles';
import realStorageService from '@/services/storageService';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

export default {
  name: 'ProfileSettings',
  components: {
    ConfirmDialog
  },
  data() {
    return {
      selectedLandingPage: 'Home',
      isSaving: false,
      storageStats: null,
      isClearingInterviews: false,
      isClearingRecordings: false,
      isClearingHistory: false,
      // Confirmation Modal State
      confirmVisible: false,
      confirmConfig: {
        title: '',
        message: '',
        type: 'primary',
        confirmText: 'Confirm',
        icon: 'el-icon-warning-outline',
        loading: false,
        action: null
      }
    };
  },
  computed: {
    availablePages() {
      const userRoles = authService.getUserRoles();
      return NAVIGATION_ITEMS.filter(item => {
        return !item.allowedRoles || hasAnyRole(userRoles, item.allowedRoles);
      });
    }
  },
  created() {
    const savedPage = realStorageService.getItem(realStorageService.KEYS.USER_LANDING_PAGE);
    if (savedPage) {
      this.selectedLandingPage = savedPage;
    }
    this.refreshStorageStats();
  },
  methods: {
    async saveSettings() {
      this.isSaving = true;
      try {
        realStorageService.setItem(realStorageService.KEYS.USER_LANDING_PAGE, this.selectedLandingPage);
        this.$message({
          message: 'Settings saved successfully!',
          type: 'success'
        });
      } catch (error) {
        console.error('Failed to save settings:', error);
        this.$message.error('Failed to save settings. Please try again.');
      } finally {
        this.isSaving = false;
      }
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
    async clearInterviews() {
      this.confirmConfig = {
        title: 'Clear Interview Data',
        message: 'This will clear your current interview questions and live transcripts. Your transcription history notes will not be affected. Proceed?',
        type: 'warning',
        confirmText: 'Clear Data',
        icon: 'el-icon-refresh-left',
        loading: false,
        action: 'interviews'
      };
      this.confirmVisible = true;
    },
    async clearRecordings() {
      this.confirmConfig = {
        title: 'Delete All Recordings',
        message: 'This will permanently delete all locally stored video and audio recordings. Make sure you have downloaded any recordings you want to keep. Proceed?',
        type: 'danger',
        confirmText: 'Delete All',
        icon: 'el-icon-video-camera',
        loading: false,
        action: 'recordings'
      };
      this.confirmVisible = true;
    },
    async clearHistory() {
      this.confirmConfig = {
        title: 'Delete Transcription History',
        message: 'This will permanently delete ALL your saved transcription history notes. This action cannot be undone. Proceed?',
        type: 'danger',
        confirmText: 'Delete Everything',
        icon: 'el-icon-delete',
        loading: false,
        action: 'history'
      };
      this.confirmVisible = true;
    },
    async handleConfirmAction() {
      const { action } = this.confirmConfig;
      this.confirmConfig.loading = true;

      try {
        if (action === 'interviews') {
          await realStorageService.clearInterviewSession();
          this.$message.success('Interview data cleared');
        } else if (action === 'recordings') {
          await realStorageService.clearRecordingData();
          this.$message.success('Recordings cleared');
        } else if (action === 'history') {
          realStorageService.clearTranscriptionHistory();
          this.$message.success('Transcription history cleared');
        }
        
        await this.refreshStorageStats();
        this.confirmVisible = false;
      } catch (error) {
        console.error('Action failed:', error);
        this.$message.error('Failed to perform action.');
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

.select-wrapper {
  position: relative;
}

.styled-select {
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  font-size: 1rem;
  color: #1e293b;
  cursor: pointer;
  appearance: none;
  transition: all 0.2s;
}

.styled-select:focus {
  outline: none;
  border-color: #2563eb;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.select-wrapper::after {
  content: '\e6df'; /* el-icon-arrow-down */
  font-family: 'element-icons';
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: #94a3b8;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 40px;
}

.save-btn {
  background-color: #2563eb;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.save-btn:hover:not(:disabled) {
  background-color: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
}

.save-btn:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.storage-stats-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.storage-stat-card:not(:last-child) {
  border-bottom: 1px solid #edf2f7;
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
  border: 1px solid #2563eb;
  background: white;
  color: #2563eb;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover:not(:disabled) {
  background: #2563eb;
  color: white;
}

.clear-btn.secondary {
  border-color: #ef4444;
  color: #ef4444;
}

.clear-btn.secondary:hover:not(:disabled) {
  background: #ef4444;
  color: white;
}

.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.persistent-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 4px 8px;
  border-radius: 4px;
}

.stats-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: #64748b;
  padding: 12px;
}

.spinner.dark {
  border-color: rgba(0, 0, 0, 0.1);
  border-top-color: #2563eb;
}
</style>
