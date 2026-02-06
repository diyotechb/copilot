import storageService from './storageService';
import moment from 'moment';

const KEYS = storageService.KEYS;
const MAX_HISTORY = 10;

class TranscriptService {
    loadHistory() {
        const history = storageService.getItem(KEYS.TRANSCRIPTIONS_HISTORY, true) || [];
        return history.sort((a, b) => b.timestamp - a.timestamp);
    }

    saveHistory(history) {
        storageService.setItem(KEYS.TRANSCRIPTIONS_HISTORY, history);
    }

    saveTranscript(session) {
        if (!session.lines || session.lines.length === 0) return;

        let history = this.loadHistory();

        const newEntry = {
            id: session.id || this.generateId(),
            timestamp: session.timestamp || Date.now(),
            dateStr: session.dateStr || moment().format('MMM D, h:mm A'),
            title: session.title || `Note ${moment().format('MMM D')}`,
            lines: session.lines
        };

        const existingIdx = history.findIndex(h => h.id === newEntry.id);
        if (existingIdx >= 0) {
            history.splice(existingIdx, 1);
        }

        history.unshift(newEntry);

        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }

        this.saveHistory(history);
        return history;
    }

    deleteTranscript(id) {
        let history = this.loadHistory();
        history = history.filter(h => h.id !== id);
        this.saveHistory(history);
        return history;
    }

    deleteAll() {
        this.saveHistory([]);
        return [];
    }

    generateId() {
        return 'SID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    getPreviewText(lines) {
        if (!lines || lines.length === 0) return '';
        const allText = lines.map(line => line.text).join(' ');
        const words = allText.split(/\s+/).filter(w => w);
        if (words.length > 75) {
            return words.slice(0, 75).join(' ') + '...';
        }
        return allText;
    }
}

export default new TranscriptService();
