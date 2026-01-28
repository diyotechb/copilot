<template>
    <div class="auth-container">
        <!-- Step 1: Request Reset Code -->
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

        <!-- Step 2: Confirm Reset with Code and New Password -->
        <form v-else class="auth-form" @submit.prevent="handleConfirmReset">
            <h2>New Password</h2>
            <div class="form-group">
                <label for="confirmationCode">Reset Code</label>
                <input
                    id="confirmationCode"
                    v-model="confirmationCode"
                    type="text"
                    placeholder="Enter the code"
                    required
                />
            </div>
            <div class="form-group">
                <div class="label-with-icon">
                    <label for="newPassword">New Password</label>
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
                <input
                    id="newPassword"
                    v-model="newPassword"
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
import { Message } from 'element-ui';

export default {
    name: "ResetPassword",
    data() {
        return {
            step: 1, // 1: Request code, 2: Reset password
            email: "",
            confirmationCode: "",
            newPassword: "",
            confirmNewPassword: "",
            showPolicy: false,
            isLoading: false,
            errorMessage: '',
        };
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
        async handleRequestReset() {
            this.errorMessage = '';

            if (!validateEmail(this.email)) {
                this.errorMessage = 'Please enter a valid email address.';
                return;
            }

            this.isLoading = true;

            try {
                await authService.resetPassword(this.email);
                Message.success('Reset code sent to your email.');
                this.step = 2;
            } catch (error) {
                console.error('Reset request error:', error);
                const errorMsg = error.response?.data || error.message || 'Failed to send reset code.';
                this.errorMessage = errorMsg;
                Message.error(errorMsg);
            } finally {
                this.isLoading = false;
            }
        },
        async handleConfirmReset() {
            this.errorMessage = '';

            if (!validatePassword(this.newPassword)) {
                this.errorMessage = 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.';
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
                const errorMsg = error.response?.data || error.message || 'Failed to update password.';
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
