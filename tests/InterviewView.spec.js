process.env.VUE_APP_SILENCE_WAIT_MS = '3000';

import { mount } from '@vue/test-utils';
import InterviewView from '../src/views/InterviewView.vue';

// Mock the AssemblyAI service
jest.mock('../src/services/assemblyAISpeechService', () => ({
  sendToAssemblyAI: jest.fn().mockResolvedValue('Mock transcript')
}));

describe('InterviewView.vue transcript functionality', () => {
  it('updates answerTranscripts when transcript is received', async () => {
    const wrapper = mount(InterviewView, {
      data() {
        return {
          interviewQA: [
            { question: 'Q1', answer: 'A1' },
            { question: 'Q2', answer: 'A2' }
          ],
          interviewing: true,
          showAnswer: true,
          answerTranscripts: []
        };
      }
    });
    // Mock the $refs.assemblyAISpeech
    wrapper.vm.$refs.assemblyAISpeech = {
      sendToAssemblyAI: jest.fn().mockResolvedValue('Mock transcript')
    };
    // Simulate receiving an audio blob
    await wrapper.vm.onAudioBlob(new Blob(['audio']));
    // Wait for transcript to be added
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.answerTranscripts.length).toBe(1);
    expect(wrapper.vm.answerTranscripts[0]).toBe('Mock transcript');
  });

  it('shows summary only when all transcripts are received', async () => {
    const wrapper = mount(InterviewView, {
      data() {
        return {
          interviewQA: [
            { question: 'Q1', answer: 'A1' },
            { question: 'Q2', answer: 'A2' }
          ],
          interviewing: false,
          lastAudioBlob: null,
          answerTranscripts: ['Mock transcript', 'Mock transcript'],
          showInstructions: false,
          loadingTranscripts: false,
          enableVideo: false,
          turn: 2,
          currentQuestion: '',
          currentAnswer: '',
          isThinking: false
        };
      },
      // Stub created to prevent parseInterviewQA from overriding test data
      created: jest.fn()
    });
    expect(wrapper.vm.allTranscriptsReceived).toBe(true);
  });

  it('shows loading when transcripts are pending', async () => {
    const wrapper = mount(InterviewView, {
      data() {
        return {
          interviewQA: [
            { question: 'Q1', answer: 'A1' },
            { question: 'Q2', answer: 'A2' }
          ],
          interviewing: false,
          lastAudioBlob: new Blob(['audio']),
          answerTranscripts: ['Mock transcript']
        };
      }
    });
    expect(wrapper.vm.allTranscriptsReceived).toBe(false);
  });
});
