<template>
  <nav class="app-nav">
    <div class="nav-left">
    
      <ul class="nav-items" role="menubar">
      <li class="nav-item" :class="{ active: isActive('/setup') }" role="none">
        <router-link to="/setup" role="menuitem" class="nav-link">
          <svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Home</span>
        </router-link>
      </li>
      <li class="nav-item" :class="{ active: isActive('/liveTranscription') }" role="none">
        <router-link to="/liveTranscription" role="menuitem" class="nav-link">
          <svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3C8.13 3 5 6.13 5 10c0 2.71 1.67 5.01 4 5.8V20l3-2 3 2v-4.2c2.33-.79 4-3.09 4-5.8 0-3.87-3.13-7-7-7z"/></svg>
          <span>Live Transcription</span>
        </router-link>
      </li>
    </ul>
    </div>

    <div class="nav-right">
      <button class="logout-btn" @click="handleLogout" aria-label="Logout">
        <svg class="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16 13v-2H7V8l-5 4 5 4v-3zM20 3h-8v2h8v14h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
        <span>Logout</span>
      </button>
    </div>
  </nav>
</template>

<script>
export default {
  name: 'NavBar',
  methods: {
    handleLogout() {
      localStorage.removeItem('otterAuthToken');
      this.$router.push({ name: 'Login' });
    },
    isActive(path) {
      return this.$route.path === path;
    }
  }
}
</script>

<style scoped>
.app-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: linear-gradient(90deg, #ffffff, #f5f8fa);
  box-shadow: 0 2px 8px rgba(16,24,40,0.06);
  border-bottom: 1px solid rgba(34,36,38,0.06);
}
.nav-left {
  display: flex;
  align-items: center;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: inherit;
}
.brand-icon { border-radius: 6px; }
.brand-text {
  font-weight: 700;
  color: #1f3f56;
}
.nav-items {
  list-style: none;
  display: flex;
  gap: 1rem;
  margin: 0;
  padding: 0;
  margin-left: 1rem; /* space between brand and nav items */
}
.nav-item { display: flex; align-items: center; }
.nav-link {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  color: #4b5563;
  text-decoration: none;
}
.nav-item.active .nav-link {
  background: linear-gradient(90deg,#e6f4fb,#dff0f8);
  color: #0b5f8a;
  box-shadow: 0 1px 0 rgba(11,95,138,0.06) inset;
}
.nav-right { display: flex; align-items: center; }
.logout-btn {
  background: transparent;
  border: none;
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  cursor: pointer;
  color: #ef4444;
}
.logout-btn:hover { background: rgba(239,68,68,0.06); }
.icon { color: currentColor; }

/* Responsive */
@media (prefers-color-scheme: dark) {
  .app-nav { background: linear-gradient(90deg,#0f1724,#0b1220); color: #e6eef6; }
  .nav-link { color: #cbd5e1; }
  .nav-item.active .nav-link { background: rgba(127,156,245,0.08); color: #93c5fd; }
  .brand-text { color: #e6eef6; }
}
</style>