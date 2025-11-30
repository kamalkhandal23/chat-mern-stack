// server/sockets/index.js
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

function setupSocket(io) {
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    console.log('[SOCKET] connected:', socket.id, 'handshake.auth=', socket.handshake.auth);

    if (socket.handshake && socket.handshake.auth && socket.handshake.auth.token) {
      try {
        const payload = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
        socket.userId = payload.id;
        onlineUsers.set(payload.id, socket.id);
        console.log('[SOCKET] authed via handshake userId=', payload.id);
      } catch (err) {
        console.log('[SOCKET] handshake token invalid', err.message);
      }
    }

    socket.on('authenticate', (data) => {
      try {
        const payload = jwt.verify(data.token, process.env.JWT_SECRET);
        socket.userId = payload.id;
        onlineUsers.set(payload.id, socket.id);
        console.log('[SOCKET] authenticated via event userId=', payload.id);
        socket.emit('authenticated', { ok: true, userId: payload.id });
      } catch (err) {
        console.log('[SOCKET] authenticate failed', err.message);
        socket.emit('authenticated', { ok: false, message: 'Invalid token' });
      }
    });

    socket.on('join-room', (data) => {
      const { roomId } = data || {};
      if (!roomId) return;
      socket.join(roomId);
      console.log('[SOCKET] join-room', socket.userId, roomId);
      socket.to(roomId).emit('user-joined', { userId: socket.userId, roomId });
    });

    socket.on('leave-room', (data) => {
      const { roomId } = data || {};
      if (!roomId) return;
      socket.leave(roomId);
      console.log('[SOCKET] leave-room', socket.userId, roomId);
      socket.to(roomId).emit('user-left', { userId: socket.userId, roomId });
    });

    socket.on('typing', (data) => {
      try {
        if (!socket.userId) return;
        const { roomId, isTyping } = data || {};
        socket.to(roomId).emit('typing', { userId: socket.userId, isTyping: !!isTyping });
      } catch (err) {
        console.error('[SOCKET] typing error', err);
      }
    });

    
    socket.on('message-delivered', async (data) => {
      try {
        if (!socket.userId) return;
        const { messageId, roomId } = data || {};
        if (!messageId) return;

        await Message.updateOne(
          { _id: messageId },
          { $addToSet: { deliveredTo: socket.userId } }
        );

        
        io.to(String(roomId)).emit('message-delivered', { messageId, userId: socket.userId });
      } catch (err) {
        console.error('[SOCKET] message-delivered error', err);
      }
    });

    
    socket.on('message-read', async (data) => {
      try {
        if (!socket.userId) return;
        const { messageId, roomId } = data || {};
        if (!messageId) return;

        await Message.updateOne(
          { _id: messageId },
          { $addToSet: { readBy: socket.userId } }
        );

        io.to(String(roomId)).emit('message-read', { messageId, userId: socket.userId });
      } catch (err) {
        console.error('[SOCKET] message-read error', err);
      }
    });

    socket.on('send-message', async (data) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }
        const message = new Message({
          roomId: data.roomId,
          senderId: socket.userId,
          text: data.text || '',
          attachments: data.attachments || []
        });
        await message.save();

        const populated = await Message.findById(message._id).populate('senderId', 'name email');

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

        io.to(String(populated.roomId)).emit('message', out);
        console.log('[SOCKET] message emitted', out._id.toString());
      } catch (err) {
        console.error('[SOCKET] send-message error', err);
        socket.emit('error', { message: 'Server error' });
      }
    });

    socket.on('disconnect', (reason) => {
      if (socket.userId) onlineUsers.delete(socket.userId);
      console.log('[SOCKET] disconnected', socket.id, 'user=', socket.userId, 'reason=', reason);
    });
  });
}

module.exports = { setupSocket };
