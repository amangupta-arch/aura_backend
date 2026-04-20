require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const { SLOTS, upsertUserImages, getUserImages } = require('./db');
const { uploadBufferToDrive } = require('./drive');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const uploadFields = SLOTS.map((name) => ({ name, maxCount: 1 }));

app.post('/api/upload', upload.fields(uploadFields), async (req, res) => {
  try {
    const userId = (req.body.user_id || '').trim() || crypto.randomUUID();
    const files = req.files || {};

    const present = SLOTS.filter((slot) => files[slot] && files[slot][0]);
    if (present.length === 0) {
      return res.status(400).json({ error: 'No images were provided.' });
    }

    const links = {};
    for (const slot of present) {
      const file = files[slot][0];
      const ext = path.extname(file.originalname) || '';
      const name = `${userId}__${slot}${ext}`;
      const link = await uploadBufferToDrive({
        buffer: file.buffer,
        mimeType: file.mimetype,
        name,
      });
      links[slot] = link;
    }

    const row = upsertUserImages(userId, links);
    res.json({ user_id: userId, links: row });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

app.get('/api/user/:id', (req, res) => {
  const row = getUserImages(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.listen(PORT, () => {
  console.log(`Aura backend listening on http://localhost:${PORT}`);
});
