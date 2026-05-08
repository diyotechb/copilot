import OpenAI from 'openai';
import { APP_CONFIG } from '@/constants/appConfig';

// Sends a single batched request to gpt-4o-mini with all Q/A/transcript
// triples plus session metadata, and returns structured per-question
// scores + session-level insights. Called only after a completed interview
// (Intermediate / Advanced with the per-interview toggle ON).
//
// Cost note: ~$0.005-$0.015 per interview at typical question counts.

function buildPrompt({ qaList, transcripts, difficulty, category, analysisTypes }) {
  const wantDelivery = !!analysisTypes.delivery;
  const wantContent = !!analysisTypes.content;
  const wantImprovements = !!analysisTypes.improvements;

  const items = qaList.map((qa, idx) => {
    const t = transcripts[idx];
    let candidateText;
    if (!t || (typeof t === 'string' && (t === '' || t === '[Transcription error]'))) {
      candidateText = '[no spoken answer recorded]';
    } else if (typeof t === 'string') {
      candidateText = t;
    } else {
      candidateText = t.text || '[empty]';
    }
    const lines = [
      `--- Q${idx + 1} ---`,
      `Question: ${qa.question || ''}`,
      `Candidate's spoken answer (verbatim transcript): ${candidateText}`
    ];
    // Reference answer is only useful for the "content" track. Omitting it
    // for delivery-only runs reduces tokens and keeps the model honest
    // about what it's evaluating.
    if (wantContent && qa.answer) {
      lines.push(`Reference answer: ${qa.answer}`);
    }
    return lines.join('\n');
  }).join('\n\n');

  const dimensionList = [];
  if (wantDelivery) dimensionList.push('Delivery quality (grammar, tone, fillers, pace, clarity).');
  if (wantContent) dimensionList.push('Answer evaluation (correctness, completeness, structure — compared against the reference answer).');
  if (wantImprovements) dimensionList.push('Improvement plan (concrete things to practice next time, ranked by impact).');

  // Build the per-question schema piece-by-piece so the model only sees
  // (and emits) the sections the user asked for.
  const perQuestionFields = [];
  perQuestionFields.push('"score": <integer 1-10, weighted by selected dimensions>');
  if (wantDelivery) {
    perQuestionFields.push(`"deliveryScore": <integer 1-10>,
      "deliveryNotes": {
        "grammar": "one short observation, or empty string if clean",
        "tone": "one short observation about tone",
        "fillers": "one short observation about filler use",
        "pace": "one short observation about pace",
        "clarity": "one short observation about structure and clarity"
      }`);
  }
  if (wantContent) {
    perQuestionFields.push(`"contentScore": <integer 1-10>,
      "contentNotes": {
        "correctness": "did they get the answer right? short.",
        "completeness": "did they cover the key points? short.",
        "structure": "was the answer organized? short."
      },
      "keyPointsHit": ["concept they mentioned", ...],
      "keyPointsMissed": ["concept from the reference they did not mention", ...]`);
  }
  perQuestionFields.push('"strengths": ["short bullet", ...]');
  perQuestionFields.push('"weaknesses": ["short bullet", ...]');
  if (wantImprovements) {
    perQuestionFields.push(`"improvements": ["concrete actionable bullet", ...],
      "tryNext": "one sentence — the single most important improvement"`);
  } else {
    perQuestionFields.push('"tryNext": "one short suggestion (optional)"');
  }

  // Behaviour rules tailored to what was selected
  const rules = [
    `- Each "score" / "deliveryScore" / "contentScore" is 1-10. A weak case gets a low score with a specific reason. Do not soft-pedal.`,
    `- Quote 1-3 of the candidate's actual words when relevant.`,
    `- "strengths" / "weaknesses": 1-3 short bullets each, max 12 words per bullet. Empty array allowed.`,
    `- If the candidate gave no spoken answer, score 1 and put "no answer recorded" in weaknesses.`
  ];
  if (wantDelivery) {
    rules.push(`- Delivery dimension is about HOW they spoke (grammar, tone, fillers, pace, clarity). Wrong answers can still earn a high deliveryScore if delivered well.`);
    rules.push(`- "deliveryNotes" entries: max 14 words each. Empty string when nothing notable.`);
  }
  if (wantContent) {
    rules.push(`- Content dimension is about WHAT they said vs. the reference answer (correctness, completeness, structure). Great delivery does not earn content points if the answer was wrong.`);
    rules.push(`- "keyPointsHit" / "keyPointsMissed": up to 5 each, drawn from the reference answer.`);
  }
  if (wantImprovements) {
    rules.push(`- "improvements": 2-4 actionable bullets. Each starts with a verb. ("Pause 1 second instead of saying 'um'.", "Name the specific framework when you mention CI.")`);
  }
  rules.push(`- Skip generic words ("good", "nice", "great"). Be specific.`);

  return `You are an interview coach reviewing a mock interview. The user has asked you to evaluate the following dimensions:
${dimensionList.map(d => '- ' + d).join('\n')}

DIFFICULTY: ${difficulty}
CATEGORY: ${category || 'All'}

INTERVIEW TRANSCRIPT:
${items}

Return ONLY valid JSON matching this exact shape — no markdown, no commentary:

{
  "perQuestion": [
    {
      ${perQuestionFields.join(',\n      ')}
    }
    // one entry per question, in the same order as input
  ],
  "session": {
    "strongestArea": "one sentence with concrete evidence from a specific answer",
    "growthArea": "one sentence with concrete evidence from a specific answer",
    "patterns": ["short observed pattern across answers", ...],
    "verdict": "one sentence overall verdict"
  }
}

Rules:
${rules.join('\n')}`;
}

