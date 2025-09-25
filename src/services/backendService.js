const API_BASE =
  process.env.NODE_ENV === 'production'
    ? process.env.VUE_APP_BACKEND_URL_PROD
    : process.env.VUE_APP_BACKEND_URL_DEV;

// Session APIs
export async function createSession(sessionData) {
  const res = await fetch(`${API_BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionData)
  });
  return res.json();
}

export async function getSessionsByUser(userId) {
  const res = await fetch(`${API_BASE}/session/user/${userId}`);
  return res.json();
}

// Interview APIs
export async function createInterview(interviewData) {
  const res = await fetch(`${API_BASE}/interview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(interviewData)
  });
  return res.json();
}

export async function getInterviewsBySession(sessionId) {
  const res = await fetch(`${API_BASE}/interview/session/${sessionId}`);
  return res.json();
}

export async function updateSessionLastActive(sessionId, lastActive) {
  const res = await fetch(`${API_BASE}/session/${sessionId}/last-active`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lastActive })
  });
  return res.json();
}

export async function endSession(sessionId, endTime) {
  const res = await fetch(`${API_BASE}/session/${sessionId}/end`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endTime })
  });
  return res.json();
}

export async function createInterviewsBulk(interviews) {
  console.log('Creating interviews in bulk:', interviews);
  const res = await fetch(`${API_BASE}/interview/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interviews })
  });
  return res.json();
}

export function createInterviewsBulkBeacon(interviews) {
  const url = `${API_BASE}/interview/bulk`;
  const data = JSON.stringify({ interviews });
  const blob = new Blob([data], { type: 'application/json' });
  navigator.sendBeacon(url, blob);
}
