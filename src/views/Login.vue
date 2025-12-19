<template>
    <div class="login-container">
        <form class="login-form" @submit.prevent="handleLogin">
            <h2>Login</h2>
            <div class="form-group">
                <label for="username">Username</label>
                <input
                    id="username"
                    v-model="username"
                    @input="errorMessage = ''"
                    type="text"
                    placeholder="Enter your username"
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
            <button type="submit" :disabled="isLoading">
                <span class="spinner" v-if="isLoading" aria-hidden="true"></span>
                {{ isLoading ? 'Logging in...' : 'Login' }}
            </button>
        </form>
    </div>
</template>

<script>
import axios from 'axios';

export default {
    name: "Login",
    data() {
        return {
            username: "",
            password: "",
            isLoading: false,
            errorMessage: '',
        };
    },
    created() {
        const token = localStorage.getItem('otterAuthToken');
        if (token) {
            this.$router.push({ name: 'OtterAssistant' });
        }
    },
    methods: {
        async handleLogin() {
            // Temporary mock: API is currently unavailable. Replace this with a real POST to
            // process.env.VUE_APP_LOGIN_ENDPOINT when the endpoint is back online.
            this.errorMessage = '';

            if (!this.username || !this.password) {
                this.errorMessage = 'Please enter both email and password.';
                return;
            }

            this.isLoading = true;

            try {
                // Simulate a short network delay
                await new Promise((resolve) => setTimeout(resolve, 400));

                // Generate a mock token (base64 of username + timestamp + random part)
                const randomPart = Math.random().toString(36).slice(2);
                const tokenPayload = `${this.username}:${Date.now()}:${randomPart}`;
                const token = btoa(tokenPayload);

                // The real API call is commented out while the endpoint is down:
                // const endpoint = process.env.VUE_APP_LOGIN_ENDPOINT;
                // const res = await axios.post(endpoint, { email: this.username, password: this.password });
                // const data = res?.data || {};
                // const token = data.token || data.accessToken || data?.data?.token;

                localStorage.setItem('otterAuthToken', token);
                this.$router.push({ name: 'ResumeSetup' });
            } catch (err) {
                console.error('Login mock error:', err);
                this.errorMessage = 'Unexpected error during login. Please try again.';
            } finally {
                this.isLoading = false;
            }
        },
    },
};
</script>

<style scoped>
.login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
        background: linear-gradient(135deg, #6dd5ed 0%, #2193b0 100%);

@media (prefers-color-scheme: dark) {
    .login-container {
        background: linear-gradient(135deg, #232946 0%, #121629 100%);
    }
    .login-form {
        background: #181a2a;
        color: #e0e7ef;
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    }
    .login-form h2 {
        color: #7f9cf5;
    }
    .form-group label {
        color: #e0e7ef;
    }
    .form-group input {
        background: #232946;
        color: #e0e7ef;
        border: 1px solid #2d334a;
    }
    .form-group input:focus {
        border-color: #7f9cf5;
    }
    .error-message {
        color: #ffb4b4;
        background: rgba(255,180,180,0.04);
    }
    button[type="submit"] {
        background: #7f9cf5;
        color: #181a2a;
    }
    button[type="submit"]:hover {
        background: #4f5d75;
        color: #fff;
    }
}
}

.login-form {
    background: #fff;
    padding: 2rem 2.5rem;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
}

.login-form h2 {
    margin-bottom: 0.5rem;
    color: #2193b0;
    text-align: center;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.form-group label {
    font-weight: 500;
    color: #333;
}

.form-group input {
    padding: 0.6rem;
    border: 1px solid #b0c4de;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
}

.form-group input:focus {
    border-color: #2193b0;
    outline: none;
}

.error-message {
    color: #b00020;
    background: rgba(176,0,32,0.04);
    padding: 0.5rem;
    border-radius: 6px;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

button[type="submit"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: #2193b0;
    color: #fff;
    border: none;
    padding: 0.7rem;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

button[type="submit"]:hover {
    background: #17668c;
}

button[type="submit"][disabled] {
    opacity: 0.65;
    cursor: not-allowed;
}

.spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.6);
    border-top-color: rgba(255,255,255,1);
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>