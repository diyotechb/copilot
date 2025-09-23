<template>
  <div id="app">
    <el-menu :default-active="$router.currentRoute.path" mode="horizontal" :router="true">
      <!-- Remove any tab or navigation related to Otter Assistant -->
    </el-menu>
    <router-view class="router_view"/>
    <SessionTracker v-if="isAuthenticated"/>
  </div>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

</style>
<script>
import SessionTracker from './components/SessionTracker.vue';

export default {
  name: 'App',
  props: {},
  components: { SessionTracker },
  computed: {
    isAuthenticated() {
      const token = localStorage.getItem('otterAuthToken');
      if (!token) return false;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload && payload.sub;
      } catch {
        return false;
      }
    }
  },
  beforeMount() {
  },
  mounted() {

  },
  data() {
    return {
      activeIndex: "/"
    }
  },
  methods: {}


}

</script>
<style>
.router_view {
  margin-top: 10px;
}
</style>