// client/src/services/socket.js
import { io } from 'socket.io-client';
let socket = null;

export function connectSocket(token) {
  // If socket already created, return it (do not disconnect)
  if (socket) return socket;

  socket = io(process.env.REACT_APP_SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket"],
    auth: { token }
  });

  socket.on('connect', () => {
    console.log('[CLIENT SOCKET] connected', socket.id, 'connected=', socket.connected);
  });
  socket.on('connect_error', (err) => {
    console.error('[CLIENT SOCKET] connect_error', err);
  });
  socket.on('disconnect', (reason) => {
    console.log('[CLIENT SOCKET] disconnected', reason);
  });
  socket.on('authenticated', (data) => {
    console.log('[CLIENT SOCKET] authenticated event from server ->', data);
  });
  socket.on('error', (err) => {
    console.warn('[CLIENT SOCKET] error event', err);
  });

  window.__chatSocket = socket;
  socket.connect();

  socket.once('connect', () => {
    const t = token || localStorage.getItem('token');
    if (t) {
      try { socket.emit('authenticate', { token: t }); console.log('[CLIENT SOCKET] emitted authenticate'); }
      catch(e){ console.warn('emit authenticate error', e); }
    }
  });

  return socket;
}

export function getSocket(){ return socket; }
