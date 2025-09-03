import Vue from 'vue'
import VueRouter from 'vue-router'
import Login from '@/views/Login.vue'
import ResumeSetup from '@/views/ResumeSetup.vue'
import SummaryView from '@/views/SummaryView.vue'
import InterviewView from '@/views/InterviewView.vue'

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
    }
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
