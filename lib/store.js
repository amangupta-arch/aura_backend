const fs = require('fs');
const path = require('path');

const { SLOTS } = require('./slots');

const STORE_FILE = process.env.AURA_STORE_FILE || '/tmp/aura-store.json';

function readAll() {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    console.warn('Store read failed, starting empty:', err.message);
    return {};
  }
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

function upsertUserImages(userId, links) {
  const db = readAll();
  const now = new Date().toISOString();
  const existing = db[userId] || {
    user_id: userId,
    front_face: null,
    left_face: null,
    right_face: null,
    front_body: null,
    left_body: null,
    right_body: null,
    created_at: now,
  };

  const merged = { ...existing };
  for (const slot of SLOTS) {
    if (links[slot]) merged[slot] = links[slot];
  }
  merged.updated_at = now;

  db[userId] = merged;
  writeAll(db);
  return merged;
}

function getUserImages(userId) {
  const db = readAll();
  return db[userId] || null;
}

module.exports = { upsertUserImages, getUserImages };
