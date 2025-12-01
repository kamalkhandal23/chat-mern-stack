// server/sockets/index.js
const jwt = require("jsonwebtoken");
const Message = require("../models/Message");

function setupSocket(io) {
  const onlineUsers = new Map();

  io.on("connection", (socket) => {
    console.log("SOCKET CONNECTED:", socket.id);

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

    socket.on('typing', (data) => {
      try {
        const { roomId, isTyping } = data || {};
        if (!roomId) return;
        const userId = socket.userId || null;
        socket.to(roomId).emit('typing', { userId, isTyping: !!isTyping });
      } catch (err) {
        console.error('[SOCKET] typing error', err);
      }
    });

    socket.on("join-room", ({ roomId }) => {
      if (!roomId) return;
      socket.join(roomId);
    });

    socket.on("leave-room", ({ roomId }) => {
      socket.leave(roomId);
    });

    socket.on('send-message', async ({ roomId, text, attachments, clientId }) => {
      try {
        let safeAttachments = [];
    
        if (Array.isArray(attachments)) {
          safeAttachments = attachments.map((a) => {
            if (!a) return null;
    
            let finalUrl = a.url || a;
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
