const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_FILE || './data/aura.db';

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS user_images (
    user_id       TEXT PRIMARY KEY,
    front_face    TEXT,
    left_face     TEXT,
    right_face    TEXT,
    front_body    TEXT,
    left_body     TEXT,
    right_body    TEXT,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );
`);

const SLOTS = ['front_face', 'left_face', 'right_face', 'front_body', 'left_body', 'right_body'];

function upsertUserImages(userId, links) {
  const row = {
    user_id: userId,
    front_face: links.front_face || null,
    left_face: links.left_face || null,
    right_face: links.right_face || null,
    front_body: links.front_body || null,
    left_body: links.left_body || null,
    right_body: links.right_body || null,
  };

  const stmt = db.prepare(`
    INSERT INTO user_images (user_id, front_face, left_face, right_face, front_body, left_body, right_body)
    VALUES (@user_id, @front_face, @left_face, @right_face, @front_body, @left_body, @right_body)
    ON CONFLICT(user_id) DO UPDATE SET
      front_face = COALESCE(excluded.front_face, user_images.front_face),
      left_face  = COALESCE(excluded.left_face,  user_images.left_face),
      right_face = COALESCE(excluded.right_face, user_images.right_face),
      front_body = COALESCE(excluded.front_body, user_images.front_body),
      left_body  = COALESCE(excluded.left_body,  user_images.left_body),
      right_body = COALESCE(excluded.right_body, user_images.right_body),
      updated_at = datetime('now')
  `);
  stmt.run(row);

  return db.prepare('SELECT * FROM user_images WHERE user_id = ?').get(userId);
}

function getUserImages(userId) {
  return db.prepare('SELECT * FROM user_images WHERE user_id = ?').get(userId);
}

module.exports = { db, SLOTS, upsertUserImages, getUserImages };
