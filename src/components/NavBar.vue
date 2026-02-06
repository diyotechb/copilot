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
          
          <span class="brand-text">Copilot</span>

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
          <div v-if="userEmail" class="user-info desktop-only">
            <span class="user-email">{{ userEmail }}</span>
          </div>
          <button class="logout-btn desktop-only" @click="handleLogout" aria-label="Logout">
            <svg class="nav-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/></svg>
            <span>Logout</span>
          </button>
        </div>
      </div>

      <!-- Mobile Sidebar/Drawer -->
      <transition name="slide">
        <div v-if="isMenuOpen" class="mobile-sidebar">
          <div class="mobile-user-info" v-if="userEmail">
            <span class="mobile-email">{{ userEmail }}</span>
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
      navItems: NAVIGATION_ITEMS
    };
  },
  computed: {
    userEmail() {
      return authService.getUserEmail();
    }
  },
  methods: {
    handleLogout() {
      this.isMenuOpen = false;
      authService.logout();
      this.$router.push({ name: 'Login' });
    },
    isActive(routeName) {
      return this.$route.name === routeName;
    },
    toggleMenu() {
      this.isMenuOpen = !this.isMenuOpen;
    }
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

.brand-text {
  font-size: 1.25rem;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.025em;
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

.user-info {
  margin-right: -1rem;
}

.user-email {
  font-size: 0.875rem;
  color: #6b7280;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: 1px solid #e5e7eb;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  color: #ef4444;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background-color: #fef2f2;
  border-color: #fecaca;
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
}

.mobile-email {
  display: block;
  font-size: 0.875rem;
  color: #6b7280;
  word-break: break-all;
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
