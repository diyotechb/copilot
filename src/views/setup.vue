<template>
  <el-container class="page-container">
    <el-card class="assistant-card" shadow="hover">
      <h2 class="title">Setup Candidate Assistant</h2>

      <el-form label-position="top" label-width="140px" class="assistant-form">
        <el-form-item label="Candidate Name" required>
          <el-input
            v-model="candidateName"
            placeholder="Enter Candidate Name"
            clearable
            class="input-field"
          />
        </el-form-item>

        <el-form-item label="Paste Resume" required>
          <el-input
            type="textarea"
            :rows="10"
            placeholder="Paste candidate's resume here"
            v-model="resumeText"
            clearable
            class="textarea-field"
          />
        </el-form-item>

        <el-form-item label="Paste Job Description (JD)" required>
          <el-input
            type="textarea"
            :rows="10"
            placeholder="Paste job description here"
            v-model="jdText"
            clearable
            class="textarea-field"
          />
        </el-form-item>

        <el-form-item label="Recruiter Notes">
          <el-input
            type="textarea"
            :rows="6"
            placeholder="Add any notes (optional)"
            v-model="notesText"
            clearable
            class="textarea-field"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="info"
            @click="saveToLocal"
            :disabled="!candidateName || !resumeText || !jdText"
            round
            style="width: 100%;"
          >
            Save Inputs
          </el-button>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :disabled="!isSaved || loading"
            @click="createAssistant"
            class="submit-button"
            round
          >
            {{ loading ? "Creating..." : "Create Assistant" }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </el-container>
</template>

<script>
import OpenAI from "openai";

export default {
  data() {
    return {
      candidateName: "",
      resumeText: "",
      jdText: "",
      notesText: "",
      isSaved: false,
      loading: false
    };
  },
  mounted() {
    this.candidateName = localStorage.getItem("candidateName") || "";
    this.resumeText = localStorage.getItem("resumeText") || "";
    this.jdText = localStorage.getItem("jdText") || "";
    this.notesText = localStorage.getItem("notesText") || "";
    this.isSaved = !!(this.candidateName && this.resumeText && this.jdText);
  },
  methods: {
    saveToLocal() {
      localStorage.setItem("candidateName", this.candidateName);
      localStorage.setItem("resumeText", this.resumeText);
      localStorage.setItem("jdText", this.jdText);
      localStorage.setItem("notesText", this.notesText);
      this.isSaved = true;
      this.$message.success("Inputs saved to localStorage.");
    },

    async createAssistant() {
      this.loading = true;
      const apiKey = process.env.VUE_APP_OPENAPI_TOKEN_KEY;

      try {
        const openai = new OpenAI({
          apiKey,
          dangerouslyAllowBrowser: true,
        });

        const assistant = await openai.beta.assistants.create({
          name: `Interview Assistant - ${this.candidateName}`,
          instructions: `You are an AI assistant conducting interviews. Use the resume, job description, and notes to answer questions in a story-driven and business-relevant format.`,
          model: "gpt-4o"
        });

        const thread = await openai.beta.threads.create();

        const messageContent = `
Resume:
${this.resumeText}

Job Description:
${this.jdText}

Recruiter Notes:
${this.notesText || "None"}
        `.trim();

        await openai.beta.threads.messages.create(thread.id, {
          role: "user",
          content: messageContent
        });

        this.$store.commit("setSession", {
          candidateName: this.candidateName,
          assistantId: assistant.id,
          threadId: thread.id
        });

        this.$message.success("Assistant created successfully!");
        this.$router.push("/assistant");

      } catch (error) {
        console.error("Error creating assistant:", error);
        this.$message.error("Failed to create assistant.");
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.assistant-card {
  width: 600px;
  padding: 2.5rem 3rem;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  background-color: #ffffff;
  transition: transform 0.2s ease-in-out;
}

.assistant-card:hover {
  transform: translateY(-5px);
}

.title {
  font-weight: 700;
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
  color: #3a3a3a;
  letter-spacing: 0.05em;
}

.assistant-form {
  width: 100%;
}

.input-field,
.textarea-field {
  font-size: 1rem;
  background: #f9f9f9;
  border-radius: 6px;
  border: 1px solid #dcdcdc;
  transition: border-color 0.3s ease;
}

.input-field:hover,
.textarea-field:hover,
.input-field:focus-within,
.textarea-field:focus-within {
  border-color: #667eea;
  background: #fff;
}

.submit-button {
  width: 100%;
  font-size: 1.1rem;
  background: #667eea;
  border-color: #667eea;
  box-shadow: 0 8px 15px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.submit-button:hover,
.submit-button:focus {
  background: #5a6bde;
  border-color: #5a6bde;
  box-shadow: 0 10px 20px rgba(90, 107, 222, 0.5);
  color: white;
  cursor: pointer;
}
</style>
