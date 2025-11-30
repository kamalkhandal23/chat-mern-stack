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

// Config
// Accept either FRONTEND_URLS (comma-separated) or fallback to CLIENT_URL
const rawFrontend = process.env.FRONTEND_URLS || process.env.CLIENT_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Middlewares
app.use(express.json());

// Log allowed origins at startup (helpful for debugging)
console.log('Allowed frontend origins:', ALLOWED_ORIGINS);

// Express CORS config (dynamic)
app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));

// ensure preflight handled
app.options('*', cors());

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

// Setup Socket.IO with same origin whitelist
const io = require('socket.io')(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});
setupSocket(io);
app.set('io', io);

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
