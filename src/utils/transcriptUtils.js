import fillerWordsList from '@/assets/fillerWords.json';

export function highlightTranscript(transcriptObj) {
  if (
    !transcriptObj.words ||
    !transcriptObj.text ||
    !transcriptObj.sentiment_analysis_results
  ) return transcriptObj.text || '';

  const sentimentColors = {
    POSITIVE: 'rgba(34,197,94,0.15)',
    NEGATIVE: 'rgba(239,68,68,0.15)',
    NEUTRAL:  'rgba(59,130,246,0.10)'
  };
  const fillerColor = '#a855f7';

  function normalize(word) {
    return word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  }

  // 🔹 Preprocess fillers into single-word Set and multi-word Map
  const singleWordFillers = new Set();
  const multiWordFillers = new Map(); // key = first word, value = array of phrases

  fillerWordsList.forEach(f => {
    const parts = f.toLowerCase().split(" ");
    if (parts.length === 1) {
      singleWordFillers.add(parts[0]);
    } else {
      if (!multiWordFillers.has(parts[0])) {
        multiWordFillers.set(parts[0], []);
      }
      multiWordFillers.get(parts[0]).push(parts);
    }
  });

  transcriptObj._fillerWordCount = 0;
  let html = '';

  transcriptObj.sentiment_analysis_results.forEach(segment => {
    const color = sentimentColors[segment.sentiment] || 'transparent';
    const wordsInSegment = transcriptObj.words.filter(
      w => w.start >= segment.start && w.end <= segment.end
    );

    // Pre-normalize segment words for speed
    const normalizedSegment = wordsInSegment.map(w => normalize(w.text));
    let segmentHtml = '';
    let i = 0;

    while (i < wordsInSegment.length) {
      let wordObj = wordsInSegment[i];
      let normWord = normalizedSegment[i];
      let matched = false;

      // 🔹 Multi-word filler check
      if (multiWordFillers.has(normWord)) {
        for (const fillerParts of multiWordFillers.get(normWord)) {
          const slice = normalizedSegment.slice(i, i + fillerParts.length);
          if (slice.join(" ") === fillerParts.join(" ")) {
            const originalPhrase = wordsInSegment.slice(i, i + fillerParts.length).map(w => w.text).join(" ");
            segmentHtml += `<span style="color:${fillerColor};font-weight:bold;">${originalPhrase}</span> `;
            i += fillerParts.length;
            transcriptObj._fillerWordCount++;
            matched = true;
            break;
          }
        }
      }

      // 🔹 Single-word filler check
      if (!matched) {
        let displayWord = wordObj.text;

        // Confidence highlighting
        if (wordObj.confidence !== undefined) {
          if (wordObj.confidence < 0.5) {
            displayWord = `<span style="background:#fee2e2;color:#dc2626;border-radius:3px;font-weight:bold;" title="Low confidence">${displayWord}</span>`;
          } else if (wordObj.confidence < 0.7) {
            displayWord = `<span style="background:#fef9c3;color:#ca8a04;border-radius:3px;font-weight:bold;" title="Medium confidence">${displayWord}</span>`;
          }
        }

        if (singleWordFillers.has(normWord)) {
          displayWord = `<span style="color:${fillerColor};font-weight:bold;">${wordObj.text}</span>`;
          transcriptObj._fillerWordCount++;
        }

        segmentHtml += displayWord + ' ';
        i++;
      }
    }

    html += `<span style="background:${color};padding:2px 4px;border-radius:4px;margin-right:2px;">${segmentHtml.trim()}</span> `;
  });

    return {
    highlightedHtml: html.trim(),
    transcript: transcriptObj,
  };
}


export function averageConfidence(words) {
  if (!words || !words.length) return 'N/A';
  const avg = words.reduce((sum, w) => sum + (w.confidence || 0), 0) / words.length;
  return (avg * 100).toFixed(1);
}