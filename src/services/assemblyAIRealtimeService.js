// assemblyAIRealtimeService.js
// Handles real-time connection to AssemblyAI via your local proxy

export default class AssemblyAIRealtimeService {
  constructor({ proxyUrl, sampleRate = 16000 }) {
    this.proxyUrl = `${proxyUrl}?sample_rate=${sampleRate}`;
    this.sampleRate = sampleRate;
    this.ws = null;
    this.listeners = {
      open: [],
      partial: [],
      final: [],
      close: [],
      error: []
    };
    this.ready = false; // true after proxy_open
  }

  on(event, callback) {
    if (this.listeners[event]) this.listeners[event].push(callback);
  }

  emit(event, ...args) {
    (this.listeners[event] || []).forEach(cb => cb(...args));
  }

  async start() {
    if (this.ws) this.stop();

    this.ws = new WebSocket(this.proxyUrl);

    this.ws.onopen = () => {
      console.log('[assemblyAIRealtimeService] connection open');
      this.emit('open');
    };

    this.ws.onerror = (err) => {
      console.error('[assemblyAIRealtimeService] error –', err);
      this.emit('error', err);
    };

    this.ws.onclose = (evt) => {
      console.warn('[assemblyAIRealtimeService] closed –', evt.code, evt.reason);
      this.emit('close', evt.code, evt.reason);
      this.ws = null;
      this.ready = false;
    };

    this.ws.onmessage = async (evt) => {
      let msg = evt.data;

      // Handle Blob / ArrayBuffer from proxy
      if (msg instanceof Blob) msg = await msg.arrayBuffer();
      if (msg instanceof ArrayBuffer) msg = new TextDecoder().decode(msg);

      try {
        const json = typeof msg === 'string' ? JSON.parse(msg) : msg;

        // Proxy events
        if (json.type === 'proxy_open') {
          console.log('[assemblyAIRealtimeService] proxy ready');
          this.ready = true;
          this.emit('proxy_open');
          return;
        }

        if (json.type === 'message' && json.data) {
          const data = json.data;

          // AssemblyAI partial/final text
          if (data.text) {
            if (data.end_of_turn) {
              console.log('[assemblyAIRealtimeService] final payload:', data);
              this.emit('final', data.text);
            } else {
              // Log partials when debugging
              this.emit('partial', data.text);
            }
          }
        }

      } catch (e) {
        console.warn('[assemblyAIRealtimeService] non-JSON message', msg);
      }
    };
  }

  sendAudioPCM16(buffer) {
    if (!this.ws || !this.ready || this.ws.readyState !== WebSocket.OPEN) return;

    const base64 = bufferToBase64(buffer);
    const msg = JSON.stringify({ audio_data: base64 });
    this.ws.send(msg);
  }

  stop() {
    if (this.ws) {
      // Optionally send a final commit here if needed by AssemblyAI
      try { this.ws.close(); } catch {}
      this.ws = null;
      this.ready = false;
    }
  }
}

// Utility to convert PCM16 array to base64
function bufferToBase64(buffer) {
  if (buffer instanceof ArrayBuffer) buffer = new Uint8Array(buffer);
  else if (ArrayBuffer.isView(buffer)) buffer = new Uint8Array(buffer.buffer);

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}
