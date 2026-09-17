# Henry Dimoko Ministries - Sermon Audio Archive

A high-performance, mobile-first web portal for **Henry Dimoko Ministries**, engineered to deliver bandwidth-conscious, speech-optimized audio versions of YouTube livestreams to congregants with minimal mobile data consumption.

---

## Architecture Overview

* **Frontend:** Next.js (Static HTML/CSS/JS export) hosted on **Cloudflare Pages** with global CDN caching.
* **Audio Storage & CDN:** **Cloudflare R2** (S3-compatible object storage with **\$0.00 egress bandwidth fees**).
* **Audio Ingestion:** Local Python pipeline utilizing `yt-dlp` and `ffmpeg` for automatic audio extraction, pre-service dead air trimming, speech-optimized compression (64 kbps mono MP3), and ID3 metadata tagging.

---

## Step-by-Step Setup Guide

### Phase 1: Local Development Setup

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to view the sermon catalog and test audio playback.

---

### Phase 2: Audio Ingestion Workflow (From YouTube to MP3)

Before running the ingestion pipeline, install the two required audio binaries on your machine:

1. **Install Prerequisites (Windows PowerShell):**
   ```powershell
   # Install yt-dlp via Python pip
   pip install yt-dlp

   # Install FFmpeg via Windows Package Manager
   winget install Gyan.FFmpeg
   ```

2. **Process a YouTube Livestream:**
   Church livestreams frequently include 15 to 30 minutes of pre-service countdowns and dead air before the sermon starts. Use the `--start` flag to trim cleanly:
   ```bash
   python scripts/ingest_sermon.py "https://www.youtube.com/watch?v=YOUR_VIDEO_ID" \
     --start "00:15:30" \
     --series "Prophetic Authority" \
     --speaker "Pastor Henry Dimoko"
   ```

   **What the script does automatically:**
   * Extracts metadata (title, stream date, description) via `yt-dlp`.
   * Trims pre-service dead air (`--start`) and post-service announcements (`--end`).
   * Downmixes stereo to mono (speech does not require stereo channels).
   * Normalizes audio volume using broadcast-standard EBU R128 (`loudnorm`).
   * Encodes audio to 64 kbps MP3 (slashing file sizes by ~70% to roughly 40 MB for a 90-minute service).
   * Injects ID3 metadata tags (Title, Artist, Album, Year).
   * Saves the output to `public/audio/<sermon-slug>.mp3`.
   * Automatically adds the new entry to `data/sermons.json`.

---

### Phase 3: Setting Up Cloudflare R2 (Audio Storage with Zero Egress Fees)

Standard cloud hosts (AWS S3, Vercel) charge heavy penalties when hundreds of church members download 40 MB files. Cloudflare R2 eliminates this with **zero egress fees**.

1. Log in to your free account at [cloudflare.com](https://www.cloudflare.com).
2. In the left navigation bar, click **R2**.
3. Click **Create bucket**.
4. Name your bucket: `hdm-sermon-audio` (Location: Automatic) and click **Create Bucket**.
5. Enable public access for your bucket:
   * Click on your newly created bucket and navigate to the **Settings** tab.
   * Scroll down to **Public access**.
   * Under **R2.dev subdomain**, click **Allow** (or under **Custom Domains**, click **Connect Domain** if you have a custom subdomain like `audio.henrydimokoministries.org`).
   * Note down your public URL (e.g., `https://pub-xxxxxx.r2.dev`).
6. Upload your processed MP3 files directly to this bucket via the Cloudflare web interface, or using Cyberduck / AWS S3 CLI.
7. In `data/sermons.json`, update the `audioUrl` field for your sermons to point to your R2 public URL:
   ```json
   "audioUrl": "https://pub-xxxxxx.r2.dev/power-of-prophetic-declaration.mp3"
   ```

---

### Phase 4: Deploying the Website to Cloudflare Pages

Because this project is configured for static export (`output: 'export'` in `next.config.ts`), you can deploy to Cloudflare Pages for free with zero cold starts.

#### Option A: Drag-and-Drop Deployment (No Git Required, Takes 2 Minutes)

1. Build the production output on your computer:
   ```bash
   npm run build
   ```
   This compiles your Next.js application into a production-ready `out/` folder.
2. Log in to [dash.cloudflare.com](https://dash.cloudflare.com).
3. In the sidebar, go to **Compute (Workers & Pages)** -> **Create application** -> **Pages**.
4. Select the **Upload assets** tab.
5. Enter a project name (e.g., `henrydimoko-audio`).
6. Drag and drop the generated `out/` folder into the upload dropzone.
7. Click **Deploy site**.
8. Cloudflare will provision global edge routing and provide your live link:
   `https://henrydimoko-audio.pages.dev`

#### Option B: Automated Git Deployment (Recommended for Continuous Updates)

1. Push your project to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Henry Dimoko Ministries Sermon Portal"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/akoopistis.git
   git push -u origin main
   ```
2. In Cloudflare Dashboard, go to **Compute (Workers & Pages)** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Select your repository from the list.
4. Under **Build settings**, configure:
   * **Framework preset:** `Next.js (Static Export)`
   * **Build command:** `npm run build`
   * **Build output directory:** `out`
5. Click **Save and Deploy**.
6. Every time you push a new sermon or update code to GitHub, Cloudflare automatically builds and deploys your site in under 60 seconds.

---

### Phase 5: Connecting a Custom Domain Later (Free)

Whenever the ministry purchases an official domain (e.g., `henrydimokoministries.org`):

1. Go to your Cloudflare Pages project dashboard.
2. Click the **Custom domains** tab.
3. Click **Set up a custom domain**.
4. Enter your domain or subdomain (e.g., `sermons.henrydimokoministries.org`).
5. Follow the one-click DNS prompt. Cloudflare automatically issues and manages free SSL/TLS certificates with zero downtime.

---

## Project File Structure

```
akoopistis/
├── data/
│   └── sermons.json          # Curated sermon archive database
├── public/
│   └── audio/                # Local audio files for development
├── scripts/
│   └── ingest_sermon.py      # Python audio extraction and encoding pipeline
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout with AudioPlayerProvider & Header/Footer
│   │   ├── page.tsx          # Homepage with HeroBanner & SermonList
│   │   └── globals.css       # Tailwind CSS styling
│   ├── components/
│   │   ├── AudioPlayerBar.tsx # Sticky bottom persistent audio dock
│   │   ├── HeroBanner.tsx     # Ministry highlight and latest sermon spotlight
│   │   ├── SermonCard.tsx     # Individual sermon player and download card
│   │   ├── SermonList.tsx     # Filterable and searchable sermon catalog
│   │   ├── Header.tsx         # Navigation bar
│   │   └── Footer.tsx         # Ministry footer
│   ├── context/
│   │   └── AudioPlayerContext.tsx # Global audio playback state manager
│   ├── types/
│   │   └── sermon.ts          # TypeScript models and interfaces
│   └── utils/
│       └── format.ts          # Timestamp and date formatting utilities
├── .env.example              # Cloudflare R2 credentials template
├── next.config.ts            # Static export configuration for Cloudflare Pages
└── package.json
```
