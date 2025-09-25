<template>
  <div>
    <div v-if="interviews.length === 0" class="no-interviews">
      <p>No interviews found for this session.</p>
    </div>
    <ul v-else>
      <div v-for="(interview, idx) in interviews" :key="interview.id" class="interview-item">
        <div class="section summary-section">
          <h3 class="summary-question-title centered-title">Question {{ idx + 1 }}</h3>
          <div class="summary-row">
            <span class="summary-label">Question:</span>
            <span class="summary-value">{{ interview.question || '(No question found)' }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Your Transcript:</span>
            <span class="summary-value" v-html="getHighlightedTranscript(interview.transcript)"></span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Actual Answer:</span>
            <span class="summary-value">{{ interview.answer || '(No answer found)' }}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Statistics:</span>
            <table class="summary-stats-table">
              <tr>
                <td>Overall Confidence</td>
                <td>
                  <template v-if="getParsedTranscript(interview.transcript).words && getParsedTranscript(interview.transcript).words.length">
                    {{ averageConfidence(getParsedTranscript(interview.transcript).words) }}%
                  </template>
                  <template v-else>
                    N/A
                  </template>
                </td>
              </tr>
              <tr>
                <td>Filler Word Usage</td>
                <td>
                  <template v-if="typeof getParsedTranscript(interview.transcript)._fillerWordCount !== 'undefined'">
                    {{ getParsedTranscript(interview.transcript)._fillerWordCount }}
                  </template>
                  <template v-else>
                    N/A
                  </template>
                </td>
              </tr>
              <tr>
                <td>Filler Words Percentage</td>
                <td>
                  <template v-if="getParsedTranscript(interview.transcript).words && getParsedTranscript(interview.transcript).words.length && typeof getParsedTranscript(interview.transcript)._fillerWordCount !== 'undefined'">
                    {{ ((getParsedTranscript(interview.transcript)._fillerWordCount / getParsedTranscript(interview.transcript).words.length) * 100).toFixed(1) }}%
                  </template>
                  <template v-else>
                    N/A
                  </template>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </ul>
    <button v-if="showBackButton" @click="$emit('back')" class="back-btn">Back to Sessions</button>
  </div>
</template>

<script>
import { highlightTranscript, averageConfidence } from '@/utils/transcriptUtils';
export default {
  name: 'InterviewSummaryList',
  props: {
    interviews: { type: Array, required: true },
    showBackButton: { type: Boolean, default: false }
  },
  mounted() {
    console.log("Interviews prop:", this.interviews);
  },
  methods: {
    averageConfidence,
    getParsedTranscript(transcript) {
      try {
        const parsed = typeof transcript === 'string' ? JSON.parse(transcript) : transcript;
        const result = highlightTranscript(parsed);
        return result.transcript;
      } catch {
        return {};
      }
    },
    getHighlightedTranscript(transcript) {
      const parsed = typeof transcript === 'string' ? JSON.parse(transcript) : transcript;
      const result = highlightTranscript(parsed);
      return result.highlightedHtml;
    },
  }
};
</script>

<style scoped>
.summary-main {
  padding: 2rem 2vw;
  max-width: 700px;
  margin: 0 auto;
  box-sizing: border-box;
}
.summary-title {
  margin-bottom: 1.5rem;
  color: #22223b;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
}
.section.summary-section {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #f6f8fa;
  margin-bottom: 2.5rem;
  width: 100%;
  box-sizing: border-box;
  padding: 1.25rem 1rem;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.summary-question-title {
  margin-bottom: 1rem;
  color: #2563eb;
  font-size: 1.2rem;
  font-weight: 600;
  text-align: center;
}
.summary-row {
  margin-bottom: 0.5rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.summary-label {
  font-weight: 600;
  color: #22223b;
  min-width: 120px;
}
.summary-value {
  color: #3a3a3a;
  flex: 1 1 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.summary-loading {
  text-align: center;
  margin-top: 2rem;
}
.loading-text {
  margin-top: 1rem;
  color: #2563eb;
  font-size: 1.2rem;
}
.centered-title {
  text-align: center;
}
.loader {
  border: 6px solid #e5e7eb;
  border-top: 6px solid #2563eb;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}
.summary-legend {
  display: flex;
  gap: 2rem;
  margin: 0.5rem 0 2rem 0;
  font-size: 0.95rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}
.legend-sample {
  display: inline-block;
  width: 24px;
  height: 20px;
  vertical-align: middle;
  margin-right: 6px;
  border-radius: 4px;
  padding: 0 4px;
}
.legend-positive {
  background: rgba(34,197,94,0.15);
  border: 1px solid #22c55e;
}
.legend-neutral {
  background: rgba(59,130,246,0.10);
  border: 1px solid #3b82f6;
}
.legend-negative {
  background: rgba(239,68,68,0.15);
  border: 1px solid #ef4444;
}
.legend-filler {
  color: #a855f7;
  font-weight: bold;
  background: transparent;
  border: none;
  width: auto;
  height: auto;
  padding: 0;
}
.legend-confidence-low {
  background: #fee2e2;
  border: 1px solid #dc2626;
}
.legend-confidence-medium {
  background: #fef9c3;
  border: 1px solid #ca8a04;
}
.summary-stats-table {
  border-collapse: collapse;
  width: 100%;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  background: #f6f8fa;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(59,130,246,0.07);
  overflow: hidden;
}
.summary-stats-table td {
  border: 1px solid #e5e7eb;
  padding: 8px 14px;
  font-size: 1rem;
}
.summary-stats-table tr td:first-child {
  font-weight: 600;
  background: #e0e7ff;
  width: 180px;
}
.no-interviews {
  text-align: center;
  color: #888;
  margin-top: 2rem;
  font-size: 1.15rem;
  background: #fff;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(60, 60, 60, 0.06);
}
.back-btn {
  margin-top: 2rem;
  padding: 0.5rem 1.2rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}
.back-btn:hover {
  background: #1e40af;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>