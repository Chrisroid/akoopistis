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
):
    """Download audio stream via yt-dlp. Uses FFmpeg if available, otherwise direct M4A stream."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if has_ffmpeg():
        print(f"[*] FFmpeg detected. Downloading and encoding to normalized {bitrate} MP3...")
        temp_raw = output_path.with_suffix(".temp.webm")
        try:
            # Download best audio stream
            yt_cmd = ytdlp_cmd + [
                "-f", "bestaudio[ext=m4a]/bestaudio/best",
                "-o", str(temp_raw),
                "--no-playlist",
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


def main():
    parser = argparse.ArgumentParser(
        description="Henry Dimoko Ministries - Stream Audio Ingestion Tool"
    )
    parser.add_argument("url", help="YouTube Livestream URL or Video ID")
    parser.add_argument("--start", help="Start timestamp to trim (e.g. 00:12:30)", default=None)
    parser.add_argument("--end", help="End timestamp to trim (e.g. 01:50:00)", default=None)
    parser.add_argument("--title", help="Override sermon title", default=None)
    parser.add_argument("--series", help="Sermon series name", default="Breakthrough Service")
    parser.add_argument("--speaker", help="Speaker name", default="Pastor Henry Dimoko")
    parser.add_argument("--bitrate", help="Audio bitrate (default: 64k)", default="64k")
    parser.add_argument("--no-upload", action="store_true", help="Skip automatic R2 upload")

    args = parser.parse_args()

    ytdlp_cmd = get_ytdlp_cmd()
    if not ytdlp_cmd:
        print("[ERROR] yt-dlp is not installed. Run: pip install yt-dlp")
        sys.exit(1)

    print(f"[*] Using yt-dlp via: {' '.join(ytdlp_cmd)}")
    if has_ffmpeg():
        print("[*] FFmpeg status: Available (full speech normalization and trimming enabled)")
    else:
        print("[*] FFmpeg status: Not found (native M4A direct download mode enabled)")

    meta = extract_metadata(ytdlp_cmd, args.url)
    if not meta:
        sys.exit(1)

    title = args.title or meta["title"]
    sermon_slug = slugify(title)

    project_root = Path(__file__).resolve().parent.parent
    target_audio_path = project_root / "public" / "audio" / f"{sermon_slug}.mp3"
    catalog_path = project_root / "data" / "sermons.json"

    success, final_audio_path = process_audio(
        ytdlp_cmd=ytdlp_cmd,
        youtube_url=args.url,
        output_path=target_audio_path,
        start_time=args.start,
        end_time=args.end,
        bitrate=args.bitrate,
        title=title,
        speaker=args.speaker,
    )

    if not success or not final_audio_path.exists():
        print("[ERROR] Ingestion aborted due to download failure.")
        sys.exit(1)

    file_size_bytes = final_audio_path.stat().st_size
    duration_secs = meta["duration"]

    upload_date_str = meta.get("upload_date", "")
    if len(upload_date_str) == 8:
        parsed_date = f"{upload_date_str[:4]}-{upload_date_str[4:6]}-{upload_date_str[6:]}"
    else:
        parsed_date = datetime.now().strftime("%Y-%m-%d")

    # Upload to Cloudflare R2
    if not args.no_upload:
        audio_url = upload_to_r2(final_audio_path, f"{sermon_slug}{final_audio_path.suffix}")
    else:
        audio_url = f"/audio/{final_audio_path.name}"

    sermon_record = {
        "id": sermon_slug,
        "title": title,
        "description": meta.get("description", "").strip()[:300] or "Live sermon broadcast.",
        "speaker": args.speaker,
        "date": parsed_date,
        "duration": duration_secs,
        "durationFormatted": format_duration(duration_secs),
        "fileSizeBytes": file_size_bytes,
        "fileSizeFormatted": format_file_size(file_size_bytes),
        "audioUrl": audio_url,
        "youtubeUrl": meta["webpage_url"],
        "series": args.series,
        "tags": [args.series, "Sermon", "Audio"],
        "featured": False,
    }

    update_catalog(sermon_record, catalog_path)
    print("\n[COMPLETE] Ingestion and deployment registration completed successfully!")
    print(f"Audio file ready: {final_audio_path}")
    print(f"Audio R2 URL: {audio_url}")
    print(f"Catalog record registered: {sermon_slug}")



if __name__ == "__main__":
    main()
