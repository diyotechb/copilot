<template>
  <div class="live-assist-view">
   <div class="dashboard-view">
    <div class="dashboard-header">
      <h2>Live Assist</h2>
    </div>

    <el-card class="setup-card" shadow="never">
      <div class="field-block">
        <label class="field-label">Select Candidate</label>
        <div class="candidate-row">
          <el-date-picker
            v-model="candidateDate"
            type="date"
            value-format="yyyy-MM-dd"
            placeholder="Pick a date"
            :clearable="false"
            :disabled="fieldsLocked"
            @change="loadCandidates"
          />
          <el-input
            v-if="preparing"
            class="candidate-select"
            :value="continueCandidateName"
            disabled
          />
          <el-select
            v-else
            v-model="selectedCandidateId"
            filterable
            :loading="loadingCandidates"
            :disabled="interviewActive"
            class="candidate-select"
            @change="onCandidateSelect"
          >
            <el-option label="No selection" :value="''" />
            <el-option
              v-for="c in candidates"
              :key="c.id"
              :label="candidateLabel(c)"
              :value="c.id"
            />
          </el-select>
        </div>
        <p v-if="!loadingCandidates && candidateDate && !candidates.length" class="hint">No candidates found for this date.</p>
        <p v-if="candidateInfoParts.length" class="candidate-info">
          <template v-for="(seg, i) in candidateInfoParts">{{ seg.text }}<b v-if="seg.bold" :key="i">{{ seg.bold }}</b></template>
        </p>
      </div>

      <div class="field-block">
        <label class="field-label">Session Name</label>
        <el-input v-model="sessionLabel" placeholder="Session name" :disabled="fieldsLocked" :maxlength="maxLabelChars" />
      </div>

      <div class="field-block">
        <label class="field-label">Resume <span class="req">*</span></label>
        <div :class="{ 'field-error-wrap': resumeMissing || resumeTooLong }">
          <FileUpload
            label="Resume"
            :value="resumeText"
            :disabled="fieldsLocked"
            @input="onResumeInput"
          />
        </div>
        <p v-if="resumeTooLong" class="resume-warn">
          Resume is too long ({{ resumeText.length.toLocaleString() }} / {{ maxResumeChars.toLocaleString() }} characters). Please trim it before starting.
        </p>
      </div>

      <div class="advanced">
        <el-button type="text" @click="showContext = !showContext">
          <i :class="showContext ? 'el-icon-arrow-down' : 'el-icon-arrow-right'"></i> More Details
        </el-button>
        <div v-show="showContext" class="advanced-body">
          <div class="field-block">
            <label class="field-label">Job Description</label>
            <el-input v-model="jobDescription" type="textarea" :rows="3" :disabled="fieldsLocked" :maxlength="maxJdChars" show-word-limit />
          </div>
          <div class="field-block" style="margin-bottom:0">
            <label class="field-label">Additional Notes</label>
            <el-input v-model="notes" type="textarea" :rows="2" :disabled="fieldsLocked" :maxlength="maxNotesChars" show-word-limit />
          </div>
        </div>
      </div>

      <div class="field-block">
        <label class="field-label">Conversation ID <span class="req">*</span></label>
        <el-input v-model="conversationId" :disabled="starting || fieldsLocked" :maxlength="maxConversationIdChars" @input="onConversationIdInput">
          <el-button slot="append" @click="copyConversationId">Copy</el-button>
          <el-button slot="append" @click="conversationId = roomId('')" :disabled="starting || fieldsLocked">New</el-button>
          <el-button slot="append" @click="conversationId = defaultConversationId" :disabled="starting || fieldsLocked">Default</el-button>
        </el-input>
      </div>

      <div class="stream-note">
        <i class="el-icon-info"></i>
        <span>Use Conversation ID <code>{{ conversationId }}</code>, and the Backend URL is <code>{{ httpBase }}</code> in your extension.</span>
      </div>

      <div class="start-row">
        <el-button v-if="preparing" type="text" :disabled="starting" @click="cancelPrepare">Cancel</el-button>
        <el-button
          v-if="interviewActive"
          type="danger"
          class="primary-hero-btn end-hero-btn"
          :loading="completing"
          @click="endInterview"
        >End Session</el-button>
        <el-button
          v-else-if="preparing"
          type="primary"
          class="primary-hero-btn"
          :loading="starting"
          @click="confirmContinue"
        >Continue Session <i class="el-icon-right"></i></el-button>
        <el-button
          v-else
          type="primary"
          class="primary-hero-btn"
          :loading="starting"
          @click="startInterview"
        >Start Session <i :class="(resumeText.trim() && !resumeTooLong) ? 'el-icon-right' : 'el-icon-lock'"></i></el-button>
      </div>

      <el-alert v-if="sessionError" :title="sessionError" type="error" :closable="false" show-icon style="margin-top:12px" />
    </el-card>

    <el-card v-if="interviewActive" class="live-card" shadow="never">
      <div class="live-bar">
        <div class="live-indicator">
          <span class="heartbeat"></span>
          <span class="live-label">{{ statusLabel }}</span>
        </div>
      </div>
      <div class="live-meta">
        <span><span class="meta-key">Streaming to</span> <code>{{ httpBase }}</code></span>
        <span><span class="meta-key">Conversation</span> <code>{{ conversationId }}</code></span>
        <span><span class="meta-key">Session</span> <code>{{ sessionId }}</code></span>
      </div>
    </el-card>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error-banner" />

    <div v-if="interviewActive" class="columns">
      <el-card class="panel" shadow="never">
        <div slot="header"><i class="el-icon-microphone"></i> Live Transcript</div>
        <div class="content transcript">
          <div v-if="livePartial" class="line partial">{{ livePartial }}</div>
          <div v-for="(line, i) in transcriptReversed" :key="'t' + i" class="line final">{{ line }}</div>
          <div v-if="!transcriptLines.length && !livePartial" class="empty">
            {{ connected ? 'Waiting for audio from the extension…' : 'Connecting…' }}
          </div>
        </div>
      </el-card>

      <el-card class="panel" shadow="never">
        <div slot="header"><i class="el-icon-chat-line-square"></i> AI Response</div>
        <div class="content ai-response">
          <div v-for="(reply, i) in repliesReversed" :key="'r' + i" class="reply">
            <div class="reply-text">{{ reply.content }}</div>
            <div v-if="reply.streaming" class="reply-meta"><i class="el-icon-loading"></i> streaming…</div>
          </div>
          <div v-if="!aiReplies.length" class="empty">
            {{ connected ? 'Answers appear here when the interviewer finishes speaking.' : 'Connecting…' }}
          </div>
        </div>
      </el-card>
    </div>

    <template v-if="!fieldsLocked">
      <div v-if="loadingRecents" class="empty-dashboard">Loading…</div>
      <div v-else-if="!recentSessions.length" class="empty-dashboard">
        <i class="el-icon-headset empty-icon"></i>
        <h3>No sessions yet</h3>
        <p>Paste a resume and start a session to see it here.</p>
      </div>
      <div v-else class="transcript-list">
        <div class="recent-header">
          <h3 class="recent-title">Recent Sessions</h3>
          <router-link class="view-all" :to="{ name: 'LiveAssistSessions' }">View All</router-link>
        </div>

        <div
          v-for="s in recentSessions"
          :key="s.sessionId"
          class="transcript-card"
          @click="openSaved(s.sessionId)"
        >
          <div class="card-topline">
            <div class="card-title-group">
              <h3 class="card-title">{{ sessionName(s) }}</h3>
              <el-tag :type="statusType(s.status)" size="mini" effect="dark">{{ s.status }}</el-tag>
              <span v-if="timeAgo(s.updatedAt || s.createdAt)" class="card-ago">{{ timeAgo(s.updatedAt || s.createdAt) }}</span>
            </div>
            <el-button type="text" class="continue-btn" @click.stop="continueFromSaved(s.sessionId)">
              Continue Session <i class="el-icon-right"></i>
            </el-button>
          </div>
          <div class="card-subline-row">
            <span v-if="sessionSublineParts(s).length" class="card-subline-text">
              <template v-for="(seg, i) in sessionSublineParts(s)">{{ seg.text }}<b v-if="seg.bold" :key="i">{{ seg.bold }}</b></template>
            </span>
            <span class="card-date">{{ formatDate(s.createdAt) }}</span>
          </div>
          <div class="card-body">
            <p :class="{ 'empty-preview': !s.preview }">{{ s.preview || 'No responses yet' }}</p>
          </div>
        </div>
      </div>
    </template>
   </div>

   <ConfirmDialog
     :visible.sync="confirmVisible"
     :title="confirmConfig.title"
     :message="confirmConfig.message"
     :type="confirmConfig.type"
     :confirm-text="confirmConfig.confirmText"
     :cancel-text="confirmConfig.cancelText"
     :icon="confirmConfig.icon"
     @confirm="onConfirmAccept"
     @cancel="onConfirmCancel"
   />
  </div>
