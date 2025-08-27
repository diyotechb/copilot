<template>
  <div class="app-container">
    <div class="main-card">
      <!-- Question area -->
      <div class="section">
        <h2 class="subtitle">Question</h2>
        <p>{{ currentQuestion }}</p>
      </div>

      <!-- Answer area -->
      <div class="section answer">
        <h2 class="subtitle">Answer</h2>
        <div class="answer-body">{{ currentAnswer }}</div>
      </div>

      <!-- Start/Next/Stop buttons -->
      <div class="actions">
        <button class="btn start" :disabled="!resumeReady || interviewing" @click="startInterview">Start Interview</button>
        <button class="btn next" :disabled="!interviewing" @click="nextQuestion">Next Question</button>
        <button class="btn stop" :disabled="!interviewing" @click="stopInterview">Stop Interview</button>
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
import { ref } from 'vue'

// --- Main content state ---
const currentQuestion = ref('Your interview question will appear here...')
const currentAnswer = ref('The AI generated answer or candidate answer will appear here...')

// --- Resume upload/paste ---
const dragging = ref(false)
const resumeFile = ref(null)
const resumeText = ref('')
const fileInput = ref(null)
const uploading = ref(false)

// --- Interview (Option B: one-by-one, adaptive; mocked locally for now) ---
const interviewing = ref(false)
const resumeReady = ref(false)
let streamTimer = null
let turn = 0

function openFilePicker() { fileInput.value?.click() }
function onFileChange(e) { const file = e.target.files[0]; if (file) handleFile(file) }
function onDrop(e) {
  dragging.value = false
  const file = e.dataTransfer.files[0]
  if (file) handleFile(file)
}
function handleFile(file) {
  resumeFile.value = file
  const reader = new FileReader()
  reader.onload = () => { resumeText.value = String(reader.result || '') }
  reader.readAsText(file)
}

function clearResume() {
  resumeFile.value = null
  resumeText.value = ''
  resumeReady.value = false
}

async function sendResume() {
  if (!resumeText.value || uploading.value) return
  uploading.value = true
  resumeReady.value = false
  currentAnswer.value = ""  // or ai_result if you’re using that
  try {
    const apiKey = import.meta.env.VUE_APP_OPENAPI_TOKEN_KEY // or however you store it
    if (!apiKey) throw new Error("You should setup an OpenAI Key!")

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an interview assistant. Generate interview questions and answers from the candidate’s resume." },
        { role: "user", content: `Here is the candidate’s resume:\n${resumeText.value}` }
      ],
      stream: true,
    })

    resumeReady.value = true

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ""
      currentAnswer.value += text
    }

  } catch (e) {
    currentAnswer.value = "Error: " + e.message
  } finally {
    uploading.value = false
  }
}


function startInterview() {
  if (!resumeReady.value) return
  interviewing.value = true
  turn = 0
  nextQuestion()
}

function stopInterview() {
  interviewing.value = false
  clearStream()
  currentQuestion.value = 'Interview stopped.'
  currentAnswer.value = ''
}

function nextQuestion() {
  if (!interviewing.value) return
  clearStream()
  const qa = mockGenerateNextQA(resumeText.value, turn++)
  currentQuestion.value = qa.question
  currentAnswer.value = ''
  // stream the sample answer locally (typing effect)
  streamLocalAnswer(qa.sample_answer)
}

function streamLocalAnswer(text) {
  const chars = [...(text || '')]
  let i = 0
  streamTimer = setInterval(() => {
    currentAnswer.value += chars.slice(i, i+3).join('')
    i += 3
    if (i >= chars.length) clearStream()
  }, 22)
}
function clearStream(){ if (streamTimer) { clearInterval(streamTimer); streamTimer = null } }

function onPasteResume(){
  // Auto-upload shortly after paste if content is present
  setTimeout(() => { if (resumeText.value.trim()) sendResume() }, 150)
}

