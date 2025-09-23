<template>
  <div class="login-container">
    <form class="login-form">
      <div v-if="errorMessage" style="color:red; margin-top:10px;">
        {{ errorMessage }}
      </div>
    </form>
  </div>
</template>

<script>
import { fetchAuthSession, signInWithRedirect } from '@aws-amplify/auth';

export default {
  name: "Login",
  data() {
    return {
      redirecting: false,
      errorMessage: ''
    };
  },
  async created() {
    // console.log('[Login.vue] created hook called');
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('error')) {
        this.errorMessage = `OAuth Error: ${urlParams.get('error_description')}`;
        this.redirecting = false;
        // console.log('[Login.vue] OAuth error in URL:', this.errorMessage);
        return;
      }
    //   console.log('[Login.vue] Checking session with fetchAuthSession...');
      const session = await fetchAuthSession();
    //   console.log('[Login.vue] fetchAuthSession result:', session);

      if (session.tokens?.idToken) {
        localStorage.setItem('otterAuthToken', session.tokens.idToken.toString());
        // console.log('[Login.vue] Valid session found, redirecting to ResumeSetup');
        this.$router.push({ name: 'ResumeSetup' });
        return;
      }
      // No session? Show login button
    //   console.log('[Login.vue] No valid session, showing login button');
      await signInWithRedirect();
    } catch (e) {
      console.error('[Login.vue] Auth session error:', e);
      this.errorMessage = e.message || 'Login failed';
      this.redirecting = false; // Ensure button is shown on error
    }
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  margin-top: 50px;
}
.login-form {
  display: flex;
  flex-direction: column;
  align-items: center;
}
button {
  padding: 8px 16px;
  margin-top: 20px;
  cursor: pointer;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>