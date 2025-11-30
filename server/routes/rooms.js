// backend/routes/rooms.js
const express = require('express');
const auth = require('../middlewares/auth');
const Room = require('../models/Room');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * Get all rooms
 */
router.get('/', auth, async (req, res) => {
  try {
    const rooms = await Room.find().populate('createdBy', 'name').limit(200);
    return res.json(rooms);
  } catch (err) {
    console.error('GET /rooms error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Create room
 */
router.post('/', auth, async (req, res) => {
  try {
    const { name, isPrivate, members } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    const room = new Room({
      name: String(name).trim(),
      isPrivate: !!isPrivate,
      members: Array.isArray(members) && members.length ? members : [req.user._id],
      createdBy: req.user._id
    });

    await room.save();
    const populated = await Room.findById(room._id).populate('createdBy', 'name');
    return res.status(201).json(populated);
  } catch (err) {
    console.error('POST /rooms error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});



router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid room id' });
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Name cannot be empty' });

    const room = await Room.findById(id).lean(); 
    if (!room) return res.status(404).json({ message: 'Room not found' });

   
    let createdById = null;
    if (room.createdBy) {
      if (typeof room.createdBy === 'object' && room.createdBy._id) createdById = String(room.createdBy._id);
      else createdById = String(room.createdBy);
    }

    const requesterId = String(req.user._id);
    const memberIds = Array.isArray(room.members) ? room.members.map(m => {
      if (!m) return null;
      if (typeof m === 'object' && m._id) return String(m._id);
      return String(m);
    }).filter(Boolean) : [];

    const isCreator = createdById === requesterId;
    const isMember = memberIds.includes(requesterId);
    // console.log(`[rooms:rename] requester=${requesterId} roomId=${id} createdBy=${createdById} isCreator=${isCreator} isMember=${isMember}`);

    if (!isCreator && !isMember) {
      return res.status(403).json({ message: 'Not authorized to rename this room' });
    }

    const updated = await Room.findByIdAndUpdate(id, { name: String(name).trim() }, { new: true }).populate('createdBy', 'name');
    return res.json(updated);
  } catch (err) {
    console.error('PUT /rooms/:id error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid room id' });

    const room = await Room.findById(id);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isCreator = String(room.createdBy) === String(req.user._id);
    const isMember = Array.isArray(room.members) && room.members.some(m => String(m) === String(req.user._id));
    if (!isCreator && !isMember) {
      return res.status(403).json({ message: 'Not authorized to delete this room' });
    }

    await Room.findByIdAndDelete(id);
    return res.json({ message: 'Room deleted' });
  } catch (err) {
    console.error('DELETE /rooms/:id error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
