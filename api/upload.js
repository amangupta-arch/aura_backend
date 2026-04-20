const crypto = require('crypto');
const path = require('path');

const { SLOTS } = require('../lib/slots');
const { parseMultipart } = require('../lib/multipart');
const { isConfigured, uploadBuffer } = require('../lib/supabase');
const { upsertUserImages } = require('../lib/store');

module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseMultipart(req);
    const userId = (fields.user_id || '').trim() || crypto.randomUUID();

    const present = SLOTS.filter((slot) => files[slot]);
    if (present.length === 0) {
      return res.status(400).json({ error: 'No images were provided.' });
    }

    if (!isConfigured()) {
      return res.status(503).json({
        error:
          'Supabase is not configured on the server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      });
    }

    const links = {};
    for (const slot of present) {
      const file = files[slot];
      const ext = (path.extname(file.filename || '') || '.jpg').toLowerCase();
      const storagePath = `${userId}/${slot}${ext}`;
      links[slot] = await uploadBuffer({
        buffer: file.buffer,
        mimeType: file.mimeType,
        path: storagePath,
      });
    }

    const row = await upsertUserImages(userId, links);
    return res.status(200).json({ user_id: userId, links: row });
  } catch (err) {
    console.error('Upload failed:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Upload failed' });
  }
};
