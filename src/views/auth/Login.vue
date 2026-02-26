<template>
  <div class="auth-container">
    <div class="auth-form">
      <div class="auth-header">
        <img src="https://www.diyotech.net/logo-transparent.svg" alt="Diyo Logo" class="auth-brand-logo" />
        <h2>Welcome Back</h2>
        <p class="auth-subtitle">Log in to your Interview Simulator</p>
      </div>

      <form @submit.prevent="handleLogin" style="display: flex; flex-direction: column; gap: 20px;">
        <div class="form-group">
          <label for="email">Email Address</label>
          <div class="input-with-icon">
            <i class="el-icon-message input-icon"></i>
            <input
              id="email"
              v-model="email"
              @input="errorMessage = ''"
              type="email"
              placeholder="Enter your email"
              required
            />
          </div>
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <div class="input-with-icon">
            <i class="el-icon-lock input-icon"></i>
            <input
              id="password"
              v-model="password"
              @input="errorMessage = ''"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>
        </div>

        <div class="error-message" v-if="errorMessage" role="alert">
          <i class="el-icon-warning"></i> {{ errorMessage }}
        </div>

        <button type="submit" class="auth-button" :disabled="isLoading">
          <div class="spinner" v-if="isLoading" aria-hidden="true"></div>
          {{ isLoading ? 'Entering Workspace...' : 'Login to Workspace' }}
        </button>

        <!-- Links hidden per user request; functional via direct URL only -->
        <!-- <div class="form-footer">
          <span class="footer-text">Don't have an account? <router-link to="/signup">Sign up</router-link></span>
          <router-link to="/reset-password">Forgot password?</router-link>
        </div> -->
      </form>
    </div>
  </div>
</template>

<script>
import { validateEmail, validateMinLength } from '@/utils/validation';
import authService from '@/services/authService';
import { Message } from 'element-ui';

export default {
    name: "Login",
    data() {
        return {
            email: "",
            password: "",
            isLoading: false,
            errorMessage: '',
        };
    },
    created() {
        if (authService.isLoggedIn()) {
            this.$router.push({ name: 'ResumeSetup' });
        }
    },
    methods: {
        async handleLogin() {
            if (!this.email || !this.password) {
                this.errorMessage = 'Please enter both email and password.';
                return;
            }
            if (!validateEmail(this.email)) {
                this.errorMessage = 'Please enter a valid email address.';
                return;
            }

            this.isLoading = true;
            this.errorMessage = '';

            try {
                await authService.login(this.email, this.password);
                Message.success('Login successful!');
                this.$router.push({ name: 'ResumeSetup' });
            } catch (error) {
                console.error('Login error:', error);
                const errorMsg = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
                this.errorMessage = errorMsg;
            } finally {
                this.isLoading = false;
            }
        },
    },
};
</script>

<style scoped>
@import '@/assets/styles/auth.css';
</style>