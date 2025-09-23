<template>
  <div>
    <!-- This component tracks user sessions -->
  </div>
</template>
<script>
import { createSession, updateSessionLastActive, endSession } from '@/services/backendService';

export default {
  name: 'SessionTracker',
  data() {
    return {
      sessionId: null,
      startTime: null,
      lastActive: null,
      intervalId: null,
      userId: null 
    };
  },
  async created() {
    this.userId = this.getUserIdFromToken();
    const now = new Date().toISOString();
    console.log('[SessionTracker] Creating session for user:', this.userId);
    const session = await createSession({ userId: this.userId, startTime: now });
    this.sessionId = session.id;
    localStorage.setItem('sessionId', this.sessionId);
    this.startTime = now;
    this.lastActive = now;
    console.log('[SessionTracker] Session created with ID:', this.sessionId);

    // Periodically update lastActive
    this.intervalId = setInterval(async () => {
      const activeTime = new Date().toISOString();
      await updateSessionLastActive(this.sessionId, activeTime);
      this.lastActive = activeTime;
    }, 60000); // every minute

    // End session on tab close
    window.addEventListener('beforeunload', this.handleUnload);
  },
  beforeDestroy() {
    clearInterval(this.intervalId);
    window.removeEventListener('beforeunload', this.handleUnload);
  },
  methods: {
    async handleUnload() {
      if (this.sessionId) {
        await endSession(this.sessionId, new Date().toISOString());
      }
    },
    getUserIdFromToken() {
      const token = localStorage.getItem('otterAuthToken');
      if (!token) return null;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub; // Cognito user ID
      } catch (e) {
        return null;
      }
    }
  }
};
</script>