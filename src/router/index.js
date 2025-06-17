import Vue from 'vue'
import VueRouter from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/login.vue'
Vue.use(VueRouter)

const routes = [
     {
        path: '/',
        name: 'login',
        component: LoginView
    },
    {
        path: '/readytouse',
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
        path: '/setup',
        component: () => import(/* webpackChunkName: "about" */ '../views/setup.vue')
    },
    {
        path: '/assistant',
        component: () => import(/* webpackChunkName: "about" */ '../views/Assistant.vue')
    },

]

const router = new VueRouter({
    routes
})

export default router
