class TranscriptionSpeechService {
    constructor() {
        this.isListening = false;
        this.callbacks = {
            onResult: null,
            onEnd: null,
            onStart: null,
            onError: null
        };

        // Websocket and Audio Context
        this.ws = null;
        this.audioContext = null;
        this.processor = null;
        this.source = null;
        this.audioStream = null;
        this.sampleRate = 48000;
        this.bufferSize = 4096;
        this.audioQueue = [];
        this.sending = false;
        this.debug = true;

        // Determine Base URL
        this.baseUrl = (function () {
            const env = process.env.VUE_APP_SERVER_URL;
            let url = env || null;
            if (!url) {
                try {
                    const origin = window.location.origin;
                    if (window.location.port === '3002') {
                        // Dev scenario: app on 3002, api on 3001
                        url = `${window.location.protocol}//${window.location.hostname}:3001`;
                    } else {
                        url = origin;
                    }
                } catch (e) {
                    url = 'http://localhost:3001';
                }
            }
            if (url && /\/$/.test(url)) {
                url = url.replace(/\/+$/, '');
            }
            return url;
        })();
    }

    isSupported() {
        return !!(window.AudioContext || window.webkitAudioContext) && !!window.WebSocket;
    }

    init(options = {}) {
        this.options = options;
    }

    setCallback(name, cb) {
        this.callbacks[name] = cb;
    }

    async start() {
        if (this.isListening) return;

        try {
            console.log('[TranscriptionSpeechService] Starting recording...');
            this.isListening = true;
            if (this.callbacks.onStart) this.callbacks.onStart();

            // 1. Setup Audio
            const constraints = {
                audio: {
                    noiseSuppression: true,
                    echoCancellation: true,
                    sampleRate: this.sampleRate
                }
            };

            try {
                this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                console.warn('[TranscriptionSpeechService] Fallback to default audio', err);
                this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
            this.source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.processor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);

            this.source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

            this.audioQueue = [];

            this.processor.onaudioprocess = (event) => {
                if (!this.isListening) return;
                const input = event.inputBuffer.getChannelData(0);

                // Float32 -> PCM16
                const pcm16 = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    pcm16[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
                }
                this.audioQueue.push(pcm16);
            };

            // 2. Setup WebSocket
            let wsOrigin = this.baseUrl.replace(/\/+$/, '');
            if (wsOrigin.startsWith('http://')) wsOrigin = wsOrigin.replace(/^http:/, 'ws:');
            else if (wsOrigin.startsWith('https://')) wsOrigin = wsOrigin.replace(/^https:/, 'wss:');

            const wsUrl = `${wsOrigin}/realtime?sample_rate=${this.sampleRate}`;
            console.log('[TranscriptionSpeechService] Connecting to', wsUrl);

            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                console.log('[TranscriptionSpeechService] WebSocket open');
                this.sendAudioLoop();
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'message') {
                        this.handleServerMessage(msg.data);
                    } else if (msg.type === 'proxy_error') {
                        console.error('[TranscriptionSpeechService] Server Error:', msg.message);
                        this.handleError(msg.message);
                    }
                } catch (e) {
                    console.warn('[TranscriptionSpeechService] Failed to parse message', e);
                }
            };

            this.ws.onerror = (err) => {
                console.error('[TranscriptionSpeechService] WebSocket Error', err);
                this.handleError('WebSocket connection error');
            };

            this.ws.onclose = () => {
                console.log('[TranscriptionSpeechService] WebSocket closed');
                this.stop();
            };

        } catch (e) {
            console.error('[TranscriptionSpeechService] Start failed', e);
            this.handleError(e.message);
            this.stop();
        }
    }

    async sendAudioLoop() {
        this.sending = true;
        while (this.isListening && this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (this.audioQueue.length === 0) {
                await new Promise(r => setTimeout(r, 20));
                continue;
            }

            const chunk = this.audioQueue.shift();
            // Minimum size check (approx 50ms)
            if (chunk.length < (this.sampleRate / 1000) * 50) continue;

            try {
                this.ws.send(chunk.buffer);
            } catch (e) {
                console.warn('[TranscriptionSpeechService] Send failed', e);
            }
        }
        this.sending = false;
    }

    handleServerMessage(data) {
        if (!data) return;

        // Normalize
        let text = '';
        let isFinal = false;

        if (typeof data === 'string') {
            text = data;
        } else {
            text = data.text || data.utterance || '';
            isFinal = !!data.end_of_turn;
        }

        if (!text && !isFinal) return;

        const mockEvent = {
            resultIndex: 0,
            results: {
                0: {
                    isFinal: isFinal,
                    0: { transcript: text },
                    length: 1
                },
                length: 1
            }
        };

        if (this.callbacks.onResult) {
            this.callbacks.onResult(mockEvent);
        }
    }

    handleError(msg) {
        if (this.callbacks.onError) {
            this.callbacks.onError({ error: msg });
        }
    }

    stop() {
        this.isListening = false;

        // Cleanup Audio
        if (this.processor) {
            try { this.processor.disconnect(); } catch (e) { }
            this.processor = null;
        }
        if (this.source) {
            try { this.source.disconnect(); } catch (e) { }
            this.source = null;
        }
        if (this.audioContext) {
            try { this.audioContext.close(); } catch (e) { }
            this.audioContext = null;
        }
        if (this.audioStream) {
            try { this.audioStream.getTracks().forEach(t => t.stop()); } catch (e) { }
            this.audioStream = null;
        }

        // Cleanup WS
        if (this.ws) {
            try { this.ws.close(); } catch (e) { }
            this.ws = null;
        }

        this.audioQueue = [];

        if (this.callbacks.onEnd) {
            this.callbacks.onEnd();
        }
    }
}

export default new TranscriptionSpeechService();
