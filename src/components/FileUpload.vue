<template>
  <div class="section">
    <h3>{{ label }}</h3>
    <div class="uploader" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop" :class="{ dragging }">
      <p v-if="!text">Drag & drop your {{ label.toLowerCase() }} file here, or</p>
      <input ref="fileInput" type="file" :accept="accept" class="hidden" @change="onFileChange" />
      <button class="btn" @click="openFilePicker">Choose file</button>
    </div>
    <textarea
      v-model="text"
      @paste="onPasteText"
      :placeholder="`Or paste your ${label.toLowerCase()} text here...`"
      class="textarea"
    />
    <div class="resume-info" v-if="file">
      <span>{{ file.name }} ({{ (file.size/1024).toFixed(1) }} KB)</span>
  <button class="clear-btn" @click="clearFile">Clear file</button>
    </div>
  </div>
</template>

<script>
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import mammoth from 'mammoth';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default {
  name: 'FileUpload',
  props: {
    label: { type: String, required: true },
    value: { type: String, default: '' },
    accept: { type: String, default: '.pdf,.doc,.docx,.txt,.md,.rtf' }
  },
  data() {
    return {
      text: this.value,
      file: null,
      dragging: false
    };
  },
 watch: {
    value(newVal) {
      this.text = newVal;
    },
    text(val) {
      this.$emit('input', val);
    }
  },
  methods: {
    openFilePicker() { this.$refs.fileInput.click(); },
    onFileChange(e) { const file = e.target.files[0]; if (file) this.handleFile(file); },
    onDrop(e) {
      this.dragging = false;
      const file = e.dataTransfer.files[0];
      if (file) this.handleFile(file);
    },
    async handleFile(file) {
      this.file = file;
      const ext = file.name.split('.').pop().toLowerCase();
      if (["txt","md","rtf"].includes(ext)) {
        const reader = new FileReader();
        reader.onload = () => { this.text = String(reader.result || ""); };
        reader.readAsText(file);
      } else if (ext === "pdf") {
        this.text = "Extracting text from PDF...";
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const typedarray = new Uint8Array(ev.target.result);
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            let text = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              text += content.items.map(item => item.str).join(" ") + "\n";
            }
            this.text = text.trim();
          } catch (err) {
            this.text = "Failed to extract text from PDF.";
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === "docx") {
        this.text = "Extracting text from DOCX...";
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const arrayBuffer = ev.target.result;
            const result = await mammoth.extractRawText({ arrayBuffer });
            this.text = result.value.trim();
          } catch (err) {
            this.text = "Failed to extract text from DOCX.";
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        this.text = "Unsupported file type.";
      }
    },
    clearFile() {
      this.file = null;
      this.text = "";
    },
    onPasteText() {
      setTimeout(() => { if (this.text.trim()) {/* Optionally auto-upload */} }, 150);
    }
  }
};
</script>

<style scoped>
.uploader {
  margin-bottom: 1rem;
}
.textarea {
  width: 100%;
  min-height: 120px;
  margin-bottom: 0.5rem;
}
.resume-info {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.clear-btn {
  background: #eee;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
}
</style>
