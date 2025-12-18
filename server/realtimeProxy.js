import WebSocket, { WebSocketServer } from 'ws';

export function setupRealtimeProxy(server) {
  const wss = new WebSocketServer({ noServer: true });

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
    const sampleRate = params.get('sample_rate') || '16000';
    const model = params.get('model') || process.env.ASSEMBLY_AI_MODEL || 'latest';

    const assemblyHost =
      process.env.ASSEMBLY_AI_WS_URL ||
      'wss://streaming.assemblyai.com/v3/ws';
    const targetUrl = new URL(assemblyHost);
    // Core params
    targetUrl.searchParams.set('sample_rate', sampleRate);
    targetUrl.searchParams.set('model', model);
    // Enable AssemblyAI formatting/punctuation features for polished final transcripts
    // These flags enable punctuation, casing, and inverse text normalization (numbers/currency)
    targetUrl.searchParams.set('punctuate', 'true');
    targetUrl.searchParams.set('format_text', 'true');
    targetUrl.searchParams.set('itn', 'true');

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
      try { wsClient.send(JSON.stringify({ type: 'proxy_open' })); } catch (e) { /* ignore */ }
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
