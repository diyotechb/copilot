<template>
  <div class="unauthorized-container">
    <div class="content">
      <div class="icon-box">
        <i class="el-icon-lock"></i>
      </div>
      <h1>Access Restricted</h1>
      <p>You don't have the necessary permissions to view this page. Please contact your administrator if you believe this is an error.</p>
      <div class="actions">
        <el-button type="primary" @click="$router.push({ name: 'Home' })">
          Return Home
        </el-button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'UnauthorizedView'
};
</script>

<style scoped>
.unauthorized-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 80px);
  padding: 40px;
  background-color: var(--secondary-bg);
  font-family: var(--font-family);
}

.content {
  max-width: 480px;
  text-align: center;
  background: white;
  padding: 48px;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color);
}

.icon-box {
  width: 80px;
  height: 80px;
  background: #fef2f2;
  color: #ef4444;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  margin: 0 auto 24px;
}

h1 {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0 0 16px;
  letter-spacing: -0.5px;
}

p {
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 32px;
}

.actions {
  display: flex;
  justify-content: center;
}
</style>
