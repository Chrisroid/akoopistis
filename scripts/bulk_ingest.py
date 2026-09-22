#!/usr/bin/env python3
"""
Henry Dimoko Ministries - Sermon Audio Ingestion Utility (Plan A Engine)

Automates downloading, speech optimization, ID3 metadata tagging, and catalog registration
for YouTube livestreams.

Features:
- Android player API client routing to bypass YouTube bot detection and HTTP 429.
- Intelligent title sanitization: cleans embedded DATE strings and extracts message names from descriptions.
- Date-differentiated slugs and R2 object keys preventing file/record overwriting.
- EBU R128 speech volume normalization and 64 kbps mono downmixing via FFmpeg.
- Cloudflare R2 direct bucket upload and instant local temporary disk cleanup.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
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
    """Extract stream title, date, duration, and description using yt-dlp via android client."""
    print(f"[*] Querying stream metadata from {youtube_url}...")
    cmd = ytdlp_cmd + [
        "-4",
        "--socket-timeout", "30",
        "--extractor-args", "youtube:player_client=android",
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


def sanitize_metadata(raw_title: str, desc: str, upload_date_str: str, video_id: str):
    """
    Sanitize titles, parse dates, extract message topics, and classify series.
    Returns: (cleaned_title, parsed_date, series, sermon_slug)
    """
    title = raw_title.strip()

    # 1. Check for embedded DATE in title (e.g. 'SERVICEDATE: 19/12/2025' or 'DATE: 7/12/2025')
    date_match = re.search(r"DATE\s*:\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", title, re.IGNORECASE)
    parsed_date = None
    date_readable = None
    if date_match:
        day, month, year = date_match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            parsed_date = dt.strftime("%Y-%m-%d")
            date_readable = dt.strftime("%b %d, %Y")
        except Exception:
            pass
        title = re.sub(r"DATE\s*:\s*\d{1,2}[/.-]\d{1,2}[/.-]\d{4}", "", title, flags=re.IGNORECASE).strip()

    # Fallback to upload_date if no date was parsed from title
    if not parsed_date and len(upload_date_str) == 8:
        try:
            dt = datetime.strptime(upload_date_str, "%Y%m%d")
            parsed_date = dt.strftime("%Y-%m-%d")
            date_readable = dt.strftime("%b %d, %Y")
        except Exception:
            pass
    if not parsed_date:
        parsed_date = datetime.now().strftime("%Y-%m-%d")
        date_readable = datetime.now().strftime("%b %d, %Y")

    # Normalize multiple whitespace and trailing colons/hyphens
    title = re.sub(r"\s+", " ", title).strip(" :-")

    # 2. Classify series
    series = "Breakthrough Service"
    upper_title = title.upper()
    upper_desc = desc.upper()
    if "ANOINTING" in upper_title or "ANOINTING" in upper_desc:
        series = "Anointing Service"
    elif "COMMUNION" in upper_title or "COMMUNION" in upper_desc:
        series = "Communion Service"
    elif "IMPARTATION" in upper_title or "IMPARTATION" in upper_desc:
        series = "Impartation Service"
    elif "REVIVAL" in upper_title or "REVIVAL" in upper_desc:
        series = "Mid-Week Revival"
    elif "THANKSGIVING" in upper_title:
        series = "Thanksgiving Service"
    elif "CROSSOVER" in upper_title:
        series = "Crossover Service"
    elif "EBENEZER" in upper_title:
        series = "Ebenezer Convention"
    elif "JUDGEMENTAL" in upper_title or "JUDGMENTAL" in upper_title:
        series = "Judgemental Service"

    # 3. Extract clean message title from description if present
    message_title = None
    for line in desc.splitlines()[:20]:
        m = re.search(r"(?:MESSAGE|TOPIC|THEME)\s*[:\-]\s*(.+)", line, re.IGNORECASE)
        if m:
            cand = m.group(1).strip()
            if len(cand) > 3 and not re.match(r"^(date|time|venue|pastor|ministering)", cand, re.IGNORECASE):
                cand = re.sub(r"\s*\(.*?\)", "", cand).strip()
                if cand:
                    message_title = cand
                    break

    # 4. Construct polished title
    generic_titles = {
        "BREAKTHROUGH SERVICE", "SUNDAY BREAKTHROUGH SERVICE",
        "COMMUNION SERVICE", "MID-WEEK REVIVAL SERVICE", "REVIVAL SERVICE",
        "ANOINTING SERVICE", "SUNDAY ANOINTING SERVICE",
        "IMPARTATION SERVICE", "EARLY WILL I SEEK THEE", "JUDGEMENTAL SERVICE"
    }

    if message_title:
        final_title = f"{series}: {message_title}"
    elif title.upper() in generic_titles:
        final_title = f"{title.title()} ({date_readable})"
    else:
        final_title = title.title()

    # Generate slug with date and short video ID to guarantee absolute uniqueness
    short_vid = re.sub(r"[^a-zA-Z0-9]", "", video_id)[:6].lower()
    base_slug = slugify(final_title)
    sermon_slug = f"{base_slug}-{parsed_date}-{short_vid}"

    return final_title, parsed_date, series, sermon_slug


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
    """Download audio stream via yt-dlp with android player client routing and EBU R128 speech normalization."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if has_ffmpeg() and not fast_mode:
        print(f"[*] FFmpeg detected. Downloading and encoding to normalized {bitrate} MP3...")
        temp_raw = output_path.with_suffix(".temp.webm")
        try:
            # Download audio stream using android player client to bypass 429
            yt_cmd = ytdlp_cmd + [
                "-4",
                "--extractor-args", "youtube:player_client=android",
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
        print(f"[*] Downloading native high-efficiency M4A stream directly...")
        try:
            yt_cmd = ytdlp_cmd + [
                "-4",
                "--extractor-args", "youtube:player_client=android",
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


def fetch_channel_streams(ytdlp_cmd, channel_url: str, limit: int = 150):
    """Scan recent streams from channel playlist."""
    print(f"[*] Scanning recent streams from {channel_url}...")
    cmd = ytdlp_cmd + [
        "--flat-playlist",
        "--extractor-args", "youtube:player_client=android",
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
    """Process a single video entry from the channel list using Plan A metadata sanitation."""
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
    upload_date_str = meta.get("upload_date", "")

    # Plan A metadata sanitization & collision-free slug generation
    final_title, parsed_date, series, sermon_slug = sanitize_metadata(
        raw_title=raw_title,
        desc=desc,
        upload_date_str=upload_date_str,
        video_id=video_id
    )

    temp_dir = project_root / "temp_audio"
    temp_dir.mkdir(parents=True, exist_ok=True)
    target_audio_path = temp_dir / f"{sermon_slug}.mp3"

    print(f"\n=======================================================")
    print(f"[>] Ingesting: {final_title}")
    print(f"[>] Duration: {format_duration(duration)} | Series: {series}")
    print(f"[>] Slug/R2 Key: {sermon_slug}.mp3")
    print(f"=======================================================")

    success, final_audio_path = process_audio(
        ytdlp_cmd=ytdlp_cmd,
        youtube_url=video_url,
        output_path=target_audio_path,
        bitrate="64k",
        title=final_title,
        speaker="Pastor Henry Dimoko",
        fast_mode=False,
    )

    if not success or not final_audio_path.exists():
        print(f"[WARN] Ingestion failed for {final_title}")
        return False

    file_size_bytes = final_audio_path.stat().st_size

    # Upload to Cloudflare R2
    r2_object_name = f"{sermon_slug}{final_audio_path.suffix}"
    audio_url = upload_to_r2(final_audio_path, r2_object_name)

    # Immediately delete local temporary file to conserve disk space
    if final_audio_path.exists():
        final_audio_path.unlink()
        print(f"[*] Cleaned up local temp file: {final_audio_path.name}")

    sermon_record = {
        "id": sermon_slug,
        "title": final_title,
        "description": desc.strip()[:300] or f"Live sermon broadcast by Pastor Henry Dimoko for {series}.",
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
    print(f"[SUCCESS] Registered and uploaded: {final_title}")
    return True


def main():
    parser = argparse.ArgumentParser(description="Henry Dimoko Ministries - 50-Sermon Bulk Ingestion Engine (Plan A)")
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
    scan_limit = max(args.count + len(existing_ids) + 40, 160)
    all_entries = fetch_channel_streams(ytdlp_cmd, channel_url, limit=scan_limit)

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
        print("\n=== DRY RUN PREVIEW (Top Candidates under Plan A) ===")
        for i, c in enumerate(candidates, 1):
            dur = format_duration(c.get("duration") or 0) if c.get("duration") else "Unknown"
            raw_t = c.get("title", "")
            cleaned_t, p_date, ser, sl = sanitize_metadata(raw_t, "", "", c.get("id"))
            print(f"[{i:02d}] ID: {c.get('id')} | Dur: {dur} | Title: {cleaned_t} | Slug: {sl}")
        print("====================================================\n")
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

        # Respectful delay between network extractions
        time.sleep(3)

    print(f"\n[ALL DONE] Bulk processing finished. Successfully added {success_count} sermons!")


if __name__ == "__main__":
    main()
