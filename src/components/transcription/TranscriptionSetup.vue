<template>
  <div class="transcription-setup">
    <div class="setup-fields">
      <div class="field-block">
        <label class="field-label">Select Candidate</label>
        <div class="candidate-row">
          <el-date-picker
            v-model="candidateDate"
            type="date"
            value-format="yyyy-MM-dd"
            placeholder="Pick a date"
            :clearable="false"
            :disabled="continuing"
            @change="onDateChange"
          />
          <el-input
            v-show="continuing"
            class="candidate-select"
            :value="continueCandidateName || 'No candidate'"
            disabled
          />
          <el-select
            v-show="!continuing"
            v-model="selectedCandidateId"
            filterable
            :loading="loadingCandidates"
            class="candidate-select"
            @change="onSelectionChange"
          >
            <el-option label="No Selection" :value="noSelection" />
            <el-option label="Otter Practice" :value="otterPractice" />
            <el-option
              v-for="c in candidates"
              :key="c.id"
              :label="candidateLabel(c)"
              :value="c.id"
            />
          </el-select>
        </div>
        <div class="candidate-meta-line">
          <span v-if="!loadingCandidates && candidateDate && !candidates.length" class="hint">No candidates found for this date.</span>
          <span v-else-if="candidateInfoParts.length" class="candidate-info">
            <template v-for="(seg, i) in candidateInfoParts">{{ seg.text }}<b v-if="seg.bold" :key="i">{{ seg.bold }}</b></template>
          </span>
        </div>
      </div>

      <div class="field-block">
        <label class="field-label">Session Name <span class="required">*</span></label>
        <el-input v-model="sessionName" placeholder="Session name" :maxlength="maxLabelChars" :disabled="continuing" />
      </div>
    </div>

    <div class="setup-action">
      <el-button
        type="primary"
        class="start-btn"
        :class="{ 'continue-mode': continuing }"
        @click="onPrimaryClick"
      >
        {{ continuing ? 'Continue Recording' : 'Start Recording' }}
        <i :class="(!continuing && micPermission === 'denied') ? 'el-icon-lock' : 'el-icon-right'"></i>
      </el-button>
      <a class="cancel-continue" :class="{ 'is-hidden': !continuing }" @click="$emit('cancel-continue')">Cancel</a>
    </div>
  </div>
</template>

<script>
import candidateSelectMixin, { NO_SELECTION, OTTER_PRACTICE } from '@/mixins/candidateSelectMixin';

export default {
  name: 'TranscriptionSetup',
  mixins: [candidateSelectMixin],
  props: {
    micPermission: { type: String, default: 'prompt' },
    continueTarget: { type: Object, default: null }
  },
  data() {
    return {
      sessionName: '',
      maxLabelChars: 200,
      noSelection: NO_SELECTION,
      otterPractice: OTTER_PRACTICE,
      continueCandidateName: ''
    };
  },
  computed: {
    continuing() {
      return !!this.continueTarget;
    }
  },
  watch: {
    continueTarget(val) {
      if (val) {
        this.sessionName = val.label || '';
        this.category = val.category || 'NONE';
        this.continueCandidateName = val.candidateName || '';
        this.candidateInfoSource = (val.vendor || val.client || val.callTaker || val.duration)
          ? { vendor: val.vendor, client: val.client, duration: val.duration, callTaker: val.callTaker }
          : null;
      } else {
        this.continueCandidateName = '';
        this.resetCandidateSelection();
        this.sessionName = this.defaultSessionName();
      }
    }
  },
  created() {
    this.candidateDate = new Date().toISOString().split('T')[0];
    this.sessionName = this.defaultSessionName();
    this.loadCandidates();
  },
  methods: {
    defaultSessionName() {
      return `Session-${this.candidateDate || new Date().toISOString().split('T')[0]}`;
    },
    onPrimaryClick() {
      if (this.continuing) {
        if (this.continueTarget) this.$emit('continue', this.continueTarget.sessionId);
      } else {
        this.start();
      }
    },
    onDateChange() {
      this.sessionName = this.defaultSessionName();
      this.loadCandidates();
    },
    onSelectionChange(id) {
      this.sessionName = this.onCandidateSelect(id) || this.defaultSessionName();
    },
    start() {
      if (!this.candidateDate) {
        this.$message.warning('Please pick a date.');
        return;
      }
      const label = (this.sessionName || '').trim();
      if (!label) {
        this.$message.warning('Please enter a session name.');
        return;
      }
      if (label.length > this.maxLabelChars) {
        this.$message.warning(`Session name must be ${this.maxLabelChars} characters or fewer.`);
        return;
      }
      const meta = this.candidateMeta || {};
      this.$emit('start', {
        label,
        category: this.category,
        candidateName: meta.candidateName || '',
        enrollmentId: meta.enrollmentId || '',
        task: meta.task || '',
        interviewDateTime: meta.interviewDateTime || '',
        client: meta.client || '',
        callTaker: meta.callTaker || '',
        vendor: meta.vendor || '',
        duration: meta.duration || '',
        outcome: meta.outcome || ''
      });
    }
  }
};
</script>

<style scoped>
.transcription-setup {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 22px 26px;
}

.setup-fields {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 8px;
}

.candidate-row {
  display: flex;
  gap: 12px;
}

.candidate-row .el-date-picker {
  width: 180px;
  flex-shrink: 0;
}

.candidate-select {
  flex: 1;
  min-width: 0;
}

.candidate-meta-line {
  min-height: 18px;
  margin-top: 8px;
  font-size: 13px;
  line-height: 18px;
}

.hint { color: #c0c4cc; font-size: 12px; }

.candidate-info { color: #64666b; }

.required { color: #f56c6c; }

.setup-action {
  position: relative;
  display: flex;
  align-items: center;
  align-self: center;
  flex-shrink: 0;
}

.start-btn {
  font-weight: 700;
  border-radius: 10px;
  padding: 14px 26px;
  font-size: 15px;
  min-width: 215px;
}

.start-btn.continue-mode,
.start-btn.continue-mode:focus {
  background-color: #e6a23c;
  border-color: #e6a23c;
}
.start-btn.continue-mode:hover {
  background-color: #ebb563;
  border-color: #ebb563;
}
.start-btn.continue-mode:active {
  background-color: #cf9236;
  border-color: #cf9236;
}

.cancel-continue.is-hidden {
  visibility: hidden;
  pointer-events: none;
}

.cancel-continue {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 22px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: #909399;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}
.cancel-continue:hover {
  color: #f56c6c;
  background-color: #fef0f0;
  border-color: #fbc4c4;
}
.cancel-continue:active {
  background-color: #fde2e2;
}

@media (max-width: 900px) {
  .transcription-setup { flex-direction: column; }
  .setup-action { align-self: stretch; }
  .start-btn { width: 100%; }
}
</style>
