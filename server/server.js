require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");
const path = require("path");
const { setupSocket } = require("./sockets");
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/rooms");
const messageRoutes = require("./routes/messages");
const uploadRoutes = require("./routes/upload");

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://chat-mern-stack.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

      console.log("❌ CORS blocked:", origin);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  })
);

app.use(express.json());
app.get("/health", (req, res) => res.send("ok"))
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoutes);

// MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((e) => console.log("DB error:", e.message));


const io = require("socket.io")(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 60000,
});
setupSocket(io);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
