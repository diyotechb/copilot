<template>
  <div class="auth-container">
    <div class="auth-form">
      <div class="auth-header">
        <img src="https://www.diyotech.net/logo-transparent.svg" alt="Diyo Logo" class="auth-brand-logo" />
        <h2>Create Account</h2>
        <p class="auth-subtitle">Join the Interview Simulator</p>
      </div>

      <form @submit.prevent="handleSignup" style="display: flex; flex-direction: column; gap: 20px;">
        <div class="form-row">
          <div class="form-group">
            <label for="firstName">First Name</label>
            <div class="input-with-icon">
              <i class="el-icon-user input-icon"></i>
              <input 
                id="firstName" 
                v-model="form.firstName" 
                @input="errorMessage = ''" 
                type="text" 
                placeholder="First" 
                required 
              />
            </div>
          </div>
          <div class="form-group">
            <label for="lastName">Last Name</label>
            <div class="input-with-icon">
              <i class="el-icon-user input-icon"></i>
              <input 
                id="lastName" 
                v-model="form.lastName" 
                @input="errorMessage = ''" 
                type="text" 
                placeholder="Last" 
                required 
              />
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="email">Email Address</label>
          <div class="input-with-icon">
            <i class="el-icon-message input-icon"></i>
            <input 
              id="email" 
              v-model="form.email" 
              @input="errorMessage = ''" 
              type="email" 
              placeholder="Enter your email" 
              required 
            />
          </div>
        </div>

        <div class="form-group">
          <div class="label-with-icon">
            <label for="password">Password</label>
            <PasswordPolicy />
          </div>
          <div class="input-with-icon">
            <i class="el-icon-lock input-icon"></i>
            <input 
              id="password" 
              v-model="form.password" 
              @input="errorMessage = ''" 
              type="password" 
              placeholder="Enter your password" 
              required 
            />
          </div>
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <div class="input-with-icon">
            <i class="el-icon-check input-icon"></i>
            <input 
              id="confirmPassword" 
              v-model="form.confirmPassword" 
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
          {{ isLoading ? 'Creating account...' : 'Create Account' }}
        </button>

        <div class="form-footer centered">
          <span class="footer-text">Already have an account? <router-link to="/login">Log in</router-link></span>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import authService from '@/services/authService';
import { validateEmail, validatePassword } from '@/utils/validation';
import PasswordPolicy from './components/PasswordPolicy.vue';

export default {
  components: { PasswordPolicy },
  data() {
    return {
      form: {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
      },
      isLoading: false,
      errorMessage: ''
    }
  },
  methods: {
    async handleSignup() {
      if (!this.form.firstName || !this.form.lastName || !this.form.email || !this.form.password || !this.form.confirmPassword) {
          this.errorMessage = 'Please fill in all required fields.';
          return;
      }

      if (!validateEmail(this.form.email)) {
        this.errorMessage = 'Invalid email format';
        return;
      }
      if (!validatePassword(this.form.password)) {
        this.errorMessage = 'Password does not meet requirements';
        return;
      }
      if (this.form.password !== this.form.confirmPassword) {
        this.errorMessage = 'Passwords do not match';
        return;
      }

      this.isLoading = true;
      try {
        const signupData = {
          userName: this.form.email,
          email: this.form.email,
          password: this.form.password,
          firstName: this.form.firstName,
          lastName: this.form.lastName,
          middleName: '',
          dateOfBirth: ''
        };

        const response = await authService.signup(signupData);
        if (response.status === 200 || response.status === 201) {
          this.$router.push({ name: 'Login' });
        }
      } catch (error) {
        console.error('Signup error:', error);
        this.errorMessage = error.response?.data?.message || error.message || 'Registration failed.';
      } finally {
        this.isLoading = false;
      }
    }
  }
}
</script>

<style scoped>
@import '@/assets/styles/auth.css';

/* Signup specific layout for name row */
.form-row {
  display: flex;
  gap: 1rem;
}

.form-row .form-group {
  flex: 1;
}

@media (max-width: 480px) {
  .form-row {
    flex-direction: column;
    gap: 1.2rem;
  }
}
</style>
