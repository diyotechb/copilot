import Vue from 'vue'
import App from './App.vue'
import router from './router'
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import { logStorageEstimate } from '@/store/recordingStore';
Vue.use(ElementUI);
Vue.config.productionTip = false

// One-shot console summary of IndexedDB usage. Cheap, no UI, just makes
// growth visible without DevTools digging.
logStorageEstimate('app start');

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
