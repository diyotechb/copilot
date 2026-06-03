import Vue from 'vue'
import VueRouter from 'vue-router'
import { Message } from 'element-ui'
import Login from '@/views/auth/Login.vue'
import Signup from '@/views/auth/Signup.vue'
import ResetPassword from '@/views/auth/ResetPassword.vue'
import Unauthorized from '@/views/Unauthorized.vue'
import { getInterviewQA, getInterviewMeta } from '@/store/interviewStore'
import authService from '@/services/authService';
import storageService from '@/services/storageService';
import { ROLE_GROUPS, hasAnyRole } from '@/constants/roles';

// Heavy authenticated views are lazy-loaded so the initial bundle only
// carries auth-flow pages (Login/Signup/ResetPassword/Unauthorized). On
// authenticated entry, the destination chunk loads in parallel with route
// resolution. Webpack chunk names make the network panel easier to read.
const HomeView          = () => import(/* webpackChunkName: "home" */          '@/views/HomeView.vue')
const ResumeSetup       = () => import(/* webpackChunkName: "resume-setup" */  '@/views/ResumeSetup.vue')
const SummaryView       = () => import(/* webpackChunkName: "summary" */       '@/views/SummaryView.vue')
const InterviewView     = () => import(/* webpackChunkName: "interview" */     '@/views/InterviewView.vue')
const MyInterviews      = () => import(/* webpackChunkName: "my-interviews" */ '@/views/MyInterviews.vue')
const TranscriptionsView= () => import(/* webpackChunkName: "transcriptions" */'@/views/TranscriptionsView.vue')
const ProfileSettings   = () => import(/* webpackChunkName: "profile" */       '@/views/ProfileSettings.vue')
const AdminStatus       = () => import(/* webpackChunkName: "admin" */         '@/views/admin/AdminStatus.vue')
const LiveAssistView = () => import(/* webpackChunkName: "live-assist" */ '@/views/LiveAssistView.vue')
const LiveAssistSessionsView = () => import(/* webpackChunkName: "live-assist-sessions" */ '@/views/LiveAssistSessionsView.vue')

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
      allowedRoles: ROLE_GROUPS.ALL_AUTHORIZED
    }
  },
  {
    path: '/summary',
    name: 'SummaryView',
    component: SummaryView,
    // Pass ?sessionId=… as the `sessionId` prop so SummaryView can render
    // a saved history entry instead of the live session.
    props: route => ({ sessionId: route.query.sessionId || '' }),
    meta: {
      requiresAuth: true,
      allowedRoles: ROLE_GROUPS.ALL_AUTHORIZED
    }
  },
  {
    path: '/interviews',
    name: 'MyInterviews',
    component: MyInterviews,
    meta: {
      requiresAuth: true,
      allowedRoles: ROLE_GROUPS.ALL_AUTHORIZED
    }
  },
  {
    path: '/interview',
    name: 'InterviewView',
    component: InterviewView,
    meta: {
      requiresAuth: true,
      allowedRoles: ROLE_GROUPS.ALL_AUTHORIZED
    }
  },
  {
    path: '/setting',
    name: 'Setting',
    component: ResumeSetup,
    meta: {
      requiresAuth: true,
      allowedRoles: ROLE_GROUPS.ALL_AUTHORIZED
    }
  },
  {
    path: '/transcriptions',
    name: 'TranscriptionsView',
    component: TranscriptionsView,
    meta: {
      requiresAuth: true,
      allowedRoles: ROLE_GROUPS.TRANSCRIPTION_ACCESS
    }
  },
  {
    path: '/profile',
    name: 'ProfileSettings',
    component: ProfileSettings,
    meta: {
      requiresAuth: true,
      allowedRoles: ROLE_GROUPS.ALL_AUTHORIZED
    }
  },
  {
    path: '/admin',
    name: 'AdminStatus',
    component: AdminStatus,
    meta: {
      requiresAuth: true,
      allowedRoles: ROLE_GROUPS.STAFF
    }
  },
  {
    path: '/live-assist',
    name: 'LiveAssist',
    component: LiveAssistView,
    meta: {
      requiresAuth: true,
      allowedRoles: ROLE_GROUPS.STAFF
    }
  },
  {
    path: '/live-assist/sessions',
    name: 'LiveAssistSessions',
    component: LiveAssistSessionsView,
    meta: {
      requiresAuth: true,
      allowedRoles: ROLE_GROUPS.STAFF
    }
  }
]

const router = new VueRouter({ routes })

const AUTH_BYPASS = process.env.VUE_APP_BYPASS_AUTH === 'true';

// Global navigation guard
router.beforeEach(async (to, from, next) => {
  const isLoggedIn = AUTH_BYPASS || authService.isLoggedIn();
  const userRoles = AUTH_BYPASS ? ['DIYO_EMP'] : authService.getUserRoles();

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
    if (!hasAnyRole(userRoles, requiredRoles)) {
      return next({ name: 'Unauthorized' });
    }
  }

  // 4. Special Interview logic — allow entry while questions are
  // still generating (InterviewView's onboarding overlay parks the
  // user). Only block deep-link / no-setup entry.
  if (to.name === 'InterviewView') {
    const [interviewQA, meta] = await Promise.all([
      getInterviewQA(),
      getInterviewMeta()
    ]);
    const hasQA = Array.isArray(interviewQA) && interviewQA.length > 0;
    const sessionStarted = meta && meta.startedAt;
    if (!hasQA && !sessionStarted) {
      Message.warning({
        message: 'Please complete setup first.',
        duration: 4000
      });
      return next({ name: 'ResumeSetup' });
    }
  }

  next();
});

export default router
