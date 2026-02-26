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

import Unauthorized from '@/views/Unauthorized.vue'

Vue.use(VueRouter)

// Silence navigation failure errors (Redirection / Duplication) globally to avoid runtime overlays
const originalPush = VueRouter.prototype.push
VueRouter.prototype.push = function push(location, onResolve, onReject) {
  if (onResolve || onReject) return originalPush.call(this, location, onResolve, onReject)
  return originalPush.call(this, location).catch(err => {
    if (VueRouter.isNavigationFailure(err)) return err
    return Promise.reject(err)
  })
}

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/signup',
    name: 'Signup',
    component: Signup
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: ResetPassword
  },
  {
    path: '/unauthorized',
    name: 'Unauthorized',
    component: Unauthorized
  },
  {
    path: '/setup',
    name: 'ResumeSetup',
    component: ResumeSetup,
    meta: {
      requiresAuth: true,
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'DIYO_EMP', 'COPILOT_USER', 'DIYO_EXTERNAL']
    }
  },
  {
    path: '/summary',
    name: 'SummaryView',
    component: SummaryView,
    meta: {
      requiresAuth: true,
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'DIYO_EMP', 'COPILOT_USER', 'DIYO_EXTERNAL']
    }
  },
  {
    path: '/interview',
    name: 'InterviewView',
    component: InterviewView,
    meta: {
      requiresAuth: true,
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'DIYO_EMP', 'COPILOT_USER', 'DIYO_EXTERNAL']
    }
  },
  {
    path: '/setting',
    name: 'Setting',
    component: ResumeSetup,
    meta: {
      requiresAuth: true,
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'DIYO_EMP', 'COPILOT_USER', 'DIYO_EXTERNAL']
    }
  },
  {
    path: '/transcriptions',
    name: 'TranscriptionsView',
    component: TranscriptionsView,
    meta: {
      requiresAuth: true,
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'DIYO_EMP']
    }
  }
]

const router = new VueRouter({ routes })

// Global navigation guard
router.beforeEach(async (to, from, next) => {
  const isLoggedIn = authService.isLoggedIn();
  const userRoles = authService.getUserRoles(); // returns array

  // 1. Check Authentication
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!isLoggedIn) {
      return next({ name: 'Login' });
    }
  }

  // 2. Redirect logged-in users away from auth pages
  const authPages = ['Login', 'Signup', 'ResetPassword'];
  if (authPages.includes(to.name) && isLoggedIn) {
    return next({ name: 'Home' });
  }

  // 3. Check Authorization (Roles)
  const requiredRoles = to.meta.allowedRoles;
  if (requiredRoles && requiredRoles.length > 0) {
    // Robust role checking: Ensure array and normalize to uppercase
    const rawRoles = authService.getUserRoles();
    const userRoles = Array.isArray(rawRoles) ? rawRoles : (typeof rawRoles === 'string' ? [rawRoles] : []);
    const normalizedUserRoles = userRoles.map(r => String(r).trim().toUpperCase());
    const normalizedRequiredRoles = requiredRoles.map(r => String(r).trim().toUpperCase());

    const hasRole = normalizedUserRoles.some(role => normalizedRequiredRoles.includes(role));
    if (!hasRole) {
      return next({ name: 'Unauthorized' });
    }
  }

  // 4. Special Interview logic
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