</template>

<script>
import { authHeaders } from '@/services/backendApi';
import FileUpload from '@/components/FileUpload.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { fetchCandidatesByDate } from '@/services/candidateService';

const DEFAULT_BACKEND = process.env.VUE_APP_SERVER_URL || 'ws://localhost:8080';
const DEFAULT_CONVERSATION_ID = 'diyotech-room';
const ACTIVE_SESSION_KEY = 'voiceai.activeSession';
const MAX_RESUME_CHARS = 50000;
const MAX_LABEL_CHARS = 120;
const MAX_JD_CHARS = 8000;
const MAX_NOTES_CHARS = 2000;
const MAX_CONVERSATION_ID_CHARS = 64;

export default {
  name: 'LiveAssistView',
  components: { FileUpload, ConfirmDialog },
  data() {
    return {
      backendUrl: DEFAULT_BACKEND,
      conversationId: DEFAULT_CONVERSATION_ID,
      sessionId: '',
      ws: null,
      connected: false,
      status: 'Idle',
      error: '',
      transcriptLines: [],
      livePartial: '',
      aiReplies: [],
      resumeText: '',
      jobDescription: '',
      notes: '',
      resumeMissing: false,
      starting: false,
      showContext: false,
      sessionError: '',
      completing: false,
      leaving: false,
      interviewActive: false,
      recentSessions: [],
      loadingRecents: false,
      candidateDate: '',
      candidates: [],
      loadingCandidates: false,
      selectedCandidateId: '',
      sessionLabel: '',
      candidateMeta: null,
      candidateInfoSource: null,
      preparing: false,
      continueSessionId: '',
      continueCandidateName: '',
      confirmVisible: false,
      confirmConfig: { title: '', message: '', type: 'warning', confirmText: 'Confirm', cancelText: 'Cancel', icon: 'el-icon-warning-outline' },
      confirmResolver: null
    };
  },
  computed: {
    extensionUrl() {
      const base = (this.backendUrl || '')
        .replace(/\/$/, '')
        .replace(/^http:\/\//i, 'ws://')
        .replace(/^https:\/\//i, 'wss://');
      return `${base}/ws/live-assist?conversationId=${encodeURIComponent(this.conversationId)}`;
    },
    fieldsLocked() {
      return this.interviewActive || this.preparing;
    },
    resumeTooLong() {
      return this.resumeText.length > MAX_RESUME_CHARS;
    },
    maxResumeChars() {
      return MAX_RESUME_CHARS;
    },
    maxLabelChars() {
      return MAX_LABEL_CHARS;
    },
    maxJdChars() {
      return MAX_JD_CHARS;
    },
    maxNotesChars() {
      return MAX_NOTES_CHARS;
    },
    maxConversationIdChars() {
      return MAX_CONVERSATION_ID_CHARS;
    },
    defaultConversationId() {
      return DEFAULT_CONVERSATION_ID;
    },
    candidateInfoParts() {
      const c = this.candidateInfoSource;
      if (!c) return [];
      const parts = [];
      if (c.vendor) parts.push({ text: 'Interview through ', bold: c.vendor });
      if (c.client) parts.push({ text: ' with ', bold: this.toTitleCase(c.client) });
      if (c.duration) parts.push({ text: ' for ', bold: `${c.duration} min` });
      if (c.callTaker) parts.push({ text: ' by ', bold: this.toTitleCase(c.callTaker) });
      return parts;
    },
    statusLabel() {
      if (this.error) return 'Error';
      return this.status === 'Ready' ? 'Live' : this.status;
    },
    transcriptReversed() {
      return this.transcriptLines.slice().reverse();
    },
    repliesReversed() {
      return this.aiReplies.slice().reverse();
    },
    httpBase() {
      return (this.backendUrl || '')
        .replace(/\/$/, '')
        .replace(/^wss:\/\//i, 'https://')
        .replace(/^ws:\/\//i, 'http://');
    }
  },
  mounted() {
    window.addEventListener('beforeunload', this.onBeforeUnload);
    const id = this.$route.query.conversationId;
    if (id) {
      this.conversationId = id;
      this.connect();
      return;
    }
    this.candidateDate = new Date().toISOString().split('T')[0];
    this.sessionLabel = this.defaultSessionName();
    this.loadCandidates();
    this.loadRecents();
    this.tryResume();
  },
  beforeDestroy() {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.disconnect();
  },
  async beforeRouteLeave(to, from, next) {
    if (!this.interviewActive || this.leaving) {
      next();
      return;
    }
    const ok = await this.askConfirm({
      title: 'End session?',
      message: 'The session is still live. Leaving will end it. The transcript is saved — you can analyze it later from Saved Sessions.',
      type: 'warning',
      confirmText: 'End & leave',
      cancelText: 'Stay'
    });
    if (!ok) {
      next(false);
      if (to.fullPath !== from.fullPath) {
        window.history.pushState(window.history.state, '', from.fullPath);
      }
      return;
    }
    this.leaving = true;
    try {
      await this.endSessionRequest();
    } catch (e) {
      /* best-effort */
    }
    this.clearActiveSession();
    this.disconnect();
    next();
  },
  methods: {
    askConfirm(config) {
      this.confirmConfig = {
        title: config.title || 'Confirm',
        message: config.message || '',
        type: config.type || 'warning',
        confirmText: config.confirmText || 'Confirm',
        cancelText: config.cancelText || 'Cancel',
        icon: config.icon || 'el-icon-warning-outline'
      };
      this.confirmVisible = true;
      return new Promise((resolve) => { this.confirmResolver = resolve; });
    },
    onConfirmAccept() {
      this.confirmVisible = false;
      if (this.confirmResolver) { this.confirmResolver(true); this.confirmResolver = null; }
    },
    onConfirmCancel() {
      this.confirmVisible = false;
      if (this.confirmResolver) { this.confirmResolver(false); this.confirmResolver = null; }
    },
    async loadCandidates() {
      this.candidates = [];
      this.selectedCandidateId = '';
      this.candidateMeta = null;
      this.sessionLabel = this.defaultSessionName();
      if (!this.candidateDate) return;
      this.loadingCandidates = true;
      try {
        this.candidates = await fetchCandidatesByDate(this.candidateDate);
      } catch (e) {
        this.$message.error(e.message);
      } finally {
        this.loadingCandidates = false;
      }
    },
    toTitleCase(str) {
      if (!str) return '';
      return str.replace(/_/g, ' ').toLowerCase().trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    },
    candidateLabel(c) {
      const time = c.dateTime
        ? new Date(c.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : '';
      return [this.toTitleCase(c.fullName), this.toTitleCase(c.task), this.toTitleCase(c.client), time]
        .filter(Boolean).join(' - ');
    },
    onCandidateSelect(id) {
      const c = this.candidates.find(x => x.id === id);
      if (!c) {
        this.candidateMeta = null;
        this.candidateInfoSource = null;
        this.sessionLabel = this.defaultSessionName();
        this.conversationId = DEFAULT_CONVERSATION_ID;
        this.resumeText = '';
        return;
      }
      this.candidateMeta = {
        candidateName: c.fullName || '',
        enrollmentId: c.enrollmentId || '',
        task: c.task || '',
        interviewDateTime: c.dateTime || '',
        client: c.client || '',
        callTaker: c.callTaker || '',
        vendor: c.vendor || '',
        duration: c.duration || '',
        outcome: c.outcome || ''
      };
      this.sessionLabel = [this.toTitleCase(c.fullName), this.toTitleCase(c.task), this.toTitleCase(c.client)]
        .filter(Boolean).join('-');
      this.candidateInfoSource = { vendor: c.vendor, client: c.client, duration: c.duration, callTaker: c.callTaker };
      this.conversationId = this.roomId(c.enrollmentId);
      this.loadCandidateResume(c.enrollmentId);
    },
    async loadCandidateResume(enrollmentId) {
      this.resumeText = '';
      if (!enrollmentId) return;
      try {
        const res = await fetch(`${this.httpBase}/ws/live-assist/resume/${encodeURIComponent(enrollmentId)}`, {
          headers: authHeaders()
        });
        const data = await res.json();
        if (data.ok && data.resumeText) {
          this.resumeText = data.resumeText;
          this.resumeMissing = false;
        }
      } catch (e) {
        /* ignore */
      }
    },
    defaultSessionName() {
      return `Session-${this.candidateDate || new Date().toISOString().split('T')[0]}`;
    },
    newId() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'conv-' + Math.random().toString(36).slice(2, 10);
    },
    roomId(enrollmentId) {
      const suffix = enrollmentId || String(Date.now()).slice(-4);
      return `${DEFAULT_CONVERSATION_ID}-${suffix}`;
    },
    onConversationIdInput(val) {
      const cleaned = (val || '').replace(/\s+/g, '');
      if (cleaned !== val) this.conversationId = cleaned;
    },
    copyConversationId() {
      navigator.clipboard.writeText(this.conversationId).then(
        () => this.$message.success('Conversation ID copied'),
        () => this.$message.error('Copy failed — select & copy manually')
      );
    },

    async loadRecents() {
      this.loadingRecents = true;
      try {
        const res = await fetch(`${this.httpBase}/ws/live-assist/sessions`, { headers: authHeaders() });
        const list = await res.json();
        this.recentSessions = Array.isArray(list) ? list.slice(0, 20) : [];
      } catch (e) {
        this.recentSessions = [];
      } finally {
        this.loadingRecents = false;
      }
    },

    openSaved(id) {
      this.$router.push({ name: 'LiveAssistSessions', query: { sessionId: id } });
    },

    sessionName(s) {
      if (s.label) return s.label;
      if (!s.createdAt) return 'Session';
      const d = new Date(s.createdAt);
      return `Session - ${d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`;
    },

    sessionSublineParts(s) {
      const parts = [];
      if (s.vendor) parts.push({ text: 'Interview through ', bold: s.vendor });
      if (s.client) parts.push({ text: ' with ', bold: this.toTitleCase(s.client) });
      return parts;
    },

    statusType(status) {
      if (status === 'COMPLETED') return 'success';
      if (status === 'ENDED') return 'warning';
      return 'info';
    },

    formatDate(ts) {
      if (!ts) return '';
      return new Date(ts).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    },

    timeAgo(ts) {
      if (!ts) return '';
      const diff = Date.now() - new Date(ts).getTime();
      if (diff < 60000) return 'just now';
      const min = Math.floor(diff / 60000);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const day = Math.floor(hr / 24);
      if (day < 30) return `${day}d ago`;
      const mon = Math.floor(day / 30);
      if (mon < 12) return `${mon}mo ago`;
      return `${Math.floor(mon / 12)}y ago`;
    },

    onBeforeUnload(e) {
      if (!this.interviewActive) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    },

    onResumeInput(val) {
      this.resumeText = val;
      if (val && val.trim()) this.resumeMissing = false;
    },

    async startInterview() {
      if (!this.resumeText.trim()) {
        this.resumeMissing = true;
        this.$message.warning('Please add the candidate resume first');
        return;
      }
      if (this.resumeTooLong) {
        this.$message.warning(`Resume is too long (${this.resumeText.length.toLocaleString()} chars). Please trim it under ${MAX_RESUME_CHARS.toLocaleString()}.`);
        return;
      }
      if (!this.conversationId.trim()) {
        this.$message.warning('Conversation ID is required');
        return;
      }
      this.sessionError = '';
      this.starting = true;
      try {
        const sessionId = this.newId();
        const res = await fetch(`${this.httpBase}/ws/live-assist/session`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            conversationId: this.conversationId,
            sessionId,
            resumeText: this.resumeText,
            jobDescription: this.jobDescription || null,
            notes: this.notes || null,
            label: this.sessionLabel,
            candidateName: this.candidateMeta ? this.candidateMeta.candidateName : null,
            enrollmentId: this.candidateMeta ? this.candidateMeta.enrollmentId : null,
            task: this.candidateMeta ? this.candidateMeta.task : null,
            interviewDateTime: this.candidateMeta ? this.candidateMeta.interviewDateTime : null,
            client: this.candidateMeta ? this.candidateMeta.client : null,
            callTaker: this.candidateMeta ? this.candidateMeta.callTaker : null,
            vendor: this.candidateMeta ? this.candidateMeta.vendor : null,
            duration: this.candidateMeta ? this.candidateMeta.duration : null,
            outcome: this.candidateMeta ? this.candidateMeta.outcome : null,
            pastQAs: []
          })
        });
        if (!res.ok) {
          this.sessionError = `Failed to start session: ${res.status}`;
          return;
        }
        const data = await res.json();
        if (!data.ok) {
          this.sessionError = data.error || 'Failed to start session';
          return;
        }
        this.sessionId = data.sessionId || sessionId;
        this.interviewActive = true;
        this.persistActiveSession();
        this.connect();
      } catch (err) {
        this.sessionError = err.message;
      } finally {
        this.starting = false;
      }
    },

    persistActiveSession() {
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
          sessionId: this.sessionId,
          conversationId: this.conversationId,
          backendUrl: this.backendUrl,
          resumeText: this.resumeText
        }));
      } catch (e) { /* ignore */ }
    },

    clearActiveSession() {
      try { localStorage.removeItem(ACTIVE_SESSION_KEY); } catch (e) { /* ignore */ }
    },

    async tryResume() {
      let saved;
      try {
        saved = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) || 'null');
      } catch (e) {
        saved = null;
      }
      if (!saved || !saved.sessionId) return;

      try {
        const base = (saved.backendUrl || this.backendUrl || '')
          .replace(/\/$/, '').replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
        const res = await fetch(`${base}/ws/live-assist/session/${encodeURIComponent(saved.sessionId)}`, {
          headers: authHeaders()
        });
        const data = await res.json();
        if (!data.ok || data.status !== 'ACTIVE') {
          this.clearActiveSession();
          return;
        }

        const resume = await this.askConfirm({
          title: 'Resume session?',
          message: 'You have a session that was left in progress. Resume it, or start a new one?',
          type: 'primary',
          confirmText: 'Resume',
          cancelText: 'Start new',
          icon: 'el-icon-refresh'
        });
        if (!resume) {
          this.clearActiveSession();
          return;
        }

        this.backendUrl = saved.backendUrl || this.backendUrl;
        this.conversationId = saved.conversationId;
        this.sessionId = saved.sessionId;
        this.resumeText = saved.resumeText || '';
        this.transcriptLines = [];
        this.aiReplies = [];
        (data.messages || []).forEach(m => {
          if (m.role === 'user') this.transcriptLines.push(m.content);
          else if (m.role === 'assistant') this.aiReplies.push({ content: m.content, streaming: false });
        });
        this.interviewActive = true;
        this.connect();
        this.$message.info('Resumed session in progress');
      } catch (e) {
        this.clearActiveSession();
      }
    },

    async continueFromSaved(savedSessionId) {
      this.starting = true;
      this.sessionError = '';
      try {
        const res = await fetch(`${this.httpBase}/ws/live-assist/session/${encodeURIComponent(savedSessionId)}`, {
          headers: authHeaders()
        });
        const data = await res.json();
        if (!data.ok) {
          this.$message.error(data.error || 'Could not load session');
          return;
        }
        this.continueSessionId = data.sessionId;
        this.sessionId = data.sessionId;
        this.conversationId = data.conversationId || this.roomId(data.enrollmentId);
        this.resumeText = data.resumeText || '';
        this.jobDescription = data.jobDescription || '';
        this.notes = data.notes || '';
        this.showContext = !!(this.jobDescription || this.notes);
        this.sessionLabel = data.label || this.defaultSessionName();
        this.continueCandidateName = [this.toTitleCase(data.candidateName), this.toTitleCase(data.task)]
          .filter(Boolean).join(' - ');
        if (data.interviewDateTime) {
          this.candidateDate = data.interviewDateTime.split('T')[0];
        }
        this.candidateInfoSource = {
          vendor: data.vendor, client: data.client, duration: data.duration, callTaker: data.callTaker
        };
        this.transcriptLines = [];
        this.aiReplies = [];
        (data.messages || []).forEach(m => {
          if (m.role === 'user') this.transcriptLines.push(m.content);
          else if (m.role === 'assistant') this.aiReplies.push({ content: m.content, streaming: false });
        });
        this.preparing = true;
        this.$nextTick(() => {
          const el = this.$el.querySelector('.dashboard-view');
          if (el) el.scrollTop = 0;
        });
      } catch (err) {
        this.$message.error(err.message);
      } finally {
        this.starting = false;
      }
    },

    cancelPrepare() {
      this.preparing = false;
      this.continueSessionId = '';
      this.resetSession();
      this.loadRecents();
    },

    async confirmContinue() {
      this.starting = true;
      this.sessionError = '';
      try {
        const res = await fetch(`${this.httpBase}/ws/live-assist/session/${encodeURIComponent(this.continueSessionId)}/continue`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ conversationId: this.conversationId })
        });
        const data = await res.json();
        if (!data.ok) {
          this.sessionError = data.error || 'Could not continue session';
          return;
        }
        this.sessionId = data.sessionId;
        this.conversationId = data.conversationId;
        this.preparing = false;
        this.interviewActive = true;
        this.persistActiveSession();
        this.connect();
        this.$message.success('Continuing earlier session — AI has the prior context');
      } catch (err) {
        this.sessionError = err.message;
      } finally {
        this.starting = false;
      }
    },

    async endInterview() {
      this.completing = true;
      try {
        await this.endSessionRequest();
        this.disconnect();
        this.resetSession();
        this.loadRecents();
        this.$message.success('Session ended and saved. Ready for a new one.');
      } catch (err) {
        this.$message.error(err.message);
      } finally {
        this.completing = false;
      }
    },

    async endSessionRequest() {
      if (!this.sessionId) return;
      await fetch(`${this.httpBase}/ws/live-assist/session/end`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ sessionId: this.sessionId })
      });
    },

    resetSession() {
      this.clearActiveSession();
      this.interviewActive = false;
      this.leaving = false;
      this.resumeText = '';
      this.jobDescription = '';
      this.notes = '';
      this.showContext = false;
      this.sessionId = '';
      this.conversationId = DEFAULT_CONVERSATION_ID;
      this.transcriptLines = [];
      this.livePartial = '';
      this.aiReplies = [];
      this.error = '';
      this.sessionError = '';
      this.status = 'Idle';
      this.selectedCandidateId = '';
      this.candidateInfoSource = null;
      this.candidateMeta = null;
      this.preparing = false;
      this.continueSessionId = '';
      this.continueCandidateName = '';
      this.candidateDate = new Date().toISOString().split('T')[0];
      this.sessionLabel = this.defaultSessionName();
      this.loadCandidates();
    },

    connect() {
      this.error = '';
      this.status = 'Connecting…';
      try {
        const ws = new WebSocket(this.extensionUrl);
        this.ws = ws;
        ws.onopen = () => { this.connected = true; this.status = 'Connected'; };
        ws.onmessage = (e) => this.onMessage(e.data);
        ws.onerror = () => { this.error = 'WebSocket error'; this.status = 'Error'; };
        ws.onclose = (e) => {
          this.connected = false;
          this.status = `Closed (${e.code})`;
          this.ws = null;
        };
      } catch (e) {
        this.error = e.message;
        this.status = 'Error';
      }
    },
    disconnect() {
      if (this.ws) {
        try { this.ws.close(); } catch (e) { /* ignore */ }
      }
      this.ws = null;
      this.connected = false;
    },
    onMessage(raw) {
      let msg;
      try { msg = JSON.parse(raw); } catch (e) { return; }

      if (msg.type === 'open') {
        if (msg.data && msg.data.conversationId) {
          this.conversationId = msg.data.conversationId;
        }
      } else if (msg.type === 'proxy_open') {
        this.status = 'Ready';
      } else if (msg.type === 'message' && msg.data && msg.data.type === 'Turn') {
        this.handleTurn(msg.data);
      } else if (msg.type === 'AI_RESPONSE') {
        this.handleAiChunk(msg);
      } else if (msg.type === 'proxy_error') {
        this.error = msg.message || 'Upstream error';
      }
    },
    handleTurn(turn) {
      const text = turn.transcript || '';
      if (turn.end_of_turn && turn.turn_is_formatted) {
        if (text.trim()) this.transcriptLines.push(text);
        this.livePartial = '';
      } else {
        this.livePartial = text;
      }
    },
    handleAiChunk(msg) {
      const current = this.aiReplies[this.aiReplies.length - 1];
      if (!current || !current.streaming) {
        this.aiReplies.push({ content: msg.content || '', streaming: !msg.completed });
        return;
      }
      current.content += (msg.content || '');
      if (msg.completed) {
        current.streaming = false;
      }
    }
  }
};
</script>

