<template>
  <div v-if="bullets.length" class="feedback-section">
    <div class="feedback-header">
      <i class="el-icon-data-line"></i>
      <h4>Feedback</h4>
    </div>
    <ul class="feedback-list">
      <li
        v-for="(b, i) in bullets"
        :key="i"
        class="feedback-bullet"
        :class="['tone-' + b.tone]"
      >
        <i :class="b.icon"></i>
        <div>
          <strong class="feedback-bullet-title">{{ b.title }}</strong>
          <p class="feedback-bullet-text">{{ b.text }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import {
  averageConfidencePct,
  paceWpm,
  fillerPercent,
  wordCount,
  referenceWordCount
} from '@/utils/summaryStats';

const ICONS = {
  good: 'el-icon-circle-check',
  ok: 'el-icon-info',
  bad: 'el-icon-warning-outline'
};

export default {
  name: 'FeedbackSection',
  props: {
    transcript: { type: Object, required: true },
    referenceAnswer: { type: String, default: '' }
  },
  computed: {
    bullets() {
      const t = this.transcript;
      if (!t || !t.words || !t.words.length) return [];

      const out = [];
      const conf = averageConfidencePct(t);
      const fillerPct = fillerPercent(t);
      const wpm = paceWpm(t);
      const wc = wordCount(t);
      const refWc = referenceWordCount(this.referenceAnswer);

      // Clarity (transcription confidence)
      if (conf >= 90) {
        out.push({ tone: 'good', title: 'Clarity', text: 'Clear pronunciation throughout — speech recognition was confident on every word.' });
      } else if (conf >= 75) {
        out.push({ tone: 'ok', title: 'Clarity', text: `Mostly clear (${conf}%). A few words tripped up recognition — slow down on technical terms.` });
      } else {
        out.push({ tone: 'bad', title: 'Clarity', text: `Recognition struggled (${conf}%). Try speaking slower and enunciating key words more deliberately.` });
      }

      // Fillers
      if (fillerPct < 5) {
        out.push({ tone: 'good', title: 'Fillers', text: 'Very few filler words — your delivery sounds polished.' });
      } else if (fillerPct < 15) {
        out.push({ tone: 'ok', title: 'Fillers', text: `Some filler words (${fillerPct}% of speech). Try a brief pause instead of "um" or "like".` });
      } else {
        out.push({ tone: 'bad', title: 'Fillers', text: `Frequent filler words (${fillerPct}%). Practice silent pauses to break the habit.` });
      }

      // Pace
      if (wpm > 0) {
        if (wpm < 100) {
          out.push({ tone: 'ok', title: 'Pace', text: `${wpm} WPM — a bit slow. Aim for 130–160 WPM for natural interview cadence.` });
        } else if (wpm <= 180) {
          out.push({ tone: 'good', title: 'Pace', text: `${wpm} WPM — natural conversational rhythm.` });
        } else {
          out.push({ tone: 'bad', title: 'Pace', text: `${wpm} WPM — too fast. Slow down to give your words space to land.` });
        }
      }

      // Length vs reference
      if (refWc > 20 && wc > 0) {
        const ratio = wc / refWc;
        if (ratio < 0.4) {
          out.push({ tone: 'ok', title: 'Length', text: `Your answer (${wc} words) was much shorter than the reference (${refWc}). Add a concrete example or one more detail.` });
        } else if (ratio > 2.0) {
          out.push({ tone: 'ok', title: 'Length', text: `Your answer (${wc} words) ran much longer than the reference (${refWc}). Tighten to the most important 2–3 points.` });
        } else {
          out.push({ tone: 'good', title: 'Length', text: `Answer length is in line with the reference (${wc} vs ${refWc} words).` });
        }
      }

      // Attach matching icons
      return out.map(b => ({ ...b, icon: ICONS[b.tone] }));
    }
  }
};
</script>

<style scoped>
.feedback-section {
  margin-top: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 18px;
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.feedback-header i {
  color: #2563eb;
  font-size: 1.1rem;
}

.feedback-header h4 {
  margin: 0;
  font-size: 0.95rem;
  color: #1f2937;
  font-weight: 700;
}

.feedback-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feedback-bullet {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #f1f5f9;
}

.feedback-bullet i {
  font-size: 1.05rem;
  margin-top: 2px;
  flex-shrink: 0;
}

.feedback-bullet-title {
  display: block;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  font-weight: 700;
  margin-bottom: 2px;
}

.feedback-bullet-text {
  margin: 0;
  font-size: 0.95rem;
  color: #1e293b;
  line-height: 1.5;
}

.feedback-bullet.tone-good i { color: #16a34a; }
.feedback-bullet.tone-good { border-left: 3px solid #16a34a; }
.feedback-bullet.tone-ok i { color: #ca8a04; }
.feedback-bullet.tone-ok { border-left: 3px solid #ca8a04; }
.feedback-bullet.tone-bad i { color: #dc2626; }
.feedback-bullet.tone-bad { border-left: 3px solid #dc2626; }
</style>
