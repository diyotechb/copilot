import Vue from 'vue'
import VueRouter from 'vue-router'
import Login from '@/views/auth/Login.vue'
import Signup from '@/views/auth/Signup.vue'
import ResetPassword from '@/views/auth/ResetPassword.vue'
import ResumeSetup from '@/views/ResumeSetup.vue'
import SummaryView from '@/views/SummaryView.vue'
import InterviewView from '@/views/InterviewView.vue'
import { getInterviewQA } from '@/store/interviewStore'
import TranscriptionsView from '@/views/TranscriptionsView.vue';
import HomeView from '@/views/HomeView.vue';
import authService from '@/services/authService';

Vue.use(VueRouter)

const routes = [
  { path: '/', name: 'Home', component: HomeView },
  { path: '/login', name: 'Login', component: Login },
  // NOTE: Keep Signup and ResetPassword routes even if hidden from Login UI.
  // Users should be able to access these directly via URL.
  { path: '/signup', name: 'Signup', component: Signup },
  { path: '/reset-password', name: 'ResetPassword', component: ResetPassword },
  { path: '/setup', name: 'ResumeSetup', component: ResumeSetup },
  { path: '/summary', name: 'SummaryView', component: SummaryView },
  { path: '/interview', name: 'InterviewView', component: InterviewView },
  { path: '/setting', name: 'Setting', component: ResumeSetup },
  { path: '/transcriptions', name: 'TranscriptionsView', component: TranscriptionsView }
]

const router = new VueRouter({ routes })

// Global navigation guard for authentication
router.beforeEach(async (to, from, next) => {
  const isLoggedIn = authService.isLoggedIn();
  const publicPages = ['Login', 'Signup', 'ResetPassword', 'Home'];
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
