<template>
  <nav class="user-navbar">
    <div class="navbar-content">
      <span class="navbar-title">Interview App</span>
      <router-link to="/setup" class="navbar-link">Setup</router-link>
      <router-link to="/userSession" class="navbar-link">Sessions</router-link>
      <button class="navbar-logout" @click="logout">Logout</button>
    </div>
  </nav>
</template>

<script>
export default {
  name: 'UserNavbar',
  methods: {
    logout() {
      localStorage.removeItem('otterAuthToken');
      this.$router.push({ name: 'Login' });
    }
  }
};
</script>

<style scoped>
.user-navbar {
  background: linear-gradient(90deg, #2563eb 70%, #1e40af 100%);
  color: #fff;
  padding: 0.85rem 2vw;
  box-shadow: 0 2px 12px rgba(59,130,246,0.10);
  border-radius: 0 0 16px 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background 0.3s;
}

.user-navbar:hover {
  background: linear-gradient(90deg, #1e40af 70%, #2563eb 100%);
}

.navbar-content {
  display: flex;
  align-items: center;
  gap: 2rem;
  max-width: 1100px;
  margin: 0 auto;
}

.navbar-title {
  font-weight: 700;
  font-size: 1.35rem;
  margin-right: 2.5rem;
  letter-spacing: 1px;
  text-shadow: 0 2px 8px rgba(30,64,175,0.08);
}

.navbar-link {
  color: #fff;
  text-decoration: none;
  font-weight: 500;
  padding: 0.35rem 1.1rem;
  border-radius: 6px;
  transition: background 0.2s, color 0.2s;
  font-size: 1.05rem;
  position: relative;
}

.navbar-link:hover,
.navbar-link.router-link-exact-active {
  background: rgba(255,255,255,0.12);
  color: #e0e7ff;
}

.navbar-logout {
  margin-left: auto;
  background: linear-gradient(90deg, #ef4444 70%, #dc2626 100%);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.4rem 1.2rem;
  font-size: 1.05rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(239,68,68,0.10);
  transition: background 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.navbar-logout:hover {
  background: linear-gradient(90deg, #dc2626 70%, #ef4444 100%);
  box-shadow: 0 4px 16px rgba(239,68,68,0.15);
}

@media (max-width: 700px) {
  .navbar-content {
    gap: 1rem;
    font-size: 0.98rem;
  }
  .navbar-title {
    font-size: 1.1rem;
    margin-right: 1rem;
  }
  .navbar-link {
    padding: 0.3rem 0.7rem;
    font-size: 0.98rem;
  }
  .navbar-logout {
    padding: 0.3rem 0.8rem;
    font-size: 0.98rem;
  }
}
</style>