<style scoped>
.live-assist-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 60px);
  background-color: #f9fafe;
  color: #333;
}

.dashboard-view {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 0 40px 40px 40px;
  overflow-y: auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 40px 0 6px 0;
  flex-wrap: wrap;
  gap: 15px;
}

.dashboard-header h2 {
  font-size: 28px;
  color: #2c3e50;
  margin: 0;
  font-weight: 700;
}

.req {
  color: #f56c6c;
}

.resume-warn {
  margin: 6px 0 0;
  font-size: 12px;
  color: #f56c6c;
}

.candidate-row {
  display: flex;
  gap: 12px;
}

.candidate-select {
  flex: 1;
}

.candidate-info {
  margin: 8px 0 0;
  font-size: 13px;
  color: #64666b;
}

.setup-card,
.live-card,
.columns,
.transcript-list,
.error-banner {
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  flex-shrink: 0;
}

.setup-card {
  margin-bottom: 16px;
  overflow: visible;
}

.setup-card >>> .el-card__body {
  overflow: visible;
}

.field-block {
  margin-bottom: 18px;
}

.field-label {
  display: block;
  color: #2c3e50;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.field-error-wrap >>> .smart-container {
  border-color: #f56c6c;
}

.hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
}

.advanced {
  margin: 4px 0 8px;
}

