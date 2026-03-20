import OpenAI from 'openai';
import { saveInterviewQA } from '@/store/interviewStore';
import { APP_CONFIG } from '@/constants/appConfig';

/**
 * CASUAL OPENER CONFIGURATION
 * Add or remove questions here to change the "opening phase" of the interview.
 */
const CASUAL_OPENERS = [
  "Hey, how are you today?",
  "Where are you currently based?",
  "Are you open to relocation?",
  "What's the weather like where you are right now?",
  "Which part of the state are you in exactly?",
  "How do you like the area you're living in currently?",
  "What's your current work authorization or visa status?",
  "When did you move to the U.S.?"
];

export async function generateInterviewQA({ resumeText, jobDescriptionText }) {
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
  const minCount = APP_CONFIG.SERVICES.OPENAI.MIN_Q_COUNT;
  const maxCount = APP_CONFIG.SERVICES.OPENAI.MAX_Q_COUNT;
  const batchSize = APP_CONFIG.SERVICES.OPENAI.BATCH_SIZE;
  const parallelBatches = APP_CONFIG.SERVICES.OPENAI.PARALLEL_BATCHES;

  if (!openaiModel) throw new Error('Missing OpenAI model in configuration');

  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  async function fetchBatch(batchNum) {
    const isFirstBatch = (batchNum === 1);

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

${isFirstBatch ? `
INTERVIEW OPENING PHASE
Before the main interview questions, you may optionally include 2 to 4 casual opener questions from the following list:
${CASUAL_OPENERS.map(q => `- ${q}`).join('\n')}

Rules for opener questions:
- **ONLY the very first question** generated should start with a greeting (e.g., "Hi there!", "Hello! It's so nice to meet you.").
- Subsequent openers **MUST NOT** say "Hi", "Hello", "Welcome", or "Nice to meet you" again.
- Pick 2 to 4 **distinct** topics from the list.
- Wrap them in natural conversation.
- Use these to build a friendly rapport before "diving into the business."

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

  let allQA = [];
  let batchNum = 1;

  while (allQA.length < maxCount) {
    const batchPromises = [];
    for (let i = 0; i < parallelBatches; i++) {
      batchPromises.push(fetchBatch(batchNum++));
    }

    const results = await Promise.all(batchPromises);
    allQA = allQA.concat(...results);

    // Deduplicate by question text
    const seen = new Set();
    allQA = allQA.filter(item => {
      const q = item.question?.trim();
      if (!q || seen.has(q)) return false;
      seen.add(q);
      return true;
    });
  }

  // Handle Flow
  const openers = allQA.filter(item => item.type === 'opener');
  const formatStatements = allQA.filter(item => item.type === 'format');
  let mainQuestions = allQA.filter(item => !item.type || item.type === 'main');

  const introKeywords = [
    'tell me about yourself', 'introduce yourself', 'your background', 'introduction',
    'kick things off', 'your journey', 'how you started', 'how you became', 'your story',
    'your path', 'developer journey', 'engineering journey', 'kick off'
  ];
  const introQuestions = mainQuestions.filter(q =>
    introKeywords.some(keyword => q.question?.toLowerCase().includes(keyword))
  );

  const singleIntro = introQuestions.length > 0 ? [introQuestions[0]] : [];

  const otherMainQuestions = mainQuestions.filter(q =>
    !introKeywords.some(keyword => q.question?.toLowerCase().includes(keyword))
  );

  // Shuffle only the non-intro main questions
  for (let i = otherMainQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherMainQuestions[i], otherMainQuestions[j]] = [otherMainQuestions[j], otherMainQuestions[i]];
  }

  const combinedQA = [
    ...openers,
    ...(formatStatements.length > 0 ? [formatStatements[0]] : []),
    ...singleIntro,
    ...otherMainQuestions
  ];

  // Limit to MAX_Q_COUNT (ensuring the range 30-45 represents the final set)
  const slicedQA = combinedQA.slice(0, maxCount);

  // SCRUBBING
  const finalQA = slicedQA.map((item, index) => {
    if (index === 0) return item;

    let q = item.question || '';
    q = q.replace(/^(hi|hello|welcome|nice to meet you|thanks for joining|good (morning|afternoon|evening))\s*([\w']+\s*)?[,!.]?\s*/gi, '');

    if (q.length > 0) q = q.charAt(0).toUpperCase() + q.slice(1);

    return { ...item, question: q };
  });

  const sanitizedQA = finalQA.map(item => ({
    question: item.question,
    answer: item.answer
  }));

  await saveInterviewQA(sanitizedQA);
  return sanitizedQA;
}
