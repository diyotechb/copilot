import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
    // Vuex store/index.js
    state: {
        candidateName: localStorage.getItem('candidateName') || '',
        assistantId: localStorage.getItem('assistantId') || '',
        threadId: localStorage.getItem('threadId') || ''
    },
    mutations: {
        setSession(state, payload) {
            state.candidateName = payload.candidateName;
            state.assistantId = payload.assistantId;
            state.threadId = payload.threadId;
            localStorage.setItem('candidateName', payload.candidateName);
            localStorage.setItem('assistantId', payload.assistantId);
            localStorage.setItem('threadId', payload.threadId);
        }
    }
    ,
    getters: {
    },
    actions: {
    },
    modules: {}
})
