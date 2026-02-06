<template>
  <nav class="app-nav">
    <div class="nav-container">
      <!-- Desktop & Mobile Header -->
      <div class="nav-header">
        <div class="nav-left">
          <!-- Hamburger for Mobile -->
          <button class="menu-toggle" @click="toggleMenu" aria-label="Toggle menu">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path v-if="!isMenuOpen" fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              <path v-else fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
          
          <router-link to="/" class="brand-link">
            <img src="https://diyotech.net/assets/images/diyotech.jpg" alt="Diyo Logo" class="brand-logo" />
          </router-link>

          <!-- Desktop Navigation -->
          <ul class="nav-items desktop-only" role="menubar">
            <li v-for="item in navItems" :key="item.routeName" role="none">
              <router-link 
                :to="{ name: item.routeName }" 
                class="nav-link" 
                :class="{ active: isActive(item.routeName) }"
                role="menuitem"
              >
                <svg class="nav-icon" viewBox="0 0 24 24"><path fill="currentColor" :d="item.icon"/></svg>
                <span>{{ item.name }}</span>
              </router-link>
            </li>
          </ul>
        </div>

        <div class="nav-right">
          <div v-if="userEmail" class="user-menu-container">
            <div class="user-avatar" @click="toggleUserMenu" :title="userEmail">
              {{ userInitials }}
            </div>
            
            <transition name="fade">
              <div v-if="isUserMenuOpen" class="user-dropdown">
                <div class="dropdown-header">
                  <span class="user-email-full">{{ userEmail }}</span>
                </div>
                <button class="dropdown-item logout" @click="handleLogout">
                  <svg class="nav-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/></svg>
                  <span>Logout</span>
                </button>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <!-- Mobile Sidebar/Drawer -->
      <transition name="slide">
        <div v-if="isMenuOpen" class="mobile-sidebar">
          <div class="mobile-user-info" v-if="userEmail">
            <div class="user-avatar" title="userEmail">
              {{ userInitials }}
            </div>
            <span class="mobile-email-hint">{{ userEmail }}</span>
          </div>
          
          <ul class="mobile-nav-items">
            <li v-for="item in navItems" :key="item.routeName">
              <router-link 
                :to="{ name: item.routeName }" 
                class="mobile-nav-link"
                :class="{ active: isActive(item.routeName) }"
                @click.native="isMenuOpen = false"
              >
                <svg class="nav-icon" viewBox="0 0 24 24"><path fill="currentColor" :d="item.icon"/></svg>
                <span>{{ item.name }}</span>
              </router-link>
            </li>
            <li class="mobile-logout-item">
              <button class="mobile-nav-link logout-link" @click="handleLogout">
                <svg class="nav-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/></svg>
                <span>Logout</span>
              </button>
            </li>
          </ul>
        </div>
      </transition>

      <div v-if="isMenuOpen" class="overlay" @click="isMenuOpen = false"></div>
    </div>
  </nav>
</template>

<script>
import authService from '@/services/authService';
import { NAVIGATION_ITEMS } from '@/config/navigation';

export default {
  name: 'NavBar',
  data() {
    return {
      isMenuOpen: false,
      isUserMenuOpen: false,
      navItems: NAVIGATION_ITEMS.filter(item => item.routeName) 
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
    handleLogout() {
      this.isMenuOpen = false;
      this.isUserMenuOpen = false;
      authService.logout();
      this.$router.push({ name: 'Login' });
    },
    isActive(routeName) {
      return this.$route.name === routeName;
    },
    toggleMenu() {
      this.isMenuOpen = !this.isMenuOpen;
      if (this.isMenuOpen) this.isUserMenuOpen = false;
    },
    toggleUserMenu() {
      this.isUserMenuOpen = !this.isUserMenuOpen;
    },
    closeMenus(e) {
      if (!this.$el.contains(e.target)) {
        this.isMenuOpen = false;
        this.isUserMenuOpen = false;
      }
    }
  },
  mounted() {
    document.addEventListener('click', this.closeMenus);
  },
  beforeDestroy() {
    document.removeEventListener('click', this.closeMenus);
  }
};
</script>

<style scoped>
.app-nav {
  height: 60px;
  background-color: #ffffff;
  border-bottom: 2px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
}

.nav-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 1.5rem;
}

.nav-left, .nav-right {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.brand-link {
  display: flex;
  align-items: center;
  text-decoration: none;
}

.brand-logo {
  height: 48px;
  width: auto;
  border-radius: 4px;
  transition: transform 0.2s;
}

.brand-logo:hover {
  transform: scale(1.05);
}

.nav-items {
  display: flex;
  list-style: none;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  text-decoration: none;
  color: #4b5563;
  font-weight: 500;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  background-color: #f3f4f6;
  color: #111827;
}

.nav-link.active {
  color: #3b82f6;
  background-color: #eff6ff;
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.user-menu-container {
  position: relative;
}

.user-avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
  transition: all 0.2s;
  user-select: none;
}

.user-avatar:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  width: 200px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  padding: 0.5rem;
  z-index: 1001;
}

.dropdown-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  margin-bottom: 0.5rem;
}

.user-email-full {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  border-radius: 8px;
  color: #4b5563;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.dropdown-item:hover {
  background-color: #f3f4f6;
  color: #111827;
}

.dropdown-item.logout {
  color: #ef4444;
}

.dropdown-item.logout:hover {
  background-color: #fef2f2;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Mobile Specific */
.menu-toggle {
  display: none;
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: #000000; /* Force black for visibility */
}

.menu-toggle .icon {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.mobile-sidebar {
  position: fixed;
  top: 60px;
  left: 0;
  width: 280px;
  height: calc(100vh - 60px);
  background: #ffffff;
  box-shadow: 4px 0 20px rgba(0,0,0,0.1);
  z-index: 1002;
  padding: 1.5rem 1rem;
}

.mobile-user-info {
  padding: 0.5rem 0.75rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.mobile-email-hint {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  word-break: break-all;
  text-align: center;
}

.mobile-nav-items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  text-decoration: none;
  color: #4b5563;
  font-weight: 500;
  border-radius: 6px;
  width: 100%;
}

.mobile-nav-link:hover {
  background-color: #f3f4f6;
}

.mobile-nav-link.active {
  background-color: #eff6ff;
  color: #3b82f6;
}

.logout-link {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 1rem;
  text-align: left;
}

.overlay {
  position: fixed;
  top: 60px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(2px);
  z-index: 1001;
}

@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .menu-toggle { display: block; }
  .nav-header { padding: 0 1rem; }
  /* Reduce gap on mobile for better proximity */
  .nav-left { gap: 0.5rem; }
  /* Ensure button padding doesn't offset it weirdly */
  .menu-toggle { padding: 0.25rem; margin-left: -0.25rem; } 
}

.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}
.slide-enter, .slide-leave-to {
  transform: translateX(-100%);
}
</style>
