# Chat MERN Stack

**Live demo (frontend):** [https://chat-mern-stack.vercel.app](https://chat-mern-stack.vercel.app)

**Backend (API & sockets):** [https://chat-mern-stack-1.onrender.com](https://chat-mern-stack-1.onrender.com)

**Repo:** [https://github.com/kamalkhandal23/chat-mern-stack](https://github.com/kamalkhandal23/chat-mern-stack)

---

## Overview

A real-time chat application built with the MERN stack (MongoDB, Express, React, Node) and Socket.IO for realtime features. Core functionality: register/login, create rooms, join rooms, send text + media, edit messages, unsend (delete) messages, read/delivery receipts, typing indicator, and logout.

This README provides everything you need to run locally, deploy, and understand the API / socket contracts.

---

## Features

* User registration and login (JWT)
* Create, rename and delete chat rooms
* Join/leave rooms
* Real-time messages via Socket.IO (text + attachments)
* Optimistic UI (temporary client message id -> replaced by server message)
* Edit and unsend (delete) messages
* Delivery & read receipts
* Typing indicator
* File uploads (images/files)

---

## Tech stack

* Frontend: React (create-react-app or Vite-compatible) + Axios
* Backend: Node.js, Express, Socket.IO
* Database: MongoDB (Atlas or local)
* Deployment: Vercel (frontend) + Render (backend) (example)

---

## Quick start — Local Development

### Prerequisites

* Node.js (v16+ recommended)
* npm or yarn
* MongoDB (Atlas cluster URI or local mongodb)

### Clone

```bash
git clone https://github.com/kamalkhandal23/chat-mern-stack.git
cd chat-mern-stack
```

### Backend

```bash
cd server
npm install
# create .env file (see .env.example below)
npm run dev   # or `node server.js` for production-start
```

### Frontend

In another terminal:

```bash
cd client
npm install
# create .env file (see .env.example below)
npm start
```

Open `http://localhost:3000` in your browser.

---

## Environment variables

Create `.env` files for server and client.

### Server `.env` (server/.env)

```
PORT=5001
MONGO_URI=mongodb+srv://statusbykamal_db_user:FRywtwDMbZwdbhod@cluster0.gmnwy6g.mongodb.net/?
JWT_SECRET=afe917c63d97463f4818ad98176ce8c7c479bdbca7f68d2ec305fcc181eaf091
CLIENT_URL=http://localhost:3000
# FRONTEND_URLS=https://chat-mern-stack.vercel.app,https://your-other-domain.com
UPLOAD_DIR=./uploads
```

### Client `.env` (client/.env)

```
REACT_APP_API_URL=https://chat-mern-stack-1.onrender.com     # dev: http://localhost:5001
REACT_APP_SOCKET_URL=wss://chat-mern-stack-1.onrender.com    # or ws://localhost:5001 for local
```

> **Important:** When deploying to production, set `FRONTEND_URLS` or `CLIENT_URL` on the server side to include your frontend origin(s) (example: `https://chat-mern-stack.vercel.app`). This fixes CORS issues.

---

## Run & Build scripts

**Server**

* `npm run dev` — run with nodemon (development)
* `node server.js` — production

**Client**

* `npm start` — development
* `npm run build` — production build to deploy

---

## Deploy notes

* **Frontend**: Vercel — point to `client` folder. Ensure `REACT_APP_API_URL` and `REACT_APP_SOCKET_URL` environment variables are set in Vercel dashboard.
* **Backend**: Render (or Heroku / Railway) — deploy `server` folder as a web service. Add environment variables on Render (MONGO_URI, JWT_SECRET, FRONTEND_URLS / CLIENT_URL, UPLOAD_DIR).
* When using Render or other platforms, enable health check endpoint (e.g. `/health`) and set `pingInterval`/`pingTimeout` for socket server to avoid idle disconnects.

**Socket.IO on hosting platforms:**

* Some hosts block WebSocket upgrades or require additional config. Use both `transports: ['websocket','polling']` on server and client to fallback to polling when websocket fails.
* CORS for socket must match HTTP CORS on server. Provide same allowed origins.

---

## API Endpoints (HTTP)

> Base: `{{REACT_APP_API_URL}}/api`

* `POST /api/auth/register` — { name, email, password }

* `POST /api/auth/login` — { email, password } → returns JWT token

* `GET /api/rooms` — list rooms

* `POST /api/rooms` — create room (auth required)

* `PUT /api/rooms/:id` — update room

* `DELETE /api/rooms/:id` — delete room

* `GET /api/messages/:roomId` — get messages for a room

* `PUT /api/messages/:id` — edit a message

* `DELETE /api/messages/:id` — delete (unsend) a message

* `POST /api/upload` — multipart/form-data file upload (returns { url, fileName, fileType })

---

## Socket events (client ↔ server)

**Client -> Server**

* `authenticate` — { token } (optional if token provided in handshake)
* `join-room` — { roomId }
* `leave-room` — { roomId }
* `typing` — { roomId, isTyping }
* `send-message` — { roomId, text, attachments, clientId }
* `message-delivered` — { messageId, roomId }
* `message-read` — { messageId, roomId }

**Server -> Client**

* `authenticated` — auth result
* `message` — emits created message object (may include `clientId` to replace temp message)
* `typing` — { userId, isTyping }
* `message-updated` — updated message object
* `message-deleted` — { _id }
* `message-delivered` — { messageId, userId }
* `message-read` — { messageId, userId }

---

## File uploads & Security

* Uploaded files are served from `/uploads` static route. In production, prefer object storage (S3) or a CDN.
* Validate/limit file size on server. Currently `maxHttpBufferSize` is set for socket; uploads should be done via HTTP `/api/upload`.
* Ensure `UPLOAD_DIR` exists and is writable on the host.

---

## Common Issues & Troubleshooting

* **CORS errors**: Make sure server environment `CLIENT_URL` or `FRONTEND_URLS` includes the exact origin of your frontend (including https://). Example: `https://chat-mern-stack.vercel.app`.
* **Socket connection errors**: Some hosting providers require `wss://` (secure) and can block websocket upgrade — enable transports fallback to polling. Also ensure `REACT_APP_SOCKET_URL` matches the deployed backend domain and protocol (wss://).
* **Mixed content / image blocked**: Use HTTPS everywhere. Your file URLs must start with `https://your-backend` when frontend is served over HTTPS.
* **Duplicate messages**: Make sure the client uses a single socket instance (`connectSocket` / `getSocket`) and that listeners are not attached multiple times. Use `socket.off('message')` before attaching or attach listeners once in a top-level effect.

---

## UX tips implemented (and why)

* Optimistic messages: show a temporary message (`clientId`) while server saves; server returns same `clientId` and client replaces the temp message to avoid jumps.
* Typing indicator: server relays `typing` events to the room.
* Read/delivery receipts: messages track `deliveredTo` and `readBy` arrays; UI renders tick status.
* Message delete: server emits `message-deleted`; clients update UI immediately and optionally re-fetch full messages for consistency.

---

## Example .env.example files

`server/.env.example`

```
PORT=5001
MONGO_URI=
JWT_SECRET=
FRONTEND_URLS=http://localhost:3000,https://chat-mern-stack.vercel.app
UPLOAD_DIR=./uploads
```

`client/.env.example`

```
REACT_APP_API_URL=http://localhost:5001
REACT_APP_SOCKET_URL=http://localhost:5001
```

---
