<template>
    <div class="login-container">
        <form class="login-form" @submit.prevent="handleLogin">
            <h2>Login</h2>
            <div class="form-group">
                <label for="username">Username</label>
                <input
                    id="username"
                    v-model="username"
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
                    type="password"
                    placeholder="Enter your password"
                    required
                />
            </div>
            <button type="submit">Login</button>
        </form>
    </div>
</template>

<script>
export default {
    name: "Login",
    data() {
        return {
            username: "",
            password: "",
        };
    },
    created() {
        const token = localStorage.getItem('otterAuthToken');
        if (token) {
            this.$router.push({ name: 'OtterAssistant' });
        }
    },
    methods: {
        handleLogin() {
            // Local credential check
            const validUsername = 'mgaire@diyotech.net';
            const validPassword = 'Test@123';
            if (this.username === validUsername && this.password === validPassword) {
                // Generate a simple token (base64 of username + timestamp)
                const tokenPayload = `${this.username}:${Date.now()}`;
                const token = btoa(tokenPayload);
                localStorage.setItem('otterAuthToken', token);
                this.$router.push({ name: 'ResumeSetup' });
            } else {
                alert('Login failed. Please check your credentials.');
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

button[type="submit"] {
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
</style>