<template>
  <div class="app-container">
    <!-- Video Recorder Preview -->
    <div class="video-recorder" style="margin-bottom:1rem;">
      <video ref="videoPreview" autoplay playsinline muted width="320" height="240" style="border-radius:8px;" v-show="interviewing"></video>
      <div v-if="recordedVideoUrl && !interviewing" style="margin-top:0.5rem;">
        <video :src="recordedVideoUrl" controls width="320" height="240" style="border-radius:8px;"></video>
        <a :href="recordedVideoUrl" download="interview.mp4" class="btn" style="margin-top:0.5rem;">Download Recording</a>
      </div>
    </div>
    <div class="main-card">
      <!-- Question area -->
      <div class="section">
        <h2 class="subtitle">Question</h2>
        <p>{{ currentQuestion }}</p>
      </div>
      <!-- Answer area -->
      <div class="section answer">
        <h2 class="subtitle">Answer</h2>
        <div class="answer-body" v-if="showAnswer">{{ currentAnswer }}</div>
        <div v-else-if="interviewing && isThinking" class="answer-body thinking-effect">
          <span>Thinking<span class="dots"><span>.</span><span>.</span><span>.</span></span></span>
        </div>
        <div v-else class="answer-body" style="color:#aaa;font-style:italic;">(Answer will appear after question is read)</div>
        <div v-if="answerTranscripts.length">
          <h3 style="margin-top:1rem;">Transcripts:</h3>
          <ul>
            <li v-for="(t, idx) in answerTranscripts" :key="idx" style="margin-bottom:0.5rem;">
              <strong>Answer {{ idx+1 }}:</strong> {{ t }}
            </li>
          </ul>
        </div>
      </div>
      <!-- Start/Next/Stop buttons -->
      <div class="actions">
        <button v-if="resumeReady && !interviewing" class="btn start" @click="startInterview">Start Interview</button>
        <button class="btn next" :disabled="!interviewing" @click="nextQuestion">Next Question</button>
  <button v-if="interviewing" class="btn stop" @click="stopInterview">Stop Interview</button>
      </div>
    </div>
    <!-- Resume sidebar -->
    <div class="sidebar">
      <h2 class="subtitle">Candidate Resume</h2>
      <div
        class="uploader"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
        :class="{ dragging }"
      >
        <p v-if="!resumeText">Drag & drop your resume file here, or</p>
        <input
          ref="fileInput"
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md,.rtf"
          class="hidden"
          @change="onFileChange"
        />
        <button class="btn" @click="openFilePicker">Choose file</button>
      </div>
      <textarea
        v-model="resumeText"
        @paste="onPasteResume"
        placeholder="Or paste your resume text here..."
        class="textarea"
      />
      <div class="resume-info" v-if="resumeFile">
        <span>{{ resumeFile.name }} ({{ (resumeFile.size/1024).toFixed(1) }} KB)</span>
        <button class="clear-btn" @click="clearResume">✕</button>
      </div>
      <button class="btn upload-btn" :disabled="!resumeText || uploading" @click="sendResume">
        {{ uploading ? 'Uploading…' : 'Upload Resume' }}
      </button>
      <div class="ready" v-if="resumeReady">
        <span class="badge ready">Resume ready ✓</span>
      </div>
    </div>
  </div>
</template>
<script setup>


// --- Interview state ---
// ...existing code...

// --- Interview state ---
import { ref, watch, onMounted, onUnmounted } from 'vue';
import OpenAI from 'openai';
const isThinking = ref(false);
const currentAnswer = ref('The AI generated answer or candidate answer will appear here...');
const currentQuestion = ref('Your interview question will appear here...');
const showAnswer = ref(true); // default true for initial state
const interviewing = ref(false);
const resumeReady = ref(false);
let streamTimer = null;
const turn = ref(0);
let qaHistory = [];
const qaBatch = ref([]);
const answerTranscripts = ref([]);

const isRecordingAnswer = ref(false);
let answerMediaRecorder = null;
let answerAudioChunks = [];
const answerAudioBlobs = ref([]); 

