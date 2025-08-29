import OpenAI from 'openai';

export async function generateInterviewQA({ resumeText, jobDescriptionText }) {
  const apiKey = process.env.VUE_APP_OPENAPI_TOKEN_KEY;
  console.log('[generateInterviewQA] Called with:', { resumeText, jobDescriptionText, apiKey });
  if (!apiKey) {
    console.error('[generateInterviewQA] Missing OpenAI API key:', apiKey);
    throw new Error('The OPENAI_API_KEY environment variable is missing or empty; either provide it, or instantiate the OpenAI client with an apiKey option, like new OpenAI({ apiKey: "My API Key" }).');
  }
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  let prompt = `Generate a large, unique, and randomized set of interview questions and answers based on the following resume. Avoid repeating common questions. Make each question distinct and relevant to the resume and job description. Generate as many Q/A pairs as possible, up to the model's response limit. For each answer, make it as descriptive and detailed as possible, providing deep technical insights and real-world examples. Ensure the questions and answers are different and randomized for every run.`;
  if (jobDescriptionText) {
    prompt += ` Also consider the following job description.\nJob Description:\n${jobDescriptionText}`;
  }
  prompt += `\nResume:\n${resumeText}`;
  prompt += `\n\nFormat your response exactly as follows:\nQuestion 1: ...\nAnswer 1: ...\nQuestion 2: ...\nAnswer 2: ...\n(Continue for all questions)`;
  console.log('[OpenAI Prompt]', prompt);
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an interview assistant. Generate multiple interview questions and answers from the candidate’s resume.' },
        { role: 'user', content: prompt }
      ],
      stream: false,
    });
    console.log('[OpenAI Completion]', completion);
    return completion.choices[0].message.content;
  } catch (err) {
    console.error('[generateInterviewQA] OpenAI API error:', err);
    throw err;
  }
}
