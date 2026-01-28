class SpeechRecognitionService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.callbacks = {
            onResult: null,
            onEnd: null,
            onStart: null,
            onError: null
        };
    }

    isSupported() {
        return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
    }

    init(options = {}) {
        if (this.recognition) return;

        if (!this.isSupported()) {
            throw new Error("Speech recognition not supported");
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = options.continuous ?? true;
        this.recognition.interimResults = options.interimResults ?? true;
        this.recognition.lang = options.lang ?? 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            if (this.callbacks.onStart) this.callbacks.onStart();
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                try {
                    this.recognition.start();
                } catch (e) {
                    this.isListening = false;
                    if (this.callbacks.onEnd) this.callbacks.onEnd();
                }
            } else {
                if (this.callbacks.onEnd) this.callbacks.onEnd();
            }
        };

        this.recognition.onresult = (event) => {
            if (this.callbacks.onResult) {
                this.callbacks.onResult(event);
            }
        };

        this.recognition.onerror = (event) => {
            if (this.callbacks.onError) {
                this.callbacks.onError(event);
            }
        };
    }

    start() {
        if (!this.recognition) this.init();
        try {
            this.recognition.start();
            this.isListening = true;
        } catch (e) {
            console.error("SpeechRecognition start error:", e);
        }
    }

    stop() {
        if (this.recognition) {
            this.isListening = false;
            this.recognition.stop();
        }
    }

    setCallback(name, cb) {
        this.callbacks[name] = cb;
    }
}

export default new SpeechRecognitionService();
