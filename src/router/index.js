import Vue from 'vue'
import VueRouter from 'vue-router'
import HomeView from '../views/HomeView.vue'
import BedrockView from '@/views/BedrockView.vue'
import OtterAssistant from '@/views/OtterAssistant.vue'

Vue.use(VueRouter)

const routes = [
    {
        path: '/',
        name: 'home',
        component: OtterAssistant
    },
      {
        path: '/assistant',
        name: 'bedrock',
        component: BedrockView
    },
    {
        path: '/setting',
        component: () => import(/* webpackChunkName: "about" */ '../views/Setting.vue')
    },
]

const router = new VueRouter({
    routes
})

export default router
