// client/src/services/socket.js
import { io } from 'socket.io-client';
let socket = null;

export function connectSocket(token) {
  if (socket) {
    try { socket.disconnect(); } catch(e) {}
    socket = null;
  }

  const url = process.env.REACT_APP_SOCKET_URL || 'https://chat-mern-stack-1.onrender.com'; // production wss url
  socket = io(url, {
    autoConnect: false,
    transports: ['websocket', 'polling'], // use polling fallback if websocket blocked
    upgrade: true,
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.2
  });

  socket.on('connect', () => console.log('[CLIENT SOCKET] connected', socket.id));
  socket.on('connect_error', (err) => console.error('[CLIENT SOCKET] connect_error', err));
  socket.on('disconnect', (reason) => console.warn('[CLIENT SOCKET] disconnected', reason));

  // automatic authenticate after connect (if needed)
  socket.once('connect', () => {
    const t = token || localStorage.getItem('token');
    if (t) socket.emit('authenticate', { token: t });
  });

  socket.connect();
  return socket;
}

export function getSocket(){ return socket; }
