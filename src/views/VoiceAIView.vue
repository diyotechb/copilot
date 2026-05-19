<template>
  <div class="voice-ai-view">
    <div class="header">
      <h1>Voice AI <span class="beta-tag">Beta</span></h1>
      <p class="subtitle">
        Stream audio from the AI Audio Streamer Chrome extension into this view.
        Both connections must share the same <code>conversationId</code>.
      </p>
    </div>

    <el-card class="setup-card" shadow="never">
      <div class="row">
        <label>Backend</label>
        <el-input v-model="backendUrl" size="small" :disabled="connected" />
      </div>

      <div class="row">
        <label>Conversation ID</label>
        <el-input v-model="conversationId" size="small" :disabled="connected">
          <el-button slot="append" icon="el-icon-refresh" @click="conversationId = newId()" :disabled="connected">New</el-button>
        </el-input>
      </div>

      <div class="row">
        <label>Extension URL</label>
        <el-input :value="extensionUrl" size="small" readonly>
          <el-button slot="append" icon="el-icon-document-copy" @click="copyExtensionUrl">Copy</el-button>
        </el-input>
      </div>

      <div class="row actions">
        <el-tag :type="statusTagType" effect="dark" size="medium">{{ status }}</el-tag>
        <el-button v-if="!connected" type="primary" icon="el-icon-video-play" @click="connect">Connect view</el-button>
        <el-button v-else type="danger" icon="el-icon-video-pause" @click="disconnect">Disconnect</el-button>
        <el-button icon="el-icon-delete" @click="clearAll" :disabled="connected">Clear</el-button>
      </div>

      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error-banner" />
    </el-card>

    <div class="columns">
      <el-card class="panel" shadow="never">
        <div slot="header"><i class="el-icon-microphone"></i> Live Transcript</div>
        <div class="content transcript">
          <div v-for="(line, i) in transcriptLines" :key="'t' + i" class="line final">{{ line }}</div>
          <div v-if="livePartial" class="line partial">{{ livePartial }}</div>
          <div v-if="!transcriptLines.length && !livePartial" class="empty">Waiting for audio from the extension…</div>
        </div>
      </el-card>

      <el-card class="panel" shadow="never">
        <div slot="header"><i class="el-icon-chat-line-square"></i> AI Response</div>
        <div class="content ai-response">
          <div v-for="(reply, i) in aiReplies" :key="'r' + i" class="reply">
            <div class="reply-text">{{ reply.content }}</div>
            <div class="reply-meta">
              <i v-if="reply.streaming" class="el-icon-loading"></i>
              {{ reply.streaming ? 'streaming…' : 'complete' }}
            </div>
          </div>
          <div v-if="!aiReplies.length" class="empty">AI replies will stream here once the user finishes speaking.</div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script>
const DEFAULT_BACKEND = process.env.VUE_APP_SERVER_URL || 'ws://localhost:8080';

export default {
  name: 'VoiceAIView',
  data() {
    return {
      backendUrl: DEFAULT_BACKEND,
      conversationId: this.newId(),
      ws: null,
      connected: false,
      status: 'Idle',
      error: '',
      transcriptLines: [],
      livePartial: '',
      aiReplies: []
    };
  },
  computed: {
    extensionUrl() {
      const base = (this.backendUrl || '')
        .replace(/\/$/, '')
        .replace(/^http:\/\//i, 'ws://')
        .replace(/^https:\/\//i, 'wss://');
      return `${base}/api/realtime-voice?conversationId=${encodeURIComponent(this.conversationId)}`;
    },
    statusTagType() {
      if (this.error) return 'danger';
      if (this.connected) return 'success';
      return 'info';
    }
  },
  beforeDestroy() {
    this.disconnect();
  },
  methods: {
    newId() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'conv-' + Math.random().toString(36).slice(2, 10);
    },
    copyExtensionUrl() {
      navigator.clipboard.writeText(this.extensionUrl).then(
        () => this.$message.success('Extension URL copied'),
        () => this.$message.error('Copy failed — select & copy manually')
      );
    },
    connect() {
      this.error = '';
      this.status = 'Connecting…';
      try {
        const ws = new WebSocket(this.extensionUrl);
        this.ws = ws;
        ws.onopen = () => { this.connected = true; this.status = 'Connected'; };
        ws.onmessage = (e) => this.onMessage(e.data);
        ws.onerror = () => { this.error = 'WebSocket error'; this.status = 'Error'; };
        ws.onclose = (e) => {
          this.connected = false;
          this.status = `Closed (${e.code})`;
          this.ws = null;
        };
      } catch (e) {
        this.error = e.message;
        this.status = 'Error';
      }
    },
    disconnect() {
      if (this.ws) {
        try { this.ws.close(); } catch (e) { /* ignore */ }
      }
      this.ws = null;
      this.connected = false;
    },
    clearAll() {
      this.transcriptLines = [];
      this.livePartial = '';
      this.aiReplies = [];
      this.error = '';
    },
    onMessage(raw) {
      let msg;
      try { msg = JSON.parse(raw); } catch (e) { return; }

      if (msg.type === 'open') {
        if (msg.data && msg.data.conversationId) {
          this.conversationId = msg.data.conversationId;
        }
      } else if (msg.type === 'proxy_open') {
        this.status = 'Ready';
      } else if (msg.type === 'message' && msg.data && msg.data.type === 'Turn') {
        this.handleTurn(msg.data);
      } else if (msg.type === 'AI_RESPONSE') {
        this.handleAiChunk(msg);
      } else if (msg.type === 'proxy_error') {
        this.error = msg.message || 'Upstream error';
      }
    },
    handleTurn(turn) {
      const text = turn.transcript || '';
      if (turn.end_of_turn && turn.turn_is_formatted) {
        if (text.trim()) this.transcriptLines.push(text);
        this.livePartial = '';
      } else {
        this.livePartial = text;
      }
    },
    handleAiChunk(msg) {
      const current = this.aiReplies[this.aiReplies.length - 1];
      if (!current || !current.streaming) {
        this.aiReplies.push({ content: msg.content || '', streaming: !msg.completed });
        return;
      }
      current.content += (msg.content || '');
      if (msg.completed) {
        current.streaming = false;
      }
    }
  }
};
</script>

<style scoped>
.voice-ai-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.header h1 {
  margin: 0 0 8px;
  font-size: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.beta-tag {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #c2e7b0;
  border-radius: 10px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.subtitle {
  margin: 0 0 16px;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}

.subtitle code {
  background: #f4f4f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
}

.setup-card {
  margin-bottom: 16px;
}

.row {
  display: grid;
  grid-template-columns: 130px 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.row label {
  color: #606266;
  font-size: 13px;
  font-weight: 500;
}

.row.actions {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
}

.row.actions > :first-child {
  margin-right: auto;
}

.error-banner {
  margin-top: 12px;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.panel {
  min-height: 360px;
}

.content {
  height: 320px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
}

.empty {
  color: #c0c4cc;
  font-style: italic;
  text-align: center;
  padding: 32px 0;
}

.line.final {
  padding: 4px 0;
  border-bottom: 1px solid #f0f2f5;
}

.line.partial {
  color: #909399;
  font-style: italic;
  padding: 4px 0;
}

.reply {
  padding: 8px 0;
  border-bottom: 1px solid #f0f2f5;
}

.reply-text {
  white-space: pre-wrap;
}

.reply-meta {
  margin-top: 4px;
  font-size: 11px;
  color: #909399;
}

@media (max-width: 900px) {
  .columns { grid-template-columns: 1fr; }
}
</style>
