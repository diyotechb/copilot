<template>
  <div>
  <UserNavbar />
  <div class="summary-main">
    <h2>Session #{{ sessionId }} Summary</h2>
    <div v-if="loading">Loading interviews...</div>
    <div v-else>
      <InterviewSummaryList
        :interviews="interviews"
        :showBackButton="true"
        @back="$router.push({ name: 'UserSessionsView' })"
      />
    </div>
  </div>
  </div>
</template>

<script>
import { getInterviewsBySession } from '@/services/backendService';
import InterviewSummaryList from '@/components/InterviewSummaryList.vue';
import UserNavbar from '@/components/UserNavbar.vue';

export default {
  name: 'SummarySessionView',
  components: {
    InterviewSummaryList,
    UserNavbar
  },
  data() {
    return {
      interviews: [],
      loading: true,
      sessionId: this.$route.params.sessionId
    };
  },
  async mounted() {
    this.interviews = await getInterviewsBySession(this.sessionId);
    this.loading = false;
  }
};
</script>

<style scoped>
.summary-main { max-width: 700px; margin: 2rem auto; }
</style>