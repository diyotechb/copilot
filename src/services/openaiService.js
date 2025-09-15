import OpenAI from 'openai';
import { saveInterviewQA } from '@/store/interviewStore';

export async function generateInterviewQA({ resumeText, jobDescriptionText }) {
  const apiKey = process.env.VUE_APP_OPENAPI_TOKEN_KEY;
  const openaiModel = process.env.VUE_APP_OPENAI_MODEL;
  const targetCount = parseInt(process.env.VUE_APP_INTERVIEW_Q_COUNT || '30', 10);
  const batchSize = parseInt(process.env.VUE_APP_INTERVIEW_Q_BATCH || '10', 10);
  const parallelBatches = parseInt(process.env.VUE_APP_INTERVIEW_Q_PARALLEL || '3', 10);

  if (!apiKey) throw new Error('Missing OpenAI API key');
  if (!openaiModel) throw new Error('Missing OpenAI model');

  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  async function fetchBatch(batchNum) {
    const prompt = `
      Generate ${batchSize} unique, non-repetitive, highly randomized interview questions 
      with detailed answers based on the following resume and job description.
      
      Resume:
      ${resumeText}

      Job Description:
      ${jobDescriptionText || 'N/A'}

      Respond ONLY in valid JSON as an array of objects with "question" and "answer" keys, like:
      [
        { "question": "What is X?", "answer": "Explanation..." },
        { "question": "How would you do Y?", "answer": "Detailed response..." }
      ]
    `;

    // console.log(`[generateInterviewQA] 🔄 Fetching batch ${batchNum} of size ${batchSize}...`);

    const start = Date.now();
    const completion = await openai.chat.completions.create({
      model: openaiModel,
      messages: [
        { role: 'system', content: 'You are an interview assistant that outputs only JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
    });

    const duration = ((Date.now() - start) / 1000).toFixed(2);
    // console.log(`[generateInterviewQA] ✅ Batch ${batchNum} completed in ${duration}s`);

    const raw = completion.choices[0].message.content;
    try {
      const cleaned = raw.replace(/```(json)?\s*|```$/gi, '').trim();
      const qaArr = JSON.parse(cleaned);
      // console.log(`[generateInterviewQA] 📦 Batch ${batchNum} produced ${qaArr.length} QAs`);
      return qaArr;
    } catch (e) {
      console.error(`[generateInterviewQA] ❌ Batch ${batchNum} returned invalid JSON`, raw);
      return [];
    }
  }

  let allQA = [];
  let batchNum = 1;

  while (allQA.length < targetCount) {
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

    console.log(`[generateInterviewQA] 📊 Total unique QAs so far: ${allQA.length}`);
  }

  // Shuffle for randomness
  for (let i = allQA.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allQA[i], allQA[j]] = [allQA[j], allQA[i]];
  }

  console.log(`[generateInterviewQA] 🎯 Final QA count: ${allQA.length}`);

  await saveInterviewQA(allQA);
  return allQA;
}
