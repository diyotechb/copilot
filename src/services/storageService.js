const KEYS = {
    ACCESS_TOKEN: 'accessToken',
    USER_EMAIL: 'email',
    USER_ROLES: 'roles',
    OTTER_HISTORY: 'otter_history'
};

class StorageService {
    setItem(key, value) {
        if (typeof value === 'object') {
            localStorage.setItem(key, JSON.stringify(value));
        } else {
            localStorage.setItem(key, value);
        }
    }

    getItem(key, isJson = false) {
        const item = localStorage.getItem(key);
        if (isJson && item) {
            try {
                return JSON.parse(item);
            } catch (e) {
                console.error(`Error parsing JSON for key ${key}`, e);
                return null;
            }
        }
        return item;
    }

    removeItem(key) {
        localStorage.removeItem(key);
    }

    clearAuth() {
        this.removeItem(KEYS.ACCESS_TOKEN);
        this.removeItem(KEYS.USER_EMAIL);
        this.removeItem(KEYS.USER_ROLES);
    }

    get KEYS() {
        return KEYS;
    }
}

export default new StorageService();
