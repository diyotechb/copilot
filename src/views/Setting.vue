<!-- <template>
  <div class="p-4">
    <h2>Paste Resume Summary</h2>
    <textarea v-model="resumeStore.resumeText" rows="15" class="w-full border p-2"></textarea>
  </div>
</template>

<script setup>
import { resumeStore } from '../store/resumeStore';
</script> -->

<template>
  <div class="resume-settings">
    <el-card class="box-card">
      <div slot="header" class="card-header">
        <span>Paste Resume Summary</span>
      </div>

      <el-input
        type="textarea"
        :rows="15"
        v-model="resumeStore.resumeText"
        placeholder="Paste your resume summary here..."
        resize="none"
        clearable
      ></el-input>

      <div class="card-footer">
        <el-button type="primary" @click="handleSave">Save</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { resumeStore } from '../store/resumeStore';

function handleSave() {
  // Optional: Save or give feedback
  ElMessage({
    message: 'Resume saved successfully!',
    type: 'success'
  });
}
</script>

<style scoped>
.resume-settings {
  max-width: 800px;
  margin: 40px auto;
  padding: 20px;
}

.card-header {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.card-footer {
  text-align: right;
  margin-top: 20px;
}
</style>
