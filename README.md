# Mixer

A cloud-synced music player PWA. Sign in with Google or an email/password account,
upload songs from your device, stream them from anywhere you sign in, and download
tracks locally so they still play with no internet connection.

**Stack:** Next.js (frontend + API routes) on Vercel · Neon Postgres (user/track metadata)
· Vercel Blob (audio file storage) · NextAuth (Google + credentials auth) · IndexedDB (offline downloads).

Only two platforms to manage: **Vercel** and **Neon**.

---

## 1. Local setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with the values from the steps below, then:

```bash
npm run dev
```

App runs at http://localhost:3000.

---

## 2. Create a Neon database

1. Go to https://neon.tech and create a free project (call it `mixer`).
2. On the project dashboard, copy the **pooled connection string**.
3. Paste it into `DATABASE_URL` in `.env.local`.

Tables (`users`, `tracks`) are created automatically the first time the app talks to
the database — there's no separate migration step to run.

---

## 3. Create a Google OAuth client

1. Go to https://console.cloud.google.com/ → APIs & Services → Credentials.
2. Create Credentials → OAuth client ID → Application type: **Web application**.
3. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
   - `https://YOUR-VERCEL-DOMAIN/api/auth/callback/google` (for production, add after you deploy and know the domain)
4. Copy the Client ID and Client Secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

If your app is only used by you/testing, you can leave the OAuth consent screen in "Testing" mode and add your own Google account as a test user — no Google review needed.

---

## 4. Generate a NextAuth secret

```bash
openssl rand -base64 32
```

Put the result in `NEXTAUTH_SECRET`. Use a different one for local vs. production if you like, but production must have one set.

---

## 5. Set up Vercel Blob storage

1. Deploy this project to Vercel first (see step 6), or create the store ahead of time from any existing Vercel project.
2. In your Vercel project → **Storage** tab → **Create Database** → **Blob**.
3. Vercel will auto-populate `BLOB_READ_WRITE_TOKEN` as an environment variable on that project. Copy it into your local `.env.local` too if you want uploads to work in local dev.

---

## 6. Deploy to Vercel

1. Push this project to a GitHub repo.
2. Go to https://vercel.com/new and import that repo.
3. In the project's **Environment Variables** settings, add everything from `.env.example` with your real values:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` → set to your real `https://your-app.vercel.app` domain
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `BLOB_READ_WRITE_TOKEN` (auto-added if you created the Blob store from this project)
4. Deploy.
5. Go back to Google Cloud Console and add the real production redirect URI (step 3) once you know your Vercel domain.

---

## How it works

- **Auth:** NextAuth handles both Google sign-in and email/password sign-in. Both map onto
  the same `users` table by email — so if you sign up with email/password and later sign in
  with Google using the same address, it's treated as one account with one library.
- **Upload:** Files go straight to Vercel Blob storage (public, unguessable URL); only the
  URL and metadata (title, artist, size) are saved in Postgres.
- **Cross-device sync:** Because tracks are tied to your account in Postgres (not stored on
  one device), signing in anywhere shows the same library.
- **Streaming:** Playback reads directly from the Blob URL — no server proxying needed.
- **Offline downloads:** Hitting "Download" on a track fetches the audio and stores it as a
  Blob in the browser's IndexedDB. Playback checks IndexedDB first, so a downloaded track
  keeps working with no connection. This is per-device — downloading on your phone doesn't
  download on your laptop too, only the *cloud library* is shared.
- **PWA shell:** A basic service worker caches the app's pages so the UI still loads
  offline; it deliberately does not touch API calls or audio files (that's IndexedDB's job).

## Known limitations / things to consider before going further

- **Blob URLs are public.** Anyone with the exact URL can stream a file without logging in
  (they're long random unguessable strings, but not access-controlled). Fine for a personal
  project; if you want real privacy, we'd add a server-side streaming proxy that checks the
  session before serving each file.
- **100MB upload limit** per track, set in `app/api/tracks/upload-url/route.js` — adjust
  `MAX_SIZE_BYTES` if you need larger files. Uploads go straight from the browser to Blob
  storage (not through this app's own server), which is what avoids Vercel's hard ~4.5MB
  request-size cap on serverless functions.
- **Uploads only save to the database on the deployed site, not in local dev.** After a file
  finishes uploading, Vercel's Blob service calls this app back (`onUploadCompleted` in
  `app/api/tracks/upload-url/route.js`) to record it in Postgres — but that callback needs a
  publicly reachable URL, so it can't reach `localhost`. Test uploads on the real Vercel
  deployment; local dev is fine for everything else.
- **No icons yet:** `public/manifest.json` references `/icon-192.png` and `/icon-512.png`
  which don't exist yet — add real app icon images at those paths so "Add to Home Screen"
  looks right.
- **Playlists, search, and metadata editing** aren't built yet — this covers the core
  upload/stream/sync/offline loop you asked for as a foundation to build on.
