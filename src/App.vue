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
      isSidebarCollapsed: false,
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
:root {
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 80px;
  --top-nav-height: 60px;
}

* {
  box-sizing: border-box;
}

#app {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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