export async function analyzeInterviewSession({
  qaList,
  transcripts,
  difficulty,
  category,
  analysisTypes
}) {
  const apiKey = process.env.VUE_APP_OPENAPI_TOKEN_KEY;
  if (!apiKey) throw new Error('OpenAI API key missing.');
  if (!Array.isArray(qaList) || qaList.length === 0) {
    throw new Error('No questions provided for analysis.');
  }

  // Default to all-on so callers that haven't been updated still work.
  const types = {
    delivery: !!(analysisTypes && analysisTypes.delivery),
    content: !!(analysisTypes && analysisTypes.content),
    improvements: !!(analysisTypes && analysisTypes.improvements)
  };
  if (!types.delivery && !types.content && !types.improvements) {
    types.delivery = true;
  }

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const prompt = buildPrompt({ qaList, transcripts, difficulty, category, analysisTypes: types });

  const response = await client.chat.completions.create({
    model: APP_CONFIG.SERVICES.OPENAI.ANALYSIS_MODEL || 'gpt-4o-mini',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are an interview coach. Evaluate only the dimensions the user requested. Output strict JSON only.' },
      { role: 'user', content: prompt }
    ]
  });

  const raw = response.choices?.[0]?.message?.content || '';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('Could not parse analysis response as JSON');
  }

  // Defensive shape normalization
  if (!Array.isArray(parsed.perQuestion)) parsed.perQuestion = [];
  while (parsed.perQuestion.length < qaList.length) {
    parsed.perQuestion.push({
      score: null,
      strengths: [],
      weaknesses: ['Analysis unavailable for this question.'],
      tryNext: ''
    });
  }
  parsed.perQuestion = parsed.perQuestion.map(q => {
    const safe = q && typeof q === 'object' ? q : {};
    const out = {
      score: typeof safe.score === 'number' ? safe.score : null,
      strengths: Array.isArray(safe.strengths) ? safe.strengths : [],
      weaknesses: Array.isArray(safe.weaknesses) ? safe.weaknesses : [],
      tryNext: typeof safe.tryNext === 'string' ? safe.tryNext : ''
    };
    if (types.delivery) {
      const dn = safe.deliveryNotes && typeof safe.deliveryNotes === 'object' ? safe.deliveryNotes : {};
      out.deliveryScore = typeof safe.deliveryScore === 'number' ? safe.deliveryScore : out.score;
      out.deliveryNotes = {
        grammar: dn.grammar || '',
        tone: dn.tone || '',
        fillers: dn.fillers || '',
        pace: dn.pace || '',
        clarity: dn.clarity || ''
      };
    }
    if (types.content) {
      const cn = safe.contentNotes && typeof safe.contentNotes === 'object' ? safe.contentNotes : {};
      out.contentScore = typeof safe.contentScore === 'number' ? safe.contentScore : out.score;
      out.contentNotes = {
        correctness: cn.correctness || '',
        completeness: cn.completeness || '',
        structure: cn.structure || ''
      };
      out.keyPointsHit = Array.isArray(safe.keyPointsHit) ? safe.keyPointsHit : [];
      out.keyPointsMissed = Array.isArray(safe.keyPointsMissed) ? safe.keyPointsMissed : [];
    }
    if (types.improvements) {
      out.improvements = Array.isArray(safe.improvements) ? safe.improvements : [];
    }
    return out;
  });
  if (!parsed.session || typeof parsed.session !== 'object') {
    parsed.session = {
      strongestArea: '',
      growthArea: '',
      patterns: [],
      verdict: ''
    };
  }
  parsed.analysisTypes = types;
  return parsed;
}
