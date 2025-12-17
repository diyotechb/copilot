<template>
  <div class="otter-view">
    <h2>Otter — Live Transcription</h2>

    <!-- Otter recorder emits partial + final-transcript -->
    <otter-recorder @final-transcript="onFinalTranscript" @partial="onPartial" />

    <!-- Live partial transcript -->
    <div class="live" v-if="partial">
      <h3>Live</h3>
      <div class="partial"><strong>Partial:</strong> {{ partial }}</div>
    </div>

    <!-- Final / saved transcripts -->
    <div v-if="saved.length">
      <h3>Final Transcripts</h3>
      <div v-for="(t, i) in saved" :key="i" class="saved">
        {{ t }}
      </div>
      <div style="margin-top:0.5rem;">
        <button @click="clearSaved">Clear</button>
      </div>
    </div>

    <div v-if="!saved.length && !partial" class="hint" style="color:#6b7280;margin-top:1rem;">
      Start recording to see realtime partials and final transcripts.
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
      saved: [],
      partial: ''
    };
  },
  methods: {
    onFinalTranscript(text) {
      // Add to saved list and clear the partial line
      this.saved.push(text);
      this.partial = '';
    },
    onPartial(text) {
      this.partial = text;
    },
    clearSaved() {
      this.saved = [];
    }
  }
};
</script>

<style scoped>
.otter-view { padding: 1.5rem; }
.saved { padding: 0.5rem; border-bottom: 1px dashed #e5e7eb; margin-bottom: 0.25rem; }
.partial { color: #374151; font-style: italic; margin-bottom: 0.5rem; }
.hint { font-size: 0.95rem; }
</style>