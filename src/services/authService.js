import axios from 'axios';
import storageService from './storageService';

const BASE_URL = process.env.VUE_APP_DIYO_SERVICE_BACKEND_ENDPOINT;
const API_URL = `${BASE_URL}/api`;
const KEYS = storageService.KEYS;

class AuthService {
    async login(email, password) {
        const response = await axios.post(`${API_URL}/login`, {
            email,
            password
        });

        if (response.data) {
            this.handleLoginResponse(response.data);
        }

        return response;
    }

    handleLoginResponse(data) {
        const { accessToken, email, roles } = data;
        storageService.setItem(KEYS.ACCESS_TOKEN, accessToken);
        storageService.setItem(KEYS.USER_EMAIL, email);
        storageService.setItem(KEYS.USER_ROLES, roles);
    }

    signup(user) {
        return axios.post(`${API_URL}/register`, user);
    }

    resetPassword(email) {
        return axios.post(`${API_URL}/resetPassword`, { email });
    }

    confirmReset(data) {
        return axios.post(`${API_URL}/confirmReset`, data);
    }

    logout() {
        storageService.clearAuth();
    }

    isLoggedIn() {
        return !!storageService.getItem(KEYS.ACCESS_TOKEN);
    }

    getToken() {
        return storageService.getItem(KEYS.ACCESS_TOKEN);
    }

    getUserEmail() {
        return storageService.getItem(KEYS.USER_EMAIL);
    }

    getUserRoles() {
        return storageService.getItem(KEYS.USER_ROLES, true) || [];
    }
}

export default new AuthService();
