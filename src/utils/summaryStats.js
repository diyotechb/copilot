// Pure helpers for the summary screen — derive simple stats from an
// AssemblyAI transcript object. No external state, no API calls.

import fillerWordsList from '@/assets/fillerWords.json';

function asWords(transcriptObj) {
  if (!transcriptObj || typeof transcriptObj === 'string') return [];
  return Array.isArray(transcriptObj.words) ? transcriptObj.words : [];
}

function getText(transcriptObj) {
  if (!transcriptObj) return '';
  if (typeof transcriptObj === 'string') return transcriptObj;
  return transcriptObj.text || '';
}

export function wordCount(transcriptObj) {
  const words = asWords(transcriptObj);
  if (words.length) return words.length;
  // Fallback to whitespace-split when only text is present (e.g. OpenAI Whisper
  // text-only response shape).
  const text = getText(transcriptObj).trim();
  return text ? text.split(/\s+/).length : 0;
}

// Duration of the candidate's spoken answer (seconds), based on the first
// and last word timestamps. Returns 0 when there are fewer than 2 words.
export function answerDurationSec(transcriptObj) {
  const words = asWords(transcriptObj);
  if (words.length < 2) return 0;
  const startMs = words[0].start ?? 0;
  const endMs = words[words.length - 1].end ?? words[words.length - 1].start ?? 0;
  return Math.max(0, (endMs - startMs) / 1000);
}

export function paceWpm(transcriptObj) {
  const count = wordCount(transcriptObj);
  const seconds = answerDurationSec(transcriptObj);
  if (count === 0 || seconds === 0) return 0;
  return Math.round((count / seconds) * 60);
}

// Compile filler matchers once at module load. Single-word fillers go in a
// Set; multi-word fillers go in a Map keyed by the first word for fast lookup.
const _singleFillers = new Set();
const _multiFillers = new Map();
(() => {
  for (const f of fillerWordsList) {
    const parts = f.toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length === 1) _singleFillers.add(parts[0]);
    else if (parts.length > 1) {
      const first = parts[0];
      if (!_multiFillers.has(first)) _multiFillers.set(first, []);
      _multiFillers.get(first).push(parts);
    }
  }
})();

function normalizeWord(s) {
  return (s || '').toLowerCase().replace(/[^a-z']/g, '');
}

// Counts filler words/phrases directly from the transcript. Works on both
// the AssemblyAI rich object (uses words array if present) and on plain
// text. No mutation, no side effects.
export function fillerCount(transcriptObj) {
  // Prefer the words array when available — it preserves disfluencies even
  // if the joined text was post-processed.
  const words = asWords(transcriptObj);
  let tokens;
  if (words.length) {
    tokens = words.map(w => normalizeWord(w.text || w.word || ''));
  } else {
    tokens = getText(transcriptObj).toLowerCase().split(/\s+/).map(normalizeWord);
  }

  let count = 0;
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (!tok) { i++; continue; }
    let matched = false;
    if (_multiFillers.has(tok)) {
      for (const phrase of _multiFillers.get(tok)) {
        const slice = tokens.slice(i, i + phrase.length);
        if (slice.length === phrase.length && slice.every((s, k) => s === phrase[k])) {
          count++;
          i += phrase.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      if (_singleFillers.has(tok)) count++;
      i++;
    }
  }
  return count;
}

export function fillerPercent(transcriptObj) {
  const count = wordCount(transcriptObj);
  if (count === 0) return 0;
  return Math.round((fillerCount(transcriptObj) / count) * 100);
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

// Reference answer text → naive word count (split on whitespace).
export function referenceWordCount(text) {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// Aggregate across an array of transcripts. Skips strings and empties.
export function aggregateStats(transcripts) {
  let totalWords = 0;
  let totalFillers = 0;
  let totalDurationSec = 0;
  let answeredCount = 0;

  for (const t of transcripts || []) {
    const wc = wordCount(t);
    if (wc === 0) continue;
    answeredCount++;
    totalWords += wc;
    totalFillers += fillerCount(t);
    totalDurationSec += answerDurationSec(t);
  }

  return {
    answeredCount,
    totalWords,
    totalFillers,
    totalDurationSec,
    fillerPercent: totalWords ? Math.round((totalFillers / totalWords) * 100) : 0,
    averagePaceWpm: totalDurationSec ? Math.round((totalWords / totalDurationSec) * 60) : 0
  };
}

// Simple, deterministic verdict from the aggregates. Scored on pace and
// filler percentage only.
export function overallVerdict(agg) {
  if (!agg || agg.answeredCount === 0) {
    return {
      label: 'No data',
      tone: 'neutral',
      description: 'No spoken answers were recorded, so there is nothing to score.'
    };
  }
  const okFillers = agg.fillerPercent < 10;
  const okPace = agg.averagePaceWpm >= 110 && agg.averagePaceWpm <= 180;
  const score = [okFillers, okPace].filter(Boolean).length;

  // Build a description tailored to what passed and what didn't, so the
  // verdict label is never just a colored sticker — it always has a sentence
  // that tells the user *why* this is the verdict.
  if (score === 2) {
    return {
      label: 'Strong',
      tone: 'good',
      description: `Natural pace (${agg.averagePaceWpm} WPM) and few fillers (${agg.fillerPercent}% of speech) across the interview. Polished delivery overall.`
    };
  }
  if (score === 1) {
    const issue = !okPace
      ? `pace was ${agg.averagePaceWpm} WPM (a comfortable interview rhythm sits between 110 and 180 WPM)`
      : `fillers were ${agg.fillerPercent}% of your speech (under 10% reads as polished)`;
    const win = okPace
      ? `pace stayed in the natural conversational band`
      : `you kept fillers low at ${agg.fillerPercent}%`;
    return {
      label: 'Solid',
      tone: 'ok',
      description: `Mostly steady delivery — ${win}, but ${issue}.`
    };
  }
  return {
    label: 'Needs work',
    tone: 'bad',
    description: `Both pace (${agg.averagePaceWpm} WPM) and fillers (${agg.fillerPercent}% of speech) are outside the natural interview range. Slow down where you sped up, and pause instead of using "um"/"like" while you think.`
  };
}