// --- Per-answer audio recording state ---
function startAnswerRecording() {
  if (isRecordingAnswer.value) return;
  isRecordingAnswer.value = true;
  answerAudioChunks = [];
  console.log('[Answer Recording] Starting audio recording for answer', turn.value);
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      try {
        answerMediaRecorder = new MediaRecorder(stream);
      } catch (err) {
        console.error('Error initializing MediaRecorder:', err);
        isRecordingAnswer.value = false;
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      answerMediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) answerAudioChunks.push(e.data);
      };
      answerMediaRecorder.onstop = async () => {
        let idx = turn.value-1;
        try {
          const blob = new Blob(answerAudioChunks);
          answerAudioBlobs.value[idx] = blob;
          console.log('[Answer Recording] Stopped recording for answer', idx+1, 'Blob size:', blob.size);
          // Azure STT API call after each recording
          const subscriptionKey = process.env.VUE_APP_AZURE_SPEECH_KEY;
          const region = process.env.VUE_APP_AZURE_SPEECH_REGION;
          if (!subscriptionKey || !region) {
            answerTranscripts.value[idx] = 'Azure Speech config missing';
          } else {
            const endpoint = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;
            let contentType = blob.type || 'audio/webm';
            if (contentType !== 'audio/wav' && contentType !== 'audio/ogg' && contentType !== 'audio/webm') {
              contentType = 'audio/webm';
            }
            console.log(`[Azure STT] Sending blob for answer ${idx+1}, size: ${blob.size}, type: ${contentType}`);
            try {
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Ocp-Apim-Subscription-Key': subscriptionKey,
                  'Content-Type': contentType,
                  'Accept': 'application/json',
                },
                body: blob
              });
              console.log(`[Azure STT] Response for answer ${idx+1}:`, response);
              if (!response.ok) throw new Error('Azure STT failed: ' + response.status + ' ' + response.statusText);
              const result = await response.json();
              console.log(`[Azure STT] Result for answer ${idx+1}:`, result);
              answerTranscripts.value[idx] = result.DisplayText || '(No transcript)';
              console.log(`[Azure STT] Transcript for answer ${idx+1}:`, answerTranscripts.value[idx]);
            } catch (e) {
              console.error(`[Azure STT] Error for answer ${idx+1}:`, e);
              answerTranscripts.value[idx] = 'Error: ' + e.message;
            }
          }
        } catch (err) {
          console.error('Error creating audio blob:', err);
        }
        stream.getTracks().forEach(track => track.stop());
        isRecordingAnswer.value = false;
      };
      answerMediaRecorder.start();
      console.log('[Answer Recording] MediaRecorder started');
    })
    .catch(err => {
      console.error('Error accessing microphone:', err);
      isRecordingAnswer.value = false;
    });
}

function stopAnswerRecording() {
  console.log('[Answer Recording] stopAnswerRecording called. isRecordingAnswer:', isRecordingAnswer.value, 'answerMediaRecorder:', answerMediaRecorder ? answerMediaRecorder.state : 'null');
  if (isRecordingAnswer.value && answerMediaRecorder && answerMediaRecorder.state !== 'inactive') {
    try {
      answerMediaRecorder.stop();
      console.log('[Answer Recording] MediaRecorder.stop() called for answer', turn.value);
    } catch (err) {
      console.error('Error stopping answerMediaRecorder:', err);
    }
  }
}

onUnmounted(() => {
  stopAnswerRecording();
  stopVideoRecording();
  if (videoPreview.value) videoPreview.value.srcObject = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
});

watch(showAnswer, (val) => {
  if (interviewing.value && val) {
    startAnswerRecording();
  }
});

// --- Video Recorder State ---
const videoPreview = ref(null);
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
const recordedVideoUrl = ref('');

async function startVideoRecording() {
  recordedVideoUrl.value = '';
  recordedChunks = [];
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (videoPreview.value) {
      videoPreview.value.srcObject = mediaStream;
    }
    // Dynamically select the best MIME type for MediaRecorder
    let options = {};
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      options.mimeType = 'video/webm;codecs=vp8';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      options.mimeType = 'video/webm';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      options.mimeType = 'video/mp4';
    }
    mediaRecorder = new MediaRecorder(mediaStream, options);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
        console.log('Chunk size:', e.data.size);
      }
    };
    mediaRecorder.onerror = (err) => {
      console.error('MediaRecorder error:', err);
    };
    mediaRecorder.onwarning = (warn) => {
      console.warn('MediaRecorder warning:', warn);
    };
    mediaRecorder.onstop = () => {
      // Use default MIME type for best compatibility
      const blob = new Blob(recordedChunks);
      console.log('Final blob size:', blob.size);
      recordedVideoUrl.value = URL.createObjectURL(blob);
      if (videoPreview.value) videoPreview.value.srcObject = null;
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }
    };
    mediaRecorder.start();
    // Wait a moment to ensure recording has started
    return new Promise(resolve => setTimeout(resolve, 300));
  } catch (err) {
    console.error('Could not start video recording:', err);
    return Promise.resolve();
  }
}

function stopVideoRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    // Allow a short delay for graceful stop
    setTimeout(() => {
      mediaRecorder.stop();
    }, 500);
  }
}

onUnmounted(() => {
  stopVideoRecording();
  if (videoPreview.value) videoPreview.value.srcObject = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
});

// --- Main content state ---
// ...existing code...

onMounted(() => {
  showAnswer.value = true;
  // If you want a sample initial answer, set it here:
  // currentAnswer.value = 'The AI generated answer or candidate answer will appear here...';
});

