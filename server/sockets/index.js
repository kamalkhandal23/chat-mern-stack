// server/sockets/index.js
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

function setupSocket(io) {
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    console.log('[SOCKET] connected:', socket.id);

    // AUTH
    if (socket.handshake?.auth?.token) {
      try {
        const payload = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
        socket.userId = payload.id || payload._id;
        onlineUsers.set(String(socket.userId), socket.id);
      } catch (err) {
        console.log('[SOCKET] handshake invalid');
      }
    }

    socket.on('authenticate', (data) => {
      try {
        const payload = jwt.verify(data.token, process.env.JWT_SECRET);
        socket.userId = payload.id || payload._id;
        onlineUsers.set(String(socket.userId), socket.id);
        socket.emit('authenticated', { ok: true });
      } catch {
        socket.emit('authenticated', { ok: false });
      }
    });

    // ROOM JOIN
    socket.on('join-room', ({ roomId }) => {
      if (!roomId) return;
      socket.join(roomId);
    });

    socket.on('leave-room', ({ roomId }) => {
      if (!roomId) return;
      socket.leave(roomId);
    });

    // TYPING
    socket.on('typing', ({ roomId, isTyping }) => {
      if (!roomId) return;
      socket.to(roomId).emit('typing', { userId: socket.userId, isTyping });
    });

    // DELIVERY
    socket.on('message-delivered', async ({ messageId, roomId }) => {
      if (!messageId) return;
      await Message.updateOne(
        { _id: messageId },
        { $addToSet: { deliveredTo: socket.userId } }
      );
      io.to(roomId).emit('message-delivered', { messageId, userId: socket.userId });
    });

    // READ
    socket.on('message-read', async ({ messageId, roomId }) => {
      if (!messageId) return;
      await Message.updateOne(
        { _id: messageId },
        { $addToSet: { readBy: socket.userId } }
      );
      io.to(roomId).emit('message-read', { messageId, userId: socket.userId });
    });

    // SEND MESSAGE — **ONLY ONE HANDLER**
    socket.on('send-message', async ({ roomId, text, attachments, clientId } = {}) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }
        if (!roomId) {
          socket.emit('error', { message: 'No roomId provided' });
          return;
        }
    
        const created = await Message.create({
          roomId,
          senderId: socket.userId,
          text: text || '',
          attachments: Array.isArray(attachments) ? attachments : []
        });
    
        const populated = await Message.findById(created._id).populate('senderId', 'name email');
    
        const out = {
          _id: populated._id,
          roomId: populated.roomId,
          senderId: populated.senderId,
          text: populated.text,
          attachments: populated.attachments,
          createdAt: populated.createdAt,
          editedAt: populated.editedAt,
          deleted: populated.deleted,
          deliveredTo: populated.deliveredTo || [],
          readBy: populated.readBy || []
        };
    
        if (clientId) out.clientId = clientId;
        io.to(String(populated.roomId)).emit('message', out);
      } catch (err) {
        // Helpful debug logging:
        console.error('[SOCKET] send-message failed:', err.name, err.message);
        if (err.errors) console.error('[SOCKET] validation errors:', err.errors);
        socket.emit('error', { message: 'Server error: ' + (err.message || 'unknown') });
      }
    });
    
    
    

    socket.on('disconnect', () => {
      if (socket.userId) onlineUsers.delete(String(socket.userId));
    });
  });
}

module.exports = { setupSocket };
