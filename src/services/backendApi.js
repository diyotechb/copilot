import { APP_CONFIG } from '@/constants/appConfig';
import authService from './authService';
import router from '@/router';

export function backendUrl(path) {
  const base = APP_CONFIG.SERVICES.COPILOT_BACKEND_URL;
  if (!base) {
    throw new Error('Copilot backend URL is missing (set VUE_APP_SERVER_URL or VUE_APP_COPILOT_BACKEND_URL).');
  }
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
}

export function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = authService.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// Returns true and triggers a redirect when the response is a 401.
// Callers should bail out (throw / return) after a true result.
export function handleAuthFailure(response) {
  if (response && response.status === 401) {
    authService.logout();
    const current = router && router.currentRoute && router.currentRoute.fullPath;
    router.push({
      name: 'Login',
      query: current && current !== '/login' ? { redirect: current } : undefined
    }).catch(() => { /* duplicate navigation is fine */ });
    return true;
  }
  return false;
}

// Common gate after a backend fetch. Handles 401 (redirect), 429 (friendly
// rate-limit message), and generic !ok with parsed detail. Throws on
// failure; returns the response when ok so caller can read the body.
export async function assertOk(response, label) {
  if (handleAuthFailure(response)) {
    throw new Error('Your session has ended. Please sign in again.');
  }
  if (response.status === 429) {
    const retry = response.headers.get('Retry-After');
    const seconds = retry && !isNaN(Number(retry)) ? Number(retry) : null;
    throw new Error(seconds
      ? `Too many requests. Please wait about ${seconds} seconds and try again.`
      : 'Too many requests. Please wait a moment and try again.');
  }
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.clone().json();
      detail = body.error || body.message || '';
    } catch (e) { /* not json or empty */ }
    throw new Error(`${label} failed (${response.status})${detail ? ': ' + detail : ''}`);
  }
  return response;
}