// Azure Speech Service TTS
async function speakQuestion(text, onEnd) {
  const subscriptionKey = process.env.VUE_APP_AZURE_SPEECH_KEY;
  const region = process.env.VUE_APP_AZURE_SPEECH_REGION;
  if (!subscriptionKey || !region) {
    // Fallback to browser TTS if Azure not configured
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.lang = 'en-US';
      utter.rate = 1.05;
      utter.onend = onEnd;
      window.speechSynthesis.speak(utter);
      return;
    }
    if (typeof onEnd === 'function') onEnd();
    return;
  }
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `
    <speak version='1.0' xml:lang='en-US'>
      <voice xml:lang='en-US' xml:gender='Female' name='en-US-AdamMultilingualNeural'>
        ${text}
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
        'User-Agent': 'OtterAssistantVue'
      },
      body: ssml
    });
    if (!response.ok) throw new Error('Azure TTS failed');
    const audioData = await response.arrayBuffer();
    const blob = new Blob([audioData], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = onEnd;
    audio.play();
  } catch (e) {
    console.error('Azure TTS error:', e);
    if (typeof onEnd === 'function') onEnd();
  }
}

// --- Resume upload/paste ---
const dragging = ref(false);
const resumeFile = ref(null);
const resumeText = ref('');
const fileInput = ref(null);
const uploading = ref(false);

// --- Interview (Option B: one-by-one, adaptive; mocked locally for now) ---
// ...existing code...

function openFilePicker() { fileInput.value?.click(); }
function onFileChange(e) { const file = e.target.files[0]; if (file) handleFile(file); }
function onDrop(e) {
  dragging.value = false;
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
}

function handleFile(file) {
  resumeFile.value = file;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'txt' || ext === 'md' || ext === 'rtf') {
    const reader = new FileReader();
    reader.onload = () => { 
      resumeText.value = String(reader.result || '');
    };
    reader.readAsText(file);
  } else if (ext === 'pdf') {
    import('pdfjs-dist/legacy/build/pdf').then(pdfjsLib => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const reader = new FileReader();
      reader.onload = async () => {
        const typedarray = new Uint8Array(reader.result);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(' ') + '\n';
        }
        resumeText.value = text;
      };
      reader.readAsArrayBuffer(file);
    }).catch(err => { console.error('PDF import error:', err); });
  } else if (ext === 'docx') {
    import('mammoth').then(mammoth => {
      const reader = new FileReader();
      reader.onload = async () => {
        const arrayBuffer = reader.result;
        const { value } = await mammoth.extractRawText({ arrayBuffer });
        resumeText.value = value;
      };
      reader.readAsArrayBuffer(file);
    });
  } else {
    resumeText.value = 'Unsupported file type.';
  }
}

function clearResume() {
  resumeFile.value = null;
  resumeText.value = '';
  resumeReady.value = false;
}

async function sendResume() {
  if (!resumeText.value || uploading.value) return;
  uploading.value = true;
  resumeReady.value = false;
  currentAnswer.value = '';
  qaBatch.value = [];
  try {
    const apiKey = process.env.VUE_APP_OPENAPI_TOKEN_KEY;
    if (!apiKey) throw new Error('You should setup an OpenAI Key!');

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    // Request a batch of Q/A pairs (e.g., 30)
    const prompt = `Here is the candidate's resume:\n${resumeText.value}\nGenerate 30 unique interview questions and sample answers.\n- The questions should be a mix of technical and behavioral (soft skills, teamwork, leadership, problem solving, communication, etc).\n- For each question, provide a detailed, descriptive, and lengthier sample answer (at least 5-8 sentences).\n- Format as:\nQuestion 1: ...\nAnswer 1: ...\nQuestion 2: ...\nAnswer 2: ...\n...`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an interview assistant. Generate multiple interview questions and answers from the candidate’s resume.' },
        { role: 'user', content: prompt }
      ],
      stream: false,
    });
    qaBatch.value = parseBatchQA(completion.choices[0].message.content);
    resumeReady.value = qaBatch.value.length > 0;
    if (!interviewing.value) {
      currentAnswer.value = '';
      currentQuestion.value = '';
      showAnswer.value = false;
    }
  } catch (e) {
    currentAnswer.value = 'Error: ' + e.message;
  } finally {
    uploading.value = false;
  }
}

async function startInterview() {
  interviewing.value = true;
  turn.value = 0;
  qaHistory = [];
  await startVideoRecording(); // Wait for permissions and recording to start
  nextQuestion(); // Only ask the first question after recording starts
}

async function stopInterview() {
  interviewing.value = false;
  clearStream();
  stopVideoRecording();
  stopAnswerRecording();
  currentQuestion.value = 'Interview stopped.';
  currentAnswer.value = '';

  // No longer needed: API call now happens after each recording
}

