# aura_backend

A no-login web app that lets anyone upload six photos — **front face, left
face, right face, front body, left body, right body** — stores each one in
a shared Google Drive folder, and saves the six resulting share links in
six columns keyed by a browser-generated anonymous user ID.

## How it works

1. The browser creates a UUID on first visit and keeps it in
   `localStorage` (`aura_user_id`). No sign-up, no login.
2. The user picks one image per slot and submits the form.
3. A Vercel serverless function parses the multipart upload with `busboy`,
   streams each file to Google Drive via a service account, sets
   "anyone with link" reader permission, then upserts the six
   `webViewLink` URLs for that user ID.
4. Re-submitting with the same user ID only updates the slots that were
   re-uploaded — the other links stay intact.

## Stack

- Vercel serverless Node.js functions (`api/*.js`)
- `busboy` for multipart form parsing
- `googleapis` for Drive uploads
- JSON file in `/tmp` as the `user_id → 6 links` store (ephemeral per Lambda
  container — easy to swap for Postgres/Supabase/Vercel KV later)

## Project layout

```
.
├── api/
│   ├── upload.js          # POST /api/upload
│   ├── user/[id].js       # GET  /api/user/:id
│   └── status.js          # GET  /api/status (tells the UI if Drive is configured)
├── lib/
│   ├── drive.js           # Google Drive service-account upload
│   ├── multipart.js       # busboy-based form parsing
│   ├── slots.js           # canonical slot names
│   └── store.js           # JSON file store
├── public/                # static frontend served at /
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── vercel.json
└── package.json
```

## Environment variables

| Variable                      | Required | Description                                                   |
| ----------------------------- | -------- | ------------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | yes      | The full service-account key JSON as a single string.         |
| `GOOGLE_DRIVE_FOLDER_ID`      | yes      | Target Drive folder ID (shared with the service account).     |
| `AURA_STORE_FILE`             | no       | Override the JSON store location (default `/tmp/aura-store.json`). |

Without the two Google vars the app runs in **demo mode**: the UI still
works end-to-end, but `/api/upload` returns placeholder URLs and shows a
banner at the top of the page.

## Setup (Google side)

1. Go to <https://console.cloud.google.com/>, select/create a project.
2. Enable the **Google Drive API**.
3. Create a **service account** and download its JSON key.
4. Create a folder in Google Drive, click **Share**, and add the service
   account's email (`…@…iam.gserviceaccount.com`) as **Editor**.
5. Copy the folder ID from its URL
   (`https://drive.google.com/drive/folders/<FOLDER_ID>`).
6. In Vercel → Project → Settings → Environment Variables, add:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = the entire key JSON, pasted as one value
   - `GOOGLE_DRIVE_FOLDER_ID` = `<FOLDER_ID>`
7. Redeploy (or push a commit) so the new env vars are picked up.

## Local development

```bash
npm install
npx vercel dev
```

Put the same env vars in a `.env.local` file to test real uploads locally.

## API

### `POST /api/upload`

`multipart/form-data` with any subset of these file fields, capped at
~4 MB each (Vercel request-body limit):

`front_face`, `left_face`, `right_face`, `front_body`, `left_body`, `right_body`

Plus an optional `user_id` text field (server generates a UUID otherwise).

Response:

```json
{
  "user_id": "…",
  "demo_mode": false,
  "warnings": [],
  "links": {
    "user_id":   "…",
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

Returns the stored row for that user ID (404 if unknown).

### `GET /api/status`

Returns `{ "drive_configured": true|false }` — used by the frontend to
show the demo-mode banner.
