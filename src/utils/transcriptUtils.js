// Plain-text rendering for the Summary screen's transcript surface.
// Sentiment colors and per-word confidence highlights have been removed
// (the user explicitly asked for no colors). We still want to count
// fillers via the words array — that's done in summaryStats.js now.

export function highlightTranscript(transcriptObj) {
  if (!transcriptObj) return '';
  const text = typeof transcriptObj === 'string'
    ? transcriptObj
    : (transcriptObj.text || '');
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