function nextQuestion() {
  if (!interviewing.value) return;
  if (turn.value >= qaBatch.value.length) {
    window.alert('Interview finished!');
    interviewing.value = false;
    clearStream();
    stopVideoRecording();
    currentQuestion.value = 'Interview finished.';
    currentAnswer.value = '';
    showAnswer.value = false;
    return;
  }
  clearStream();
  showAnswer.value = false;
  isThinking.value = false;
  const qa = qaBatch.value[turn.value];
  currentQuestion.value = qa.question;
  currentAnswer.value = '';
  qaHistory.push(qa);
  turn.value++;
  stopAnswerRecording();
  speakQuestion(qa.question, () => {
    const delay = interviewing.value ? Math.floor(Math.random() * 1000) + 1000 : 0;
    if (interviewing.value && delay > 0) {
      isThinking.value = true;
    }
    setTimeout(() => {
      showAnswer.value = true;
      isThinking.value = false;
      if (interviewing.value) {
        streamLocalAnswer(qa.answer);
      } else {
        currentAnswer.value = qa.answer;
      }
    }, delay);
  });
}

function streamLocalAnswer(text) {
  const chars = [...(text || '')];
  let i = 0;
  function typeChunk() {
    if (i >= chars.length) {
      clearStream();
      return;
    }
    currentAnswer.value += chars.slice(i, i+3).join('');
    i += 3;
    const delay = Math.floor(Math.random() * 80) + 40;
    streamTimer = setTimeout(typeChunk, delay);
  }
  typeChunk();
}

function clearStream() {
  if (streamTimer) { clearInterval(streamTimer); streamTimer = null; }
}

function onPasteResume() {
  setTimeout(() => { if (resumeText.value.trim()) sendResume(); }, 150);
}

function parseBatchQA(content) {
  const qaPairs = [];
  const regex = /Question\s*\d*\s*:(.*?)\nAnswer\s*\d*\s*:(.*?)(?=\nQuestion|$)/gs;
  let match;
  while ((match = regex.exec(content)) !== null) {
    qaPairs.push({ question: match[1].trim(), answer: match[2].trim() });
  }
  if (qaPairs.length === 0 && content.trim()) {
    qaPairs.push({ question: content.trim(), answer: '' });
  }
  return qaPairs;
}
</script>

<style scoped>
.app-container {
  display: flex;
  gap: 1.5rem;
  padding: 1.5rem;
  background: #f9fafb;
  min-height: 100vh;
}

.main-card {
  flex: 2;
  background: #fff;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
}

.sidebar {
  flex: 1;
  background: #fff;
  border-radius: 1rem;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.title {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
}

.subtitle {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.section {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.answer { min-height: 180px; }
.answer-body { white-space: pre-wrap; }

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: auto;
}

.btn { padding: 0.5rem 1rem; border-radius: 0.75rem; font-size: 0.9rem; border: none; cursor: pointer; color: #fff; }
.btn.start { background: #10b981; }
.btn.next { background: #2563eb; }
.btn.stop { background: #ef4444; }

.textarea {
  width: 100%; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 0.5rem; font-size: 0.85rem; min-height: 120px; margin-top: 0.75rem;
}

.uploader { border: 2px dashed #e5e7eb; border-radius: 0.75rem; padding: 1rem; text-align: center; background: #fafafa; }
.uploader.dragging { background: #f0f9ff; border-color: #93c5fd; }

.resume-info { margin-top: 0.5rem; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center; }
.clear-btn { background: none; border: none; cursor: pointer; color: #ef4444; }

.ready { margin-top: 0.5rem; }
.badge.ready { display:inline-block; padding: .25rem .5rem; border-radius: 9999px; background: #d1fae5; color: #065f46; font-size: .8rem; }
.upload-btn {
  background-color: #28a745;   /* green */
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.upload-btn:hover:not(:disabled) {
  background-color: #218838;   /* darker green */
}

.upload-btn:disabled {
  background-color: #a5d6a7;
  cursor: not-allowed;
}

/* Thinking effect animation */
.thinking-effect {
  color: #2563eb;
  font-style: italic;
  font-size: 1.1em;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
}
.thinking-effect .dots {
  display: inline-block;
  animation: dots 1.5s infinite;
}
.thinking-effect .dots span {
  animation: blink 1.2s infinite;
  opacity: 0.3;
  margin-left: 2px;
}
.thinking-effect .dots span:nth-child(2) {
  animation-delay: 0.4s;
}
.thinking-effect .dots span:nth-child(3) {
  animation-delay: 0.8s;
}
@keyframes dots {
  0%, 20% { opacity: 0; }
  40% { opacity: 1; }
  60% { opacity: 1; }
  80%, 100% { opacity: 0; }
}
@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}
</style>
