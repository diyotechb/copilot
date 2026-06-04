import { backendUrl, authHeaders, assertOk } from './backendApi';
import authService from './authService';

function mapLines(lines) {
  return (lines || []).map(l => ({ time: l.time, text: l.text, ts: l.ts }));
}

async function jsonOrThrow(res, label) {
  await assertOk(res, label);
  return res.json();
}

export default {
  async createSession(payload) {
    const body = {
      sessionId: payload.sessionId || undefined,
      label: payload.label || '',
      category: payload.category || 'NONE',
      notes: payload.notes || '',
      createdByEmail: authService.getUserEmail() || '',
      startedAt: payload.startedAt || null,
      candidateName: payload.candidateName || '',
      enrollmentId: payload.enrollmentId || '',
      task: payload.task || '',
      interviewDateTime: payload.interviewDateTime || '',
      client: payload.client || '',
      callTaker: payload.callTaker || '',
      vendor: payload.vendor || '',
      duration: payload.duration || '',
      outcome: payload.outcome || '',
      lines: mapLines(payload.lines)
    };
    const res = await fetch(backendUrl('/api/transcriptions/session'), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
    return jsonOrThrow(res, 'Create transcription');
  },

  async checkpoint(id, lines, durationMs) {
    const res = await fetch(backendUrl(`/api/transcriptions/session/${encodeURIComponent(id)}/checkpoint`), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ lines: mapLines(lines), durationMs: durationMs ?? null, updatedByEmail: authService.getUserEmail() || '' })
    });
    return jsonOrThrow(res, 'Save transcription');
  },

  async end(id, lines, durationMs) {
    const res = await fetch(backendUrl(`/api/transcriptions/session/${encodeURIComponent(id)}/end`), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ lines: mapLines(lines), durationMs: durationMs ?? null, updatedByEmail: authService.getUserEmail() || '' })
    });
    return jsonOrThrow(res, 'Finish transcription');
  },

  endOnUnload(id) {
    return fetch(backendUrl(`/api/transcriptions/session/${encodeURIComponent(id)}/end`), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ updatedByEmail: authService.getUserEmail() || '' }),
      keepalive: true
    });
  },

  async continueSession(id) {
    const res = await fetch(backendUrl(`/api/transcriptions/session/${encodeURIComponent(id)}/continue`), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' })
    });
    return jsonOrThrow(res, 'Continue transcription');
  },

  async rename(id, label) {
    const res = await fetch(backendUrl(`/api/transcriptions/session/${encodeURIComponent(id)}/rename`), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ label, updatedByEmail: authService.getUserEmail() || '' })
    });
    return jsonOrThrow(res, 'Rename transcription');
  },

  async list() {
    const res = await fetch(backendUrl('/api/transcriptions/sessions'), { headers: authHeaders() });
    return jsonOrThrow(res, 'Load transcriptions');
  },

  async get(id) {
    const res = await fetch(backendUrl(`/api/transcriptions/session/${encodeURIComponent(id)}`), { headers: authHeaders() });
    return jsonOrThrow(res, 'Load transcription');
  },

  async remove(id) {
    const res = await fetch(backendUrl(`/api/transcriptions/session/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: authHeaders()
    });
    return jsonOrThrow(res, 'Delete transcription');
  }
};
