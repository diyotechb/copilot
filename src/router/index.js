import Vue from 'vue'
import VueRouter from 'vue-router'
import HomeView from '../views/HomeView.vue'

Vue.use(VueRouter)

const routes = [
    {
        path: '/',
        name: 'home',
        component: HomeView
    },
    {
        path: '/setting',
        component: () => import(/* webpackChunkName: "about" */ '../views/Setting.vue')
    },
    {
        path: '/new',
        component: () => import(/* webpackChunkName: "about" */ '../views/Homeview2.vue')
    },
    {
        path: '/view3',
        component: () => import(/* webpackChunkName: "about" */ '../views/HomeView3.vue')
    },
    {
        path: '/otter',
        name: 'otter',
        component: () => import('../views/OtterView.vue')
    },
]

const router = new VueRouter({
    routes
})

export default router
