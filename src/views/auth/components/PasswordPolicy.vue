<template>
  <div class="info-button" @click.stop="toggle" title="View password policy">
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
    <div class="policy-popup" v-if="isOpen" @click.stop>
      <div class="policy-header">Password Requirements</div>
      
      <div class="requirement-list">
        <div class="requirement-item">
          <svg viewBox="0 0 24 24" width="14" height="14" class="check-icon">
            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <span>Minimum 8 characters</span>
        </div>
        <div class="requirement-item">
          <svg viewBox="0 0 24 24" width="14" height="14" class="check-icon">
            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <span>At least one: uppercase, lowercase, number, and special character</span>
        </div>
      </div>

      <div class="special-chars-section">
        <div class="section-label">Accepted Special Characters:</div>
        <div class="special-chars-grid">
          ^ $ * . [ ] { } ( ) ? - " ! @ # % & / \ , > < ' : ; | _ ~ ` + =
        </div>
        <div class="space-note">Non-boundary spaces are also accepted.</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PasswordPolicy',
  data() {
    return {
      isOpen: false
    }
  },
  methods: {
    toggle() {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        document.addEventListener('click', this.close);
      } else {
        document.removeEventListener('click', this.close);
      }
    },
    close() {
      this.isOpen = false;
      document.removeEventListener('click', this.close);
    }
  },
  beforeDestroy() {
    document.removeEventListener('click', this.close);
  }
}
</script>

<style scoped>
.info-button {
  position: relative;
  cursor: pointer;
  color: #2193b0;
  display: flex;
  align-items: center;
}

.policy-popup {
  position: absolute;
  top: 22px; /* Position below the icon */
  left: 0;   /* Align with the left edge of the icon */
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  width: 230px; /* Reduced width */
  z-index: 100;
  text-align: left;
}

.policy-header {
  font-size: 0.7rem; /* Smaller text */
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.4px;
  margin-bottom: 0.5rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid #f1f5f9;
}

.requirement-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem; /* Tighter gap */
  margin-bottom: 0.6rem;
}

.requirement-item {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  font-size: 0.75rem; /* Smaller text */
  color: #334155;
  line-height: 1.3;
}

.check-icon {
  color: #2563eb;
  flex-shrink: 0;
  margin-top: 1px;
}

.special-chars-section {
  padding-top: 0.3rem;
}

.section-label {
  font-size: 0.65rem; /* Smaller text */
  font-weight: 600;
  color: #64748b;
  margin-bottom: 0.3rem;
}

.special-chars-grid {
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  padding: 0.5rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.7rem; /* Smaller text */
  color: #2563eb;
  letter-spacing: 0.5px;
  line-height: 1.4;
  word-break: break-all;
}

.space-note {
  font-size: 0.6rem; /* Smaller text */
  color: #64748b;
  margin-top: 0.3rem;
  font-style: italic;
}
</style>
