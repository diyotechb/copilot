let activeEnrollmentId = '';

export function setActiveEnrollmentId(id) {
  activeEnrollmentId = (id || '').toString().trim();
}

export function clearActiveEnrollmentId() {
  activeEnrollmentId = '';
}

export function getActiveEnrollmentId() {
  return activeEnrollmentId;
}
