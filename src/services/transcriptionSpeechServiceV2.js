import { APP_CONFIG } from '@/constants/appConfig';

class TranscriptionSpeechServiceV2 {
    constructor() {
        this.isListening = false;
        this.callbacks = {
            onResult: null,
            onEnd: null,
            onStart: null,
            onError: null
        };

        this.ws = null;
        this.audioContext = null;
        this.processor = null;
        this.source = null;
        this.audioStream = null;
        this.sampleRate = APP_CONFIG.TRANSCRIPTION.SAMPLE_RATE;
        this.bufferSize = APP_CONFIG.TRANSCRIPTION.BUFFER_SIZE;
        this.audioQueue = [];
        this.sending = false;

        this.baseUrl = APP_CONFIG.SERVICES.WS_URL;
        if (!this.baseUrl) {
            console.error('ERROR: Real-time Backend URL (VUE_APP_SERVER_URL) is MISSING!');
        }
    }

    isSupported() {
        return !!(window.AudioContext || window.webkitAudioContext) && !!window.WebSocket;
    }

    setCallback(name, cb) {
        this.callbacks[name] = cb;
    }

    async start() {
        if (this.isListening) return;

        try {
            this.isListening = true;
            if (this.callbacks.onStart) this.callbacks.onStart();

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
                const pcm16 = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    pcm16[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
                }
                this.audioQueue.push(pcm16);
            };

            let wsOrigin = this.baseUrl;
            if (wsOrigin.startsWith('http://')) wsOrigin = wsOrigin.replace(/^http:/, 'ws:');
            else if (wsOrigin.startsWith('https://')) wsOrigin = wsOrigin.replace(/^https:/, 'wss:');

            // Connect to the V2 endpoint
            const wsUrl = `${wsOrigin}/realtime-v2?sample_rate=${this.sampleRate}`;

            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                this.sendAudioLoop();
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'message') {
                        this.handleServerMessage(msg.data);
                    } else if (msg.type === 'proxy_error') {
                        this.handleError(msg.message);
                    }
                } catch (e) {
                    // Ignore malformed messages
                }
            };

            this.ws.onerror = () => {
                this.handleError('WebSocket connection error');
            };

            this.ws.onclose = () => {
                if (this.isListening) {
                    this.handleError('Connection lost. Recording stopped.');
                }
                this.stop();
            };

        } catch (e) {
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
            if (chunk.length < (this.sampleRate / 1000) * 50) continue;

            try {
                this.ws.send(chunk.buffer);
            } catch (e) {
                break;
            }
        }
        this.sending = false;
    }

    handleServerMessage(data) {
        // Raw AssemblyAI V3 Turn format:
        // { type: "Turn", end_of_turn: bool, transcript: str, utterance: str,
        //   words: [{text, start, end, word_is_final}], turn_is_formatted: bool }
        if (!data || data.type !== 'Turn') return;

        const isFinal = data.end_of_turn === true;
        const words = data.words || [];

        // Audio timestamps live on the words array
        const audioStart = words.length > 0 ? (words[0].start || 0) : 0;
        const audioEnd = words.length > 0 ? (words[words.length - 1].end || 0) : 0;

        // Text extraction:
        // - Final: use transcript (fully punctuated complete turn text)
        // - Partial: use utterance (formatted in-progress) → fallback to joining words
        let text = '';
        if (isFinal) {
            text = data.transcript || data.utterance || words.map(w => w.text).join(' ');
        } else {
            text = data.utterance || words.map(w => w.text).join(' ') || data.transcript || '';
        }

        if (!text && !isFinal) return;

        const mockEvent = {
            resultIndex: 0,
            results: {
                0: {
                    isFinal: isFinal,
                    0: { transcript: text },
                    audioStart: audioStart,
                    audioEnd: audioEnd,
                    words: words,
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

        if (this.processor) {
            try { this.processor.disconnect(); } catch (e) { }
            this.processor = null;
        }
        if (this.source) {
            try { this.source.disconnect(); } catch (e) { }
            this.source = null;
        }
        if (this.audioContext) {
            try {
                if (this.audioContext.state !== 'closed') {
                    this.audioContext.close();
                }
            } catch (e) { }
            this.audioContext = null;
        }
        if (this.audioStream) {
            try {
                this.audioStream.getTracks().forEach(t => t.stop());
            } catch (e) { }
            this.audioStream = null;
        }

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

export default new TranscriptionSpeechServiceV2();
