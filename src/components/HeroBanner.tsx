'use client';

import React, { useState } from 'react';
import { Sermon, downloadSermonAudio } from '@/types/sermon';
import { useAudioPlayer } from '@/context/AudioPlayerContext';
import { Play, Pause, Download, Radio, ShieldCheck, Zap } from '@/components/icons';

interface HeroBannerProps {
  featuredSermon?: Sermon;
}

export default function HeroBanner({ featuredSermon }: HeroBannerProps) {
  const { currentSermon, status, playSermon, togglePlayPause } = useAudioPlayer();
  const [isDownloading, setIsDownloading] = useState(false);

  const isCurrent = featuredSermon && currentSermon?.id === featuredSermon.id;
  const isPlaying = isCurrent && status === 'playing';

  const handleFeaturePlay = () => {
    if (!featuredSermon) return;
    if (isCurrent) {
      togglePlayPause();
    } else {
      playSermon(featuredSermon);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!featuredSermon || isDownloading) return;
    await downloadSermonAudio(featuredSermon.audioUrl, featuredSermon.title, setIsDownloading);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/40 p-6 md:p-12 mb-10 shadow-2xl">
      {/* Decorative Glow */}
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide uppercase mb-6">
          <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400" />
          <span>Official Sermon Audio Archive</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
          Henry Dimoko Ministries
        </h1>

        <p className="text-neutral-300 text-sm sm:text-base leading-relaxed mb-8 max-w-2xl">
          Listen and download high-efficiency audio recordings from our YouTube livestreams.
          Designed specifically for bandwidth-conscious listening: saving your data while keeping you
          connected to the Word of God.
        </p>

        {/* Feature Badges */}
        <div className="flex flex-wrap gap-4 text-xs text-neutral-300 mb-8">
          <div className="flex items-center space-x-1.5 bg-neutral-950/60 border border-neutral-800 px-3 py-1.5 rounded-lg">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Data-Optimized (64 kbps MP3)</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-neutral-950/60 border border-neutral-800 px-3 py-1.5 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Lock-screen Background Playback</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-neutral-950/60 border border-neutral-800 px-3 py-1.5 rounded-lg">
            <Radio className="w-3.5 h-3.5 text-amber-400" />
            <span>Direct Offline Downloads</span>
          </div>
        </div>

        {/* Featured Sermon Spotlight */}
        {featuredSermon && (
          <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-5 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-1">
                Latest Broadcast Spotlight
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white line-clamp-2 break-words leading-snug" title={featuredSermon.title}>
                {featuredSermon.title}
              </h2>
              <div className="text-xs text-neutral-400 mt-0.5">
                {featuredSermon.series} &bull; {featuredSermon.durationFormatted} &bull; {featuredSermon.fileSizeFormatted}
              </div>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                onClick={handleFeaturePlay}
                className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/20"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    <span>Listen Now</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="p-2.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-white transition-colors disabled:opacity-60"
                title={`Download Audio (${featuredSermon.fileSizeFormatted})`}
              >
                {isDownloading ? (
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
