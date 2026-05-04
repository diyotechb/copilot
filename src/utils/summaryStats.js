// Pure helpers for the summary screen — derive simple stats from an
// AssemblyAI transcript object. No external state, no API calls.

function asWords(transcriptObj) {
  if (!transcriptObj || typeof transcriptObj === 'string') return [];
  return Array.isArray(transcriptObj.words) ? transcriptObj.words : [];
}

export function wordCount(transcriptObj) {
  return asWords(transcriptObj).length;
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

export function fillerCount(transcriptObj) {
  if (!transcriptObj || typeof transcriptObj === 'string') return 0;
  return transcriptObj._fillerWordCount || 0;
}

export function fillerPercent(transcriptObj) {
  const count = wordCount(transcriptObj);
  if (count === 0) return 0;
  return Math.round((fillerCount(transcriptObj) / count) * 100);
}

export function averageConfidencePct(transcriptObj) {
  const words = asWords(transcriptObj);
  if (!words.length) return 0;
  const sum = words.reduce((acc, w) => acc + (w.confidence || 0), 0);
  return Math.round((sum / words.length) * 100);
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
  let confidenceSum = 0;
  let confidenceWeight = 0;
  let answeredCount = 0;

  for (const t of transcripts || []) {
    const wc = wordCount(t);
    if (wc === 0) continue;
    answeredCount++;
    totalWords += wc;
    totalFillers += fillerCount(t);
    totalDurationSec += answerDurationSec(t);
    confidenceSum += averageConfidencePct(t) * wc;
    confidenceWeight += wc;
  }

  return {
    answeredCount,
    totalWords,
    totalFillers,
    totalDurationSec,
    fillerPercent: totalWords ? Math.round((totalFillers / totalWords) * 100) : 0,
    averageConfidencePct: confidenceWeight ? Math.round(confidenceSum / confidenceWeight) : 0,
    averagePaceWpm: totalDurationSec ? Math.round((totalWords / totalDurationSec) * 60) : 0
  };
}

// Simple, deterministic verdict from the aggregates.
export function overallVerdict(agg) {
  if (!agg || agg.answeredCount === 0) return { label: 'No data', tone: 'neutral' };
  const okConfidence = agg.averageConfidencePct >= 85;
  const okFillers = agg.fillerPercent < 10;
  const okPace = agg.averagePaceWpm >= 110 && agg.averagePaceWpm <= 180;
  const score = [okConfidence, okFillers, okPace].filter(Boolean).length;
  if (score === 3) return { label: 'Strong', tone: 'good' };
  if (score === 2) return { label: 'Solid', tone: 'ok' };
  if (score === 1) return { label: 'Needs work', tone: 'bad' };
  return { label: 'Needs work', tone: 'bad' };
}