// --- Simple keyword extraction + mock Q/A generator ---
const TECH = [
  'nginx','docker','kubernetes','aws','gcp','azure','redis','postgres','mysql','mongodb',
  'typescript','javascript','vue','react','node','express','nest',
  'python','django','flask','java','spring',
  'kafka','rabbitmq','grpc','rest','graphql',
  'terraform','ansible','linux','bash','git','jenkins','github actions',
  'big-o','algorithm','data structure','system design','microservices','reverse proxy','load balancer','cache','cdn'
]
let cachedKeywords = []
function extractKeywordsFromResume(){
  const text = resumeText.value.toLowerCase()
  cachedKeywords = TECH.filter(k => text.includes(k))
  if (!cachedKeywords.length) cachedKeywords = ['algorithms','system design']
}

function mockGenerateNextQA(text, turnNo){
  if (!cachedKeywords.length) extractKeywordsFromResume()
  const kw = cachedKeywords[turnNo % cachedKeywords.length]
  const q = makeQuestionFor(kw)
  const a = makeAnswerFor(kw)
  return { question: q, sample_answer: a, key_points: makeKeypointsFor(kw) }
}

function makeQuestionFor(kw){
  switch(kw){
    case 'nginx': return 'How would you configure NGINX as a reverse proxy for a Node.js app?'
    case 'docker': return 'Explain how you would containerize this service using Docker. What goes into the Dockerfile?'
    case 'kubernetes': return 'How would you deploy a stateless web app to Kubernetes and expose it securely?'
    case 'big-o':
    case 'algorithm': return 'What is the time/space complexity of your preferred sorting algorithm and why?'
    case 'system design': return 'Design a high‑traffic URL shortener. Discuss components and scalability trade‑offs.'
    default: return `Tell me about your experience with ${kw}.`
  }
}
function makeAnswerFor(kw){
  const lines = {
    'nginx': `I would place NGINX in front as a reverse proxy, terminating TLS and forwarding to the Node.js upstreams.\nI’d define an upstream block with multiple app instances for load balancing, enable health checks, gzip, and caching for static assets.\nI’d also set timeouts, client_max_body_size as needed, and use separate server blocks for staging vs prod.`,
    'docker': `I start with a small base image, install only runtime deps, and copy a pruned build.\nI set NODE_ENV=production, run as a non‑root user, expose the port, and use a multi‑stage Dockerfile to keep image small.\nFor reproducibility I pin versions and use a .dockerignore to keep the context lean.`,
    'kubernetes': `I’d create a Deployment for stateless replicas, a Service (ClusterIP) for stable discovery, and an Ingress to expose it.\nAdd HPA on CPU/requests, resource requests/limits, liveness/readiness probes, and ConfigMaps/Secrets for configuration.\nUse rolling updates and network policies for isolation.`,
    'algorithm': `For mergesort the time complexity is O(n log n) and space is O(n).\nIt divides the input, sorts recursively, then merges.\nI’d compare it to quicksort (average O(n log n), worst O(n^2)) and explain when each is preferable.`,
    'system design': `I’d use an API layer to accept URLs, a key‑generation service, storage (NoSQL) for mappings, and a redirect service.\nAdd a cache like Redis for hot keys, NGINX or CDN at the edge, background workers for analytics, and partitioning for scale.\nI’d discuss consistency, rate limits, and observability.`,
  }
  return lines[kw] || `In my work with ${kw}, I focus on clear architecture, good observability, and measurable outcomes.\nI can explain trade‑offs, common pitfalls, and how I test and deploy changes safely.`
}
function makeKeypointsFor(kw){
  switch(kw){
    case 'nginx': return ['reverse proxy','upstream','load balancing','TLS termination','caching']
    case 'docker': return ['multi‑stage build','small base image','non‑root user','.dockerignore']
    case 'kubernetes': return ['Deployment','Service','Ingress','HPA','probes']
    case 'algorithm': return ['O(n log n)','space O(n)','merge step','quicksort contrast']
    case 'system design': return ['NoSQL store','key generation','Redis cache','CDN/edge','analytics pipeline']
    default: return [kw]
  }
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

</style>
