const { Readable } = require('stream');
const fs = require('fs');
const { google } = require('googleapis');

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
const KEY_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

function loadCredentials() {
  if (KEY_JSON) {
    try {
      return JSON.parse(KEY_JSON);
    } catch (err) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON: ' + err.message
      );
    }
  }
  if (KEY_FILE && fs.existsSync(KEY_FILE)) {
    return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  }
  return null;
}

function isConfigured() {
  return Boolean(FOLDER_ID && (KEY_JSON || (KEY_FILE && fs.existsSync(KEY_FILE))));
}

let driveClient = null;
function getDrive() {
  if (driveClient) return driveClient;
  const credentials = loadCredentials();
  if (!credentials) throw new Error('Google service account credentials are not configured');

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

async function uploadBufferToDrive({ buffer, mimeType, name }) {
  if (!FOLDER_ID) throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set');
  const drive = getDrive();

  const res = await drive.files.create({
    requestBody: { name, parents: [FOLDER_ID] },
    media: { mimeType, body: bufferToStream(buffer) },
    fields: 'id, webViewLink',
  });

  const fileId = res.data.id;
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
}

module.exports = { uploadBufferToDrive, isConfigured };
