#!/usr/bin/env python3
"""
Henry Dimoko Ministries - Sermon Audio Ingestion Utility

Automates downloading, speech optimization, ID3 metadata tagging, and catalog registration
for YouTube livestreams.

Resilient architecture:
- If FFmpeg is present: Trims dead air, normalizes speech volume (EBU R128), and downmixes to 64 kbps mono MP3.
- If FFmpeg is absent: Gracefully falls back to downloading YouTube's native high-efficiency M4A audio stream directly.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

try:
    import boto3
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")
except ImportError:
    boto3 = None


def get_ytdlp_cmd():
    """Find yt-dlp executable or fallback to python -m yt_dlp."""
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]
    try:
        res = subprocess.run([sys.executable, "-m", "yt_dlp", "--version"], capture_output=True)
        if res.returncode == 0:
            return [sys.executable, "-m", "yt_dlp"]
    except Exception:
        pass
    return None


def has_ffmpeg():
    """Check if ffmpeg is on system PATH."""
    return shutil.which("ffmpeg") is not None


def slugify(text: str) -> str:
    """Create a URL-safe, filesystem-safe slug from a string."""
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")[:60]


def format_duration(seconds: int) -> str:
    """Format duration in seconds to human readable string (e.g., '1h 45m')."""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}h {minutes:02d}m"
    return f"{minutes}m"


def format_file_size(bytes_size: int) -> str:
    """Format file size in bytes to MB with 1 decimal place."""
    mb = bytes_size / (1024 * 1024)
    return f"{mb:.1f} MB"


def extract_metadata(ytdlp_cmd: list, youtube_url: str):
    """Extract stream title, date, duration, and description using yt-dlp."""
    print(f"[*] Querying stream metadata from {youtube_url}...")
    cmd = ytdlp_cmd + [
        "-4",
        "--socket-timeout", "30",
        "--dump-json",
        "--skip-download",
        "--no-playlist",
        youtube_url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        return {
            "title": data.get("title", "Untitled Sermon"),
            "description": data.get("description", ""),
            "duration": int(data.get("duration", 0)),
            "upload_date": data.get("upload_date", ""),
            "id": data.get("id", ""),
            "webpage_url": data.get("webpage_url", youtube_url),
        }
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Failed to fetch stream metadata: {e.stderr}")
        return None
    except Exception as e:
        print(f"[ERROR] Parsing metadata failed: {str(e)}")
        return None


def process_audio(
    ytdlp_cmd: list,
    youtube_url: str,
    output_path: Path,
    start_time: str = None,
    end_time: str = None,
    bitrate: str = "64k",
    title: str = "Henry Dimoko Ministries Live",
    speaker: str = "Pastor Henry Dimoko",
    fast_mode: bool = False,
):
    """Download audio stream via yt-dlp. Uses FFmpeg if available (unless fast_mode is True), otherwise direct M4A stream."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if has_ffmpeg() and not fast_mode:
        print(f"[*] FFmpeg detected. Downloading and encoding to normalized {bitrate} MP3...")
        temp_raw = output_path.with_suffix(".temp.webm")
        try:
            # Download best audio stream with resilient retry settings
            yt_cmd = ytdlp_cmd + [
                "-f", "bestaudio[ext=m4a]/bestaudio/best",
                "-o", str(temp_raw),
                "--no-playlist",
                "--retries", "20",
                "--fragment-retries", "20",
                "--retry-sleep", "5",
                "--socket-timeout", "30",
                youtube_url,
            ]
            subprocess.run(yt_cmd, check=True)

            # Transcode, normalize volume, downmix to mono, and tag ID3 metadata
            ffmpeg_cmd = ["ffmpeg", "-y"]
            if start_time:
                ffmpeg_cmd.extend(["-ss", start_time])
            ffmpeg_cmd.extend(["-i", str(temp_raw)])
            if end_time:
                ffmpeg_cmd.extend(["-to", end_time])

            ffmpeg_cmd.extend([
                "-vn",
                "-ac", "1",
                "-ar", "44100",
                "-b:a", bitrate,
                "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                "-metadata", f"title={title}",
                "-metadata", f"artist={speaker}",
                "-metadata", "album=Henry Dimoko Ministries Sermons",
                "-metadata", f"date={datetime.now().year}",
                "-metadata", "genre=Speech",
                str(output_path),
            ])

            subprocess.run(ffmpeg_cmd, check=True)
            if temp_raw.exists():
                temp_raw.unlink()
            return True, output_path
        except Exception as e:
            print(f"[ERROR] FFmpeg processing failed: {e}")
            if temp_raw.exists():
                temp_raw.unlink()
            return False, output_path
    else:
        # Graceful fallback: Native M4A download without FFmpeg
        actual_output = output_path.with_suffix(".m4a")
        print(f"[*] FFmpeg not installed. Downloading native high-efficiency M4A stream directly...")
        print(f"[*] Target destination: {actual_output}")
        try:
            # Format 140 is standard 128k AAC; format 139 is ultra-low 49k AAC
            yt_cmd = ytdlp_cmd + [
                "-4",
                "--socket-timeout", "30",
                "--retries", "10",
                "-f", "139/140/bestaudio[ext=m4a]/bestaudio",
                "-o", str(actual_output),
                "--no-playlist",
                youtube_url,
            ]
            subprocess.run(yt_cmd, check=True)
            return True, actual_output
        except Exception as e:
            print(f"[ERROR] Direct M4A download failed: {e}")
            return False, actual_output


