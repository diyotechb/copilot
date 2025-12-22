<template>
        <div class="otter-recorder">
            <RecorderControls :recording="recording" @toggle="toggleRecording" @go-home="goHome" />
            <!-- Transcripts are emitted to parent; rendering removed to avoid duplicate/raw output -->
        </div>
</template>

<script>
export default {
    name: 'LiveTranscriptionRecorder',
    components: { RecorderControls: () => import('@/components/RecorderControls.vue') },
    props: {
        sampleRate: { type: Number, default: 48000 },
        model: { type: String, default: '' },
    },
    data() {
        return {
            recording: false,
            ws: null,
            audioContext: null,
            processor: null,
            source: null,
            status: '',
            debug: true,
            segments: [],
            partial: '',
            bufferSize: 4096,
            // Default to explicit server port 3001 when running the dev server on 3002
            baseUrl: (function () {
                const env = process.env.VUE_APP_SERVER_URL;
                if (env) return env;
                try {
                    const origin = window.location.origin;
                    // If the app is served on :3002 (webpack dev), assume backend is on :3001
                    if (window.location.port === '3002') {
                        return `${window.location.protocol}//${window.location.hostname}:3001`;
                    }
                    return origin;
                } catch (e) {
                    return 'http://localhost:3001';
                }
            })(),
            serverParams: null,
        };
    },
    methods: {
        toggleRecording() {
            if (this.recording) {
                this.stop();
            } else {
                this.start();
            }
        },


        goHome() {
            // stop recording if active and navigate back
            if (this.recording) this.stop();
            try { this.$router.push({ name: 'ResumeSetup' }); } catch (e) { /* ignore when router unavailable */ }
        },

        async start() {
            if (this.recording) return;
            this.recording = true;
            this.partial = '';
            console.log('[LiveTranscriptionRecorder] starting recording');

            // Build WebSocket URL (support http/https origins)
            let wsOrigin = this.baseUrl;
            if (wsOrigin.startsWith('http://')) wsOrigin = wsOrigin.replace(/^http:/, 'ws:');
            else if (wsOrigin.startsWith('https://')) wsOrigin = wsOrigin.replace(/^https:/, 'wss:');

            let wsUrl = `${wsOrigin}/realtime?sample_rate=${this.sampleRate}`;
            if (this.model) wsUrl += `&model=${encodeURIComponent(this.model)}`;

            // ASR parameters are enforced server-side; do not send them from client
            console.log('[LiveTranscriptionRecorder] connecting websocket ->', wsUrl);
            this.ws = new WebSocket(wsUrl);
            // prefer arraybuffer for binary handling
            try { this.ws.binaryType = 'arraybuffer'; } catch (e) { /* not critical */ }

            // Audio queue
            this.audioQueue = [];
            this.sending = false;

            // Wait until proxy confirms upstream is ready
            this.ws.onopen = () => {
                console.log('[LiveTranscriptionRecorder] WebSocket open');
                if (!this.sending) this.sendAudioLoop().catch(() => {});
            };

            this.ws.onmessage = async (event) => {
                let msg;
                try {
                    msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                } catch {
                    return;
                }

                switch (msg.type) {
                    case 'open':
                        break;
                    case 'proxy_open':
                        console.log('[LiveTranscriptionRecorder] proxy connected', msg);
                        if (msg.params) {
                            console.log('[LiveTranscriptionRecorder] server ASR params:', msg.params);
                            try { this.$emit('server-asr', msg.params || {}); } catch (e) {}
                        }
                        if (!this.sending) this.sendAudioLoop();
                        break;
                    case 'message':
                        this.handleTranscription(msg.data);
                        break;
                    case 'closed':
                        console.log('[LiveTranscriptionRecorder] WebSocket closed', msg.code, msg.reason);
                        this.stop();
                        break;
                    case 'proxy_error':
                        console.error('[LiveTranscriptionRecorder] proxy error', msg.message);
                        this.stop();
                        break;
                    default:
                        break;
                }
            };

            this.ws.onerror = (err) => {
                console.error('[LiveTranscriptionRecorder] WebSocket error', err && err.message);
                this.stop();
            };

            this.ws.onclose = (evt) => {
                console.warn('[LiveTranscriptionRecorder] WebSocket closed', evt && evt.code);
                this.stop();
            };

            // Start microphone capture with recommended audio constraints (improves clarity)
            const constraints = { audio: { noiseSuppression: true, echoCancellation: true, sampleRate: this.sampleRate } };
            try {
                this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                // Fallback to generic audio if constraints not supported
                this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sampleRate });
            this.audioContext = audioCtx;
            this.source = audioCtx.createMediaStreamSource(this.audioStream);
            const processor = audioCtx.createScriptProcessor(this.bufferSize, 1, 1);
            this.processor = processor;

            this.source.connect(processor);
            processor.connect(audioCtx.destination);

            processor.onaudioprocess = (event) => {
                if (!this.recording) return;
                const input = event.inputBuffer.getChannelData(0);

                // Convert Float32 → PCM16
                const pcm16 = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    pcm16[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
                }

                this.audioQueue.push(pcm16);
            };
        },

        // Continuous audio sending loop
        async sendAudioLoop() {
            this.sending = true;

            while (this.recording) {
                if (!this.audioQueue || this.audioQueue.length === 0 || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                    await new Promise((r) => setTimeout(r, 20));
                    continue;
                }

                let chunk = this.audioQueue.shift();

                // Ensure chunk >= 50ms
                const minSamples = (this.sampleRate / 1000) * 50;
                if (chunk.length < minSamples) {
                    console.warn('[LiveTranscriptionRecorder] chunk too short, skipping');
                    continue;
                }

                try {
                    const ab = chunk.buffer;
                    this.ws.send(ab);
                } catch (e) {
                    console.warn('[LiveTranscriptionRecorder] ws send failed', e && e.message);
                }
            }
            this.sending = false;
        },


        stop(resetRecording = true) {
            if (this.processor) {
                try { this.processor.disconnect(); } catch {}
                this.processor = null;
            }
            if (this.source) {
                try { this.source.disconnect(); } catch {}
                this.source = null;
            }
            if (this.audioContext) {
                try { this.audioContext.close(); } catch {}
                this.audioContext = null;
            }
            if (this.ws) {
                try { this.ws.close(); } catch { }
                this.ws = null;
            }
            if (resetRecording) this.recording = false;
            this.status = '';
        },

        // Accepts TypedArray (Int16Array / Uint8Array) or ArrayBuffer
        bufferToBase64(input) {
            let uint8;
            if (input instanceof ArrayBuffer) uint8 = new Uint8Array(input);
            else if (ArrayBuffer.isView(input)) uint8 = new Uint8Array(input.buffer);
            else return '';

            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < uint8.length; i += chunkSize) {
                const chunk = uint8.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, chunk);
            }
            return btoa(binary);
        },

        // Accumulate transcripts: finalized segments + current partial
        handleTranscription(data) {
            if (!data) return;

            // Normalize incoming payload
            let text = '';
            let end_of_turn = false;
            if (typeof data === 'string') {
                text = data;
            } else if (data && typeof data === 'object') {
                text = data.text || data.utterance || '';
                end_of_turn = !!data.end_of_turn;
            }

            if (end_of_turn) {
                if (text) {
                    this.segments.push(text);
                    this.$emit('final-transcript', text);
                }
                this.partial = '';
            } else {
                this.partial = text || '';
                this.$emit('partial', this.partial);
            }

            // Update combined status (finalized lines followed by current partial)
            const combined = [...this.segments, this.partial].filter(Boolean).join('\n');
            this.status = combined;
            this.$emit('transcript', this.status);
        },

        floatTo16BitPCM(float32Array) {
            const buffer = new Uint8Array(float32Array.length * 2);
            let offset = 0;
            for (let i = 0; i < float32Array.length; i++, offset += 2) {
                let s = Math.max(-1, Math.min(1, float32Array[i]));
                s = s < 0 ? s * 0x8000 : s * 0x7fff;
                buffer[offset] = s & 0xff;
                buffer[offset + 1] = (s >> 8) & 0xff;
            }
            return buffer;
        },
    },
};
</script>

<style scoped>
.transcript { white-space: pre-wrap; margin-top: 0.5rem; }
.transcript-final { color: #111; margin-bottom: 0.25rem; }
.transcript-partial { color: #666; font-style: italic; }
</style>