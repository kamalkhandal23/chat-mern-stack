// server/sockets/index.js
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");

function setupSocket(io) {
  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    console.log("🔌 SOCKET CONNECTED:", socket.id);

    // AUTH
    socket.on("authenticate", ({ token }) => {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = payload.id;
        onlineUsers.set(payload.id, socket.id);

        socket.emit("authenticated", { ok: true });
        console.log("✔ authenticated:", payload.id);
      } catch (err) {
        socket.emit("authenticated", { ok: false });
      }
    });

    // JOIN ROOM
    socket.on("join-room", ({ roomId }) => {
      if (!roomId) return;
      socket.join(roomId);
    });

    // LEAVE ROOM
    socket.on("leave-room", ({ roomId }) => {
      socket.leave(roomId);
    });

    // MESSAGE SEND — FIXED DUPLICATES 🛑
    socket.on(
      "send-message",
      async ({ roomId, text, attachments, clientId }) => {
        try {
          // idempotency FIX (no double message ever)
          const already = await Message.findOne({ clientId });
          if (already) {
            console.log("⛔ duplicate msg ignored:", clientId);
            return socket.emit("message", {
              ...already.toObject(),
              clientId,
            });
          }

          const msg = await Message.create({
            roomId,
            senderId: socket.userId,
            text,
            attachments,
            clientId,
          });

          const populated = await Message.findById(msg._id).populate(
            "senderId",
            "name email"
          );

          io.to(roomId).emit("message", {
            ...populated.toObject(),
            clientId,
          });
        } catch (err) {
          console.log("send-msg error:", err);
        }
      }
    );

    socket.on("disconnect", () => {
      if (socket.userId) onlineUsers.delete(socket.userId);
    });
  });
}

module.exports = { setupSocket };
