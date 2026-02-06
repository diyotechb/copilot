<template>
  <div class="info-button" @click.stop="toggle" title="View password policy">
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
    <div class="policy-popup" v-if="isOpen" @click.stop>
      <strong>Password Policy:</strong>
      <ul>
        <li>Minimum 8 characters</li>
        <li>Uppercase, lowercase, number, and special character</li>
      </ul>
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
  bottom: 120%;
  right: 0;
  background: #fff;
  border: 1px solid #b0c4de;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 250px;
  z-index: 100;
}

.policy-popup strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #2193b0;
  font-size: 0.9rem;
}

.policy-popup ul {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.85rem;
  color: #555;
}
</style>
