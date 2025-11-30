const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  attachments: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now },
  editedAt: { type: Date },
  deleted: { type: Boolean, default: false },
  deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // NEW: store client's tmp id to prevent duplicates
  clientId: { type: String, index: { unique: true, sparse: true } }
});

module.exports = mongoose.model('Message', messageSchema);
