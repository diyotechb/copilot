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
          <el-input type="text" v-model="questionToAsk"  @keyup.enter.native="streamChatGPT(questionToAsk)"
            placeholder="GPT is waiting for input..." style="width: 100%; font-family: monospace" />
          <el-button icon="el-icon-delete" @click="streamChatGPT(questionToAsk)">
            send
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
        <div class="single_part_bottom_bar">
          <el-button icon="el-icon-thumb" @click="askCurrentText" :disabled="!isGetGPTAnswerAvailable">
            Ask GPT
          </el-button>
        </div>
      </div>
    </div>

    <div class="title_function_bar">
      <el-button type="success" @click="startCopilot" v-show="state === 'end'" :loading="copilot_starting"
        :disabled="copilot_starting">
        Start Copilot
      </el-button>
      <el-button :loading="copilot_stopping" @click="userStopCopilot" v-show="state === 'ing'">
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
import config_util from "../utils/config_util";
import { resumeStore } from '../store/resumeStore';
import systemPrompt from "@/prompts/systemPrompt.js";

export default {
  name: "HomeView",
  components: { LoadingIcon, MyTimer },
  data() {
    return {
      questionToAsk: "",
      isListening: false,
      transcript: "",
      currentText: "",
      ai_result: "",
      show_ai_thinking_effect: false,
      state: "end", // 'end' or 'ing'
      copilot_starting: false,
      copilot_stopping: false,
      openai_key: "",
      gpt_model: "gpt-3.5-turbo",
      gpt_system_prompt: "",
      azure_token: "",
      azure_region: "",
      azure_language: ""
    };
  },
  computed: {
    isDevMode() {
      return process.env.NODE_ENV === "development";
    },
    isGetGPTAnswerAvailable() {
      return !!this.currentText;
    }
  },
  async mounted() {
    this.openai_key = process.env.VUE_APP_OPENAPI_TOKEN_KEY;
    this.gpt_system_prompt = config_util.gpt_system_prompt();
    this.gpt_model = config_util.gpt_model();
    this.azure_token = process.env.VUE_APP_AZURE_TOKEN;
    this.azure_region = process.env.VUE_APP_AZURE_REGION;
    this.azure_language = config_util.azure_language();
  },
  beforeDestroy() {
    if (this.recognizer) {
      this.recognizer.close();
      this.recognizer = null;
    }
  },
  methods: {
    async startCopilot() {
      this.copilot_starting = true;
      const token = this.azure_token;
      const region = this.azure_region;
      const language = this.azure_language;
      const openai_key = this.openai_key;

      try {
        if (!openai_key || !token || !region) {
          throw new Error("Missing API keys or region config");
        }

        const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(token, region);
        speechConfig.speechRecognitionLanguage = language;
        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        this.recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

        this.transcript = "";
        this.currentText = "";
        this.ai_result = "";
        this.state = "ing";
        this.show_ai_thinking_effect = false;
        this.$refs.MyTimer.start();

        this.recognizer.recognizing = this.debounce(async (s, e) => {
          const interimText = e.result.text;
          if (interimText && interimText.length > 3) {
            this.transcript = interimText;
            await this.streamChatGPT(interimText);
          }
        }, 1500); // 1.5s debounce

        this.recognizer.recognized = (sender, event) => {
          if (
            SpeechSDK.ResultReason.RecognizedSpeech === event.result.reason &&
            event.result.text
          ) {
            const finalText = event.result.text;
            this.currentText += `\n${finalText}`;
            this.transcript = ""; // clear interim
          }
        };

        this.recognizer.startContinuousRecognitionAsync(
          () => {
            this.copilot_starting = false;
            console.log("Recognition started");
          },
          (err) => {
            this.copilot_starting = false;
            this.currentText = "Start Failed: " + err;
            console.error("Recognition error:", err);
          }
        );
      } catch (e) {
        this.copilot_starting = false;
        this.currentText = "" + e;
      }
    },

    userStopCopilot() {
      this.copilot_stopping = true;
      this.recognizer.stopContinuousRecognitionAsync(
        () => {
          this.copilot_stopping = false;
          this.state = "end";
          this.$refs.MyTimer.stop();
        },
        (err) => {
          console.error("Stop error:", err);
        }
      );
    },

    clearASRContent() {
      this.currentText = "";
      this.transcript = "";
      this.ai_result = "";
    },

    async askCurrentText() {
      const apiKey = this.openai_key;
      if (!apiKey || !this.currentText) return;

      const model = this.gpt_model;
      const prompt = this.gpt_system_prompt;
      this.ai_result = "";
      this.show_ai_thinking_effect = true;

      try {
        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        const stream = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: this.currentText }
          ],
          stream: true
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          this.ai_result += text;
        }
      } catch (e) {
        this.ai_result = "" + e;
      } finally {
        this.show_ai_thinking_effect = false;
      }
    },

    async streamChatGPT(text) {
      const apiKey = this.openai_key;
      if (!apiKey || !text) return;

      const model = this.gpt_model;
      const prompt = this.gpt_system_prompt;
      this.ai_result = "";
      this.show_ai_thinking_effect = true;

      try {

        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        const stream = await openai.chat.completions.create({
          model: model,
          messages: [{
            role: 'system',
            content: systemPrompt(prompt, resumeStore.resumeText),
          }, { role: "user", content: text }],
          stream: true,
        });



        let responseText = "";
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          responseText += delta;
          this.ai_result = responseText;
        }


      } catch (e) {
        this.ai_result = "" + e;
      } finally {
        this.show_ai_thinking_effect = false;
      }
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
