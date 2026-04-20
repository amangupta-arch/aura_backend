const { Readable } = require('stream');
const { google } = require('googleapis');

const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './service-account.json';
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

async function uploadBufferToDrive({ buffer, mimeType, name }) {
  if (!FOLDER_ID) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set');
  }

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [FOLDER_ID],
    },
    media: {
      mimeType,
      body: bufferToStream(buffer),
    },
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = res.data.id;

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
}

module.exports = { uploadBufferToDrive };
