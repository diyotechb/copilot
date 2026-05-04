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

export async function generateInterviewQA({ resumeText, jobDescriptionText, difficulty, category, onProgress, onUpdate }) {
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

INTERVIEW FORMAT MESSAGE
One short interviewer-style format statement that acts as a **pivot** from casual talk to the interview.
Examples of tone:
- "I've really enjoyed the chat so far. To give you a head's up on the format, we'll spend a few minutes on introductions..."
- "That's great. Now, transitioning into the interview itself, we'll start with a quick intro..."
- "I'm glad to hear that. To set the stage for our session today, I'll begin with a couple of basics..."
Rules:
- **STRICTLY FORBIDDEN**: Do not use "Hi", "Hello", "Welcome", or any greeting that implies you are meeting the candidate for the first time.
- Keep it natural and act as a bridge from the previous casual topic.
- Sound like a real interviewer moving the meeting forward.
- This MUST come AFTER any casual openers and BEFORE any introduction or project questions.
- The "answer" for this format message MUST be a short, natural candidate acknowledgment (e.g., "Sounds good," or "That works for me, I'm ready to dive in.").
` : 'DO NOT include any opening phase, casual openers, or format messages. Generate ONLY main interview questions. **ABSOLUTELY NO GREETINGS** like "Hi", "Hello", or "Welcome" allowed in these questions.'}

QUESTION DISTRIBUTION
The main interview questions should include a balanced mix of:
- tell me about yourself / background questions (This should be the first "main" question. It should follow the format message naturally, e.g., "Great, so to kick things off, could you tell me a bit about your journey...")
- current or recent project questions
- technical deep-dive questions
- architecture and system design questions
- debugging / production issue questions
- behavioral questions
- team collaboration / Agile questions
- leadership / ownership questions
- tradeoff and decision-making questions

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

  async function fetchAndProcess(batchNum) {
    const result = await fetchBatch(batchNum);
    addAndDedupe(result);

    if (batchNum === 1) firstBatchDone = true;

    if (onProgress) {
      onProgress({ ready: pool.length, target: minCount, firstBatchDone });
    }
    if (onUpdate) {
      onUpdate(assembleFinalQA(pool, maxCount));
    }
  }

  let batchNum = 1;
  // Exit as soon as we have enough unique questions; the slice below still caps at maxCount.
  while (pool.length < minCount) {
    const batchPromises = [];
    for (let i = 0; i < parallelBatches; i++) {
      batchPromises.push(fetchAndProcess(batchNum++));
    }
    await Promise.all(batchPromises);
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

function assembleFinalQA(pool, maxCount) {
  const openers = pool.filter(item => item.type === 'opener');
  const formatStatements = pool.filter(item => item.type === 'format');
  const mainQuestions = pool.filter(item => !item.type || item.type === 'main');

  const introQuestions = mainQuestions.filter(q =>
    INTRO_KEYWORDS.some(keyword => q.question?.toLowerCase().includes(keyword))
  );
  const singleIntro = introQuestions.length > 0 ? [introQuestions[0]] : [];

  const otherMainQuestions = mainQuestions.filter(q =>
    !INTRO_KEYWORDS.some(keyword => q.question?.toLowerCase().includes(keyword))
  );

  // Don't shuffle. Each batch produces a connected conversation thread, and
  // shuffling here destroys that continuity (e.g., a Kafka deep-dive
  // question gets stranded after a leadership question). Preserve the
  // batch order so questions on the same topic stay grouped.

  const combinedQA = [
    ...openers,
    ...(formatStatements.length > 0 ? [formatStatements[0]] : []),
    ...singleIntro,
    ...otherMainQuestions
  ];

  // Defensive fallback: if the model failed to produce any openers, the
  // first item would be a journey/intro question — which feels jarring
  // ("tell me about your path" with no greeting). Prepend a friendly
  // greeting so the candidate is welcomed before the real questions start.
  if (openers.length === 0 && combinedQA.length > 0) {
    combinedQA.unshift({
      type: 'opener',
      question: "Hi, thanks so much for hopping on with me today. Before we get into things, how's your day going so far?",
      answer: "Hey, doing well, thanks. Glad to be here and excited for our chat."
    });
  }

  const slicedQA = combinedQA.slice(0, maxCount);

  const finalQA = slicedQA.map((item, index) => {
    if (index === 0) return item;
    let q = item.question || '';
    q = q.replace(/^(hi|hello|welcome|nice to meet you|thanks for joining|good (morning|afternoon|evening))\s*([\w']+\s*)?[,!.]?\s*/gi, '');
    if (q.length > 0) q = q.charAt(0).toUpperCase() + q.slice(1);
    return { ...item, question: q };
  });

  return finalQA.map(item => ({
    question: item.question,
    answer: item.answer
  }));
}