def upload_to_r2(local_path: Path, object_name: str = None) -> str:
    """Upload audio file to Cloudflare R2 and return the public URL."""
    if not boto3:
        print("[WARN] boto3 is not installed; skipping R2 upload.")
        return f"/audio/{local_path.name}"

    endpoint = os.getenv("R2_ENDPOINT_URL")
    key_id = os.getenv("R2_ACCESS_KEY_ID")
    secret = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket = os.getenv("R2_BUCKET_NAME")
    public_prefix = os.getenv("R2_PUBLIC_URL_PREFIX", "").rstrip("/")

    if not all([endpoint, key_id, secret, bucket]):
        print("[WARN] Missing R2 credentials in .env.local; skipping R2 upload.")
        return f"/audio/{local_path.name}"

    if not object_name:
        object_name = local_path.name

    print(f"[*] Uploading {local_path.name} to Cloudflare R2 bucket '{bucket}'...")
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=key_id,
            aws_secret_access_key=secret,
            region_name="auto",
        )
        content_type = "audio/mp4" if local_path.suffix.lower() == ".m4a" else "audio/mpeg"
        s3.upload_file(
            str(local_path),
            bucket,
            object_name,
            ExtraArgs={"ContentType": content_type}
        )
        print(f"[SUCCESS] Uploaded {object_name} to R2!")
        if public_prefix:
            return f"{public_prefix}/{object_name}"
        return f"/audio/{object_name}"
    except Exception as e:
        print(f"[ERROR] R2 upload failed: {e}")
        return f"/audio/{local_path.name}"


def update_catalog(sermon_data: dict, catalog_path: Path):
    """Add or update the sermon in data/sermons.json."""
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    sermons = []
    if catalog_path.exists():
        try:
            with open(catalog_path, "r", encoding="utf-8") as f:
                sermons = json.load(f)
        except Exception:
            sermons = []

    existing_index = next((i for i, s in enumerate(sermons) if s["id"] == sermon_data["id"]), None)
    if existing_index is not None:
        sermons[existing_index] = sermon_data
        print(f"[*] Updated existing catalog record: {sermon_data['id']}")
    else:
        sermons.insert(0, sermon_data)
        print(f"[*] Added new sermon to catalog: {sermon_data['id']}")

    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(sermons, f, indent=2, ensure_ascii=False)
    print(f"[SUCCESS] Catalog written to {catalog_path}")


