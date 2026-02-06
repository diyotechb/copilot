<template>
    <div class="auth-container">
        <form v-if="step === 1" class="auth-form" @submit.prevent="handleRequestReset">
            <h2>Reset Password</h2>
            <p class="description">Enter your account email to receive a password reset code.</p>
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
            <p class="error-message" v-if="errorMessage" role="alert">{{ errorMessage }}</p>
            <button type="submit" class="auth-button" :disabled="isLoading">
                <span class="spinner" v-if="isLoading" aria-hidden="true"></span>
                {{ isLoading ? 'Sending...' : 'Send Reset Code' }}
            </button>
            <div class="form-footer centered">
                <router-link to="/">Back to Login</router-link>
            </div>
        </form>

        <form v-else class="auth-form" @submit.prevent="handleConfirmReset">
            <h2>New Password</h2>
            <div class="form-group">
                <label for="confirmationCode">Reset Code</label>
                <input
                    id="confirmationCode"
                    v-model="confirmationCode"
                    @input="errorMessage = ''"
                    type="text"
                    placeholder="Enter the code"
                    required
                />
            </div>
            <div class="form-group">
                <div class="label-with-icon">
                    <label for="newPassword">New Password</label>
                    <PasswordPolicy />
                </div>
                <input
                    id="newPassword"
                    v-model="newPassword"
                    @input="errorMessage = ''"
                    type="password"
                    placeholder="Min 8 characters"
                    required
                />
            </div>
            <div class="form-group">
                <label for="confirmNewPassword">Confirm New Password</label>
                <input
                    id="confirmNewPassword"
                    v-model="confirmNewPassword"
                    @input="errorMessage = ''"
                    type="password"
                    placeholder="Confirm new password"
                    required
                />
            </div>
            <p class="error-message" v-if="errorMessage" role="alert">{{ errorMessage }}</p>
            <button type="submit" class="auth-button" :disabled="isLoading">
                <span class="spinner" v-if="isLoading" aria-hidden="true"></span>
                {{ isLoading ? 'Updating...' : 'Update Password' }}
            </button>
            <div class="form-footer centered">
                 <router-link to="/">Back to Login</router-link>
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

.description {
    text-align: center;
    color: #666;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
}

.centered {
    justify-content: center;
}
</style>
