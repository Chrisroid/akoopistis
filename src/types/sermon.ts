export interface Sermon {
  id: string;
  title: string;
  description: string;
  speaker: string;
  date: string;
  duration: number; // in seconds
  durationFormatted: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  audioUrl: string;
  youtubeUrl: string;
  series: string;
  tags: string[];
  featured?: boolean;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface AudioPlayerState {
  currentSermon: Sermon | null;
  status: PlaybackStatus;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  errorMessage: string | null;
}

export interface AudioPlayerContextType extends AudioPlayerState {
  playSermon: (sermon: Sermon) => void;
  togglePlayPause: () => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  skipBy: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

/**
 * Utility to download sermon audio with consistent ministry-branded filenames
 * across all modern desktop and mobile browsers.
 */
export async function downloadSermonAudio(
  audioUrl: string,
  sermonTitle: string,
  onProgress?: (isDownloading: boolean) => void
): Promise<void> {
  const isM4a = audioUrl.toLowerCase().includes('.m4a');
  const ext = isM4a ? 'm4a' : 'mp3';

  // Format clean ministry-prefixed filename
  const cleanTitle = sermonTitle
    .replace(/[\\/:*?"<>|]/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
  const filename = `HDM - ${cleanTitle}.${ext}`;

  try {
    if (onProgress) onProgress(true);

    const response = await fetch(audioUrl, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio stream: ${response.statusText}`);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 3000);
  } catch (error) {
    console.warn('[Download] Direct fallback triggered:', error);
    const fallbackLink = document.createElement('a');
    fallbackLink.href = audioUrl;
    fallbackLink.download = filename;
    fallbackLink.target = '_blank';
    fallbackLink.rel = 'noopener noreferrer';
    document.body.appendChild(fallbackLink);
    fallbackLink.click();
    document.body.removeChild(fallbackLink);
  } finally {
    if (onProgress) onProgress(false);
  }
}
