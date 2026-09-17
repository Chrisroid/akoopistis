'use client';

import React, { useState } from 'react';
import { useAudioPlayer } from '@/context/AudioPlayerContext';
import { formatSeconds } from '@/utils/format';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  AlertCircle,
  ExternalLink,
  X,
} from '@/components/icons';

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export default function AudioPlayerBar() {
  const {
    currentSermon,
    status,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    errorMessage,
    togglePlayPause,
    seek,
    skipBy,
    setPlaybackRate,
    setVolume,
    toggleMute,
    pause,
  } = useAudioPlayer();

  const [isDismissed, setIsDismissed] = useState(false);

  if (!currentSermon || isDismissed) {
    return null;
  }

  const effectiveDuration = duration || currentSermon.duration || 1;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100));

  const handleNextSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
    const nextIndex = currentIndex === -1 || currentIndex === SPEED_OPTIONS.length - 1 ? 0 : currentIndex + 1;
    setPlaybackRate(SPEED_OPTIONS[nextIndex]);
  };

  return (
    <aside
      aria-label="Persistent Audio Player"
      className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900/95 backdrop-blur-md border-t border-neutral-800 text-white shadow-2xl transition-all duration-300"
    >
      {/* Interactive Progress Slider */}
      <div className="relative group w-full h-2 bg-neutral-800 cursor-pointer">
        <div
          className="h-full bg-amber-500 transition-all duration-100 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
        <input
          type="range"
          min="0"
          max={effectiveDuration}
          value={currentTime}
          onChange={(e) => seek(parseFloat(e.target.value))}
          aria-label="Audio scrubber"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Error state alert bar */}
      {errorMessage && (
        <div className="bg-red-950/80 border-b border-red-800/50 px-4 py-1.5 text-xs text-red-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => togglePlayPause()}
            className="underline font-semibold hover:text-white ml-3"
          >
            Retry
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Sermon Details */}
        <div className="flex items-center space-x-3 w-full md:w-1/3 min-w-0">
          <div className="w-11 h-11 rounded-lg bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 font-bold text-xs tracking-wider">
            HDM
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-white truncate" title={currentSermon.title}>
              {currentSermon.title}
            </h4>
            <p className="text-xs text-neutral-400 truncate">
              {currentSermon.speaker} &bull; {currentSermon.series}
            </p>
          </div>
        </div>

        {/* Center: Controls & Time */}
        <div className="flex flex-col items-center justify-center space-y-1 w-full md:w-1/3">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => skipBy(-15)}
              aria-label="Skip backward 15 seconds"
              className="p-1.5 text-neutral-400 hover:text-white transition-colors"
              title="Skip back 15s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlayPause}
              disabled={status === 'loading'}
              aria-label={status === 'playing' ? 'Pause' : 'Play'}
              className="w-10 h-10 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center hover:bg-amber-400 transition-transform active:scale-95 disabled:opacity-60"
            >
              {status === 'loading' ? (
                <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
              ) : status === 'playing' ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => skipBy(15)}
              aria-label="Skip forward 15 seconds"
              className="p-1.5 text-neutral-400 hover:text-white transition-colors"
              title="Skip forward 15s"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-neutral-400 font-mono">
            <span>{formatSeconds(currentTime)}</span>
            <span>/</span>
            <span>{formatSeconds(effectiveDuration)}</span>
          </div>
        </div>

        {/* Right: Actions, Speed, Volume & Dismiss */}
        <div className="flex items-center justify-end space-x-3 w-full md:w-1/3 text-neutral-400">
          {/* Speed Selector */}
          <button
            onClick={handleNextSpeed}
            className="px-2 py-1 text-xs font-mono font-medium rounded border border-neutral-800 hover:border-neutral-700 hover:text-white transition-colors"
            title="Playback Speed"
          >
            {playbackRate}x
          </button>

          {/* Volume (hidden on small mobile screens) */}
          <div className="hidden lg:flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className="hover:text-white transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              aria-label="Volume slider"
              className="w-16 h-1 bg-neutral-700 rounded-lg accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Direct Download Button */}
          <a
            href={currentSermon.audioUrl}
            download={`${currentSermon.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium transition-colors"
            title={`Download Audio (${currentSermon.fileSizeFormatted})`}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </a>

          {/* YouTube original link */}
          {currentSermon.youtubeUrl && (
            <a
              href={currentSermon.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:text-white transition-colors hidden sm:block"
              title="Watch Original Stream on YouTube"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Close Dock */}
          <button
            onClick={() => {
              pause();
              setIsDismissed(true);
            }}
            className="p-1.5 hover:text-white transition-colors"
            aria-label="Close audio player"
            title="Close player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
