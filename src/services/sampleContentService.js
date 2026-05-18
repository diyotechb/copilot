import { backendUrl, authHeaders, assertOk } from './backendApi';

async function postSample(path, keywords) {
  const response = await fetch(backendUrl(`/api/sample/${path}`), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ keywords: keywords || '' })
  });

  await assertOk(response, 'Sample content request');
  const data = await response.json();
  const text = (data && data.text) ? data.text : '';
  if (!text) throw new Error('Empty response from sample content backend');
  return text;
}

export async function generateSampleResume(keywords) {
  return postSample('resume', keywords);
}

export async function generateSampleJobDescription(keywords) {
  return postSample('job-description', keywords);
}
