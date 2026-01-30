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
          <div class="info-button" @click.stop="togglePolicy" title="View password policy">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            <div class="policy-popup" v-if="showPolicy" @click.stop>
              <strong>Password Policy:</strong>
              <ul>
                <li>Minimum 8 characters</li>
                <li>At least 1 uppercase letter</li>
                <li>At least 1 lowercase letter</li>
                <li>At least 1 number</li>
                <li>At least 1 special character</li>
              </ul>
            </div>
          </div>
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
import { Message } from 'element-ui';

export default {
  name: 'Signup',
  data() {
    return {
      form: {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
      },
      showPolicy: false,
      isLoading: false,
      errorMessage: ''
    }
  },
  beforeDestroy() {
    document.removeEventListener('click', this.closePolicy);
  },
  methods: {
    togglePolicy() {
      this.showPolicy = !this.showPolicy;
      if (this.showPolicy) {
        document.addEventListener('click', this.closePolicy);
      } else {
        document.removeEventListener('click', this.closePolicy);
      }
    },
    closePolicy() {
      this.showPolicy = false;
      document.removeEventListener('click', this.closePolicy);
    },
    async handleSignup() {
      // Basic empty check
      if (!this.form.firstName || !this.form.lastName || !this.form.email || !this.form.password || !this.form.confirmPassword) {
          this.errorMessage = 'Please fill in all required fields.';
          return;
      }

      // Existing Validations
      if (!validateEmail(this.form.email)) {
        this.errorMessage = 'Invalid email format';
        return;
      }
      if (!validatePassword(this.form.password)) {
        this.errorMessage = 'Password must be at least 8 characters long and contain uppercase, lowercase, number and special character';
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
