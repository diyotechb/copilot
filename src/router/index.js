import Vue from 'vue'
import VueRouter from 'vue-router'
import HomeView from '../views/HomeView.vue'
import BedrockView from '@/views/BedrockView.vue'
import OtterAssistant from '@/views/OtterAssistant.vue'
// import Login from '@/views/Login.vue'

Vue.use(VueRouter)

const routes = [
    {
        path: '/',
        name: 'Login',
        component: () => import('@/views/Login.vue')
    },
    {
        path: '/setup',
        name: 'ResumeSetup',
        component: () => import('@/views/ResumeSetup.vue')
    },
    {
        path: '/interview',
        name: 'InterviewView',
        component: () => import('@/views/InterviewView.vue')
    },
    {
        path: '/assistant',
        name: 'bedrock',
        component: BedrockView
    },
    {
        path: '/setting',
        component: () => import(/* webpackChunkName: "about" */ '../views/ResumeSetup.vue')
    },
    {
        path: '/new',
        component: () => import(/* webpackChunkName: "about" */ '../views/Homeview2.vue')
    },
    {
        path: '/view3',
        component: () => import(/* webpackChunkName: "about" */ '../views/HomeView3.vue')
    },
]

const router = new VueRouter({
    routes
})

// Global navigation guard for authentication
router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('otterAuthToken');
    console.log('[Router Guard] Navigating from', from.name, 'to', to.name);
    if (to.name === 'Login') {
        if (token) {
            console.log('[Router Guard] Authenticated, redirecting to ResumeSetup');
            return next({ name: 'ResumeSetup' });
        }
        console.log('[Router Guard] Not authenticated, staying on Login');
        return next();
    }
    if (!token) {
        console.log('[Router Guard] No token, redirecting to Login');
        return next({ name: 'Login' });
    }
    if (to.name === 'InterviewView') {
        const interviewQA = localStorage.getItem('interviewQA');
        console.log('[Router Guard] interviewQA:', interviewQA);
        if (!interviewQA || interviewQA.trim().length === 0) {
            window.alert('Interview questions are not ready. Please complete setup first.');
            console.log('[Router Guard] interviewQA missing, redirecting to ResumeSetup');
            return next({ name: 'ResumeSetup' });
        }
        console.log('[Router Guard] interviewQA found, allowing navigation to InterviewView');
    }
    next();
});

export default router
