const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema({
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  attachments: [{ fileName: String, url: String, fileType: String }],
  createdAt: { type: Date, default: Date.now },
  editedAt: Date,
  deleted: { type: Boolean, default: false },
  deliveredTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }]
});

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
