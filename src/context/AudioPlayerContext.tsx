'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AudioPlayerContextType, AudioPlayerState, PlaybackStatus, Sermon } from '@/types/sermon';

const initialAudioState: AudioPlayerState = {
  currentSermon: null,
  status: 'idle',
  currentTime: 0,
  duration: 0,
  playbackRate: 1.0,
  volume: 1.0,
  isMuted: false,
  errorMessage: null,
};

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AudioPlayerState>(initialAudioState);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize and attach standard HTMLAudioElement listeners
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setState((prev) => ({
        ...prev,
        currentTime: audio.currentTime,
        duration: isNaN(audio.duration) ? prev.duration : audio.duration,
      }));
    };

    const onLoadedMetadata = () => {
      setState((prev) => ({
        ...prev,
        duration: isNaN(audio.duration) ? 0 : audio.duration,
      }));
    };

    const onWaiting = () => {
      setState((prev) => ({ ...prev, status: 'loading' }));
    };

    const onPlaying = () => {
      setState((prev) => ({ ...prev, status: 'playing', errorMessage: null }));
    };

    const onPause = () => {
      setState((prev) => (prev.status !== 'error' ? { ...prev, status: 'paused' } : prev));
    };

    const onEnded = () => {
      setState((prev) => ({ ...prev, status: 'paused', currentTime: 0 }));
    };

    const onError = () => {
      const code = audio.error?.code;
      let message = 'An unexpected audio error occurred.';
      if (code === 1) message = 'Audio loading was aborted.';
      else if (code === 2) message = 'Network error while streaming audio. Check your connection.';
      else if (code === 3) message = 'Audio decoding error. File may be corrupted.';
      else if (code === 4) message = 'Audio format not supported or file not found.';

      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: message,
      }));
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  // Update MediaSession controls for mobile background audio & lockscreen playback
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (state.currentSermon) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: state.currentSermon.title,
        artist: state.currentSermon.speaker || 'Pastor Henry Dimoko',
        album: 'Henry Dimoko Ministries Sermon Archive',
        artwork: [
          { src: '/icons/hdm-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/hdm-icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => skipBy(-15));
      navigator.mediaSession.setActionHandler('seekforward', () => skipBy(15));
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          seek(details.seekTime);
        }
      });
    }
  }, [state.currentSermon]);

  const playSermon = (sermon: Sermon) => {
    const audio = audioRef.current;
    if (!audio) return;

    // If same sermon clicked while paused, simply resume
    if (state.currentSermon?.id === sermon.id && state.status === 'paused') {
      audio.play().catch((err) => {
        if (err.name !== 'AbortError') {
          setState((prev) => ({ ...prev, status: 'error', errorMessage: 'Autoplay blocked. Tap play.' }));
        }
      });
      return;
    }

    // Set new sermon and start playback
    setState((prev) => ({
      ...prev,
      currentSermon: sermon,
      status: 'loading',
      currentTime: 0,
      duration: sermon.duration || 0,
      errorMessage: null,
    }));

    audio.src = sermon.audioUrl;
    audio.playbackRate = state.playbackRate;
    audio.volume = state.isMuted ? 0 : state.volume;
    audio.load();

    audio.play().catch((err) => {
      if (err.name !== 'AbortError') {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: 'Audio playback could not start automatically. Tap play to listen.',
        }));
      }
    });
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !state.currentSermon) return;

    if (state.status === 'playing') {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        if (err.name !== 'AbortError') {
          setState((prev) => ({ ...prev, status: 'error', errorMessage: 'Playback blocked.' }));
        }
      });
    }
  };

  const pause = () => {
    if (audioRef.current && state.status === 'playing') {
      audioRef.current.pause();
    }
  };

  const resume = () => {
    if (audioRef.current && state.currentSermon) {
      audioRef.current.play().catch((err) => {
        if (err.name !== 'AbortError') {
          setState((prev) => ({ ...prev, status: 'error', errorMessage: 'Playback failed.' }));
        }
      });
    }
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clampedTime = Math.max(0, Math.min(time, audio.duration || state.duration));
    audio.currentTime = clampedTime;
    setState((prev) => ({ ...prev, currentTime: clampedTime }));
  };

  const skipBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    seek(audio.currentTime + seconds);
  };

  const setPlaybackRate = (rate: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = rate;
    }
    setState((prev) => ({ ...prev, playbackRate: rate }));
  };

  const setVolume = (volume: number) => {
    const audio = audioRef.current;
    const clampedVolume = Math.max(0, Math.min(volume, 1));
    if (audio) {
      audio.volume = state.isMuted ? 0 : clampedVolume;
    }
    setState((prev) => ({
      ...prev,
      volume: clampedVolume,
      isMuted: clampedVolume === 0 ? true : prev.isMuted,
    }));
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    const nextMuted = !state.isMuted;
    if (audio) {
      audio.volume = nextMuted ? 0 : state.volume;
    }
    setState((prev) => ({ ...prev, isMuted: nextMuted }));
  };

  return (
    <AudioPlayerContext.Provider
      value={{
        ...state,
        playSermon,
        togglePlayPause,
        pause,
        resume,
        seek,
        skipBy,
        setPlaybackRate,
        setVolume,
        toggleMute,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerContextType {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
