<template>
  <div id="app" :class="{ 'has-sidebar': showSidebar, 'sidebar-collapsed': isSidebarCollapsed, 'mobile-sidebar-open': isMobileSidebarOpen }">
    <AppSidebar 
      v-if="showSidebar" 
      :is-mobile-open="isMobileSidebarOpen"
      :is-collapsed="isSidebarCollapsed"
      @toggle="isSidebarCollapsed = $event"
      @close-mobile="isMobileSidebarOpen = false"
    />
    
    <div class="main-wrapper">
      <!-- Mobile Header with Hamburger -->
      <header v-if="showSidebar" class="mobile-header">
        <button class="hamburger-btn" @click="isMobileSidebarOpen = true" aria-label="Open Menu">
          <i class="el-icon-menu"></i>
        </button>
        <router-link to="/" class="mobile-branding-link">
          <div class="mobile-branding">
            <span class="mobile-logo-text">Diyo Tech</span>
          </div>
        </router-link>
        <div class="mobile-spacer"></div>
      </header>

      <!-- Minimalist Header for Top Nav if needed on public pages -->
      <NavBar v-if="showTopNav" />
      
      <main class="page-content" :class="{ 'no-top-nav': !showTopNav }">
        <router-view class="router_view"/>
      </main>
    </div>
  </div>
</template>

<script>
import NavBar from '@/components/NavBar.vue';
import AppSidebar from '@/components/AppSidebar.vue';
import authService from '@/services/authService';

export default {
  name: 'App',
  components: { NavBar, AppSidebar },
  data() {
    return {
      isSidebarCollapsed: true,
      isMobileSidebarOpen: false,
      isLoggedIn: authService.isLoggedIn(),
      isSidebarHiddenManually: false
    }
  },
  mounted() {
    this.$root.$on('toggle-sidebar', (hide) => {
      this.isSidebarHiddenManually = hide;
    });
  },
  beforeDestroy() {
    this.$root.$off('toggle-sidebar');
  },
  computed: {
    showSidebar() {
      if (this.isSidebarHiddenManually) return false;

      // Hide sidebar on Auth pages and during the actual Interview session for maximum focus
      const hideOn = ['Login', 'Signup', 'ResetPassword', 'InterviewView'];
      const isPublic = ['Home'].includes(this.$route.name);
      
      if (hideOn.includes(this.$route.name)) return false;
      
      // Only show sidebar if logged in OR on specific non-auth pages
      return this.isLoggedIn;
    },
    showTopNav() {
      // Show top nav on public pages (like Home) but NEVER on auth pages or when sidebar is active
      const authPages = ['Login', 'Signup', 'ResetPassword'];
      if (authPages.includes(this.$route.name)) return false;
      
      const publicPages = ['Home'];
      return publicPages.includes(this.$route.name) && !this.showSidebar;
    }
  },
  watch: {
    '$route'() {
      this.isLoggedIn = authService.isLoggedIn();
      this.isMobileSidebarOpen = false; // Auto-close on navigation
      this.isSidebarHiddenManually = false; // Reset session-based hiding
    }
  }
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap');

:root {
  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;
  --bg-color: #ffffff;
  --secondary-bg: #f9fafe;
  --border-color: #e2e8f0;
  --text-main: #1a1a1a;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 80px;
  --top-nav-height: 60px;
  --font-family: 'Outfit', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
}

* {
  box-sizing: border-box;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-family: 'Outfit', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
}

button, input, select, textarea, .el-button, .el-input {
  font-family: var(--font-family) !important;
}

#app {
  -webkit-font-smoothing: antialiased;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #1a1a1a;
  min-height: 100vh;
  display: flex;
}

body {
  margin: 0;
  padding: 0;
  background-color: #f9fafe;
}

.main-wrapper {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition: padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

#app.has-sidebar .main-wrapper {
  padding-left: var(--sidebar-width);
}

#app.has-sidebar.sidebar-collapsed .main-wrapper {
  padding-left: var(--sidebar-collapsed-width);
}

/* ── Global Button Standard (Hero Style) ── */
.primary-hero-btn {
  padding: 16px 40px !important;
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  border-radius: 12px !important;
  height: auto !important;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
  transition: all 0.3s !important;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.primary-hero-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.3);
}

.minimal-control-btn {
  background: white !important;
  border: 1px solid #e2e8f0 !important;
  color: #64748b !important;
  transition: all 0.2s !important;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02) !important;
}

.minimal-control-btn:hover {
  background: #f8fafc !important;
  color: #1a1a1a !important;
  border-color: #cbd5e0 !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.05) !important;
}

.minimal-control-btn:active {
  transform: translateY(0);
  background: #f1f5f9 !important;
}

.minimal-control-btn.is-active {
  background: #eff6ff !important;
  color: #2563eb !important;
  border-color: #bfdbfe !important;
}

.page-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.router_view {
  width: 100%;
  flex-grow: 1;
}

.mobile-header {
  display: none;
}

@media (max-width: 768px) {
  #app.has-sidebar .main-wrapper {
    padding-left: 0;
  }
  
  .mobile-header {
    display: flex;
    height: 60px;
    background: white;
    border-bottom: 1px solid #f1f5f9;
    align-items: center;
    padding: 0 20px;
    position: sticky;
    top: 0;
    z-index: 900;
  }
  
  .hamburger-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #1e293b;
    cursor: pointer;
    padding: 10px;
    margin-left: -10px;
  }
  
  .mobile-branding-link {
    text-decoration: none;
  }

  .mobile-branding {
    margin-left: 10px;
  }
  
  .mobile-logo-text {
    font-weight: 800;
    font-size: 1.1rem;
    color: #1e293b;
    letter-spacing: -0.5px;
  }
}
</style>