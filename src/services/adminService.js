import { backendUrl, authHeaders, assertOk } from './backendApi';

// Fetches /api/admin/status. Gated server-side by STAFF role —
// non-staff users get a 401/403 and the AdminStatus view falls
// back to a 'not authorized' message.
export async function fetchAdminStatus() {
  const response = await fetch(backendUrl('/api/admin/status'), {
    method: 'GET',
    headers: authHeaders()
  });
  await assertOk(response, 'Admin status');
  return response.json();
}

export async function fetchAdminDetails() {
  const response = await fetch(backendUrl('/api/admin/details'), {
    method: 'GET',
    headers: authHeaders()
  });
  await assertOk(response, 'Admin details');
  return response.json();
}
