<template>
  <div class="smart-upload-wrapper">
    <div 
      class="smart-container" 
      :class="{ dragging, 'has-file': !!file }"
      @dragover.prevent="dragging = true" 
      @dragleave.prevent="dragging = false" 
      @drop.prevent="onDrop"
    >
      <!-- Paste Area -->
      <textarea 
        v-model="text" 
        @paste="onPasteText" 
        :placeholder="`Paste your ${label.toLowerCase()} content here...`" 
        class="smart-textarea" 
      />

      <!-- Drag & Drop Overlay -->
      <div v-if="dragging" class="drop-overlay">
        <div class="overlay-content">
          <i class="el-icon-upload"></i>
          <p>Drop to extract text</p>
        </div>
      </div>

      <!-- Action Bar & File Info -->
      <div class="smart-footer">
        <div class="file-info" v-if="file">
          <i class="el-icon-document"></i>
          <span class="file-name">{{ file.name }}</span>
          <button class="remove-file-btn" @click.stop="clearFile" title="Clear file content">
            <i class="el-icon-close"></i>
          </button>
        </div>
        <div class="upload-actions" v-else>
          <span class="action-hint">Drag & drop or</span>
          <button class="browse-btn" @click="openFilePicker">
            <i class="el-icon-folder-opened"></i> browse files
          </button>
        </div>
      </div>

      <input ref="fileInput" type="file" :accept="accept" class="input-hidden" @change="onFileChange" />
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
    text(val) {
      this.$emit('input', val);
    },
    value(val) {
      if (val !== this.text) {
        this.text = val;
      }
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
      if (this.$refs.fileInput) this.$refs.fileInput.value = "";
    },
    onPasteText() {
      // Just emit current state
    }
  }
};
</script>

<style scoped>
.smart-upload-wrapper {
  width: 100%;
}

.smart-container {
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: #fff;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.smart-container:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.smart-container.dragging {
  border-color: #2563eb;
  background: #eff6ff;
}

.smart-textarea {
  width: 100%;
  min-height: 140px;
  padding: 16px;
  border: none;
  font-size: 1rem;
  line-height: 1.6;
  color: #374151;
  background: transparent;
  resize: vertical;
  font-family: inherit;
}

.smart-textarea:focus {
  outline: none;
}

/* Drop Overlay */
.drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(37, 99, 235, 0.9);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}

.overlay-content {
  text-align: center;
}

.overlay-content i {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.overlay-content p {
  margin: 0;
  font-weight: 700;
  font-size: 1.1rem;
}

/* Footer Section */
.smart-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 8px 16px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #e0f2fe;
  color: #0369a1;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.file-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-file-btn {
  background: none;
  border: none;
  color: #0369a1;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  opacity: 0.7;
}

.remove-file-btn:hover {
  opacity: 1;
}

.upload-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #64748b;
}

.browse-btn {
  background: none;
  border: none;
  color: #2563eb;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 5px;
}

.browse-btn:hover {
  background: #eff6ff;
  text-decoration: underline;
}

.input-hidden {
  display: none;
}
</style>
