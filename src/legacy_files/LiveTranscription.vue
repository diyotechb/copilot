<template>
  <div class="transcript-view">
    <h2 class="title">Live Transcription</h2>

    <otter-recorder
      @partial="onPartial"
      @final-transcript="onFinalTranscript"
      @server-asr="onServerASR"
    />

    <div v-if="serverASR" class="server-asr">
      <strong>Server ASR:</strong>
      <span>end_of_turn_confidence_threshold: {{ serverASR.end_of_turn_confidence_threshold }}</span>
      <span>min_end_of_turn_silence_when_confident: {{ serverASR.min_end_of_turn_silence_when_confident }}</span>
      <span>max_turn_silence: {{ serverASR.max_turn_silence }}</span>
    </div>

    <section class="transcripts">
      <header class="header">
        <h3>Transcript</h3>
        <button
          v-if="transcripts.length"
          class="clear-btn"
          @click="clearTranscripts"
        >
          Clear
        </button>
      </header>

      <p v-if="!transcripts.length" class="hint">
        Start recording to see live transcription.
      </p>

      <div ref="feed" class="feed">
        <article
          v-for="(item, i) in transcripts"
          :key="i"
          class="row"
          :class="{ final: item.final }"
        >
          <div class="speaker">{{ initials(ownerName) }}</div>
          <div class="body">
            <time class="timestamp">{{ formatElapsed(item.ts) }}</time>
            <div class="bubble">
              <span class="text">{{ item.text }}</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script>
import OtterRecorder from '@/components/LiveTranscriptionRecorder.vue';

