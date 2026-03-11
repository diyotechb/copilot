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

        <div class="settings-actions">
          <button @click="saveSettings" class="save-btn" :disabled="isSaving">
            <i v-if="!isSaving" class="el-icon-check"></i>
            <span v-if="isSaving" class="spinner"></span>
            {{ isSaving ? 'Saving...' : 'Save Preferences' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import storageService from '@/services/authService'; // Note: authService.getUserRoles relies on storageService internally
import authService from '@/services/authService';
import { NAVIGATION_ITEMS } from '@/config/navigation';
import { hasAnyRole } from '@/constants/roles';
import realStorageService from '@/services/storageService';

export default {
  name: 'ProfileSettings',
  data() {
    return {
      selectedLandingPage: 'Home',
      isSaving: false
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
</style>
