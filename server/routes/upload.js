const express = require('express');
const multer = require('multer');
const auth = require('../middlewares/auth');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage });
router.post('/', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file' });
  const protocol = req.headers['x-forwarded-proto'] || req.protocol; 
  const host = req.get('host'); 
  const fileUrl = `${protocol}://${host}/uploads/${file.filename}`;

  return res.json({
    url: fileUrl,
    fileName: file.originalname,
    fileType: file.mimetype,
    size: file.size,
  });
});


module.exports = router;
