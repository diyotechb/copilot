<template>
  <div class="otter-view">
    <h2>Otter — Live Transcription</h2>

    <!-- Otter recorder emits partial + final-transcript -->
    <otter-recorder @final-transcript="onFinalTranscript" @partial="onPartial" />

    <!-- Single combined transcript feed (finalized + current partial) -->
    <div class="transcripts">
      <div class="transcripts-header">
        <h3>Transcripts</h3>
        <button class="clear-btn" v-if="transcripts.length" @click="clearTranscripts">Clear</button>
      </div>

      <div v-if="!transcripts.length" class="hint">Start recording to see realtime partials and final transcripts.</div>

      <div v-else class="feed">
        <div v-for="(item, i) in transcripts" :key="i" class="feed-item" :class="{final: item.final}">
          <button class="avatar-btn" aria-hidden="true">{{ initials(ownerName) }}</button>
          <div class="content">
            <div class="meta"><span class="timestamp">{{ formatElapsed(item.ts) }}</span></div>
            <div class="bubble">
              <div class="text">
                <span v-for="(word, wi) in words(item.text)" :key="wi" class="word">{{ word }} </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import OtterRecorder from '@/components/OtterRecorder.vue';

export default {
  name: 'OtterView',
  components: { OtterRecorder },
  data() {
    return {
      transcripts: [],
      ownerName: 'Mahesh Gaire',
      sessionStart: null
    };
  },
  methods: {
    onFinalTranscript(text) {
      if (!text) return;
      const ts = Date.now();
      if (!this.sessionStart) this.sessionStart = ts;
      // If last item is partial, mark it final and update text
      const last = this.transcripts[this.transcripts.length - 1];
      if (last && !last.final) {
        last.text = text;
        last.final = true;
        last.ts = ts;
        this.transcripts.splice(this.transcripts.length - 1, 1, last);
      } else {
        this.transcripts.push({ text, final: true, ts });
      }
    },
    onPartial(text) {
      const ts = Date.now();
      if (!this.sessionStart) this.sessionStart = ts;
      const last = this.transcripts[this.transcripts.length - 1];
      if (!last || last.final) {
        if (text) this.transcripts.push({ text, final: false, ts });
      } else {
        last.text = text || '';
        last.ts = ts;
        this.transcripts.splice(this.transcripts.length - 1, 1, last);
      }
    },
    clearTranscripts() {
      this.transcripts = [];
      this.sessionStart = null;
    },
    initials(name) {
      if (!name) return '';
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
      return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
    },
    formatElapsed(ts) {
      if (!ts || !this.sessionStart) return '';
      const secs = Math.max(0, Math.round((ts - this.sessionStart) / 1000));
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${s.toString().padStart(2,'0')}`;
    },
    words(text) {
      if (!text) return [];
      return text.split(/(\s+)/).filter(Boolean);
    }
  }
};
</script>

<style scoped>
.otter-view { padding: 1.5rem; max-width: 900px; margin: 0 auto; }

.transcripts { background: #fff; border-radius: 12px; padding: 1rem 1.25rem; box-shadow: 0 6px 18px rgba(15,23,42,0.06); }
.transcripts-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem; }
.transcripts-header h3 { margin:0; font-size:1rem; color:#0f172a; }
.clear-btn { background:transparent; border:1px solid #e6eef8; color:#2563eb; padding:0.25rem 0.6rem; border-radius:6px; cursor:pointer; font-size:0.85rem }
.hint { color:#6b7280; margin:1rem 0; font-size:0.95rem }

.feed { max-height: 60vh; overflow:auto; padding-right:0.5rem; }
.feed-item { display:flex; gap:0.75rem; margin:0.45rem 0; align-items:flex-start; }
.avatar-btn { width:40px; height:40px; border-radius:50%; background:#2563eb; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; border:none; box-shadow:0 2px 6px rgba(37,99,235,0.18); }
.content { display:flex; flex-direction:column; }
.meta { font-size:0.78rem; color:#6b7280; margin-bottom:0.25rem; }
.bubble { max-width:78%; background:#f3f4f6; padding:0.6rem 0.9rem; border-radius:12px; box-shadow:0 4px 10px rgba(15,23,42,0.03); }
.feed-item.final .bubble { background:#e6f0ff; }
.text { color:#0f172a; white-space:pre-wrap; }
.word { display:inline-block; margin-right:0.08rem; }

</style>