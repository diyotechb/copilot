import { fetchCandidatesByDate } from '@/services/candidateService';

export const NO_SELECTION = '';
export const OTTER_PRACTICE = '__OTTER_PRACTICE__';

export default {
  data() {
    return {
      candidateDate: '',
      candidates: [],
      loadingCandidates: false,
      selectedCandidateId: null,
      candidateMeta: null,
      candidateInfoSource: null,
      category: 'NONE'
    };
  },
  computed: {
    candidateChosen() {
      return this.selectedCandidateId !== null && this.selectedCandidateId !== undefined;
    },
    candidateInfoParts() {
      const c = this.candidateInfoSource;
      if (!c) return [];
      const parts = [];
      const lead = c.task ? this.sentenceCase(c.task) : 'Interview';
      if (c.vendor) {
        parts.push({ text: '', bold: lead });
        parts.push({ text: ' through ', bold: c.vendor });
      }
      if (c.client) parts.push({ text: ' with ', bold: this.toTitleCase(c.client) });
      if (c.duration) parts.push({ text: ' for ', bold: `${c.duration} min` });
      if (c.callTaker) parts.push({ text: ' by ', bold: this.toTitleCase(c.callTaker) });
      return parts;
    }
  },
  methods: {
    async loadCandidates() {
      this.candidates = [];
      this.resetCandidateSelection();
      if (!this.candidateDate) return;
      this.loadingCandidates = true;
      try {
        this.candidates = await fetchCandidatesByDate(this.candidateDate);
      } catch (e) {
        // Candidate fetch needs a Diyo token/role; non-staff just get none.
        this.$message && this.$message.warning ? this.$message.warning(e.message) : null;
      } finally {
        this.loadingCandidates = false;
      }
    },
    resetCandidateSelection() {
      this.selectedCandidateId = null;
      this.candidateMeta = null;
      this.candidateInfoSource = null;
      this.category = 'NONE';
    },
    toTitleCase(str) {
      if (!str) return '';
      return str.replace(/_/g, ' ').toLowerCase().trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    },
    sentenceCase(str) {
      if (!str) return '';
      const s = String(str).replace(/_/g, ' ').trim().toLowerCase();
      return s.charAt(0).toUpperCase() + s.slice(1);
    },
    candidateLabel(c) {
      const time = c.dateTime
        ? new Date(c.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : '';
      return [this.toTitleCase(c.fullName), this.toTitleCase(c.task), this.toTitleCase(c.client), time]
        .filter(Boolean).join(' - ');
    },
    onCandidateSelect(id) {
      if (id === NO_SELECTION) {
        this.selectedCandidateId = NO_SELECTION;
        this.category = 'NONE';
        this.candidateMeta = null;
        this.candidateInfoSource = null;
        return '';
      }
      if (id === OTTER_PRACTICE) {
        this.selectedCandidateId = OTTER_PRACTICE;
        this.category = 'OTTER_PRACTICE';
        this.candidateMeta = null;
        this.candidateInfoSource = null;
        return `Otter Practice - ${this.candidateDate || new Date().toISOString().split('T')[0]}`;
      }
      const c = this.candidates.find(x => x.id === id);
      if (!c) {
        this.resetCandidateSelection();
        return '';
      }
      this.selectedCandidateId = id;
      this.category = 'INTERVIEW';
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
      this.candidateInfoSource = { vendor: c.vendor, client: c.client, duration: c.duration, callTaker: c.callTaker, task: c.task };
      return [this.toTitleCase(c.fullName), this.toTitleCase(c.task), this.toTitleCase(c.client)]
        .filter(Boolean).join('-');
    }
  }
};
