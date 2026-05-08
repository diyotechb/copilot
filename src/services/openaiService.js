import OpenAI from 'openai';
import { saveInterviewQA } from '@/store/interviewStore';
import { APP_CONFIG } from '@/constants/appConfig';

/**
 * CASUAL OPENER POOL
 * Prompts the interviewer can use to warm up the conversation. The model
 * is told to rephrase these in its own words and weave them into a friendly
 * back-and-forth (with a brief remark + a question), rather than firing
 * one-line questions in a row.
 *
 * Mix of three buckets so the warm-up feels real:
 *   • Small talk (day / weekend / weather)
 *   • Light personal context (where they're joining from)
 *   • Logistical pre-screening (location, time in country, work auth, relocation)
 *
 * NOTE: "background / journey" / "how you got into tech" prompts are
 * intentionally NOT here — those belong in the first *main* question (the
 * existing INTRO_KEYWORDS filter promotes them to the slot right after the
 * openers and format message). Putting them in the opener pool causes the
 * model to skip the greeting and lead with a journey question.
 */
const CASUAL_OPENERS = [
  // ── Small talk ──
  "How's your day going so far?",
  "How's the weather where you are today?",
  "Have you had a busy week so far?",
  "Anything fun planned for the weekend?",
  "Did you get a chance to grab coffee before we hopped on?",
  "What's the rest of your day looking like after this?",
  "Have you been working on anything fun outside of work?",
  "Any plans for the rest of the day after our chat?",

  // ── Light personal / location context ──
  "Whereabouts are you joining in from today?",
  "How long have you been in your current city?",
  "What do you like most about where you're living right now?",
  "Have you always been in that area, or did you move there at some point?",

  // ── Logistical pre-screening (kept from the old list, friendlier phrasing) ──
  "I see you're based in the U.S. — has it been a while since you moved over, or are you still relatively new?",
  "How long have you been in the U.S., if you don't mind me asking?",
  "Quick logistical one before we get rolling — are you authorized to work in the U.S. on your own, or would you need any kind of sponsorship from the company?",
  "On the relocation side of things — would you be open to moving for the right role, or are you mostly looking for something local or remote?",
  "Are you currently in the same time zone as the team, or is there usually a few hours of difference?"
];

const DIFFICULTY_INSTRUCTIONS = {
  Beginner: `
DIFFICULTY: BEGINNER
- Question topics: introductions, background, simple project descriptions, basic technical concepts, light behavioral questions. Keep things accessible.
- Avoid: deep system design, complex distributed-systems tradeoffs, advanced architecture debates.
- Answer length: moderate (3-5 sentences in a single paragraph), conversational.
- Tone: warm, encouraging, like a friendly recruiter screen or first-round interview.`,

  Intermediate: `
DIFFICULTY: INTERMEDIATE
- Question topics: technical deep-dives on technologies/projects in the resume, debugging stories, behavioral STAR-format questions, project tradeoffs, team collaboration, code-review scenarios.
- Include 2-3 light architecture or design questions (component-level, not full system design).
- Answer length: detailed and long (single dense paragraph that covers situation, action taken, technical detail, and outcome).
- Tone: realistic technical interview — professional but conversational.`,

  Advanced: `
DIFFICULTY: ADVANCED
- Question topics: system design, architecture decisions, scaling, distributed systems concepts, advanced behavioral (mentoring, cross-team leadership), ownership and tradeoffs at scale.
- When NO category override is provided (or category is "All"): at least 5-6 of the main questions MUST be system design / architecture deep-dives tied to systems mentioned in the resume.
- Answer length: long, technical, multi-faceted (single dense paragraph covering design choices, alternatives considered, tradeoffs, and concrete examples). This length applies regardless of category — even behavioral/scenario answers should reflect senior-level depth.
- Tone: senior-level interview, formal but conversational, treats the candidate as a peer.
- If a CATEGORY FOCUS section is included below, the category rule overrides the topic mix above. Apply the category strictly while keeping the senior-level depth and tone.`
};

