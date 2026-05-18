import { backendUrl, authHeaders, assertOk } from './backendApi';

export async function analyzeInterviewSession({
  qaList,
  transcripts,
  difficulty,
  category,
  analysisTypes
}) {
  if (!Array.isArray(qaList) || qaList.length === 0) {
    throw new Error('No questions provided for analysis.');
  }

  const response = await fetch(backendUrl('/api/interview/analyze'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      qaList,
      transcripts: transcripts || [],
      difficulty,
      category,
      analysisTypes: analysisTypes || {}
    })
  });

  await assertOk(response, 'Analysis request');
  return response.json();
}
