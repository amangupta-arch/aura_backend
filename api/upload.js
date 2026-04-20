const crypto = require('crypto');
const path = require('path');

const { SLOTS } = require('../lib/slots');
const { parseMultipart } = require('../lib/multipart');
const { uploadBufferToDrive, isConfigured } = require('../lib/drive');
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

    const driveConfigured = isConfigured();
    const links = {};
    const warnings = [];

    for (const slot of present) {
      const file = files[slot];
      const ext = path.extname(file.filename || '') || '';
      const name = `${userId}__${slot}${ext}`;

      if (driveConfigured) {
        links[slot] = await uploadBufferToDrive({
          buffer: file.buffer,
          mimeType: file.mimeType,
          name,
        });
      } else {
        links[slot] =
          `https://demo.invalid/not-configured/${encodeURIComponent(userId)}/${slot}`;
      }
    }

    if (!driveConfigured) {
      warnings.push(
        'Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_FOLDER_ID in your Vercel project to enable real uploads.'
      );
    }

    const row = upsertUserImages(userId, links);
    return res.status(200).json({
      user_id: userId,
      links: row,
      demo_mode: !driveConfigured,
      warnings,
    });
  } catch (err) {
    console.error('Upload failed:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'Upload failed' });
  }
};
