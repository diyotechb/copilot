<script>
import { getSessionsByUser } from '@/services/backendService';
import UserNavbar from '@/components/UserNavbar.vue';

function getUserIdFromToken() {
  const token = localStorage.getItem('otterAuthToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

export default {
  name: 'UserSessionsView',
  data() {
    return {
      sessions: [],
      loading: true,
    };
  },
  components: {
    UserNavbar,
  },
  async mounted() {
    const userId = getUserIdFromToken();
    if (!userId) {
      this.loading = false;
      return;
    }
    this.sessions = await getSessionsByUser(userId);
    this.loading = false;
  },
  methods: {
    viewSession(sessionId) {
      this.$router.push({ name: 'SummarySessionView', params: { sessionId } });
    }
  }
};
</script>

<template>
  <div>
    <UserNavbar />
    <div class="sessions-main">
      <h2>Your Interview Sessions</h2>
      <div v-if="loading">Loading sessions...</div>
      <div v-else>
        <div v-if="sessions.length === 0" class="no-sessions">
          <p>No previous sessions found.</p>
          <p>Start a new interview to see your sessions here!</p>
        </div>
        <ul v-else>
          <li v-for="session in sessions" :key="session.id" class="session-item">
            <div>
              <strong>Session #{{ session.id }}</strong> <br>
              Date: {{ session.startTime }} <br>
              Type: {{ session.type || 'N/A' }}
            </div>
            <button @click="viewSession(session.id)">View Summary</button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sessions-main {
  max-width: 700px;
  margin: 2rem auto;
  padding: 1rem;
  background: #fafbfc;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(60, 60, 60, 0.08);
}

.session-item {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(60, 60, 60, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-item > div {
  flex: 1;
}

button {
  margin-left: 2rem;
  padding: 0.5rem 1.2rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover {
  background: #1e40af;
}

.no-sessions {
  text-align: center;
  color: #888;
  margin-top: 2rem;
  font-size: 1.15rem;
  background: #fff;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(60, 60, 60, 0.06);
}
</style>