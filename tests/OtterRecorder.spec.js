import { shallowMount } from '@vue/test-utils';
import OtterRecorder from '@/components/OtterRecorder.vue';

describe('OtterRecorder parsing', () => {
  it('appends partials and finalizes on end_of_turn', async () => {
    const wrapper = shallowMount(OtterRecorder);
    const vm = wrapper.vm;

    // Simulate first partial
    vm.handleSessionEvent({ text: 'Hello' });
    expect(vm.partial).toBe('Hello');
    expect(wrapper.emitted('partial')).toBeTruthy();

    // Simulate second partial
    vm.handleSessionEvent({ text: ' world' });
    expect(vm.partial).toBe('Hello world');

    // Simulate final piece
    vm.handleSessionEvent({ text: '.', end_of_turn: true, utterance_details: { start: 0, end: 500 } });
    expect(vm.partial).toBe('');
    expect(vm.finalTranscripts.length).toBe(1);
    expect(vm.finalTranscripts[0]).toBe('Hello world.');
    expect(vm._finalObjs && vm._finalObjs.length === 1).toBe(true);
    expect(wrapper.emitted('final-transcript')).toBeTruthy();
    expect(wrapper.emitted('final-transcript-obj')).toBeTruthy();
  });
});
