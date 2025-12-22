import WebSocket, { WebSocketServer } from 'ws';

export function setupRealtimeProxy(server) {
  const wss = new WebSocketServer({ noServer: true });

  // Enable verbose upstream logging when REALTIME_DEBUG is 'true'
  const UPSTREAM_DEBUG = String(process.env.REALTIME_DEBUG || '').toLowerCase() === 'true';

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/realtime') {
      wss.handleUpgrade(request, socket, head, (wsClient) => {
        wss.emit('connection', wsClient, request);
      });
    } else {
      // Only log unexpected upgrade attempts
      console.warn('[Proxy] upgrade to unknown pathname, destroying socket', pathname);
      socket.destroy();
    }
  });

  wss.on('connection', (wsClient, request) => {
    console.log(`[Proxy] client connected url=${request.url}`);

    const params = new URL(request.url, 'http://localhost').searchParams;
    const sampleRate = params.get('sample_rate') || 16000;

    // ASR thresholds must be provided by server environment variables only
    const minSilenceEnv = process.env.MIN_SILENCE_THRESHOLD;
    const maxSilenceEnv = process.env.MAX_SILENCE_THRESHOLD;
    const endOfTurnEnv = process.env.END_OF_TURN_THRESHOLD;

    if (!minSilenceEnv || !maxSilenceEnv || !endOfTurnEnv) {
      console.error('[Proxy] missing server ASR environment variables. Please set MIN_SILENCE_THRESHOLD, MAX_SILENCE_THRESHOLD, and END_OF_TURN_THRESHOLD.');
      try { wsClient.send(JSON.stringify({ type: 'proxy_error', message: 'Server misconfigured: missing ASR threshold env vars' })); } catch {}
      wsClient.close();
      return;
    }

    // Validate numeric values
    const minSilenceThreshold = parseInt(minSilenceEnv, 10);
    const maxSilenceThreshold = parseInt(maxSilenceEnv, 10);
    const endOfTurnThreshold = parseFloat(endOfTurnEnv);

    if (Number.isNaN(minSilenceThreshold) || Number.isNaN(maxSilenceThreshold) || Number.isNaN(endOfTurnThreshold)) {
      console.error('[Proxy] invalid ASR env vars; must be numeric.');
      try { wsClient.send(JSON.stringify({ type: 'proxy_error', message: 'Server misconfigured: ASR env vars must be numeric' })); } catch {}
      wsClient.close();
      return;
    }

    // If client supplied params, warn but ignore them
    if (params.get('min_silence') || params.get('max_silence') || params.get('end_of_turn')) {
      console.warn('[Proxy] client attempted to override ASR params; ignoring client-supplied values for security/configuration consistency');
    }

    const assemblyHost =
      process.env.ASSEMBLY_AI_WS_URL ||
      'wss://streaming.assemblyai.com/v3/ws';
    const targetUrl = new URL(assemblyHost);
    // Core params
    targetUrl.searchParams.set('sample_rate', sampleRate);
    // targetUrl.searchParams.set('model', model);
    // Enable AssemblyAI formatting/punctuation features for polished final transcripts
    // These flags enable punctuation, casing, and inverse text normalization (numbers/currency)
    targetUrl.searchParams.set('punctuate', 'true');
    targetUrl.searchParams.set('format_turns', 'true');
    targetUrl.searchParams.set('itn', 'true');
    // targetUrl.searchParams.set('end_utterance_silence_threshold', silenceThreshold);
    targetUrl.searchParams.set('end_of_turn_confidence_threshold', endOfTurnThreshold);
    targetUrl.searchParams.set('min_end_of_turn_silence_when_confident', minSilenceThreshold);
    targetUrl.searchParams.set('max_turn_silence', maxSilenceThreshold);

    // Log the final upstream URL with params so clients can verify settings arrived
    console.log('[Proxy] upstream URL with params:', targetUrl.toString());

    const apiKey = process.env.ASSEMBLY_AI_TOKEN || process.env.VUE_APP_ASSEMBLY_AI_TOKEN;
    if (!apiKey) {
      console.error('[Proxy] missing AssemblyAI API key (env var not set)');
      try { wsClient.send(JSON.stringify({ type: 'error', message: 'Missing API key' })); } catch {}
      wsClient.close();
      return;
    }

    console.log('[Proxy] connecting to upstream', targetUrl.toString());

    const wsServerConn = new WebSocket(targetUrl.toString(), {
      headers: { Authorization: apiKey }
    });

    wsServerConn.on('open', () => {
      console.log('[Proxy] upstream connection open');
      try {
        wsClient.send(JSON.stringify({
          type: 'proxy_open',
          params: {
            end_of_turn_confidence_threshold: endOfTurnThreshold,
            min_end_of_turn_silence_when_confident: minSilenceThreshold,
            max_turn_silence: maxSilenceThreshold
          },
          upstream: targetUrl.toString()
        }));
      } catch (e) { /* ignore */ }
    });

    // Forward messages from AssemblyAI → browser
    wsServerConn.on('message', (data) => {
      try {
        // Parse textual messages from upstream and forward transcripts to client
        let text = (typeof data === 'string') ? data : (data && data.toString ? data.toString('utf8') : String(data));
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          // non-JSON message from upstream: forward as text
          try { wsClient.send(text); } catch {}
          return;
        }

        // Optional verbose logging of raw upstream payloads for debugging endpointing
        if (UPSTREAM_DEBUG) {
          try {
            const safe = (obj) => {
              try {
                return JSON.stringify(obj, (k, v) => {
                  if (Array.isArray(v) && v.length > 50) return `[Array(${v.length})]`;
                  if (typeof v === 'string' && v.length > 1000) return v.slice(0, 1000) + '...[truncated]';
                  return v;
                }, 2);
              } catch (e) { return String(obj); }
            };
            console.log('[Proxy][UPSTREAM RAW]', safe(parsed));
          } catch (e) { /* ignore logging errors */ }
        }

        if (parsed.type === 'message' || parsed.text) {
          try { wsClient.send(JSON.stringify(parsed)); } catch {}
        } else if (parsed.type === 'Turn' || parsed.transcript || parsed.words) {
          try {
            const transcriptText = parsed.transcript || parsed.utterance || (Array.isArray(parsed.words) ? parsed.words.map(w => w.text).join(' ') : '');
            const wrapper = { type: 'message', data: { text: transcriptText, end_of_turn: !!parsed.end_of_turn, raw: parsed } };
            wsClient.send(JSON.stringify(wrapper));
          } catch (e) { /* ignore */ }
        }
      } catch (err) {
        console.error('[Proxy] forward error:', err && err.message);
      }
    });

    wsServerConn.on('close', (code, reason) => {
      console.log('[Proxy] upstream closed', code);
      try { if (wsClient && wsClient.readyState === WebSocket.OPEN) wsClient.close(code, reason); } catch {}
    });

    wsServerConn.on('error', (err) => {
      console.error('[Proxy] upstream error', err && err.message);
      try { if (wsClient && wsClient.readyState === WebSocket.OPEN) wsClient.send(JSON.stringify({ type: 'proxy_error', message: err && err.message })); } catch {}
      try { if (wsClient) wsClient.close(); } catch {}
    });

    // Forward audio from browser → AssemblyAI
    wsClient.on('message', async (msg) => {
      try {
        if (wsServerConn.readyState !== WebSocket.OPEN) {
          console.warn('[Proxy] upstream not open, ignoring client message');
          return;
        }

        // Binary frames -> forward raw
        if (msg instanceof Buffer) {
          try { wsServerConn.send(msg, { binary: true }); } catch (e) { console.warn('[Proxy] failed forwarding binary'); }
          return;
        }

        // ArrayBuffer-like -> convert and forward
        if (msg && typeof msg.arrayBuffer === 'function') {
          const buf = Buffer.from(await msg.arrayBuffer());
          try { wsServerConn.send(buf, { binary: true }); } catch (e) { console.warn('[Proxy] failed forwarding arrayBuffer'); }
          return;
        }

        // JSON control messages: forward as text
        if (typeof msg === 'string') {
          try { const parsed = JSON.parse(msg); if (parsed && parsed.type) wsServerConn.send(JSON.stringify(parsed)); } catch (e) { /* ignore */ }
          return;
        }
      } catch (err) {
        console.error('[Proxy] error handling client message', err && err.message);
      }
    });

    wsClient.on('close', (code, reason) => {
      console.log('[Proxy] client closed', code || 'N/A');
      try { if (wsServerConn && (wsServerConn.readyState === WebSocket.OPEN || wsServerConn.readyState === WebSocket.CONNECTING)) wsServerConn.close(); } catch {}
    });

    wsClient.on('error', (err) => {
      console.error('[Proxy] client error', err && err.message);
      try { if (wsServerConn && wsServerConn.readyState === WebSocket.OPEN) wsServerConn.close(); } catch {}
    });
  });

  return wss;
}
