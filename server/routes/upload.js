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

router.post('/', auth, upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
  res.json({ url, fileName: file.originalname, fileType: file.mimetype });
});

module.exports = router;
