# aura_backend

A no-login web app that lets anyone upload six photos — **front face, left
face, right face, front body, left body, right body** — and stores each
one in a Google Drive folder. The six resulting links are saved in a SQLite
row keyed by a unique, browser-generated user ID (six columns, one per pose).

## How it works

1. The browser generates a UUID on first visit and keeps it in
   `localStorage` (`aura_user_id`). No sign-up, no login.
2. The user picks one image per slot and submits the form.
3. The Express backend streams every file to Google Drive via a service
   account, makes each file readable by anyone with the link, and stores
   the six `webViewLink` URLs in the `user_images` table against the
   user's ID.
4. Re-submitting with the same user ID updates only the slots that were
   uploaded again (existing links are preserved).

## Stack

- Node.js + Express
- `multer` for multipart form parsing
- `googleapis` for Drive uploads
- `better-sqlite3` for the `user_id → 6 links` table

## Database schema

```sql
CREATE TABLE user_images (
  user_id    TEXT PRIMARY KEY,
  front_face TEXT,
  left_face  TEXT,
  right_face TEXT,
  front_body TEXT,
  left_body  TEXT,
  right_body TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Google service account**

   - Go to <https://console.cloud.google.com/>, pick (or create) a project.
   - Enable the **Google Drive API**.
   - Create a **service account** and download its JSON key.
   - Save the key as `service-account.json` in the project root (or set
     `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` to its path).

3. **Create a Drive folder and share it with the service account**

   - Create any folder in Google Drive.
   - Click **Share** and add the service account's email
     (`something@project.iam.gserviceaccount.com`) with **Editor** access.
   - Copy the folder ID from its URL:
     `https://drive.google.com/drive/folders/<FOLDER_ID>`.

4. **Configure env vars**

   ```bash
   cp .env.example .env
   # then edit .env:
   #   GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account.json
   #   GOOGLE_DRIVE_FOLDER_ID=<FOLDER_ID>
   ```

5. **Run the server**

   ```bash
   npm start
   ```

   Open <http://localhost:3000>.

## API

### `POST /api/upload`

`multipart/form-data` with any subset of these file fields:

`front_face`, `left_face`, `right_face`, `front_body`, `left_body`, `right_body`

Plus an optional `user_id` text field. If omitted, the server generates one.

Response:

```json
{
  "user_id": "…",
  "links": {
    "user_id": "…",
    "front_face": "https://drive.google.com/…",
    "left_face":  "https://drive.google.com/…",
    "right_face": "https://drive.google.com/…",
    "front_body": "https://drive.google.com/…",
    "left_body":  "https://drive.google.com/…",
    "right_body": "https://drive.google.com/…",
    "created_at": "…",
    "updated_at": "…"
  }
}
```

### `GET /api/user/:id`

Returns the stored row (404 if the user ID is unknown).

## Notes

- Per-file upload limit is 20 MB (tweak in `server.js`).
- Uploaded files are named `<user_id>__<slot><ext>` in Drive to make
  cross-referencing easy.
- `service-account.json`, `.env`, and the SQLite file are gitignored.
