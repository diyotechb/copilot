<template>
  <div id="app">
    <NavBar v-if="showNav" />
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

</style>
<script>
import NavBar from '@/components/NavBar.vue';

export default {
  name: 'App',
  components: { NavBar },
  props: {},
  computed: {
    showNav() {
      // Hide the navbar on Login and InterviewView routes
      const hide = ['Login', 'InterviewView'];
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
}
</style>