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

- **Sections:** the app is organized into four sections reachable from the bottom nav
  (and, redundantly but by design, from tiles on the Home screen): **Home**, **Folders**,
  **All Songs**, and **Account**.
- **All Songs** is the master library — every uploaded track lives here, and this is the
  only place a song can be permanently deleted.
- **Folders** are separate from the library itself: adding a song to a folder just creates
  an association between them, it doesn't move or copy the song. Removing a song from a
  folder never deletes the song — only deleting from All Songs does that. Every account
  has one **default folder** ("All Uploads") that every new upload is automatically added
  to; it can't be deleted, though you can still create your own folders alongside it.
  Folders support both grid and list view (toggle top-right).
- **Account** shows a simple account card and is where Sign out lives now.
- **Duplicate detection:** every upload is fingerprinted with a SHA-256 hash of the file's
  contents (computed in the browser). Uploading the exact same audio file twice — even
  under a different filename — is rejected with a clear message, both from a fast local
  check and an authoritative server-side check.
- **Offline uploads:** choosing a song while offline (or if the upload attempt otherwise
  fails) queues it locally in IndexedDB instead of losing it. The All Songs screen shows a
  "Local (not yet uploaded)" panel above the cloud library with an **Upload to Cloud**
  button and a progress bar; successful items disappear from that panel as they sync.
  The Folders section also has a fixed "Local (offline)" folder showing the same queue.
  The existing "All Uploads" default folder already covers "all cloud songs" as a fixed
  folder, so a separate duplicate "Cloud" folder wasn't added — say the word if you'd
  rather have that as its own explicit tile anyway.
- **Offline library view:** the last successfully loaded track list is cached locally, so
  reopening the app with no connection still shows your library (with a small notice) —
  playback still requires either the network or the song having been explicitly
  downloaded for offline listening.
- **Songs queued offline are playable immediately** — a song added while offline (or one
  still waiting in the "Local" queue for any reason) plays straight from the copy already
  sitting in the browser, with no need to wait for it to reach the cloud first.
- **Now Playing screen:** tapping any song (or the mini player bar at the bottom) opens a
  full-screen player with play/pause, next/previous, Shuffle, Loop, a seek bar, and a
  ⋮ menu for "Add to folder" / "Delete" (or "Remove from queue" for a not-yet-synced
  local song). Minimize with the ⌄ at the top.
- **Playback order:** by default, a folder or the library plays straight through and stops
  after the last song. Turning Loop on (from the Now Playing screen) makes it wrap back to
  the start instead. Shuffle reorders the upcoming songs in the current queue; the Shuffle
  button inside a folder immediately shuffles and plays that folder's songs from the top.
- **Home is the upload screen.** Uploading now happens from Home rather than from All Songs
  — All Songs is purely for browsing/managing what's already there.
- **All Songs has a Cloud / Local tab bar** at the top instead of stacked sections, to
  switch between your synced library and whatever's still queued locally.
- **Every song has a ⋮ menu** with the actions that make sense for where it's showing up:
  a cloud song offers Download/Remove download, Add to folder, and Delete; a folder song
  offers Download, Add to another folder, and Remove from this folder (not a full delete);
  a not-yet-synced local song offers Upload now and Remove from queue. Tapping anywhere on
  a song's row plays it — not just a small icon.
- **Folders have a ⋮ menu too** (on real, non-default folders) for Rename and Delete.
- **A song you uploaded stays playable offline on that same device**, automatically, with
  no need to separately "download" a file that device already has the bytes for — e.g.
  upload 3 songs on your phone, then go offline: your phone can still play them. A second
  device only gets that offline access once it explicitly downloads that song (or once its
  own upload of a duplicate file was rejected in favor of the existing one).
- **Home is just the uploader now** — the decorative section tiles were removed; the bottom
  nav is the one way to move between sections.
- **Search** — a search box at the top of All Songs' Cloud tab filters by title or artist.
- **Icons instead of emoji** — every control (play/pause, next/prev, shuffle, loop, menus,
  nav bar, etc.) uses small hand-drawn SVG icons (`components/icons.js`) rather than emoji
  characters, for a more consistent, deliberate look across devices and platforms.
- **Swipe the mini player up** to open Now Playing full-screen; **swipe Now Playing down**
  to collapse it back — dragging the seek bar or tapping the control buttons doesn't trigger
  this. This is built with pointer events and hasn't been tested on a real phone from this
  environment, so it's worth double-checking the feel on your actual device.
- **The hardware/phone Back button acts like an in-app back button** — pressing it while a
  folder or the Now Playing screen is open closes just that, instead of leaving the app.
  When there's nothing open to close, the first Back press shows a brief "Press back again
  to exit" notice instead of immediately leaving; a second press within ~2 seconds actually
  exits. This is deliberately a *light-touch* pattern (touches history once per attempt)
  rather than an infinite block — an earlier, more aggressive version that tried to prevent
  Back from ever exiting caused the opposite problem on real Android hardware (the app would
  still eventually reload after a couple of presses, losing playback state, just delayed).
  Mobile back-button/history behavior for installed PWAs is genuinely finicky and hard to
  fully verify without a real device to test on — if this still doesn't feel right, let me
  know exactly what happens and we'll adjust further.
- **Pull-to-refresh is disabled** on mobile (`overscroll-behavior-y: none`) so swiping down
  at the top of a screen doesn't reload the page.
- **Multi-select** — a "Select" toggle in All Songs (Cloud tab) and inside folders turns on
  checkboxes; with one or more songs selected, a bar appears to Add to folder or
  Delete/Remove in bulk instead of one at a time.

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
