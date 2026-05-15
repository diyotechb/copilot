// Pure text-level analysis used by the Beginner basic tier and by the
// per-question pre-LLM section of the Intermediate/Advanced tiers.
// No external state, no API calls.

import fillerWordsList from '@/assets/fillerWords.json';

const STOPWORDS = new Set([
  // articles & determiners
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his',
  'her', 'its', 'our', 'their', 'some', 'any', 'each', 'every', 'no',
  // pronouns
  'i', 'me', 'we', 'us', 'you', 'he', 'she', 'they', 'them', 'it',
  // very common verbs
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might',
  'must', 'get', 'got', 'gets', 'getting',
  // common short words
  'and', 'or', 'but', 'so', 'if', 'as', 'at', 'by', 'for', 'in', 'of',
  'on', 'to', 'up', 'with', 'from', 'into', 'over', 'under',
  'about', 'after', 'again', 'against', 'all', 'also', 'because',
  'before', 'between', 'down', 'just', 'more', 'most', 'now',
  'off', 'once', 'only', 'other', 'out', 'own', 'same', 'such',
  'than', 'then', 'there', 'through', 'too', 'very', 'when', 'where',
  'which', 'who', 'whom', 'why', 'how', 'what', 'while', 'still',
  // contractions / common spoken
  "i've", "i'm", "i'll", "i'd", "we've", "we're", "we'll", "we'd",
  "you've", "you're", "you'll", "you'd",
  "they've", "they're", "they'll", "they'd",
  "it's", "it'd", "that's", "that'll", "there's", "there'll",
  "don't", "doesn't", "didn't", "won't", "wouldn't", "couldn't",
  "shouldn't", "isn't", "aren't", "wasn't", "weren't",
  "can't", "cannot", "haven't", "hasn't", "hadn't",
  "let's", "what's", "where's", "when's"
]);

const FILLER_SET = new Set(fillerWordsList.map(s => s.toLowerCase()));

function tokens(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function isContentToken(t) {
  if (!t || t.length < 2) return false;
  if (STOPWORDS.has(t)) return false;
  if (FILLER_SET.has(t)) return false;
  return true;
}

function transcriptText(transcriptObj) {
  if (!transcriptObj) return '';
  if (typeof transcriptObj === 'string') {
    return transcriptObj === '[Transcription error]' ? '' : transcriptObj;
  }
  return transcriptObj.text || '';
}

// ── Public helpers ───────────────────────────────────────────────────

// Top N words the candidate repeated most. Stopwords and fillers excluded.
export function topRepeatedWords(transcriptObj, n = 5, minCount = 2) {
  const counts = new Map();
  for (const t of tokens(transcriptText(transcriptObj))) {
    if (!isContentToken(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word, count]) => ({ word, count }));
}

// Top N two- or three-word phrases the candidate repeated. Useful for
// catching verbal tics like "kind of", "I think", "sort of".
export function topRepeatedPhrases(transcriptObj, n = 3, minCount = 2) {
  const text = transcriptText(transcriptObj);
  const toks = tokens(text);
  const counts = new Map();
  for (const len of [2, 3]) {
    for (let i = 0; i + len <= toks.length; i++) {
      const slice = toks.slice(i, i + len);
      // Skip if every word is a stopword (boring phrase like "the and")
      if (slice.every(w => STOPWORDS.has(w))) continue;
      const phrase = slice.join(' ');
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([phrase, count]) => ({ phrase, count }));
}

// Filler words actually used, sorted by frequency. Returns up to N items.
// Different from summaryStats.fillerCount which returns just the total.
export function topFillerWordsUsed(transcriptObj, n = 5) {
  const counts = new Map();
  const toks = tokens(transcriptText(transcriptObj));
  for (let i = 0; i < toks.length; i++) {
    // Two-word filler check first
    if (i + 1 < toks.length) {
      const two = `${toks[i]} ${toks[i + 1]}`;
      if (FILLER_SET.has(two)) {
        counts.set(two, (counts.get(two) || 0) + 1);
        i++; // consume both
        continue;
      }
    }
    if (FILLER_SET.has(toks[i])) {
      counts.set(toks[i], (counts.get(toks[i]) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([filler, count]) => ({ filler, count }));
}

// Words the candidate said that don't appear in the reference at all.
// Helps surface off-topic or unrelated language.
export function extraWordsNotInReference(transcriptObj, referenceText, max = 8) {
  const refSet = new Set(tokens(referenceText || '').filter(isContentToken));
  const candidateCounts = new Map();
  for (const t of tokens(transcriptText(transcriptObj))) {
    if (!isContentToken(t)) continue;
    if (refSet.has(t)) continue;
    candidateCounts.set(t, (candidateCounts.get(t) || 0) + 1);
  }
  return [...candidateCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word, count]) => ({ word, count }));
}

// ── Session-level aggregates ────────────────────────────────────────
// These concatenate all transcripts (and all reference answers) into one
// big text and reuse the per-question helpers above. That way the same
// rules and stopword list apply, and you see patterns *across* the whole
// interview rather than just one question.

function joinTranscripts(transcripts) {
  if (!Array.isArray(transcripts)) return '';
  return transcripts
    .map(t => transcriptText(t))
    .filter(Boolean)
    .join(' ');
}

function joinReferences(qaList) {
  if (!Array.isArray(qaList)) return '';
  return qaList
    .map(qa => (qa && qa.answer) ? qa.answer : '')
    .filter(Boolean)
    .join(' ');
}

export function sessionTopFillerWords(transcripts, n = 8) {
  return topFillerWordsUsed({ text: joinTranscripts(transcripts) }, n);
}

export function sessionExtraWordsNotInReference(transcripts, qaList, max = 12) {
  return extraWordsNotInReference(
    { text: joinTranscripts(transcripts) },
    joinReferences(qaList),
    max
  );
}
