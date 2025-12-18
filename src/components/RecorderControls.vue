<template>
  <div class="recorder-controls">
    <button class="home-btn" title="Back to setup" @click="$emit('go-home')" aria-label="Back to setup">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V11.5z" fill="currentColor"/>
      </svg>
    </button>

    <button class="record-btn" @click="$emit('toggle')" :aria-pressed="recording">
      <span class="dot" :class="{ recording: recording }"/>
      <span class="label">{{ recording ? 'Stop' : 'Start' }}</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'RecorderControls',
  props: {
    recording: { type: Boolean, default: false }
  }
};
</script>

<style scoped>
.recorder-controls { display:flex; flex-direction:column; align-items:flex-start; gap:0.6rem; padding: 8px 0; }
.home-btn { width:48px; height:48px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:#fff; border:1px solid rgba(15,23,42,0.06); box-shadow:0 8px 24px rgba(2,6,23,0.08); cursor:pointer; padding:6px; }
.home-btn svg { color:#0f172a; }
.record-btn { background: linear-gradient(180deg,#ff6b6b,#e11d48); color:#fff; border:none; padding:0.9rem 1.4rem; border-radius:28px; font-size:1.05rem; font-weight:700; display:inline-flex; align-items:center; gap:0.6rem; box-shadow: 0 10px 30px rgba(225,29,72,0.18); cursor:pointer; min-width:180px; justify-content:center; }
.record-btn:active { transform: translateY(1px); }
.record-btn .dot { width:14px; height:14px; border-radius:50%; background:rgba(255,255,255,0.6); display:inline-block; transition: all 120ms ease; }
.record-btn .dot.recording { background:#fff; box-shadow: 0 0 0 6px rgba(255,255,255,0.08); }
.record-btn .label { font-weight:700; }
</style>
