import Vue from 'vue'
import VueRouter from 'vue-router'
import Login from '@/views/Login.vue'
import Signup from '@/views/Signup.vue'
import ResetPassword from '@/views/ResetPassword.vue'
import ResumeSetup from '@/views/ResumeSetup.vue'
import SummaryView from '@/views/SummaryView.vue'
import InterviewView from '@/views/InterviewView.vue'
import LiveTranscriptView from '@/views/LiveTranscription.vue'
import { getInterviewQA } from '@/store/interviewStore'
import TranscriptionsView from '@/views/TranscriptionsView.vue';
import authService from '@/services/authService';

Vue.use(VueRouter)

const routes = [
  { path: '/', name: 'Login', component: Login },
  { path: '/signup', name: 'Signup', component: Signup },
  { path: '/reset-password', name: 'ResetPassword', component: ResetPassword },
  { path: '/setup', name: 'ResumeSetup', component: ResumeSetup },
  { path: '/summary', name: 'SummaryView', component: SummaryView },
  { path: '/interview', name: 'InterviewView', component: InterviewView },
  { path: '/liveTranscription', name: 'LiveTranscriptView', component: LiveTranscriptView },
  { path: '/setting', name: 'Setting', component: ResumeSetup },
  { path: '/transcriptions', name: 'TranscriptionsView', component: TranscriptionsView }
]

const router = new VueRouter({ routes })

// Global navigation guard for authentication
router.beforeEach(async (to, from, next) => {
  const isLoggedIn = authService.isLoggedIn();
  const publicPages = ['Login', 'Signup', 'ResetPassword'];
  const authRequired = !publicPages.includes(to.name);

  if (to.name === 'Login' && isLoggedIn) {
    return next({ name: 'ResumeSetup' });
  }

  if (authRequired && !isLoggedIn) {
    return next({ name: 'Login' });
  }

  if (to.name === 'InterviewView') {
    const interviewQA = await getInterviewQA();
    if (!interviewQA || interviewQA.length === 0) {
      window.alert('Interview questions are not ready. Please complete setup first.');
      return next({ name: 'ResumeSetup' });
    }
  }
  next();
});

export default router
