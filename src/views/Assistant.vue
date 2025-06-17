<template>
  <div class="homeview_container">
    <div class="center_container">
      <div class="box">
        <div class="func_desc">
          <i class="el-icon-microphone"></i>
          Speech Recognition Results
        </div>
        <div class="asr_content">
          <div style="color: gray" v-if="!currentText && !transcript">No Content</div>
          <div v-if="currentText">
            <pre>{{ currentText }}</pre>
          </div>
          <div v-if="transcript" style="color: #007acc; font-style: italic;">
            (Speaking...) {{ transcript }}
          </div>
        </div>
        <div class="single_part_bottom_bar">
          <el-button icon="el-icon-delete" :disabled="!currentText" @click="clearASRContent">
            Clear Text
          </el-button>
        </div>
        <div class="single_part_bottom_bar">
          <el-input type="text" v-model="questionToAsk" @keyup.enter.native="sendMessageToAssistant(questionToAsk)"
            placeholder="GPT is waiting for input..." style="width: 100%; font-family: monospace" />
          <el-button icon="el-icon-delete" @click="sendMessageToAssistant(questionToAsk)">
            Send
          </el-button>
        </div>
      </div>

      <div class="box" style="border-left: none;">
        <div class="func_desc">
          <i class="el-icon-s-custom"></i>
          GPT Answer
        </div>
        <LoadingIcon v-if="show_ai_thinking_effect" />
        <div class="ai_result_content">{{ ai_result || 'GPT is waiting for input...' }}</div>
      </div>
    </div>

    <div class="title_function_bar">
      <el-button type="success" @click="startInterviewSession" :loading="copilot_starting">
        Start Interview Session
      </el-button>
      <el-button @click="toggleListening" :disabled="!recognizer || state !== 'ing'">
        {{ isListening ? 'Stop Listening' : 'Start Listening' }}
      </el-button>
      <el-button @click="userStopCopilot" v-show="state === 'ing'" :loading="copilot_stopping">
        Stop Copilot
      </el-button>
      <MyTimer ref="MyTimer" />
    </div>
  </div>
</template>

<script>
import LoadingIcon from "@/components/LoadingIcon.vue";
import MyTimer from "@/components/MyTimer.vue";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import OpenAI from "openai";
import systemPrompt from "@/prompts/systemPrompt.js";
import { resumeStore } from '../store/resumeStore';

export default {
  name: "HomeView",
  components: { LoadingIcon, MyTimer },
  data() {
    return {
      questionToAsk: "",
      transcript: "",
      currentText: "",
      ai_result: "",
      show_ai_thinking_effect: false,
      state: "end",
      copilot_starting: false,
      copilot_stopping: false,
      openai_key: "",
      assistantId: "asst_nXaPBJhqlDzszN8fJ7RL3SBq",
      threadId: "",
      resumeText: "",
      jdText: "",
      recognizer: null,
      isListening: false
    };
  },
  async mounted() {
    this.openai_key = process.env.VUE_APP_OPENAPI_TOKEN_KEY;
  },
  methods: {
    async startInterviewSession() {
      this.copilot_starting = true;

      try {
        const openai = new OpenAI({
          apiKey: this.openai_key,
          dangerouslyAllowBrowser: true,
        });

        const resumeText = resumeStore.resumeText;
        const jdText = resumeStore.jdText;
        const instructions = systemPrompt(resumeText, jdText);

        await openai.beta.assistants.update(this.assistantId, { instructions });

        const thread = await openai.beta.threads.create();
        this.threadId = thread.id;

        await openai.beta.threads.messages.create(this.threadId, {
          role: "user",
          content: `Resume:\n${resumeText}\n\nJob Description:\n${jdText}`,
        });

        this.resumeText = resumeText;
        this.jdText = jdText;
        this.state = "ing";
        this.$refs.MyTimer.start();

        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
          process.env.VUE_APP_AZURE_TOKEN,
          process.env.VUE_APP_AZURE_REGION
        );
        speechConfig.speechRecognitionLanguage = "en-US";
        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        this.recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

        this.recognizer.recognizing = this.debounce(async (s, e) => {
          const interimText = e.result.text;
          if (interimText && interimText.length > 3) {
            this.transcript = interimText;
            await this.sendMessageToAssistant(interimText);
          }
        }, 1500);

        this.recognizer.recognized = (sender, event) => {
          if (
            event.result.reason === SpeechSDK.ResultReason.RecognizedSpeech &&
            event.result.text
          ) {
            this.currentText += `\n${event.result.text}`;
            this.transcript = "";
          }
        };

        this.copilot_starting = false;
      } catch (e) {
        console.error("Failed to start session:", e);
        this.copilot_starting = false;
        this.ai_result = "Error: " + e.message;
      }
    },

    toggleListening() {
      if (!this.recognizer || this.state !== "ing") return;

      if (this.isListening) {
        this.recognizer.stopContinuousRecognitionAsync(() => {
          this.isListening = false;
        });
      } else {
        this.recognizer.startContinuousRecognitionAsync(() => {
          this.isListening = true;
        });
      }
    },

    async sendMessageToAssistant(messageText) {
      this.ai_result = "";
      this.show_ai_thinking_effect = true;

      try {
        const openai = new OpenAI({
          apiKey: this.openai_key,
          dangerouslyAllowBrowser: true,
        });

        if (!this.assistantId || !this.threadId) {
          throw new Error("Assistant session not initialized.");
        }

        await openai.beta.threads.messages.create(this.threadId, {
          role: "user",
          content: messageText,
        });

        const stream = await openai.beta.threads.runs.stream(this.threadId, {
          assistant_id: this.assistantId,
        });

        let frameHandle;
        for await (const event of stream) {
          const delta = event.data?.delta?.content?.[0]?.text?.value || "";
          if (delta) {
            cancelAnimationFrame(frameHandle);
            frameHandle = requestAnimationFrame(() => {
              this.ai_result += delta;
              this.show_ai_thinking_effect = false;
            });
          }
        }
      } catch (e) {
        console.error("Streaming Error:", e);
        this.ai_result = "Streaming Error: " + e.message;
      }
    },

    userStopCopilot() {
      this.copilot_stopping = true;
      if (this.recognizer) {
        this.recognizer.stopContinuousRecognitionAsync(
          () => {
            this.state = "end";
            this.copilot_stopping = false;
            this.isListening = false;
            this.$refs.MyTimer.stop();
          },
          (err) => {
            console.error("Stop error:", err);
            this.copilot_stopping = false;
          }
        );
      }
    },

    clearASRContent() {
      this.currentText = "";
      this.transcript = "";
      this.ai_result = "";
    },

    debounce(func, wait) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
  }
};
</script>

<style scoped>
.homeview_container {
  display: flex;
  flex-direction: column;
}

.title_function_bar {
  margin-top: 10px;
  text-align: center;
  margin-bottom: 10px;
}

.center_container {
  flex-grow: 1;
  display: flex;
  height: calc(100vh - 150px);
}

.box {
  flex: 1;
  border: 1px lightgray solid;
  padding: 10px;
  display: flex;
  flex-direction: column;
}

.asr_content {
  overflow-y: auto;
  flex-grow: 1;
}

.asr_content pre {
  white-space: pre-wrap;
  margin-bottom: 10px;
}

.asr_content div[style*="italic"] {
  font-size: 0.95em;
  margin-top: 6px;
}

.func_desc {
  text-align: center;
}

.single_part_bottom_bar {
  display: flex;
}

.single_part_bottom_bar>.el-button {
  flex-grow: 1;
}

.ai_result_content {
  overflow-y: auto;
  flex-grow: 1;
}
</style>
