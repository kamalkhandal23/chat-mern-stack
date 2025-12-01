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


    // TYPING (forward to room)
    socket.on('typing', (data) => {
      try {
        const { roomId, isTyping } = data || {};
        if (!roomId) return;
        // require authenticated userId (optional)
        const userId = socket.userId || null;
        socket.to(roomId).emit('typing', { userId, isTyping: !!isTyping });
      } catch (err) {
        console.error('[SOCKET] typing error', err);
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
    socket.on('send-message', async ({ roomId, text, attachments, clientId }) => {
      try {
        // FIX: force HTTPS inside attachments array
        let safeAttachments = [];
    
        if (Array.isArray(attachments)) {
          safeAttachments = attachments.map((a) => {
            if (!a) return null;
    
            let finalUrl = a.url || a;
    
            // auto convert http → https
            if (finalUrl.startsWith("http://")) {
              finalUrl = finalUrl.replace("http://", "https://");
            }
    
            return {
              url: finalUrl,
              fileName: a.fileName || null,
              fileType: a.fileType || null,
              size: a.size || null,
            };
          }).filter(Boolean);
        }
    
        // save message
        const saved = await Message.create({
          roomId,
          senderId: socket.userId,
          text,
          attachments: safeAttachments,
        });
    
        const msgForClients = {
          ...saved.toObject(),
          clientId,
        };
    
        io.to(roomId).emit("message", msgForClients);
        console.log("[SOCKET] message sent:", saved._id.toString());
      } catch (err) {
        console.error("[SOCKET] send-message error", err);
      }
    });
    

    socket.on("disconnect", () => {
      if (socket.userId) onlineUsers.delete(socket.userId);
    });
  });
}

module.exports = { setupSocket };
