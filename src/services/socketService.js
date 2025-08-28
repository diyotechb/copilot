// services/socketService.js
let socket;

export function connectToWebSocket(onMessageCallback) {
  socket = new WebSocket("ws://localhost:5000/ws/interview");

  // socket.onopen = () => {
  //   console.log("Connected to interview bot");
  // };

  // socket.onmessage = (event) => {
  //   onMessageCallback(event.data);
  // };


  socket.onopen = () => socket.send("Tell me about Spring Boot");
socket.onmessage = (e) => console.log("Reply:", e.data);

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket closed");
  };
}

export function sendQuestion(question) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(question);
  } else {
    console.warn("WebSocket not connected");
  }
}