// CATEGORY further narrows the question style at Intermediate level only.
// Beginner and Advanced ignore this — their topic mix is fixed by design.
const CATEGORY_INSTRUCTIONS = {
  All: '',
  Technical: `
CATEGORY FOCUS: TECHNICAL
- Every "main" question MUST be a technical question.
- Cover: code-level deep-dives, debugging walk-throughs, framework/library specifics, data-structure or algorithm choices grounded in the resume's projects, technical tradeoffs, performance, testing, and code review.
- Do NOT generate behavioral or hypothetical "what would you do if…" questions in this batch.
- Each answer should include 2-3 concrete technical details (specific tools, patterns, error modes, metrics) tied to the resume.`,

  Behavioral: `
CATEGORY FOCUS: BEHAVIORAL
- Every "main" question MUST be a behavioral / soft-skills question (use STAR format implicitly).
- Cover: teamwork, conflict resolution, ownership, communication, mentoring, dealing with ambiguity, handling failure, prioritization, leadership moments, cross-team collaboration.
- Do NOT generate technical deep-dives, system design, or coding questions in this batch.
- Each answer should naturally walk through Situation → Task → Action → Result without labeling those parts. Ground the situation in something plausible from the resume.`,

  'Scenario Based': `
CATEGORY FOCUS: SCENARIO-BASED
- Every "main" question MUST be a hypothetical scenario / situational question. Frame each as a "what would you do if…" or "imagine you're on a team where…" prompt.
- Scenarios should test judgment, prioritization, tradeoff thinking, and communication under realistic constraints (production incidents, conflicting stakeholders, ambiguous requirements, tight deadlines, technical-debt vs. feature pressure, on-call decisions).
- Anchor scenarios to the candidate's domain when possible (use technologies/companies/team sizes from the resume), but the situation itself is hypothetical.
- Each answer should explain the candidate's reasoning step-by-step within a single paragraph: how they'd assess, prioritize, communicate, and decide.`
};

// Topic clusters used to give each batch a different focus, so parallel
// batches don't all converge on the same generic questions ("tell me about
// your project", "what frameworks have you used") and the final list has
// real topical diversity.
const TOPIC_CLUSTERS = [
  'Most recent or current project — what it does, who uses it, the candidate\'s role and ownership scope, and the hardest technical challenge they hit.',
  'A previous project from the resume that\'s different from the most recent one — system overview, candidate\'s contribution, and one concrete tradeoff or design decision.',
  'Technical fundamentals tied to a specific technology mentioned in the resume (databases, languages, frameworks, networking, message queues, caching).',
  'System design and architecture decisions for a system the candidate built or maintained — component boundaries, data flow, scaling, integration points.',
  'Debugging and production-incident stories — what broke, how they investigated, what the fix was, what they\'d do differently.',
  'Code review, testing strategy, and code quality practices — reviewing peers, testing approach, refactoring decisions.',
  'Teamwork, conflict, and communication — disagreements with peers, working with PMs/designers, giving and receiving feedback.',
  'Leadership, mentorship, and ownership — leading a project or feature, mentoring a junior, owning an outcome end-to-end.',
  'Tradeoffs and decision-making under constraints — speed vs. quality, build vs. buy, technical debt vs. new features.',
  'Cross-functional collaboration — working with product, design, ops, security, or another engineering team.'
];

