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