.stream-note {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  background: #f4f9ff;
  border: 1px solid #d9ecff;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: #5c6b7a;
}

.stream-note i {
  color: #409eff;
  font-size: 15px;
}

.stream-note code {
  background: #fff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  padding: 1px 6px;
  color: #409eff;
  font-weight: 600;
}

.advanced-body {
  margin-top: 8px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
}

.start-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}

.end-hero-btn {
  box-shadow: 0 4px 14px rgba(245, 108, 108, 0.25);
}

.live-card {
  margin-bottom: 16px;
  border: none;
}

.live-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.heartbeat {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #67c23a;
  animation: heartbeat 1.4s infinite ease-in-out;
}

@keyframes heartbeat {
  0%   { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.55); }
  70%  { transform: scale(1);   box-shadow: 0 0 0 10px rgba(103, 194, 58, 0); }
  100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(103, 194, 58, 0); }
}

.live-label {
  font-weight: 700;
  color: #67c23a;
  letter-spacing: 0.3px;
}

.live-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f0f2f5;
  font-size: 13px;
  color: #5c6b7a;
}

.meta-key {
  color: #5c6b7a;
  margin-right: 4px;
}

.live-meta code {
  background: #fff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  padding: 1px 6px;
  color: #409eff;
  font-weight: 600;
}


