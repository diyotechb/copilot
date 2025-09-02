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
    if (to.name === 'Login') {
        if (token) {
            return next({ name: 'ResumeSetup' });
        }
        return next();
    }
    if (!token) {
        return next({ name: 'Login' });
    }
    if (to.name === 'InterviewView') {
        const interviewQA = localStorage.getItem('interviewQA');
        if (!interviewQA || interviewQA.trim().length === 0) {
            window.alert('Interview questions are not ready. Please complete setup first.');
            return next({ name: 'ResumeSetup' });
        }
    }
    next();
});

export default router
