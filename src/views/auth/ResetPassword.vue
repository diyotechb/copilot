<template>
  <div class="auth-container">
    <div class="auth-form">
      <!-- Step 1: Request Reset -->
      <form v-if="step === 1" @submit.prevent="handleRequestReset" style="display: flex; flex-direction: column; gap: 20px;">
        <div class="auth-header">
          <img src="https://diyotech.net/assets/images/diyotech.jpg" alt="Diyo Logo" class="auth-brand-logo" />
          <h2>Reset Password</h2>
          <p class="auth-subtitle">Enter your email to receive a reset code</p>
        </div>

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

        <div class="error-message" v-if="errorMessage" role="alert">
          <i class="el-icon-warning"></i> {{ errorMessage }}
        </div>

        <button type="submit" class="auth-button" :disabled="isLoading">
          <div class="spinner" v-if="isLoading" aria-hidden="true"></div>
          {{ isLoading ? 'Sending Code...' : 'Send Reset Code' }}
        </button>

        <div class="form-footer centered">
          <router-link to="/login">Back to Login</router-link>
        </div>
      </form>

      <!-- Step 2: Confirm Reset -->
      <form v-else @submit.prevent="handleConfirmReset" style="display: flex; flex-direction: column; gap: 20px;">
        <div class="auth-header">
          <img src="https://diyotech.net/assets/images/diyotech.jpg" alt="Diyo Logo" class="auth-brand-logo" />
          <h2>New Password</h2>
          <p class="auth-subtitle">Set your new workspace credentials</p>
        </div>

        <div class="form-group">
          <label for="confirmationCode">Reset Code</label>
          <div class="input-with-icon">
            <i class="el-icon-key input-icon"></i>
            <input
              id="confirmationCode"
              v-model="confirmationCode"
              @input="errorMessage = ''"
              type="text"
              placeholder="Enter the 6-digit code"
              required
            />
          </div>
        </div>

        <div class="form-group">
          <div class="label-with-icon">
            <label for="newPassword">New Password</label>
            <PasswordPolicy />
          </div>
          <div class="input-with-icon">
            <i class="el-icon-lock input-icon"></i>
            <input
              id="newPassword"
              v-model="newPassword"
              @input="errorMessage = ''"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>
        </div>

        <div class="form-group">
          <label for="confirmNewPassword">Confirm New Password</label>
          <div class="input-with-icon">
            <i class="el-icon-check input-icon"></i>
            <input
              id="confirmNewPassword"
              v-model="confirmNewPassword"
              @input="errorMessage = ''"
              type="password"
              placeholder="Confirm your password"
              required
            />
          </div>
        </div>

        <div class="error-message" v-if="errorMessage" role="alert">
          <i class="el-icon-warning"></i> {{ errorMessage }}
        </div>

        <button type="submit" class="auth-button" :disabled="isLoading">
          <div class="spinner" v-if="isLoading" aria-hidden="true"></div>
          {{ isLoading ? 'Updating Password...' : 'Update Password' }}
        </button>

        <div class="form-footer centered">
          <router-link to="/login">Back to Login</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import authService from '@/services/authService';
import { validateEmail, validatePassword } from '@/utils/validation';
import PasswordPolicy from './components/PasswordPolicy.vue';
import { Message } from 'element-ui';

export default {
    components: { PasswordPolicy },
    data() {
        return {
            step: 1,
            email: '',
            confirmationCode: '',
            newPassword: '',
            confirmNewPassword: '',
            errorMessage: '',
            isLoading: false
        };
    },
    methods: {
        async handleRequestReset() {
            if (!this.email) {
                this.errorMessage = 'Please enter your email address.';
                return;
            }
            if (!validateEmail(this.email)) {
                this.errorMessage = 'Please enter a valid email address.';
                return;
            }

            this.isLoading = true;
            this.errorMessage = '';

            try {
                await authService.resetPassword(this.email);
                this.step = 2;
                Message.success('Reset code sent successfully.');
            } catch (error) {
                console.error('Reset request error:', error);
                const errorMsg = error.response?.data?.message || error.message || 'Failed to send reset code.';
                this.errorMessage = errorMsg;
            } finally {
                this.isLoading = false;
            }
        },
        async handleConfirmReset() {
            if (!this.confirmationCode || !this.newPassword || !this.confirmNewPassword) {
                this.errorMessage = 'Please fill in all fields.';
                return;
            }
            if (!validatePassword(this.newPassword)) {
                 this.errorMessage = 'Password does not meet requirements';
                 return;
            }
            if (this.newPassword !== this.confirmNewPassword) {
                this.errorMessage = 'Passwords do not match.';
                return;
            }

            this.isLoading = true;

            try {
                const data = {
                    username: this.email,
                    newPassword: this.newPassword,
                    confirmationCode: this.confirmationCode,
                };
                await authService.confirmReset(data);
                Message.success('Password updated successfully! Please login.');
                this.$router.push({ name: 'Login' });
            } catch (error) {
                console.error('Password confirm error:', error);
                const errorMsg = error.response?.data?.message || error.message || 'Failed to update password.';
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

.centered {
    justify-content: center;
}
</style>
