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

/**
 * Config
 * - FRONTEND_URLS can be a comma separated list, or use CLIENT_URL single value.
 * - Fallback to localhost:3000 for local dev.
 */
const rawFrontend = process.env.FRONTEND_URLS || process.env.CLIENT_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);

// Upload directory (relative to server folder)
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Middlewares
app.use(express.json());

// Helpful startup log
console.log('Allowed frontend origins:', ALLOWED_ORIGINS);

// Robust Express CORS middleware (dynamic origin check)
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
    console.warn(`CORS blocked request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Ensure preflight handled
app.options('*', cors());

// health check endpoint (useful for Render/Vercel pings)
app.get('/health', (req, res) => res.status(200).send('ok'));

// static uploads route
app.use('/uploads', express.static(path.join(__dirname, UPLOAD_DIR)));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mern-chat';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err.message));

// Socket.IO setup
// NOTE: keep socket CORS policy consistent with express CORS
const ioOptions = {
  cors: {
    origin: function (origin, callback) {
      // allow server-side tools with no origin
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
      console.warn('Socket.IO CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST'],
    credentials: true
  },

  // Allow both websocket and polling (polling helps on platforms where raw websocket is blocked)
  transports: ['websocket', 'polling'],

  // These are top-level socket.io options (not inside cors)
  pingInterval: 25000,
  pingTimeout: 60000,
  maxHttpBufferSize: 1e6, // 1MB - adjust if you allow larger socket uploads
  allowUpgrades: true
};

const io = require('socket.io')(server, ioOptions);

// initialize app sockets
setupSocket(io);

// make io available via app if needed elsewhere
app.set('io', io);

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
