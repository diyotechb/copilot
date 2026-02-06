<template>
  <div class="auth-container">
    <form class="auth-form" @submit.prevent="handleSignup">
      <h2>Create Account</h2>

      <div class="form-row">
        <div class="form-group">
          <label for="firstName">First name</label>
          <input id="firstName" v-model="form.firstName" @input="errorMessage = ''" type="text" placeholder="First name" required />
        </div>
        <div class="form-group">
          <label for="lastName">Last name</label>
          <input id="lastName" v-model="form.lastName" @input="errorMessage = ''" type="text" placeholder="Last name" required />
        </div>
      </div>

      <div class="form-group">
        <label for="email">Email</label>
        <input id="email" v-model="form.email" @input="errorMessage = ''" type="email" placeholder="Enter your email" required />
      </div>

      <div class="form-group">
        <div class="label-with-icon">
          <label for="password">Password</label>
          <PasswordPolicy />
        </div>
        <input id="password" v-model="form.password" @input="errorMessage = ''" type="password" placeholder="Min 8 characters" required />
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <input id="confirmPassword" v-model="form.confirmPassword" @input="errorMessage = ''" type="password" placeholder="Confirm your password" required />
      </div>

      <p class="error-message" v-if="errorMessage" role="alert">{{ errorMessage }}</p>

      <button type="submit" class="auth-button" :disabled="isLoading">
        <span class="spinner" v-if="isLoading" aria-hidden="true"></span>
        {{ isLoading ? 'Creating account...' : 'Sign Up' }}
      </button>

      <div class="form-footer centered">
        <span>Already have an account? <router-link to="/">Login</router-link></span>
      </div>
    </form>
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
          Message.success('Registration successful! Please login.');
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
