import Vue from 'vue'
import App from './App.vue'
import router from './router'
import ElementUI from 'element-ui';
import locale from 'element-ui/lib/locale/lang/en';
import 'element-ui/lib/theme-chalk/index.css';
import '@/assets/styles/element-theme-override.css';
import storageService from '@/services/storageService';
import { logStorageEstimate } from '@/store/recordingStore';
import { discardLegacyLocalInterviews } from '@/store/interviewHistoryStore';
Vue.use(ElementUI, { locale });
Vue.config.productionTip = false

storageService.clearTranscriptionHistory();
discardLegacyLocalInterviews();

// One-shot console summary of IndexedDB usage. Cheap, no UI, just makes
// growth visible without DevTools digging.
logStorageEstimate('app start');

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
