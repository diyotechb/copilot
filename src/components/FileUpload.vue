<template>
  <div class="smart-upload-wrapper">
    <div 
      class="smart-container" 
      :class="{ dragging, 'has-file': !!file }"
      @dragover.prevent="dragging = true" 
      @dragleave.prevent="dragging = false" 
      @drop.prevent="onDrop"
    >
      <!-- Paste Area: hidden pre-generation in AI mode so the keywords
           section takes the full height. Becomes visible (and editable)
           the moment we have any content (generated or typed). -->
      <textarea
        v-show="!hideTextarea"
        v-model="text"
        @paste="onPasteText"
        :placeholder="textareaPlaceholder"
        :disabled="generating"
        class="smart-textarea"
      />

      <!-- Drag & Drop Overlay -->
      <div v-if="dragging && !aiMode" class="drop-overlay">
        <div class="overlay-content">
          <i class="el-icon-upload"></i>
          <p>Drop to extract text</p>
        </div>
      </div>

      <!-- Action Bar — AI generation mode -->
      <div v-if="aiMode" class="smart-footer ai-footer" :class="{ 'ai-footer-expanded': hideTextarea }">
        <div v-if="hideTextarea" class="ai-intro">
          <i class="el-icon-magic-stick ai-intro-icon"></i>
          <div class="ai-intro-text">
            <strong>Create a sample {{ label.toLowerCase() }}</strong>
            <p>Add a few keywords below and click <em>Generate with AI</em>. You can edit the result after.</p>
          </div>
        </div>
        <input
          ref="keywordsInput"
          v-model="keywords"
          type="text"
          class="ai-keywords-input"
          :placeholder="`Keywords (e.g., ${keywordsExample})`"
          :disabled="generating"
          @keydown.enter.prevent="emitGenerate"
        />
        <div class="ai-footer-actions">
          <button
            type="button"
            class="ai-generate-btn"
            :disabled="generating"
            @click="emitGenerate"
          >
            <i :class="generating ? 'el-icon-loading' : 'el-icon-magic-stick'"></i>
            <span>{{ generating ? 'Generating…' : (text ? 'Regenerate' : 'Generate with AI') }}</span>
          </button>
        </div>
      </div>

      <!-- Action Bar — File upload mode (default) -->
      <div v-else class="smart-footer">
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

    <p v-if="aiMode" class="ai-hint">
      <i class="el-icon-info"></i>
      Optional. Add details like your name, company, role, or years of experience to personalize the result.
    </p>
  </div>
</template>

<script>

export default {
  name: 'FileUpload',
  props: {
    label: { type: String, required: true },
    value: { type: String, default: '' },
    accept: { type: String, default: '.pdf,.doc,.docx,.txt,.md,.rtf' },
    aiMode: { type: Boolean, default: false },
    generating: { type: Boolean, default: false },
    keywordsExample: { type: String, default: 'frontend, 5 years, fintech' }
  },
  data() {
    return {
      text: this.value,
      file: null,
      dragging: false,
      keywords: ''
    };
  },
  computed: {
    // The textarea is hidden in AI mode while there's nothing to show yet.
    // Once content arrives (from Generate, paste, or file drop) it appears
    // and is fully editable. During generation we keep it visible so the
    // "Generating …" placeholder is shown.
    hideTextarea() {
      return this.aiMode && !this.text && !this.generating;
    },
    textareaPlaceholder() {
      if (this.generating) return `Generating ${this.label.toLowerCase()}…`;
      if (this.aiMode) {
        return `Edit the generated ${this.label.toLowerCase()} freely, or regenerate with new keywords below.`;
      }
      return `Paste your ${this.label.toLowerCase()} content here...`;
    }
  },
  watch: {
    text(val) {
      this.$emit('input', val);
    },
    value(val) {
      if (val !== this.text) {
        this.text = val;
      }
    },
    aiMode(on) {
      // When the user flips AI mode on with an empty textarea, focus the
      // keywords input so the next thing they touch is the right one.
      if (on && !this.text) {
        this.$nextTick(() => {
          if (this.$refs.keywordsInput) this.$refs.keywordsInput.focus();
        });
      }
    }
  },
  methods: {
    emitGenerate() {
      if (this.generating) return;
      this.$emit('generate', { keywords: this.keywords.trim() });
    },
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
            const pdfjsLib = await import('pdfjs-dist/build/pdf');
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
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
            console.error('PDF extraction error:', err);
            this.text = "Failed to extract text from PDF.";
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === "docx") {
        this.text = "Extracting text from DOCX...";
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const { default: mammoth } = await import('mammoth');
            const arrayBuffer = ev.target.result;
            const result = await mammoth.extractRawText({ arrayBuffer });
            this.text = result.value.trim();
          } catch (err) {
            console.error('DOCX extraction error:', err);
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

/* AI generation footer */
.ai-footer {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  padding: 12px 16px;
}

/* Expanded state: textarea is hidden, so the AI footer fills the
   container with breathing room and a clear intro. */
.ai-footer-expanded {
  background: #fff;
  padding: 28px 24px;
  gap: 16px;
  min-height: 180px;
  justify-content: center;
}

.ai-intro {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ai-intro-icon {
  font-size: 1.4rem;
  color: #2563eb;
  flex-shrink: 0;
  margin-top: 2px;
}

.ai-intro-text strong {
  display: block;
  font-size: 1rem;
  color: #1f2937;
  margin-bottom: 4px;
}

.ai-intro-text p {
  margin: 0;
  font-size: 0.88rem;
  color: #6b7280;
  line-height: 1.5;
}

.ai-intro-text em {
  font-style: normal;
  font-weight: 600;
  color: #2563eb;
}

.ai-keywords-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  color: #374151;
  background: #fff;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ai-keywords-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.ai-keywords-input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.ai-footer-actions {
  display: flex;
  justify-content: flex-end;
}

.ai-generate-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s, opacity 0.15s;
}

.ai-generate-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.ai-generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Disabled state: only used while a request is in flight */
.smart-textarea:disabled {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.ai-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 4px 0;
  font-size: 0.8rem;
  color: #6b7280;
  font-style: italic;
}

.ai-hint i {
  font-size: 0.95rem;
  color: #9ca3af;
}
</style>
