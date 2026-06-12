import { backendUrl, authHeaders, assertOk } from './backendApi';
import authService from './authService';

async function jsonOrThrow(res, label) {
  await assertOk(res, label);
  return res.json();
}

function sessionBody(payload) {
  return {
    sessionId: payload.id || payload.sessionId || undefined,
    label: payload.label ?? undefined,
    startedAt: payload.startedAt ?? undefined,
    endedAt: payload.endedAt ?? undefined,
    completed: typeof payload.completed === 'boolean' ? payload.completed : undefined,
    candidateName: payload.candidateName ?? undefined,
    enrollmentId: payload.enrollmentId ?? undefined,
    createdByEmail: authService.getUserEmail() || '',
    updatedByEmail: authService.getUserEmail() || '',
    difficulty: payload.difficulty ?? undefined,
    category: payload.category ?? undefined,
    analysisMode: payload.analysisMode ?? undefined,
    qaList: Array.isArray(payload.qaList) ? payload.qaList : undefined,
    transcripts: Array.isArray(payload.transcripts) ? payload.transcripts : undefined,
    questionTimestamps: Array.isArray(payload.questionTimestamps) ? payload.questionTimestamps : undefined,
    llmAnalysis: payload.llmAnalysis ?? undefined
  };
}

export async function claimDailyTranscribe() {
  const res = await fetch(backendUrl('/api/interviews/transcribe-claim'), {
    method: 'POST',
    headers: authHeaders()
  });
  if (res.status === 429) return false;
  await assertOk(res, 'Transcribe claim');
  return true;
}

export async function checkDailyTranscribeAllowance() {
  const res = await fetch(backendUrl('/api/interviews/transcribe-allowance'), {
    method: 'GET',
    headers: authHeaders()
  });
  await assertOk(res, 'Transcribe allowance');
  const data = await res.json();
  return !!(data && data.allowed);
}

export default {
  async saveSession(payload) {
    const res = await fetch(backendUrl('/api/interviews/session'), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(sessionBody(payload))
    });
    return jsonOrThrow(res, 'Save interview');
  },

  async updateSession(id, patch) {
    const res = await fetch(backendUrl(`/api/interviews/session/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(sessionBody({ ...patch, id: undefined }))
    });
    return jsonOrThrow(res, 'Update interview');
  },

  endOnUnload(id) {
    return fetch(backendUrl(`/api/interviews/session/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ endedAt: new Date().toISOString(), updatedByEmail: authService.getUserEmail() || '' }),
      keepalive: true
    });
  },

  async listSessions() {
    const res = await fetch(backendUrl('/api/interviews/sessions'), { headers: authHeaders() });
    return jsonOrThrow(res, 'Load interviews');
  },

  async getSession(id) {
    const res = await fetch(backendUrl(`/api/interviews/session/${encodeURIComponent(id)}`), { headers: authHeaders() });
    return jsonOrThrow(res, 'Load interview');
  },

  async deleteSession(id) {
    const res = await fetch(backendUrl(`/api/interviews/session/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: authHeaders()
    });
    return jsonOrThrow(res, 'Delete interview');
  },

  async listByCandidate(enrollmentId, limit = 10) {
    const res = await fetch(
      backendUrl(`/api/interviews/sessions/by-candidate?enrollmentId=${encodeURIComponent(enrollmentId)}&limit=${encodeURIComponent(limit)}`),
      { headers: authHeaders() }
    );
    return jsonOrThrow(res, 'Load candidate sessions');
  },

  async listCandidateStats() {
    const res = await fetch(backendUrl('/api/interviews/candidates/stats'), { headers: authHeaders() });
    return jsonOrThrow(res, 'Load candidate stats');
  }
};
