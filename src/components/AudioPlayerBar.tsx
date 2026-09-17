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
      className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900/95 backdrop-blur-lg border-t border-neutral-800 text-white shadow-2xl transition-all duration-300"
    >
      {/* Full-width Flush Edge Scrubber with touch-friendly hit area */}
      <div className="relative group w-full h-1 hover:h-2 bg-neutral-800 transition-all duration-150 cursor-pointer">
        <div
          className="h-full bg-amber-500 relative transition-all duration-100 ease-out"
          style={{ width: `${progressPercent}%` }}
        >
          {/* Subtle scrub handle visible on hover / active */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <input
          type="range"
          min="0"
          max={effectiveDuration}
          value={currentTime}
          onChange={(e) => seek(parseFloat(e.target.value))}
          aria-label="Audio scrubber"
          className="absolute -top-2 -bottom-2 inset-x-0 w-full h-5 opacity-0 cursor-pointer z-10"
        />
      </div>

      {/* Error state alert bar */}
      {errorMessage && (
        <div className="bg-red-950/80 border-b border-red-800/50 px-4 py-1.5 text-xs text-red-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
          <button
            onClick={() => togglePlayPause()}
            className="underline font-semibold hover:text-white ml-3 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Compact Main Container: Single Row on mobile, spacious 3-col on desktop */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Sermon Info & Inline Tracker */}
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 font-bold text-[11px] sm:text-xs tracking-wider">
            HDM
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-medium text-white truncate" title={currentSermon.title}>
              {currentSermon.title}
            </h4>
            <div className="flex items-center space-x-2 text-[11px] text-neutral-400">
              <span className="font-mono text-amber-400/90 font-medium">
                {formatSeconds(currentTime)} / {formatSeconds(effectiveDuration)}
              </span>
              <span className="hidden xs:inline text-neutral-600">&bull;</span>
              <span className="hidden xs:inline truncate text-neutral-400">
                {currentSermon.series}
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right: Thumb-Optimized Controls */}
        <div className="flex items-center space-x-1 sm:space-x-3 shrink-0 text-neutral-300">
          {/* Skip Back 15s */}
          <button
            onClick={() => skipBy(-15)}
            aria-label="Skip backward 15 seconds"
            className="p-1.5 sm:p-2 text-neutral-400 hover:text-white transition-colors active:scale-90"
            title="Skip back 15s"
          >
            <RotateCcw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Prominent Play / Pause Button */}
          <button
            onClick={togglePlayPause}
            disabled={status === 'loading'}
            aria-label={status === 'playing' ? 'Pause' : 'Play'}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center hover:bg-amber-400 transition-transform active:scale-95 disabled:opacity-60 shadow-lg shadow-amber-500/20"
          >
            {status === 'loading' ? (
              <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            ) : status === 'playing' ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Skip Forward 15s */}
          <button
            onClick={() => skipBy(15)}
            aria-label="Skip forward 15 seconds"
            className="p-1.5 sm:p-2 text-neutral-400 hover:text-white transition-colors active:scale-90"
            title="Skip forward 15s"
          >
            <RotateCw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Speed Selector Badge */}
          <button
            onClick={handleNextSpeed}
            className="px-1.5 py-1 sm:px-2 sm:py-1 text-[11px] sm:text-xs font-mono font-medium rounded border border-neutral-800 bg-neutral-800/60 hover:bg-neutral-800 hover:border-neutral-700 hover:text-white transition-colors active:scale-95"
            title="Playback Speed"
          >
            {playbackRate}x
          </button>

          {/* Desktop Volume Slider */}
          <div className="hidden md:flex items-center space-x-2 pl-2">
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
            download={`${currentSermon.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.m4a`}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium transition-colors flex items-center space-x-1 active:scale-95"
            title={`Download Audio (${currentSermon.fileSizeFormatted})`}
          >
            <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden lg:inline text-[11px]">Download</span>
          </a>

          {/* YouTube original link (desktop only) */}
          {currentSermon.youtubeUrl && (
            <a
              href={currentSermon.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:text-white transition-colors hidden md:block"
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
            className="p-1.5 hover:text-white transition-colors active:scale-90"
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
