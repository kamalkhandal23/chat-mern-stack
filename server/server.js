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
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Middlewares
app.use(express.json());
app.use(cors({
  origin: CLIENT_URL,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));
app.options('*', cors());
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

// Setup Socket.IO
const io = require('socket.io')(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] }
});
setupSocket(io);
app.set('io', io); 

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
