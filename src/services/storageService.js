const KEYS = {
    ACCESS_TOKEN: 'accessToken',
    USER_EMAIL: 'email',
    USER_ROLES: 'roles',
    TRANSCRIPTIONS_HISTORY: 'transcriptions_history',
    USER_LANDING_PAGE: 'user_landing_page',
    USER_FEATURES: 'user_features'
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

    async clearInterviewSession() {
        const { clearStore } = await import('@/store/dbStore');
        await clearStore('interviewQA');
        await clearStore('transcripts');
    }

    async clearRecordingData() {
        const { clearStore } = await import('@/store/dbStore');
        await clearStore('recordings');
    }

    clearTranscriptionHistory() {
        this.removeItem(KEYS.TRANSCRIPTIONS_HISTORY);
    }

    async getStorageUsage() {
        const { getAllFromStore, getAllKeysFromStore } = await import('@/store/dbStore');
        
        const estimateSize = (data) => {
            try {
                const str = JSON.stringify(data);
                return new Blob([str]).size;
            } catch (e) {
                // If it's a blob already (like in recordings)
                if (data instanceof Blob) return data.size;
                return 0;
            }
        };

        const getStoreStats = async (name) => {
            const items = await getAllFromStore(name);
            const keys = await getAllKeysFromStore(name);
            let totalSize = 0;
            items.forEach(item => {
                if (item instanceof Blob) {
                    totalSize += item.size;
                } else {
                    totalSize += estimateSize(item);
                }
            });
            return { count: keys.length, size: totalSize };
        };

        return {
            recordings: await getStoreStats('recordings'),
            interviews: await getStoreStats('interviewQA'),
            transcripts: await getStoreStats('transcripts'),
            history: {
                count: (this.getItem(KEYS.TRANSCRIPTIONS_HISTORY, true) || []).length,
                size: new Blob([localStorage.getItem(KEYS.TRANSCRIPTIONS_HISTORY) || '[]']).size
            }
        };
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
