// client/src/services/socket.js
import { io } from "socket.io-client";

let socket = null;

export function connectSocket(token) {
  if (socket) return socket;

  socket = io("https://chat-mern-stack-1.onrender.com", {
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("[CLIENT SOCKET] connected", socket.id);

    socket.emit("authenticate", { token });
  });

  socket.on("connect_error", (err) => {
    console.log("[CLIENT SOCKET] connect_error", err);
  });

  window.__chatSocket = socket; // for debugging

  return socket;
}

export function getSocket() {
  return socket;
}
