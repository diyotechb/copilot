<template>
  <el-container style="height: 100vh; justify-content: center; align-items: center;">
    <el-card class="box-card" style="width: 400px; margin: auto;">
      <div slot="header" class="clearfix">
        <span style="font-size: 18px;">Login</span>
      </div>
      <el-form :model="form" label-width="100px">
        <el-form-item label="Username">
          <el-input v-model="form.email" autocomplete="off" />
        </el-form-item>
        <el-form-item label="Password">
          <el-input v-model="form.password" type="password" autocomplete="off" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="login" style="width: 100%;">Login</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </el-container>
</template>

<script>
export default {
  data() {
    return {
      form: {
        email: "bishwo@diyotech.net",
        password: "Kalimati@123%"
      }
    };
  },
  methods: {
    async login() {
      try {
        console.log(this.fo)
        const res = await fetch("http://localhost:5000/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(this.form)
        });

        if (res.ok) {
          this.$router.push("/setup");
        } else {
          this.$message.error("Login failed");
        }
      } catch (error) {
        this.$message.error("Error connecting to server");
      }
    }
  }
};
</script>