export default {
  name: "LiveTranscriptView",
  components: { OtterRecorder },

  data() {
    return {
      transcripts: [],
      ownerName: "Mahesh Gaire",
      sessionStart: null,
      mergeThresholdMs: 2000,     // merge very short finals
      serverASR: null,
    };
  },

  methods: {

    onServerASR(payload) {
      console.debug('[LiveTranscription] server ASR params confirmed', payload);
      this.serverASR = payload && payload.params ? payload.params : payload;
    },



      onPartial(text) {
        const ts = Date.now();
        if (!this.sessionStart) this.sessionStart = ts;

        const lastIndex = this.transcripts.length - 1;
        const last = this.transcripts[lastIndex];

        // If last is final and the pause since it was finalized is short,
        // show the new partial inline on the same bubble instead of creating a new one.
        if (last && last.final) {
          const dt = ts - (last.ts || ts);
          if (dt <= this.mergeThresholdMs) {
            // attach transient partial to previous final (keeps single bubble)
            last.partial = text || '';
            last.partialTs = ts;
            this.transcripts.splice(lastIndex, 1, last);
            this.scrollToBottom();
            return;
          }
        }

        // If there's an existing non-final partial, update it
        if (last && !last.final) {
          last.text = text || '';
          last.ts = ts;
          this.transcripts.splice(lastIndex, 1, last);
        } else {
          // Otherwise create a new partial segment
          if (text) {
            this.transcripts.push({ text, final: false, ts });
          }
        }

        this.scrollToBottom();
      },

      onFinalTranscript(text) {
        if (!text) return;
        const ts = Date.now();
        if (!this.sessionStart) this.sessionStart = ts;

        const lastIndex = this.transcripts.length - 1;
        const last = this.transcripts[lastIndex];


        // Helper to safely append avoiding duplicates/overlap
        const appendSmart = (base, addition, partial) => {
          const a = String(addition || '').trim();
          if (!a) return base.trim();
          const p = String(partial || '').trim();
          // If the base already ends with the addition, keep base
          if (base.trim().endsWith(a)) return base.trim();
          // If the addition starts with the partial we showed inline, only append the suffix
          if (p && a.startsWith(p)) {
            const suffix = a.slice(p.length).trim();
            return suffix ? `${base} ${suffix}`.trim() : base.trim();
          }
          // Fallback: append whole addition
          return `${base} ${a}`.trim();
        };

        // If last is final and it has a transient partial (we showed partial inline),
        // replace the whole current bubble with the final transcript (final contains punctuation).
        if (last && last.final && last.partial) {
          last.text = text; // replace, do not append
          last.partial = null;
          last.partialTs = null;
          last.ts = ts;
          this.transcripts.splice(lastIndex, 1, last);
          this.scrollToBottom();
          return;
        }

        // Merge short finals into previous final when appropriate (avoid duplicate append)
        const wordCount = String(text || '').trim().split(/\s+/).filter(Boolean).length;
        if (last && last.final) {
          const dt = ts - (last.ts || ts);

          // normalize helper (strip punctuation, lower case, collapse spaces)
          const normalize = (s) => String(s || '').replace(/[\p{P}\u2018\u2019\u201C\u201D]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
          const baseNorm = normalize(last.text);
          const newNorm = normalize(text);

          // If the new final appears to be an improved/expanded/punctuated version of the last final, replace it
          if (dt <= this.mergeThresholdMs && (newNorm.includes(baseNorm) || baseNorm.includes(newNorm) || /[.!?]$/.test(String(text || '')))) {
            last.text = text;
            last.ts = ts;
            this.transcripts.splice(lastIndex, 1, last);
            this.scrollToBottom();
            return;
          }

          // Small additions (1-2 words) should be appended
          if (dt <= this.mergeThresholdMs || wordCount <= 2) {
            last.text = appendSmart(last.text, text);
            last.ts = ts;
            this.transcripts.splice(lastIndex, 1, last);
            this.scrollToBottom();
            return;
          }
        }

        // If there are trailing partials (one or more), replace the last partial with the final.
        if (last && !last.final) {
          // replace the trailing non-final with the final text
          last.text = text;
          last.final = true;
          last.ts = ts;
          this.transcripts.splice(lastIndex, 1, last);
        } else {
          this.transcripts.push({ text, final: true, ts });
        }

        this.scrollToBottom();
      },


    clearTranscripts() {
      this.transcripts = [];
      this.sessionStart = null;
      if (this.finalizeTimer) {
        clearTimeout(this.finalizeTimer);
        this.finalizeTimer = null;
        this.pendingFinalText = null;
      }
    },

    initials(name) {
      if (!name) return '';
      const parts = name.trim().split(/\s+/);
      return parts.length === 1
        ? parts[0].slice(0, 2).toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },

    formatElapsed(ts) {
      if (!ts || !this.sessionStart) return '';
      const secs = Math.round((ts - this.sessionStart) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    },

    scrollToBottom() {
      this.$nextTick(() => {
        const el = this.$refs.feed;
        if (!el) return;
        const threshold = 120;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        if (nearBottom) el.scrollTop = el.scrollHeight;
      });
    }
  }
};
</script>

<style scoped>
.transcript-view {
  max-width: 980px;
  margin: 0 auto;
  padding: 1.5rem;
}

.title {
  font-size: 1.35rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

/* Container */
.transcripts {
  background: #ffffff;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

.clear-btn {
  background: transparent;
  border: none;
  color: #475569;
  font-size: 0.85rem;
  cursor: pointer;
}

.hint {
  margin: 1rem 0;
  color: #64748b;
  font-size: 0.95rem;
}

/* Feed */
.feed {
  max-height: 60vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
}

/* Row */
.row {
  display: flex;
  gap: 0.75rem;
  margin: 0.6rem 0;
  align-items: flex-start;
  max-width: 100%;
}

/* Speaker */
.speaker {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #334155;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Body */
.body {
  flex: 1;
  min-width: 0;
}

.timestamp {
  display: block;
  font-size: 0.7rem;
  color: #94a3b8;
  margin-bottom: 0.15rem;
}

/* Bubble */
.bubble {
  max-width: 100%;
  padding: 0.45rem 0.65rem;
  border-radius: 10px;
  background: #f8fafc;
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* Text */
.text {
  font-size: 15.5px;
  line-height: 1.55;
  font-weight: 400;
  color: #0f172a;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  letter-spacing: 0.01em;
}

/* Partial state */
.row:not(.final) .text {
  opacity: 0.75;
}

.row:not(.final) .text::after {
  content: '▍';
  margin-left: 2px;
  opacity: 0.6;
  animation: blink 1s steps(2, start) infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.settings-bar { display:flex; gap:0.75rem; align-items:center; margin-bottom:0.75rem; }
.settings-toggle { background:#eef2ff; border:1px solid #dbeafe; padding:0.4rem 0.6rem; border-radius:6px; cursor:pointer; }
.settings-note { color:#64748b; font-size:0.9rem; }
.settings { display:flex; gap:1rem; margin-bottom:1rem; align-items:center; }
.setting { display:flex; flex-direction:column; gap:0.25rem; }
.setting label { font-size:0.85rem; color:#334155; }
.setting input[type="range"] { width:260px; }

</style>