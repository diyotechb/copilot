<template>
  <div class="transcript-card" @click="$emit('click')">
    <div class="card-header">
      <h3 class="card-title">{{ item.title || 'Note' }}</h3>
      <div class="card-meta">
        <span class="card-date">{{ item.dateStr }}</span>
        <i class="el-icon-delete delete-btn" @click.stop="$emit('delete')"></i>
      </div>
    </div>
    <div class="card-body">
      <p :class="{ 'empty-preview': !previewText }">
        {{ previewText || 'Empty transcript' }}
      </p>
    </div>
  </div>
</template>

<script>
import transcriptService from '@/services/transcriptService';

export default {
  name: 'TranscriptCard',
  props: {
    item: {
      type: Object,
      required: true
    }
  },
  computed: {
    previewText() {
      return transcriptService.getPreviewText(this.item.lines);
    }
  }
}
</script>

<style scoped>
.transcript-card {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  min-height: 30px;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.transcript-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08);
  border-color: #c6e2ff;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-title {
  font-weight: 700;
  font-size: 1.1em;
  color: #2c3e50;
  margin: 0;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-date {
  font-size: 0.8em;
  color: #999;
}

.delete-btn {
  color: #e4e7ed;
  cursor: pointer;
  padding: 5px;
}

.delete-btn:hover {
  color: #f56c6c;
}

.card-body p {
  margin: 0;
  color: #606266;
  font-size: 1.15rem;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-preview {
  color: #c0c4cc !important;
  font-style: italic;
}
</style>
