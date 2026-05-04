import OpenAI from 'openai';
import { APP_CONFIG } from '@/constants/appConfig';

function getClient() {
  const apiKey = process.env.VUE_APP_OPENAPI_TOKEN_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key (VUE_APP_OPENAPI_TOKEN_KEY) is missing.');
  }
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

async function generate(prompt) {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: APP_CONFIG.SERVICES.OPENAI.MODEL,
    temperature: 1.1,
    messages: [{ role: 'user', content: prompt }]
  });
  const text = response.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from OpenAI');
  return text;
}

export async function generateSampleResume(keywords) {
  // Random seed in the prompt prevents the model from repeating itself across clicks.
  const seed = Math.random().toString(36).slice(2, 10);

  const prompt = `Generate a realistic 1-page resume in plain text.
${keywords ? `Candidate profile keywords: ${keywords}.` : 'Pick a random tech role and seniority level.'}

Variation hint: ${seed}

Requirements:
- 400-600 words, plain text only (no markdown, no asterisks, no code fences)
- Sections in this order: NAME (line 1), CONTACT (one line, placeholder values), SUMMARY, EXPERIENCE (2-3 jobs, each with 3-5 bullet points and realistic dates), EDUCATION, SKILLS, PROJECTS (1-2 items)
- If the keywords contain a person's name, use it as the candidate's name. Otherwise invent a realistic fictional name.
- If the keywords contain a company name, use it as the candidate's most recent or current employer. Other employers, dates, and locations should be realistic but fictional.
- Make the content specific and varied; avoid generic interview-prep phrasing

Output only the resume content. No preamble, no explanation, no closing remarks.`;

  return generate(prompt);
}

export async function generateSampleJobDescription(keywords) {
  const seed = Math.random().toString(36).slice(2, 10);

  const prompt = `Generate a realistic job description in plain text.
${keywords ? `Use these keywords: ${keywords}.` : 'Pick a random tech role and seniority level.'}

Variation hint: ${seed}

Requirements:
- 300-450 words, plain text only (no markdown, no asterisks, no code fences)
- Sections in this order: ROLE TITLE & SENIORITY, COMPANY (1-2 line overview), RESPONSIBILITIES (5-7 bullets), REQUIRED QUALIFICATIONS (5-7 bullets), PREFERRED QUALIFICATIONS (3-4 bullets), LOCATION (remote / hybrid / onsite), SALARY RANGE
- If the keywords contain a company name, use it as the hiring company. Otherwise invent a realistic fictional company name.
- Make the content specific and varied

Output only the job description content. No preamble, no explanation.`;

  return generate(prompt);
}
