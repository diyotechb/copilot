<template>
  <div class="transcript-view">
    <h2 class="title">Live Transcription</h2>

    <otter-recorder
      @partial="onPartial"
      @final-transcript="onFinalTranscript"
    />

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
import OtterRecorder from '@/components/OtterRecorder.vue';

export default {
  name: "LiveTranscriptView",
  components: { OtterRecorder },

  data() {
    return {
      transcripts: [],
      ownerName: "Mahesh Gaire",
      sessionStart: null,
      mergeThresholdMs: 2000      // merge very short finals
    };
  },

  methods: {
    onPartial(text) {
      const ts = Date.now();
      if (!this.sessionStart) this.sessionStart = ts;

      // Check last segment
      const last = this.transcripts[this.transcripts.length - 1];

      // If last is final and the pause since it was finalized is short,
      // show the new partial inline on the same bubble instead of creating a new one.
      if (last && last.final) {
        const dt = ts - (last.ts || ts);
        if (dt <= this.mergeThresholdMs) {
          // attach transient partial to previous final (keeps single bubble)
          last.partial = text || '';
          last.partialTs = ts;
          this.transcripts.splice(this.transcripts.length - 1, 1, last);
          this.scrollToBottom();
          return;
        }
      }

      // If there's an existing non-final partial, update it
      if (last && !last.final) {
        last.text = text || '';
        last.ts = ts;
        this.transcripts.splice(this.transcripts.length - 1, 1, last);
      } else {
        // Otherwise create a new partial segment
        if (text) this.transcripts.push({ text, final: false, ts });
      }

      this.scrollToBottom();
    },

    onFinalTranscript(text) {
      if (!text) return;
      const ts = Date.now();
      if (!this.sessionStart) this.sessionStart = ts;

      const last = this.transcripts[this.transcripts.length - 1];

      // If last is final and it has a transient partial (we showed partial inline),
      // finalize that inline partial by appending the final text to the same bubble.
      if (last && last.final && last.partial) {
        last.text = `${last.text} ${text}`.trim();
        last.partial = null;
        last.partialTs = null;
        last.ts = ts;
        this.transcripts.splice(this.transcripts.length - 1, 1, last);
        this.scrollToBottom();
        return;
      }

      // Merge short finals into previous final when appropriate
      const wordCount = String(text || '').trim().split(/\s+/).filter(Boolean).length;
      if (last && last.final) {
        const dt = ts - (last.ts || ts);
        if (dt <= this.mergeThresholdMs || wordCount <= 2) {
          last.text = `${last.text} ${text}`.trim();
          last.ts = ts;
          this.transcripts.splice(this.transcripts.length - 1, 1, last);
          this.scrollToBottom();
          return;
        }
      }

      // If last is a non-final partial, mark it final
      if (last && !last.final) {
        last.text = text;
        last.final = true;
        last.ts = ts;
        this.transcripts.splice(this.transcripts.length - 1, 1, last);
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
</style>