function pickTopicsForBatch(n = 2) {
  const shuffled = [...TOPIC_CLUSTERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function generateInterviewQA({ resumeText, jobDescriptionText, difficulty, category, preferredKeywords, onProgress, onUpdate }) {
  const apiKey = process.env.VUE_APP_OPENAPI_TOKEN_KEY;
  if (!apiKey) {
    console.error('********************************************************************************');
    console.error('ERROR: OpenAI API Key (VUE_APP_OPENAPI_TOKEN_KEY) is MISSING!');
    console.error('Interview question generation will FAIL.');
    console.error('Please provide the key in your .env file or environment.');
    console.error('********************************************************************************');
    throw new Error('OpenAI API Key is missing. Question generation cannot proceed.');
  }
  const openaiModel = APP_CONFIG.SERVICES.OPENAI.MODEL;
  const batchSize = APP_CONFIG.SERVICES.OPENAI.BATCH_SIZE;
  const parallelBatches = APP_CONFIG.SERVICES.OPENAI.PARALLEL_BATCHES;

  // Per-difficulty count + prompt block; fall back to default level if missing/unknown.
  const levelKey = APP_CONFIG.DIFFICULTY[difficulty] ? difficulty : APP_CONFIG.DIFFICULTY_DEFAULT;
  const levelConfig = APP_CONFIG.DIFFICULTY[levelKey];
  const minCount = levelConfig.MIN_Q;
  const maxCount = levelConfig.MAX_Q;
  const difficultyBlock = DIFFICULTY_INSTRUCTIONS[levelKey] || '';

  // Category narrows topic style; honored at Intermediate and Advanced levels.
  // Beginner stays a broad warm-up so we ignore category there.
  const categoryHonored = (levelKey === 'Intermediate' || levelKey === 'Advanced')
    && CATEGORY_INSTRUCTIONS[category];
  const categoryKey = categoryHonored ? category : 'All';
  const categoryBlock = CATEGORY_INSTRUCTIONS[categoryKey] || '';

  if (!openaiModel) throw new Error('Missing OpenAI model in configuration');

  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  // Preferred-keywords block: shown to every batch so all batches have a
  // chance to weave them into answers and to anchor a "what is X" question
  // on one of these terms. Trimmed/dedupd here once.
  const cleanedKeywords = Array.isArray(preferredKeywords)
    ? [...new Set(preferredKeywords.map(s => (s || '').toString().trim()).filter(Boolean))]
    : [];
  const preferredKeywordsBlock = cleanedKeywords.length
    ? `\nPREFERRED KEYWORDS (CANDIDATE-SPECIFIED — IMPORTANT)
The candidate explicitly listed these topics they want to focus on: ${cleanedKeywords.join(', ')}.
- For Category B (conceptual / "what is" / "how does") questions, prioritize asking about these terms first. At least 1-2 conceptual questions per batch should target one of these keywords.
- When generating the candidate-style ANSWERS, naturally weave references to these keywords where they plausibly fit. Don't force them — but if an answer can plausibly mention one of these terms (especially when describing tools, technologies, or approaches), include it.
- These keywords are in addition to whatever appears in the resume — treat them as "topics the candidate wants the AI answers to demonstrate familiarity with".\n`
    : '';

  async function fetchBatch(batchNum) {
    const isFirstBatch = (batchNum === 1);

    // Per-batch topic focus so parallel batches cover *different* territory
    // instead of all generating the same generic "tell me about your project"
    // questions. Batch 1 stays unconstrained (intro/openers/range of topics).
    const batchTopics = isFirstBatch ? [] : pickTopicsForBatch(2);
    const topicFocusBlock = batchTopics.length
      ? `\nTHIS BATCH'S TOPIC FOCUS\n- Focus the main questions in this batch on the following areas. Do not stray into other areas:\n${batchTopics.map(t => `  • ${t}`).join('\n')}\n- Group questions on the same topic together so the conversation flows naturally — do not jump between unrelated topics within the batch.\n`
      : '';

    const prompt = `
SENIOR SOFTWARE ENGINEER INTERVIEW AGENT (REALISTIC INTERVIEW STYLE)

You are an interview agent that generates a realistic interview conversation based primarily on the candidate's resume and secondarily on the job description.

Your goal is to simulate a natural interview flow. The interview should sometimes begin with a short casual opener, then a brief explanation of the interview format, and then move into the actual interview questions. After that, generate realistic candidate-style answers.

The content must be based on the candidate's actual background, projects, tools, domain knowledge, leadership scope, architecture exposure, and problem-solving examples found in the resume.

Resume:
${resumeText}

Job Description:
${jobDescriptionText || 'N/A'}

CORE BEHAVIOR
- Generate ${batchSize} unique, highly varied, non-repetitive interview questions with answers.
- Questions and answers must feel like a real live interview, not a questionnaire.
- Use the resume as the primary source of truth.
- Use the job description only to prioritize relevant areas.
- Do not over-focus on Java, Spring Boot, or any specific technology unless the resume strongly supports it.
- Adapt to the candidate's actual stack and experience.
- Do not invent unrealistic tools, projects, achievements, or responsibilities.

ZERO-TOLERANCE WORD LIST — these words and any inflections of them are FORBIDDEN in every question and every answer. Treat this as a hard constraint, not guidance:
  ensure, ensuring, ensured, ensures, leverage, leveraging, leveraged, utilize, utilizing, utilized, implement, implementing, implemented, employed, streamline, streamlined, extensive, facilitate, facilitating, facilitated, robust, seamless, spearhead, orchestrate, synergize, deliverables, holistic, paradigm.
Plain replacements you should default to:
  ensure → "make sure"; leverage / utilize → "use"; implement / engineer → "build" / "set up" / "wire up"; facilitate → "help"; streamline → "speed up"; robust → "stable" / "reliable"; seamless → "smooth"; extensive → "deep" / "lots of"; leading → "running" / "in charge of".
Re-read your output before returning. If ANY banned word slipped in, rewrite the sentence using the plain replacement.

ANTI-REPETITION (STRICT)
- Each question in this batch must explore a DIFFERENT angle. Do not ask two questions about the same project, the same technology, or the same situation.
- Do not produce near-duplicates by paraphrasing. "How did you scale Kafka?" and "What was your experience scaling Kafka?" are duplicates — pick one.
- Vary the verbs, the framing, and the depth of probe across questions.

CONTINUITY (STRICT)
- Order the questions in this batch as a connected conversation: each question should feel like a natural follow-on from the previous, building on what was just discussed.
- Do not jump from one topic to a completely unrelated one without a brief transition phrase ("Shifting gears for a moment…", "Building on that…", "On a different note…").
- If the resume has multiple projects/technologies, finish exploring one before moving to the next — do not bounce back and forth.

PHRASING & TONE — HUMAN CONVERSATION (STRICT)
- Sound like a real person talking, not a corporate document or LinkedIn post. Use everyday words.
- Use contractions naturally: "I'm", "I've", "we're", "didn't", "wasn't", "that's", "it's", "couldn't".
- Prefer short, clear sentences ending in a full stop. If a sentence is getting long, split it. Avoid long comma-stitched sentences that string four or five clauses together.
- Join ideas with connector words instead of more commas. Use these often: "to", "for", "in order to", "so that", "by using", "because", "since", "after", "before", "while", "and then", "which is why", "that way".
- BANNED WORDS — never use any of these in questions or answers (or any inflected forms): ensure, ensuring, ensured, employed, leverage, leveraging, leveraged, streamline, streamlined, extensive, facilitate, facilitated, facilitating, leading (use "running" or "in charge of"), engineering (as a verb — use "build" or "set up"), robust, seamless, utilize, utilizing, utilized, implement, implementing, implemented (use "build", "set up", "wire up"), spearhead, orchestrate, synergize, deliverables, holistic, paradigm, solution-oriented, value-add.
- Plain-word alternatives to default to:
  • "ensure / make sure" → "make sure", "check that"
  • "leverage / utilize" → "use"
  • "implement / engineer" → "build", "set up", "wire up", "put together"
  • "facilitate" → "help", "make easier"
  • "streamline" → "speed up", "simplify"
  • "robust" → "solid", "stable", "reliable"
  • "seamless" → "smooth"
  • "extensive" → "deep", "lots of"
  • "leading" → "running", "in charge of"
- For answers: speak in first person, like the candidate is saying the words out loud in a normal conversation. Mostly simple sentences. The kind you'd say to a colleague over coffee, polished but not corporate.
- For questions: warm and curious. Sound like a real interviewer who is interested in the answer, not someone reading from a script.
${difficultyBlock}
${categoryBlock}
${topicFocusBlock}
${preferredKeywordsBlock}

${isFirstBatch ? `
INTERVIEW OPENING PHASE
Before the main interview questions, generate 3 to 4 casual opener "questions" that warm up the conversation. These should NOT feel like a Q-and-A interrogation — they should feel like a real human interviewer easing into the chat, sharing a small remark or comment, and then asking. Use the prompt pool below as inspiration but rephrase naturally.

Opener prompt pool (use as inspiration, never word-for-word):
${CASUAL_OPENERS.map(q => `- ${q}`).join('\n')}

Rules for opener questions:
- ABSOLUTE FIRST RULE — the VERY FIRST opener (the first item in your output) MUST start with a warm greeting AND be a small-talk question (day / week / coffee / weather / how-are-you). Do NOT lead with a logistical or background question. Do NOT lead with anything that asks about the candidate's journey, their tech path, their past projects, or their resume — those come LATER as part of the structured interview, not as the first thing said.
- COVERAGE — across the openers, you SHOULD include:
  1. The very first opener: a warm greeting + a small-talk question (day / week / coffee / weather).
  2. One light personal / location prompt (where they're joining from, current city, what they like about it).
  3. One logistical pre-screening question (work authorization in the U.S., relocation openness, time zone, OR how long they've been in the country). This is important — keep it warm but ask it.
- NEVER include a "tell me about yourself", "your journey", "your path into tech", "your background", or "how did you get started" question in the opener phase. Those are MAIN questions, not openers.
- VARY THE GREETING — do not always start with "Hi there!" Mix between styles like:
  • "Hi! Thanks so much for hopping on today — before we dig in, how's your day going?"
  • "Hey, great to finally connect. Just so you know, this is a casual chat to start — we'll get into the technical stuff in a bit. How's everything on your end?"
  • "Hi, really appreciate you taking the time today. Where are you joining in from?"
  • "Hey! Thanks for making time for this. Anything fun going on today?"
- SHARE A LITTLE — at least 2 of the openers should include a brief friendly remark BEFORE the question (1 short sentence, then the question). Examples of "shareable" remarks the interviewer can drop in: "I've got a few friends out there", "we get such a mix of backgrounds on these calls", "I always like to start with this one", "the weather's been all over the place here too", "one quick logistical thing before we get rolling". This makes it feel like a back-and-forth, not an interrogation.
- USE RESUME CONTEXT — if the resume mentions a city, country, or recent move, weave it in naturally. Example: "I see from your resume you're based in [city] — how long have you been out there?" Do not invent locations the resume doesn't support.
- Subsequent openers MUST NOT repeat any greeting words ("Hi", "Hello", "Welcome", "Nice to meet you", "Great to meet you"). Only the first opener has a greeting.
- Each opener can be 1 to 2 short sentences (a remark + a question). Use contractions. Sound like a person.
- DO NOT REPEAT TOPICS — never ask two questions about the same thing (e.g., don't ask "how's your day" AND "how's your week" — pick one). Don't ask the same logistical thing twice.
- Salary expectations and notice period are OFF-LIMITS in this phase — leave those to a later HR round.

INTERVIEW FORMAT MESSAGE (STRICT SEPARATION)
Generate exactly ONE short interviewer-style format statement that acts as a pivot from casual talk to the structured interview.

CRITICAL RULES — read carefully:
- The format message MUST be a SEPARATE JSON object with type: "format".
- DO NOT merge the format pivot with the intro question. The pivot is one item, the "tell me about your journey" question is the NEXT, separate item with type: "main".
- The format message itself MUST NOT contain a question. It is a transitional statement only — one short sentence, NO question mark inside it.
- The format message MUST come AFTER all casual openers and BEFORE any "tell me about yourself" / journey / background question.

Examples of correctly-shaped format messages (statement only, no question):
- "I've really enjoyed the chat so far. Let's transition into the interview now."
- "That's great. Let's move into the actual questions."
- "I'm glad to hear that. Let me give you a quick heads-up on the format before we dig in."
- "Sounds good. We'll start with a quick intro and then get into your work."

INCORRECT (do not produce these — the question and the pivot are merged):
- "That's great. Now, transitioning into the interview itself, we'll start with a quick intro. Great, so to kick things off, could you tell me a bit about your journey?"
  ↑ This bundles the pivot AND the intro question into ONE item. Split them apart.

Other rules:
- STRICTLY FORBIDDEN: Do not use "Hi", "Hello", "Welcome", or any greeting that implies you are meeting the candidate for the first time.
- The "answer" for this format message MUST be a short, natural candidate acknowledgment ("Sounds good," / "That works for me, I'm ready to dive in.").
` : 'DO NOT include any opening phase, casual openers, or format messages. Generate ONLY main interview questions. **ABSOLUTELY NO GREETINGS** like "Hi", "Hello", or "Welcome" allowed in these questions.'}

QUESTION DISTRIBUTION
The main interview questions should include a balanced mix across these categories:

A. INTRO — exactly ONE "tell me about yourself / your journey" question. This MUST be the FIRST main question (right after the format pivot). Do not generate more than one intro/journey question per batch. Do not generate any intro/journey questions in non-first batches.

B. CONCEPTUAL / DEFINITIONAL — questions that test fundamentals, not project experience. These are vital and currently underrepresented. Use "what is", "how does", "explain", "what's the difference", "when would you choose":
  - "What is X and how does it differ from Y?"
  - "How does Z work under the hood?"
  - "Can you explain the difference between A and B?"
  - "When would you reach for X versus Y?"
  - "Walk me through what happens when you do X."
  Anchor these to technologies / patterns / tools mentioned in the resume — but the question is about understanding, not project context.

C. PROJECT / EXPERIENCE — "on your X project, how did you...", "describe the system you built at..." — anchored to specific resume projects.

D. TECHNICAL DEEP-DIVE — debugging stories, performance tuning, code review, refactoring decisions.

E. ARCHITECTURE / SYSTEM DESIGN — component boundaries, data flow, scaling, integration points.

F. BEHAVIORAL — STAR-format situational stories: teamwork, conflict, ownership, communication, mentoring, ambiguity, failure handling.

G. SCENARIO / TRADEOFFS — hypothetical "what would you do if..." or "how would you decide between..." prompts that test judgment.

QUESTION TYPE VARIETY (STRICT)
- Across the main questions in this batch, MIX category types. Do not generate 5 in a row of the same type.
- AT LEAST 2 of the main questions in this batch MUST be from category B (conceptual / "what is" / "how does"). This is the most underused category — the model tends to default to project deep-dives. Force variety here.
- Do NOT make every main question a project deep-dive. A real interview mixes "what is X" with "how did you use X" with "why did you choose X over Y".

NO CLOSURE LANGUAGE (STRICT)
- Do NOT use closure-signaling phrasing in any question: "Lastly", "Finally", "To wrap up", "Last question", "Last but not least", "To close out", "For my last question". The interview ends with a system-generated closing message — your questions should never signal the end. Treat every question as if there are more to come.

QUESTION STYLE & TONE
- Be friendly, warm, and natural. Avoid robotic or "straight" questioning.
- **CONTINUITY IS KEY**: Treat the entire array as a single continuous conversation.
- **NO REPEATED GREETINGS**: Never say "Hi", "Hello", "Welcome", or "Nice to meet you" after the very first question in the session.
- Use conversational transitions and **friendly acknowledgments** when moving between questions.
- **VARY YOUR BRIDGES**: Do not use "That's great" every time. Use a variety of acknowledgments: "That makes sense," "I appreciate that detail," "Interesting perspective," "Got it," or "That's a helpful overview."
- Every question after the first one should start with a natural follow-up or bridge based on the previous context.
- Use conversational lead-ins (e.g., "I'd love to pivot a bit and talk about...", "That's really interesting. Looking at your time at [Company], I noticed...", "Shift gears for a second...").
- Set the stage before asking. Instead of "How do you handle X?", say "I see you've worked extensively with [Technology] on [Project]. In that specific environment, how did you typically approach X?"
- Acknowledge the candidate's seniority. Treat them like a peer, not a student being tested.
- If a previous question was about a project, the next question can naturally flow from it (e.g., "Building on that architecture you just described, how did the team handle...").

ANSWER STYLE
All answers must:
- be in first person
- sound like the candidate speaking in a real interview
- feel calm, practical, and conversational
- include concrete details where relevant
- stay aligned with the candidate's actual resume
- avoid sounding scripted or overly polished

STRICT ANSWER FORMAT
- Each answer must be exactly one detailed paragraph
- Do not use bullet points
- Do not split into multiple paragraphs
- Do not label sections
- Do not prefix with "Answer:"
- Do not include markdown formatting
- Do not include meta commentary
- Keep each answer interview-ready and natural

BEHAVIORAL QUESTION RULE
For behavioral questions, the answer should naturally reflect:
- situation
- task
- action
- result
But do NOT label them explicitly. Keep everything in one natural spoken paragraph.

TECHNICAL QUESTION RULE
For technical questions:
- give a direct practical answer
- include 2 to 3 concrete technical details
- connect it to a realistic example from the resume whenever possible
- avoid textbook explanations unless specifically asked

PROJECT QUESTION RULE
When the question is about a project, the answer should naturally cover:
- what the system does
- who uses it
- how the request or workflow moves through the system
- key services, data stores, APIs, or integrations where relevant
- one challenge or improvement personally handled
- team context if useful

REALISM RULES
- If the resume does not support a technology, responsibility, domain, or project detail, do not invent it
- Questions must be distinct from each other
- Answers must be distinct from each other
- Avoid reusing the same example too often unless the resume is limited
- Keep the interview flow realistic from beginning to end

RESPONSE STRUCTURE
Return ONLY valid JSON as an array of objects.
Each object must have:
- "question"
- "answer"
- "type" (one of: "opener", "format", or "main")

The array should represent the interview flow in order for this batch.
1. optional casual opener question(s) (type: "opener")
2. one interviewer format statement (type: "format")
3. main interview questions (type: "main")

Use this exact shape:
[
  {
    "question": "string",
    "answer": "string",
    "type": "string"
  }
]
    `;

    const completion = await openai.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: 'system', content: 'You are an interview assistant that outputs only JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
    });

    const raw = completion.choices[0].message.content;

    try {
      const cleaned = raw.replace(/```(json)?\s*|```$/gi, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      return [];
    }
  }

  // Live, deduplicated pool of all received items. Mutated as batches arrive.
  const seen = new Set();
  const pool = [];
  let firstBatchDone = false;

  function addAndDedupe(items) {
    for (const item of items) {
      const q = item.question?.trim();
      if (q && !seen.has(q)) {
        seen.add(q);
        pool.push(item);
      }
    }
  }

  // Count of MAIN questions in the pool — excludes openers, format
  // pivots, and intro/journey questions. This is what minCount/maxCount
  // are sized against now (per user request: openers/intro/closing
  // shouldn't be counted toward the question budget).
  function mainQuestionCount() {
    return pool.filter(item => {
      if (item.type === 'opener' || item.type === 'format') return false;
      const q = (item.question || '').toLowerCase();
      if (INTRO_KEYWORDS.some(k => q.includes(k))) return false;
      return true;
    }).length;
  }

  async function fetchAndProcess(batchNum) {
    const result = await fetchBatch(batchNum);
    addAndDedupe(result);

    if (batchNum === 1) firstBatchDone = true;

    if (onProgress) {
      onProgress({ ready: mainQuestionCount(), target: minCount, firstBatchDone });
    }
    if (onUpdate) {
      onUpdate(assembleFinalQA(pool, maxCount));
    }
  }

  let batchNum = 1;
  // Exit when we have enough MAIN questions (not counting openers / format
  // pivot / intro). Hard safety cap on rounds so we don't loop forever
  // if dedup keeps eating responses.
  let rounds = 0;
  const MAX_ROUNDS = 6;
  while (mainQuestionCount() < minCount && rounds < MAX_ROUNDS) {
    const batchPromises = [];
    for (let i = 0; i < parallelBatches; i++) {
      batchPromises.push(fetchAndProcess(batchNum++));
    }
    await Promise.all(batchPromises);
    rounds++;
  }

  const sanitizedQA = assembleFinalQA(pool, maxCount);
  await saveInterviewQA(sanitizedQA);
  return sanitizedQA;
}

const INTRO_KEYWORDS = [
  'tell me about yourself', 'introduce yourself', 'your background', 'introduction',
  'kick things off', 'your journey', 'how you started', 'how you became', 'your story',
  'your path', 'developer journey', 'engineering journey', 'kick off'
];

// Words that should not appear in any non-final question — they signal
// the interview is wrapping up. Caught by the closure-language scrubber
// below so the model can use them in the LAST question if it wants, but
// not the middle ones.
const CLOSURE_PHRASES = [
  /\blastly\b/i,
  /\bfinally\b/i,
  /\b(to\s+)?wrap\s*(up|things\s*up)\b/i,
  /\blast(\s+but\s+not\s+least)\b/i,
  /\blast\s+question\b/i,
  /\bto\s+close\s+(out|things)\b/i,
  /\bfor\s+my\s+last\s+question\b/i
];

// Tiny stopword + stemmer used by the semantic-dedup pass. Lowercase,
// strip non-letters, drop short/common words, crude suffix stripping.
const DEDUP_STOPWORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','can','could','should','may','might','must',
  'and','or','but','so','if','as','at','by','for','in','of','on','to','with','from',
  'into','about','after','again','before','between','down','just','more','most',
  'now','off','once','only','other','out','own','same','such','than','then','there',
  'through','too','very','when','where','which','who','whom','why','how','what',
  'while','still','also','because','since','i','you','we','they','it','me','us',
  'my','your','his','her','its','our','their','some','any','each','every','no',
  'this','that','these','those','here','well','really','tell','share','describe',
  'walk','explain','give','let','think','tell','sounds','interesting','great',
  'ok','okay','um','uh','like'
]);

function _stem(w) {
  if (w.length > 5 && (w.endsWith('ings') || w.endsWith('ying'))) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed'))  return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s'))   return w.slice(0, -1);
  return w;
}

