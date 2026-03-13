<template>
  <el-dialog
    :visible.sync="visible"
    :width="width"
    :title="title"
    custom-class="premium-confirm-dialog"
    :append-to-body="true"
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <div class="confirm-content">
      <div v-if="icon" class="confirm-icon-wrapper" :class="type">
        <i :class="icon"></i>
      </div>
      <div class="confirm-text-wrapper">
        <h3 v-if="messageTitle" class="message-title">{{ messageTitle }}</h3>
        <p class="confirm-message">{{ message }}</p>
      </div>
    </div>
    
    <div slot="footer" class="confirm-footer">
      <button v-if="showCancel" class="action-btn cancel" @click="handleCancel">
        {{ cancelText }}
      </button>
      <button 
        class="action-btn confirm" 
        :class="type"
        @click="handleConfirm"
        :disabled="loading"
      >
        <span v-if="loading" class="spinner"></span>
        {{ confirmText }}
      </button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'ConfirmDialog',
  props: {
    visible: Boolean,
    title: { type: String, default: 'Confirmation' },
    messageTitle: String,
    message: { type: String, required: true },
    confirmText: { type: String, default: 'Confirm' },
    cancelText: { type: String, default: 'Cancel' },
    showCancel: { type: Boolean, default: true },
    type: { type: String, default: 'primary' }, // primary, danger, warning
    icon: { type: String, default: 'el-icon-warning-outline' },
    width: { type: String, default: '440px' },
    loading: Boolean
  },
  methods: {
    handleCancel() {
      this.$emit('update:visible', false);
      this.$emit('cancel');
    },
    handleConfirm() {
      this.$emit('confirm');
    }
  }
};
</script>

<style scoped>
.confirm-content {
  display: flex;
  gap: 20px;
  padding: 10px 0;
}

.confirm-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.confirm-icon-wrapper.primary { background: #eef2ff; color: #4f46e5; }
.confirm-icon-wrapper.warning { background: #fffbeb; color: #d97706; }
.confirm-icon-wrapper.danger { background: #fef2f2; color: #dc2626; }

.confirm-text-wrapper {
  flex: 1;
}

.message-title {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

.confirm-message {
  margin: 0;
  color: #64748b;
  font-size: 0.95rem;
  line-height: 1.6;
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 10px;
}

.action-btn {
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn.cancel {
  background: #f1f5f9;
  color: #475569;
}

.action-btn.cancel:hover {
  background: #e2e8f0;
}

.action-btn.confirm.primary { background: #2563eb; color: white; }
.action-btn.confirm.primary:hover { background: #1d4ed8; }

.action-btn.confirm.warning { background: #f59e0b; color: white; }
.action-btn.confirm.warning:hover { background: #d97706; }

.action-btn.confirm.danger { background: #ef4444; color: white; }
.action-btn.confirm.danger:hover { background: #dc2626; }

.action-btn:disabled {
  opacity: 0.6;
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

<style>
/* Global overrides for the dialog style if needed */
.premium-confirm-dialog {
  border-radius: 20px !important;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
}

.premium-confirm-dialog .el-dialog__header {
  padding: 25px 25px 0;
}

.premium-confirm-dialog .el-dialog__title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
}

.premium-confirm-dialog .el-dialog__body {
  padding: 25px;
}

.premium-confirm-dialog .el-dialog__footer {
  padding: 0 25px 25px;
  border-top: none;
}
</style>
