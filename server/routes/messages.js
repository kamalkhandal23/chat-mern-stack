const express = require('express');
const auth = require('../middlewares/auth');
const Message = require('../models/Message');

const router = express.Router();

router.get('/:roomId', auth, async (req, res) => {
  const { roomId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.before ? new Date(req.query.before) : new Date();
  try {
    const messages = await Message.find({ roomId, createdAt: { $lt: before } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'name email');
    res.json(messages.reverse());
  } catch (err) {
    console.error('GET messages error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  try {
    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (msg.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    msg.text = text;
    msg.editedAt = new Date();
    await msg.save();
    const populated = await Message.findById(msg._id).populate('senderId', 'name email');

    const io = req.app.get('io');
    if (io && populated.roomId) {
      io.to(populated.roomId.toString()).emit('message-updated', populated);
    }
    res.json(populated);
  } catch (err) {
    console.error('Edit message error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const msg = await Message.findById(id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (msg.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    msg.deleted = true;
    await msg.save();

    const io = req.app.get('io');
    if (io && msg.roomId) {
      io.to(msg.roomId.toString()).emit('message-deleted', { _id: msg._id, roomId: msg.roomId });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete message error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
