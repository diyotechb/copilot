<template>
  <div class="sidebar-container">
    <!-- Backdrop for mobile -->
    <div 
      v-if="isMobileOpen" 
      class="sidebar-backdrop" 
      @click="$emit('close-mobile')"
    ></div>

    <aside class="app-sidebar" :class="{ 'is-collapsed': isCollapsed, 'is-mobile-open': isMobileOpen }">
      <div class="sidebar-header">
        <router-link to="/" class="branding-link">
          <div class="logo-wrapper" v-if="!isCollapsed">
            <img src="https://www.diyotech.net/logo-transparent.svg" alt="Diyo Logo" class="sidebar-logo" />
          </div>
          <div class="logo-mini-text" v-else title="Diyo Tech">
            DT
          </div>
        </router-link>
        <button class="collapse-btn" @click="toggleCollapse">
          <i :class="isCollapsed ? 'el-icon-arrow-right' : 'el-icon-arrow-left'"></i>
        </button>
      </div>

      <div class="sidebar-nav">
        <div v-for="item in navItems" :key="item.routeName" class="nav-item">
          <router-link 
            :to="{ name: item.routeName }" 
            class="sidebar-link" 
            :class="{ 'active': isActive(item.routeName) }"
            :title="isCollapsed ? item.name : ''"
          >
            <div class="icon-box">
              <svg class="nav-icon" viewBox="0 0 24 24"><path fill="currentColor" :d="item.icon"/></svg>
            </div>
            <span v-if="!isCollapsed" class="link-label">{{ item.name }}</span>
          </router-link>
        </div>
      </div>

      <div class="sidebar-footer">
        <div v-if="userEmail" class="user-block">
          <div class="user-avatar-small">{{ userInitials }}</div>
          <div v-if="!isCollapsed" class="user-info">
            <span class="user-email-text">{{ userEmail }}</span>
            <button class="logout-link-small" @click="handleLogout">Logout</button>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script>
import authService from '@/services/authService';
import { NAVIGATION_ITEMS } from '@/config/navigation';

export default {
  name: 'AppSidebar',
  props: {
    isMobileOpen: {
      type: Boolean,
      default: false
    },
    isCollapsed: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      navItems: NAVIGATION_ITEMS
    };
  },
  computed: {
    userEmail() {
      return authService.getUserEmail();
    },
    userInitials() {
      if (!this.userEmail) return '?';
      return this.userEmail.charAt(0).toUpperCase();
    }
  },
  methods: {
    isActive(routeName) {
      return this.$route.name === routeName;
    },
    toggleCollapse() {
      this.$emit('toggle', !this.isCollapsed);
    },
    handleLogout() {
      authService.logout();
      this.$router.push({ name: 'Login' });
    }
  }
};
</script>

<style scoped>
.app-sidebar {
  width: 260px;
  height: 100vh;
  background: white;
  border-right: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
}

.app-sidebar.is-collapsed {
  width: 80px;
}

.sidebar-header {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  position: relative;
}

.branding-link {
  text-decoration: none;
  display: flex;
  align-items: center;
  transition: opacity 0.2s;
}

.branding-link:hover {
  opacity: 0.8;
}

.logo-wrapper {
  display: flex;
  align-items: center;
}

.sidebar-logo {
  height: 42px;
  border-radius: 8px;
}

.logo-mini-text {
  width: 40px;
  height: 40px;
  background: #f1f5f9;
  color: #1e293b;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: -0.5px;
  border: 1px solid #e2e8f0;
}

.collapse-btn {
  width: 24px;
  height: 24px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: absolute;
  right: -12px;
  top: 28px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  color: #64748b;
  z-index: 1001;
}

.sidebar-nav {
  flex-grow: 1;
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  padding: 0 16px;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  text-decoration: none;
  color: #64748b;
  border-radius: 12px;
  transition: all 0.2s;
}

.sidebar-link:hover {
  background: #f8fafc;
  color: #1a1a1a;
}

.sidebar-link.active {
  background: #eff6ff;
  color: #2563eb;
}

.icon-box {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-icon {
  width: 20px;
  height: 20px;
}

.link-label {
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid #f1f5f9;
}

.user-block {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar-small {
  width: 40px;
  height: 40px;
  background: #2563eb;
  color: white;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-email-text {
  font-size: 0.8rem;
  color: #1a1a1a;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-link-small {
  background: none;
  border: none;
  padding: 0;
  color: #ef4444;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  margin-top: 2px;
}

.logout-link-small:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .app-sidebar {
    transform: translateX(-100%);
    box-shadow: 20px 0 25px -5px rgba(0, 0, 0, 0.1);
  }
  
  .app-sidebar.is-mobile-open {
    transform: translateX(0);
  }

  /* Keep expanded width on mobile for better usability */
  .app-sidebar.is-collapsed {
    width: 260px;
  }

  .collapse-btn {
    display: none; /* No need to collapse on mobile */
  }

  .sidebar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(4px);
    z-index: 999;
  }
}
</style>
