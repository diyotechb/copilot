<template>
  <div id="app">
    <div class="nav-container">
      <el-menu :default-active="$router.currentRoute.path" mode="horizontal" :router="true" class="responsive-menu">
        <el-menu-item index="/">Interview Copilot</el-menu-item>
        <el-menu-item index="/setting">Setting</el-menu-item>
        <el-menu-item index="/view3">Beta</el-menu-item>
        <el-menu-item index="/otter">Otter</el-menu-item>
      </el-menu>
    </div>
    <router-view class="router_view"/>
  </div>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

body {
    margin: 0;
    padding: 0;
}

.nav-container {
    overflow-x: auto; /* Scrollable menu on mobile */
    -webkit-overflow-scrolling: touch;
}

.responsive-menu {
    border-bottom: solid 1px #e6e6e6;
    display: flex; /* Ensure items stay in row for scroll */
    min-width: max-content; /* Force width to fit content */
}

/* Adjust element ui menu item padding for mobile */
@media (max-width: 600px) {
    .el-menu-item {
        padding: 0 15px !important;
    }
}
</style>
<script>
import {mapGetters} from 'vuex';

export default {
  name: 'App',
  props: {},
  computed: {},
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
      margin-top: 0; /* Less margin on mobile */
  }
}
</style>