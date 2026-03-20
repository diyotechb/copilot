import { APP_CONFIG } from '@/constants/appConfig';
import axios from 'axios';
import storageService from './storageService';

const BASE_URL = APP_CONFIG.SERVICES.DIYO_SERVICE_URL;
if (!BASE_URL) {
  console.error('********************************************************************************');
  console.error('ERROR: Diyo Service Backend URL (VUE_APP_DIYO_SERVICE_BACKEND_ENDPOINT) is MISSING!');
  console.error('Login and other authentication features will FAIL.');
  console.error('Please provide the URL in your .env file or environment.');
  console.error('********************************************************************************');
}
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
