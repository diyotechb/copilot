<template>
  <div class="resume-setup-container">
    <div class="top-actions">
      <button class="btn otter-btn" @click="$router.push({ name: 'OtterView' })">Open Otter Live</button>
    </div>
    <template v-if="!loadingQA && !qaReady">
      <h2>Resume & Interviewer Voice Setup</h2>
      <FileUpload
        label="Resume"
        @input="resumeText = $event"
      />
      <FileUpload
        label="Job Description"
        @input="jobDescriptionText = $event"
      />
      <div class="section">
        <h3>Select Interviewer Voice</h3>
        <select v-model="selectedVoice" class="voice-select" @change="onVoiceChange" :disabled="voicesLoading">
          <option value="" disabled>Select a voice</option>
          <option v-for="voice in voices" :key="voice.ShortName || voice.shortName" :value="voice.ShortName || voice.shortName">
            {{ (voice.ShortName || voice.Name || '').split('-').slice(-1)[0] }}<span v-if="voice.Gender || voice.gender"> ({{ voice.Gender || voice.gender }})</span>
          </option>
        </select>
      </div>
      <div class="section">
        <h3>Interview Difficulty</h3>
        <select v-model="interviewDifficulty" class="difficulty-select" @change="onDifficultyChange">
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
        </select>
      </div>
      <div class="section">
        <label style="display:flex;align-items:center;gap:0.75rem;cursor:pointer;">
          <span
            @click="toggleVideo"
            :style="{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: enableVideo ? '#2563eb' : '#e5e7eb',
              color: enableVideo ? '#fff' : '#888',
              fontSize: '1.5rem',
              boxShadow: enableVideo ? '0 2px 8px rgba(37,99,235,0.12)' : 'none',
              border: enableVideo ? '2px solid #2563eb' : '2px solid #e5e7eb',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }"
            title="Toggle video recording"
          >
            <svg v-if="enableVideo" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M4 5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1.382l2.447 1.632A1 1 0 0 0 18 13V7a1 1 0 0 0-1.553-.816L14 7.382V6a2 2 0 0 0-2-2H4zm0 2h7v6H4V7z"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M4 5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1.382l2.447 1.632A1 1 0 0 0 18 13V7a1 1 0 0 0-1.553-.816L14 7.382V6a2 2 0 0 0-2-2H4zm0 2h7v6H4V7zm10.707 7.293-12-12-1.414 1.414 12 12 1.414-1.414z"/></svg>
          </span>
          <span>{{ enableVideo ? 'Video recording enabled' : 'Video recording disabled' }}</span>
        </label>
      </div>
      <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
        <button class="btn submit-btn"
          :disabled="!resumeText || !selectedVoice || loadingQA || voicesLoading"
          @click="submitSetup">
          Submit
        </button>
      </div>
      <div v-if="submitSent" class="submit-message">
        <div class="loader" style="margin-bottom:1.5rem;"></div>
        <div style="color:#2563eb; font-weight:600; font-size:1.1rem;">Submitting your setup and generating interview questions...</div>
      </div>
    </template>
    <template v-else-if="loadingQA">
      <div style="margin-top:3rem; text-align:center;">
        <div class="loader" style="margin-bottom:1.5rem;"></div>
        <div style="color:#2563eb; font-weight:600; font-size:1.2rem;">Waiting for interview questions...</div>
      </div>
    </template>
    <template v-else-if="qaReady">
      <InterviewInstructions @startInterview="handleStartInterview" />
    </template>
  </div>
</template>

<script>
import FileUpload from '../components/FileUpload.vue';
import InterviewInstructions from './InterviewInstructions.vue';
import { saveSetting, getSetting } from '@/store/settingStore';
import { generateInterviewQA } from '../services/openaiService.js';
import { clearRecordingsStore } from '@/store/recordingStore.js';
import { clearInterviewQAStore, clearTranscriptsStore } from '@/store/interviewStore';

