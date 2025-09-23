import Vue from 'vue'
import App from './App.vue'
import router from './router'
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import { Amplify } from 'aws-amplify';



Amplify.configure({
  Auth: {
    Cognito: {
      region: process.env.VUE_APP_COGNITO_REGION,
      userPoolId: process.env.VUE_APP_COGNITO_USER_POOL_ID,
      userPoolClientId: process.env.VUE_APP_COGNITO_CLIENT_ID,
      loginWith: {
        oauth: {
          domain: process.env.VUE_APP_COGNITO_DOMAIN, // e.g. your-app.auth.us-east-1.amazoncognito.com
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [process.env.NODE_ENV === 'production'
            ? process.env.VUE_APP_COGNITO_CALLBACK_URL_PROD
            : process.env.VUE_APP_COGNITO_CALLBACK_URL_DEV],
          redirectSignOut: [process.env.NODE_ENV === 'production'
            ? process.env.VUE_APP_COGNITO_SIGNOUT_URL_PROD
            : process.env.VUE_APP_COGNITO_SIGNOUT_URL_DEV],
          responseType: 'code' 
        }
      }
    }
  }
});


Vue.use(ElementUI);
Vue.config.productionTip = false

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')