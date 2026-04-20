# aura_backend

A no-login web app that lets anyone upload six photos — **front face, left
face, right face, front body, left body, right body** — stores each one in
Supabase Storage, and saves the six resulting public URLs in six columns
keyed by a browser-generated anonymous user ID.

## How it works

1. The browser creates a UUID on first visit and keeps it in
   `localStorage` (`aura_user_id`). No sign-up, no login.
2. The page downscales each picked photo in a canvas (max 1600 px edge,
   JPEG 0.85) and POSTs each slot as its own request (one at a time) so
   no single payload exceeds Vercel's 4.5 MB body limit.
3. Each Vercel serverless call parses the upload with `busboy`, pushes
   the bytes into the `aura-backend-photos` bucket at
   `<user_id>/<slot>.jpg`, and upserts the public URL into the
   `public.photo_uploads` row for that user (six columns: `front_face`,
   `left_face`, `right_face`, `front_body`, `left_body`, `right_body`).
4. Re-uploading a slot overwrites the file and updates only that column.

## Stack

- Vercel serverless Node.js functions (`api/*.js`)
- `busboy` for multipart form parsing
- `@supabase/supabase-js` (service-role key) for Storage + Postgres
- Supabase Storage bucket `aura-backend-photos` (public read)
- Supabase table `public.photo_uploads` (RLS on, bypassed by service role)

## Environment variables

| Variable                    | Required | Description                                              |
| --------------------------- | -------- | -------------------------------------------------------- |
| `SUPABASE_URL`              | yes      | e.g. `https://<ref>.supabase.co`                         |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | Service-role key (Supabase → Settings → API).            |
| `SUPABASE_BUCKET`           | no       | Override bucket name (default `aura-backend-photos`).    |

Without the two Supabase vars the app still loads, but `/api/upload`
returns 503 and the page shows a configuration banner.

## Vercel setup

1. In Vercel → `aura-backend` → **Settings → Environment Variables**, add
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (values from your
   Supabase project's Settings → API page).
2. Redeploy (or push any commit) so the new vars are picked up.

## Database schema

```sql
CREATE TABLE public.photo_uploads (
  user_id    text PRIMARY KEY,
  front_face text,
  left_face  text,
  right_face text,
  front_body text,
  left_body  text,
  right_body text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

The storage bucket `aura-backend-photos` is created alongside the table.

## Local development

```bash
npm install
npx vercel dev
```

Put the same env vars in a `.env.local` file to test real uploads locally.

## API

### `POST /api/upload`

`multipart/form-data` with any subset of these file fields (≤4.5 MB each):

`front_face`, `left_face`, `right_face`, `front_body`, `left_body`, `right_body`

Plus an optional `user_id` text field (server generates a UUID otherwise).

Response:

```json
{
  "user_id": "…",
  "links": {
    "user_id":    "…",
    "front_face": "https://<ref>.supabase.co/storage/v1/object/public/aura-backend-photos/…",
    "left_face":  "…",
    "right_face": "…",
    "front_body": "…",
    "left_body":  "…",
    "right_body": "…",
    "created_at": "…",
    "updated_at": "…"
  }
}
```

### `GET /api/user/:id`

Returns the stored row for that user ID (404 if unknown).

### `GET /api/status`

Returns `{ "storage_configured": true|false }` — used by the frontend to
show a configuration banner when the env vars are missing.
