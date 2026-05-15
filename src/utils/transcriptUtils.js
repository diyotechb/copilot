// Escapes a transcript object's text for safe rendering as HTML on the
// Summary screen. Filler counting lives in summaryStats.js.
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