export default {
  name: 'ResumeSetup',
  components: { FileUpload, InterviewInstructions },
  data() {
    return {
      resumeText: '',
      voices: [],
      selectedVoice: '',
      jobDescriptionText: '',
      uploading: false,
      loadingQA: false,
      qaReady: false,
      submitSent: false,
      answerFontSize: 22,
      interviewQA: [],
      enableVideo: false,
      interviewDifficulty: 'Beginner',
      voicesLoading: false,
    };
  },
  async mounted() {
    this.fetchVoices();
    clearRecordingsStore();
    clearInterviewQAStore();
    clearTranscriptsStore();
    this.enableVideo = await getSetting('enableVideo');
    const savedVoice = await getSetting('selectedVoice');
      if (savedVoice) {
      this.selectedVoice = savedVoice;
    }
    const savedDifficulty = await getSetting('interviewDifficulty');
    if (savedDifficulty) {
      this.interviewDifficulty = savedDifficulty;
    }
  },
  methods: {
    toggleVideo() {
      this.enableVideo = !this.enableVideo;
      saveSetting('enableVideo', this.enableVideo);
    },
    onVoiceChange() {
      if (this.selectedVoice) {
        this.playVoiceSample(this.selectedVoice);
      }
    },
    onDifficultyChange() {
      saveSetting('interviewDifficulty', this.interviewDifficulty);
    },
    async fetchVoices() {
      this.voicesLoading = true;
      const subscriptionKey = process.env.VUE_APP_AZURE_SPEECH_KEY;
      const region = process.env.VUE_APP_AZURE_SPEECH_REGION;
      if (!subscriptionKey || !region) return;
      const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey
          }
        });
        const allVoices = await response.json();
        this.voices = allVoices.filter(v => (v.Locale || v.locale) === 'en-US');
      } catch (e) {
        this.voices = [];
      } finally {
        this.voicesLoading = false;
      }
    },
    async playVoiceSample(voiceName) {
      const subscriptionKey = process.env.VUE_APP_AZURE_SPEECH_KEY;
      const region = process.env.VUE_APP_AZURE_SPEECH_REGION;
      if (!subscriptionKey || !region) return;
      const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
      const ssml = `
        <speak version='1.0' xml:lang='en-US'>
          <voice xml:lang='en-US' name='${voiceName}'>
            This is a sample of the selected Azure voice.
          </voice>
        </speak>
      `;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
            'User-Agent': 'ResumeSetupVue'
          },
          body: ssml
        });
        if (!response.ok) throw new Error('Azure TTS failed');
        const audioData = await response.arrayBuffer();
        const blob = new Blob([audioData], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
      } catch (e) {
        alert('Could not play sample for this voice.');
      }
    },
    async submitSetup() {
      this.submitSent = true;
      this.loadingQA = true;
      this.qaReady = false;

      await saveSetting('selectedVoice', this.selectedVoice);
      try {
        this.interviewQA = await generateInterviewQA({
          resumeText: this.resumeText,
          jobDescriptionText: this.jobDescriptionText
        }); 
        this.qaReady = true;
      } catch (e) {
        console.error('Failed to generate interview questions:', e);
        window.alert('Failed to generate interview questions.');
      } finally {
        this.loadingQA = false;
        this.submitSent = false;
      }
    },
    async handleStartInterview() {
      const mediaConstraints = this.enableVideo ? { video: true, audio: true } : { audio: true };
      navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(() => {
          if (!this.interviewQA || this.interviewQA.length === 0) {
            window.alert('Interview questions are not ready. Please try again or contact support.');
            return;
          }
          this.$router.push({ name: 'InterviewView' });
        })
        .catch(() => {
          if (this.enableVideo) {
            window.alert('Camera and microphone permission denied. Please allow access to start the interview.');
          } else {
            window.alert('Microphone permission denied. Please allow access to start the interview.');
          }
        });
    },
    goToInterview() {
      this.$router.push({ name: 'InterviewView' });
    },
  }
};
</script>

<style scoped>
.loader {
  border: 6px solid #e5e7eb;
  border-top: 6px solid #2563eb;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.resume-setup-container {
  max-width: 480px;
  margin: 2rem auto;
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 2rem;
}
/* Top actions */
.top-actions { display:flex; justify-content:flex-start; margin-bottom: 1rem; }
.btn.otter-btn { background:#0ea5e9; color:#fff; border:none; padding:0.65rem 1.25rem; border-radius:12px; cursor:pointer; font-weight:700; margin-right: 0.75rem; font-size:1.05rem; box-shadow: 0 6px 18px rgba(2,132,199,0.16); min-width:160px; text-align:center; }
.btn.otter-btn:hover { background:#0284c7; transform: translateY(-1px); }
.section { margin-bottom: 2rem; }
.uploader { border: 2px dashed #e5e7eb; border-radius: 0.75rem; padding: 1rem; text-align: center; background: #fafafa; }
.uploader.dragging { background: #f0f9ff; border-color: #93c5fd; }
.textarea {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  min-height: 120px;
  margin-top: 0.75rem;
  background: #f9fafb;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 4px 16px rgba(37,99,235,0.08);
  outline: none;
}
.resume-setup-container {
  background: #fff;
  border-radius: 1.5rem;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  padding: 2.5rem 2rem;
  max-width: 700px;
  margin: 2rem auto;
}
.section {
  background: #f6f8fa;
  border-radius: 1rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
}
.voice-select {
  border-radius: 0.75rem;
  padding: 0.5rem 1rem;
  border: 1px solid #e5e7eb;
  font-size: 1rem;
  background: #fff;
  margin-bottom: 1rem;
}
.btn.submit-btn {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 0.9rem 2rem;
  border-radius: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 1.5rem;
  box-shadow: 0 2px 8px rgba(37,99,235,0.08);
  transition: background 0.2s, box-shadow 0.2s;
}
.btn.submit-btn:disabled {
  background: #a5b4fc;
  cursor: not-allowed;
  box-shadow: none;
}
.resume-info { margin-top: 0.5rem; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center; }
.clear-btn { background: none; border: none; cursor: pointer; color: #ef4444; }
.voice-select { width: 100%; padding: 0.5rem; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 1rem; margin-top: 0.5rem; }
.btn.submit-btn { background: #2563eb; color: #fff; border: none; padding: 0.7rem 1.2rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 1.5rem; }
.btn.submit-btn:disabled { background: #a5b4fc; cursor: not-allowed; }
.submit-message {
  margin-top: 2rem;
  text-align: center;
}
.section .sample-answer {
  font-weight: 500;
  background: #f3f4f6;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  display: inline-block;
}
.difficulty-select {
  border-radius: 0.75rem;
  padding: 0.5rem 1rem;
  border: 1px solid #e5e7eb;
  font-size: 1rem;
  background: #fff;
  margin-bottom: 1rem;
  width: 100%;
}
</style>