def fetch_channel_streams(ytdlp_cmd, channel_url: str, limit: int = 120):
    """Scan recent streams from channel playlist."""
    print(f"[*] Scanning recent streams from {channel_url}...")
    cmd = ytdlp_cmd + [
        "--flat-playlist",
        "--playlist-end", str(limit),
        "--dump-single-json",
        channel_url
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        print(f"[ERROR] Failed to fetch channel streams: {res.stderr}")
        return []

    try:
        data = json.loads(res.stdout)
        entries = data.get("entries", [])
        print(f"[*] Discovered {len(entries)} total streams from channel.")
        return entries
    except Exception as e:
        print(f"[ERROR] Parsing channel JSON failed: {e}")
        return []


def process_bulk_entry(ytdlp_cmd, entry: dict, project_root: Path, catalog_path: Path):
    """Process a single video entry from the channel list."""
    video_id = entry.get("id")
    if not video_id:
        return False

    video_url = f"https://www.youtube.com/watch?v={video_id}"
    meta = extract_metadata(ytdlp_cmd, video_url)
    if not meta:
        return False

    duration = meta.get("duration") or 0
    if duration < 1200:
        print(f"[*] Skipping {video_id}: Duration ({format_duration(duration)}) is shorter than 20 mins.")
        return False

    raw_title = meta.get("title", "HDM Live Broadcast")
    desc = meta.get("description", "")

    # Classify series
    series = "Breakthrough Service"
    upper_title = raw_title.upper()
    upper_desc = desc.upper()
    if "ANOINTING" in upper_title or "ANOINTING" in upper_desc:
        series = "Anointing Service"
    elif "COMMUNION" in upper_title or "COMMUNION" in upper_desc:
        series = "Communion Service"
    elif "IMPARTATION" in upper_title or "IMPARTATION" in upper_desc:
        series = "Impartation Service"
    elif "REVIVAL" in upper_title or "REVIVAL" in upper_desc:
        series = "Mid-Week Revival"

    # Extract clean message title if present
    message_title = None
    for line in desc.splitlines()[:15]:
        m = re.search(r"MESSAGE[:\s-]+(.+)", line, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip()
            if candidate and len(candidate) > 3:
                message_title = candidate
                break

    if message_title:
        title = f"{series}: {message_title}"
    else:
        title = raw_title.strip()

    sermon_slug = slugify(title)
    temp_dir = project_root / "temp_audio"
    temp_dir.mkdir(parents=True, exist_ok=True)
    target_audio_path = temp_dir / f"{sermon_slug}.mp3"

    print(f"\n=======================================================")
    print(f"[>] Ingesting: {title} ({format_duration(duration)})")
    print(f"=======================================================")

    success, final_audio_path = process_audio(
        ytdlp_cmd=ytdlp_cmd,
        youtube_url=video_url,
        output_path=target_audio_path,
        bitrate="64k",
        title=title,
        speaker="Pastor Henry Dimoko",
        fast_mode=False,
    )

    if not success or not final_audio_path.exists():
        print(f"[WARN] Ingestion failed for {title}")
        return False

    file_size_bytes = final_audio_path.stat().st_size

    # Upload to Cloudflare R2
    r2_object_name = f"{sermon_slug}{final_audio_path.suffix}"
    audio_url = upload_to_r2(final_audio_path, r2_object_name)

    # Immediately delete local temporary file to conserve disk space
    if final_audio_path.exists():
        final_audio_path.unlink()
        print(f"[*] Cleaned up local temp file: {final_audio_path.name}")

    upload_date_str = meta.get("upload_date", "")
    if len(upload_date_str) == 8:
        parsed_date = f"{upload_date_str[:4]}-{upload_date_str[4:6]}-{upload_date_str[6:]}"
    else:
        parsed_date = datetime.now().strftime("%Y-%m-%d")

    sermon_record = {
        "id": sermon_slug,
        "title": title,
        "description": meta.get("description", "").strip()[:300] or "Live sermon broadcast.",
        "speaker": "Pastor Henry Dimoko",
        "date": parsed_date,
        "duration": duration,
        "durationFormatted": format_duration(duration),
        "fileSizeBytes": file_size_bytes,
        "fileSizeFormatted": format_file_size(file_size_bytes),
        "audioUrl": audio_url,
        "youtubeUrl": video_url,
        "series": series,
        "tags": [series, "Sermon", "Audio"],
        "featured": False,
    }

    update_catalog(sermon_record, catalog_path)
    print(f"[SUCCESS] Registered and uploaded: {title}")
    return True


def main():
    parser = argparse.ArgumentParser(description="Henry Dimoko Ministries - 50-Sermon Bulk Ingestion Engine")
    parser.add_argument("--count", type=int, default=50, help="Number of new sermons to ingest (default: 50)")
    parser.add_argument("--dry-run", action="store_true", help="Preview candidate streams without downloading")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    catalog_path = project_root / "data" / "sermons.json"
    state_path = project_root / "data" / "bulk_state.json"

    ytdlp_cmd = get_ytdlp_cmd()
    if not ytdlp_cmd:
        print("[ERROR] yt-dlp is not installed.")
        sys.exit(1)

    # 1. Collect all already-ingested video IDs
    existing_ids = set()
    if catalog_path.exists():
        try:
            with open(catalog_path, "r", encoding="utf-8") as f:
                for s in json.load(f):
                    yurl = s.get("youtubeUrl", "")
                    m = re.search(r"[?&]v=([^&]+)", yurl)
                    if m:
                        existing_ids.add(m.group(1))
        except Exception:
            pass

    print(f"[*] Found {len(existing_ids)} sermons already registered in catalog.")

    # 2. Fetch recent streams from the channel
    channel_url = "https://www.youtube.com/@henrydimokoministries4431/streams"
    all_entries = fetch_channel_streams(ytdlp_cmd, channel_url, limit=args.count + 50)

    # 3. Filter candidates
    candidates = []
    for entry in all_entries:
        vid = entry.get("id")
        if not vid or vid in existing_ids:
            continue
        duration = entry.get("duration")
        # Keep if duration is unknown (None) or >= 20 mins
        if duration is not None and duration < 1200:
            continue
        candidates.append(entry)
        if len(candidates) >= args.count:
            break

    print(f"\n[*] Found {len(candidates)} new candidate streams ready for ingestion.")

    if args.dry_run:
        print("\n=== DRY RUN PREVIEW (Top Candidates) ===")
        for i, c in enumerate(candidates, 1):
            dur = format_duration(c.get("duration") or 0) if c.get("duration") else "Unknown"
            print(f"[{i:02d}] ID: {c.get('id')} | Duration: {dur} | Title: {c.get('title')}")
        print("=========================================\n")
        return

    # 4. Process each candidate sequentially
    success_count = 0
    for idx, c in enumerate(candidates, 1):
        vid = c.get("id")
        print(f"\n>>> [Item {idx}/{len(candidates)}] Processing YouTube ID: {vid}")
        ok = process_bulk_entry(ytdlp_cmd, c, project_root, catalog_path)
        if ok:
            success_count += 1
            # Update checkpoint state
            with open(state_path, "w", encoding="utf-8") as sf:
                json.dump({
                    "lastCompleted": vid,
                    "completedCount": success_count,
                    "timestamp": datetime.now().isoformat()
                }, sf, indent=2)

    print(f"\n[ALL DONE] Bulk processing finished. Successfully added {success_count} sermons!")


if __name__ == "__main__":
    main()

