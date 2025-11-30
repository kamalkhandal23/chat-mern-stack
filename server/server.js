// server/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');
const { setupSocket } = require('./sockets');

const app = express();
const server = http.createServer(app);

// Config: FRONTEND_URLS can be comma separated (e.g. "https://app1.com,https://app2.com")
const rawFrontend = process.env.FRONTEND_URLS || process.env.CLIENT_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);

// Upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Middlewares
app.use(express.json());

// Helpful startup log
console.log('Allowed frontend origins:', ALLOWED_ORIGINS);

// Robust CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (e.g. curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // allow when origin exactly matches one of allowed origins
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
    // helpful debug log
    console.warn(`CORS blocked request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ensure preflight handled
app.options('*', cors());

// health check (useful for Render/Vercel pings)
app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// static uploads
app.use('/uploads', express.static(path.join(__dirname, UPLOAD_DIR)));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

// Connect DB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mern-chat';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err.message));

// Setup Socket.IO with same origin whitelist and transports
const io = require('socket.io')(server, {
  // CORS for socket.io (must match express CORS policy)
  cors: {
    origin: function (origin, callback) {
      // allow server-side or tools with no origin
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
      console.warn('Socket.IO CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'), false);
    },
    transports: ["websocket", "polling"],
    methods: ['GET', 'POST'],
    credentials: true
  },
  // use both websocket and polling (helps in platforms where pure websocket may fail)
  transports: ['websocket', 'polling'],
  // recommended socket options
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6 // 1 MB (adjust if you allow large uploads via sockets)
});

// pass io to your socket setup
setupSocket(io);
app.set('io', io);

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