.error-banner {
  margin-bottom: 16px;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.panel {
  min-height: 380px;
}

.content {
  height: 340px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
}

.empty {
  color: #c0c4cc;
  font-style: italic;
  text-align: center;
  padding: 32px 0;
}

.line.final {
  padding: 4px 0;
  border-bottom: 1px solid #f0f2f5;
}

.line.partial {
  color: #909399;
  font-style: italic;
  padding: 4px 0;
}

.reply {
  padding: 8px 0;
  border-bottom: 1px solid #f0f2f5;
}

.reply-text {
  white-space: pre-wrap;
}

.reply-meta {
  margin-top: 4px;
  font-size: 11px;
  color: #909399;
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #e4e7ed;
  margin-bottom: 15px;
}

.recent-title {
  color: #606266;
  font-weight: 500;
  margin: 0;
}

.view-all {
  font-size: 0.9em;
  color: #409eff;
  text-decoration: none;
}

.empty-dashboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 280px;
  color: #909399;
}

.empty-dashboard .empty-icon {
  font-size: 64px;
  color: #dcdfe6;
  margin-bottom: 20px;
}

.empty-dashboard h3 {
  font-size: 20px;
  margin: 10px 0;
  color: #606266;
}

.transcript-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.transcript-card {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.transcript-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08);
  border-color: #c6e2ff;
}

.card-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-ago {
  font-size: 12px;
  color: #909399;
}

.card-title {
  font-weight: 700;
  font-size: 1.1em;
  color: #2c3e50;
  margin: 0;
}

.card-subline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 4px 0 12px;
  font-size: 12px;
  color: #64666b;
}

.card-date {
  font-size: 12px;
  color: #999;
}

.continue-btn {
  padding: 0;
  font-weight: 600;
}

.card-body p {
  margin: 0;
  color: #606266;
  font-size: 1.05rem;
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

@media (max-width: 900px) {
  .columns { grid-template-columns: 1fr; }
}
</style>
