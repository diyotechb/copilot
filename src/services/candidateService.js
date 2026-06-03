import { APP_CONFIG } from '@/constants/appConfig';
import authService from './authService';

const BASE_URL = APP_CONFIG.SERVICES.DIYO_SERVICE_URL;

export async function fetchCandidatesByDate(date) {
  const token = authService.getToken();
  const res = await fetch(`${BASE_URL}/api/admin/active-marketing/date?date=${encodeURIComponent(date)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    throw new Error(`Failed to load candidates (${res.status})`);
  }
  const data = await res.json();
  const list = Array.isArray(data) ? data : [];
  return list.map(c => ({
    id: c.id,
    fullName: c.fullName || '',
    enrollmentId: c.enrollmentId != null ? String(c.enrollmentId) : '',
    task: c.task || '',
    dateTime: c.dateTime || '',
    client: c.client || '',
    callTaker: c.callTaker || '',
    vendor: c.vendor || '',
    duration: c.duration != null ? String(c.duration) : '',
    outcome: c.outcome || ''
  }));
}