function _signature(text) {
  if (!text) return new Set();
  const tokens = text.toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !DEDUP_STOPWORDS.has(w))
    .map(_stem);
  return new Set(tokens);
}

function _jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersect = 0;
  for (const x of a) if (b.has(x)) intersect++;
  return intersect / (a.size + b.size - intersect);
}

// Drop near-duplicate questions in order. Keeps the first occurrence;
// any subsequent question whose content-token overlap (Jaccard, after
// stemming + stopword removal) exceeds the threshold is dropped.
// 0.5 catches paraphrases like "describe the X platform" / "key components
// of the X platform", "your journey as a developer" / "your journey in
// software development", without merging genuinely different questions.
function dedupSemantically(items, threshold = 0.5) {
  const kept = [];
  const sigs = [];
  for (const item of items) {
    const sig = _signature(item.question);
    let isDup = false;
    for (const k of sigs) {
      if (_jaccard(sig, k) >= threshold) { isDup = true; break; }
    }
    if (!isDup) { kept.push(item); sigs.push(sig); }
  }
  return kept;
}

function assembleFinalQA(pool, maxCount) {
  const rawOpeners = pool.filter(item => item.type === 'opener');
  const formatStatements = pool.filter(item => item.type === 'format');
  const mainQuestions = pool.filter(item => !item.type || item.type === 'main');

  // Fix: strip intro/journey-keyword items out of openers — those are
  // misclassified main questions (e.g., "tell me about your journey").
  // They get re-routed into the intro pool below, where only one survives.
  const intrusiveIntroOpeners = rawOpeners.filter(q =>
    INTRO_KEYWORDS.some(keyword => q.question?.toLowerCase().includes(keyword))
  );
  const openers = rawOpeners.filter(q =>
    !INTRO_KEYWORDS.some(keyword => q.question?.toLowerCase().includes(keyword))
  );

  // Combine intro candidates from both main and (rescued) opener buckets,
  // keep only the first one as the interview's single "tell me about
  // yourself" moment.
  const introCandidatesFromMain = mainQuestions.filter(q =>
    INTRO_KEYWORDS.some(keyword => q.question?.toLowerCase().includes(keyword))
  );
  const allIntros = [...introCandidatesFromMain, ...intrusiveIntroOpeners];
  const singleIntro = allIntros.length > 0 ? [allIntros[0]] : [];

  let otherMainQuestions = mainQuestions.filter(q =>
    !INTRO_KEYWORDS.some(keyword => q.question?.toLowerCase().includes(keyword))
  );

  // Semantic dedup: drop near-duplicates that exact-text dedup missed
  // (e.g., "how did you set up Kafka?" / "how have you managed Kafka data
  // flow?", or "describe the platform" / "key components of the platform").
  otherMainQuestions = dedupSemantically(otherMainQuestions, 0.5);

  // Cap MAIN questions only at maxCount. Openers, format, and the single
  // intro are NOT counted toward the budget — they're preserved on top.
  const cappedMain = otherMainQuestions.slice(0, maxCount);

  // Don't shuffle. Each batch produces a connected conversation thread, and
  // shuffling here destroys that continuity. Preserve order so questions on
  // the same topic stay grouped.
  const combinedQA = [
    ...openers,
    ...(formatStatements.length > 0 ? [formatStatements[0]] : []),
    ...singleIntro,
    ...cappedMain
  ];

  // Defensive fallback: if the model failed to produce any openers, the
  // first item would be a journey/intro question — which feels jarring.
  // Prepend a friendly greeting so the candidate is welcomed.
  if (openers.length === 0 && combinedQA.length > 0) {
    combinedQA.unshift({
      type: 'opener',
      question: "Hi, thanks so much for hopping on with me today. Before we get into things, how's your day going so far?",
      answer: "Hey, doing well, thanks. Glad to be here and excited for our chat."
    });
  }

  const slicedQA = combinedQA;
  const lastIndex = slicedQA.length - 1;

  // Per-item scrubbing pass:
  // - First item keeps its greeting; everything else has any leading
  //   "Hi/Hello/Welcome/Nice to meet you" stripped (the model sometimes
  //   adds a redundant greeting on later items).
  // - Closure language ("Lastly", "Finally", "to wrap up", etc.) is
  //   scrubbed from every question EXCEPT the last one — those were
  //   generated mid-flow and only sound natural at the actual end.
  const finalQA = slicedQA.map((item, index) => {
    let q = item.question || '';
    if (index !== 0) {
      q = q.replace(/^(hi|hello|welcome|nice to meet you|thanks for joining|good (morning|afternoon|evening))\s*([\w']+\s*)?[,!.]?\s*/gi, '');
    }
    if (index !== lastIndex) {
      for (const re of CLOSURE_PHRASES) {
        q = q.replace(re, (match) => {
          // Replace "Lastly," → "Now," (keeps sentence flow). Otherwise just drop.
          if (/^lastly/i.test(match) || /^finally/i.test(match)) return 'Now';
          return '';
        });
      }
      // Cleanup any double spaces / leading commas left by the substitution
      q = q.replace(/^[\s,]+/, '').replace(/\s{2,}/g, ' ').trim();
    }
    if (q.length > 0) q = q.charAt(0).toUpperCase() + q.slice(1);
    return { ...item, question: q };
  });

  return finalQA.map(item => ({
    question: item.question,
    answer: item.answer
  }));
}
