import Vue from 'vue'
import VueRouter from 'vue-router'
import Login from '@/views/Login.vue'
import ResumeSetup from '@/views/ResumeSetup.vue'
import SummaryView from '@/views/SummaryView.vue'
import InterviewView from '@/views/InterviewView.vue'
import UserSessionsView from '@/views/UserSessionsView.vue'
import SummarySessionView from '@/views/SummarySessionView.vue'

Vue.use(VueRouter)

const routes = [
    {
        path: '/',
        name: 'Login',
        component: Login
    },
    {
        path: '/setup',
        name: 'ResumeSetup',
        component: ResumeSetup
    },
    {
        path: '/summary',
        name: 'SummaryView',
        component: SummaryView
    },
    {
        path: '/interview',
        name: 'InterviewView',
        component: InterviewView
    },
    {
        path: '/setting',
        component: ResumeSetup
    },
    {
      path: '/userSession',
      name: 'UserSessionsView',
      component: UserSessionsView
    },
    {
      path: '/summarySession/:sessionId',
      name: 'SummarySessionView',
      component: SummarySessionView
    }
]

const router = new VueRouter({
    routes
})

function isTokenValid(token) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch (e) {
    return false;
  }
}

// Global navigation guard for authentication
router.beforeEach((to, from, next) => {
   const publicPages = ['/', '#/login']; // Add other public routes if needed
  const authRequired = !publicPages.includes(to.path);
  const token = localStorage.getItem('otterAuthToken');

  if (authRequired && !isTokenValid(token)) {
    next('/');
  } else {
    next();
  }
});

export default router
