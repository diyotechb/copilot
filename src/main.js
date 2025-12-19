import Vue from 'vue'
import App from './App.vue'
import router from './router'
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
Vue.use(ElementUI);
Vue.config.productionTip = false

// Ensure login endpoint is set at build/runtime. Fail fast if missing.
const loginEndpoint = process.env.VUE_APP_LOGIN_ENDPOINT;
if (!loginEndpoint) {
  throw new Error('VUE_APP_LOGIN_ENDPOINT is not defined in the environment. Please set it in your .env file.');
}

const assemblyAIToken = process.env.VUE_APP_ASSEMBLY_AI_TOKEN;
if (!assemblyAIToken) {
  throw new Error('VUE_APP_ASSEMBLY_AI_TOKEN is not defined in the environment. Please set it in your .env file.');
}

const azureToken = process.env.VUE_APP_AZURE_TOKEN;
if (!azureToken) {
  throw new Error('VUE_APP_AZURE_TOKEN is not defined in the environment. Please set it in your .env file.');
}

const openAIToken = process.env.VUE_APP_OPENAPI_TOKEN_KEY;
if (!openAIToken) {
  throw new Error('VUE_APP_OPENAPI_TOKEN_KEY is not defined in the environment. Please set it in your .env file.');
}

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
