<script setup>
import {ref, onMounted} from 'vue';

const transcript = ref('');
const isRecording = ref(false);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const sr = new Recognition();


onMounted(() => {
  sr.continuous = true;
  sr.interimResults = true;
  
  sr.onstart = () => {
    isRecording.value = true;
    console.log('Speech recognition started');
  };


  
  sr.onstop = () => {
    isRecording.value = false;
    console.log('Speech recognition stopped');
  };

    sr.start();
    sr.onresult = (event) => {
      const t = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
        transcript.value = t;
    }
});



const togglemic = () => {
  if (isRecording.value) {
    sr.stop();
    console.log('Speech recognition stopped');
  } else {
    sr.start();
    console.log('Speech recognition started');
  }
};


</script>

<template>
    <div>
       <button  @click = "togglemic">Record</button>
       <p>{{ transcript }}</p>  
    </div>
</template>