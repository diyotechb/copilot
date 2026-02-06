<template>
  <div id="app">
    <NavBar v-if="showNav" />
    <router-view class="router_view"/>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  width: 100%;
  overflow-x: hidden;
}

body {
  margin: 0;
  padding: 0;
  width: 100%;
  overflow-x: hidden;
}

/* Adjust element ui menu item padding for mobile */
@media (max-width: 600px) {
    .el-menu-item {
        padding: 0 15px !important;
    }
}
</style>
<script>
import NavBar from '@/components/NavBar.vue';

export default {
  name: 'App',
  components: { NavBar },
  props: {},
  computed: {
    showNav() {
      const hide = ['Login', 'Signup', 'ResetPassword', 'InterviewView'];
      return !hide.includes(this.$route.name);
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
  width: 100%;
}
@media (max-width: 600px) {
  .router_view {
      margin-top: 0;
  }
}
</style>