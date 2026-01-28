<template>
    <div class="auth-container">
        <form class="auth-form" @submit.prevent="handleLogin">
            <h2>Login</h2>
            <div class="form-group">
                <label for="email">Email</label>
                <input
                    id="email"
                    v-model="email"
                    @input="errorMessage = ''"
                    type="email"
                    placeholder="Enter your email"
                    required
                />
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input
                    id="password"
                    v-model="password"
                    @input="errorMessage = ''"
                    type="password"
                    placeholder="Enter your password"
                    required
                />
            </div>
            <p class="error-message" v-if="errorMessage" role="alert">{{ errorMessage }}</p>
            <button type="submit" class="auth-button" :disabled="isLoading">
                <span class="spinner" v-if="isLoading" aria-hidden="true"></span>
                {{ isLoading ? 'Logging in...' : 'Login' }}
            </button>
            <div class="form-footer">
                <router-link to="/signup">Create an account</router-link>
                <router-link to="/reset-password">Forgot password?</router-link>
            </div>
        </form>
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
            this.errorMessage = '';

            if (!validateEmail(this.email)) {
                this.errorMessage = 'Please enter a valid email address.';
                return;
            }

            if (!validateMinLength(this.password, 8)) {
                this.errorMessage = 'Password must be at least 8 characters.';
                return;
            }

            this.isLoading = true;

            try {
                await authService.login(this.email, this.password);
                Message.success('Login successful!');
                this.$router.push({ name: 'ResumeSetup' });
            } catch (error) {
                console.error('Login error:', error);
                const errorMsg = error.response?.data || error.message || 'Login failed. Please check your credentials.';
                this.errorMessage = errorMsg;
                Message.error(errorMsg);
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