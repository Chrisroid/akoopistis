'use client';

import React from 'react';
import { Sermon } from '@/types/sermon';
import { useAudioPlayer } from '@/context/AudioPlayerContext';
import { formatDate } from '@/utils/format';
import { Play, Pause, Download, Clock, HardDrive, Youtube, Radio } from '@/components/icons';

interface SermonCardProps {
  sermon: Sermon;
}

export default function SermonCard({ sermon }: SermonCardProps) {
  const { currentSermon, status, playSermon, togglePlayPause } = useAudioPlayer();

  const isCurrent = currentSermon?.id === sermon.id;
  const isPlaying = isCurrent && status === 'playing';
  const isLoading = isCurrent && status === 'loading';

  const handlePlayClick = () => {
    if (isCurrent) {
      togglePlayPause();
    } else {
      playSermon(sermon);
    }
  };

  const safeFilename = `${sermon.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`;

  return (
    <article
      className={`rounded-2xl border transition-all duration-200 bg-neutral-900/60 backdrop-blur-sm p-6 flex flex-col justify-between ${
        isCurrent
          ? 'border-amber-500/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
          : 'border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80'
      }`}
    >
      <div>
        {/* Badges & Meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {sermon.series}
          </span>
          <div className="flex items-center space-x-3 text-neutral-400 font-mono text-xs">
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{sermon.durationFormatted}</span>
            </span>
            <span className="flex items-center space-x-1">
              <HardDrive className="w-3.5 h-3.5" />
              <span>{sermon.fileSizeFormatted}</span>
            </span>
          </div>
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-semibold text-white tracking-tight mb-2 line-clamp-2">
          {sermon.title}
        </h3>
        <p className="text-sm text-neutral-400 mb-4 line-clamp-3 leading-relaxed">
          {sermon.description}
        </p>

        {/* Date & Speaker */}
        <div className="flex items-center justify-between text-xs text-neutral-500 mb-6">
          <span>{sermon.speaker}</span>
          <time dateTime={sermon.date}>{formatDate(sermon.date)}</time>
        </div>
      </div>

      {/* Action Footers */}
      <div className="pt-4 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center gap-2.5">
        {/* Play Button */}
        <button
          onClick={handlePlayClick}
          className={`w-full sm:flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-medium text-sm transition-all ${
            isPlaying
              ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 hover:bg-amber-400'
              : 'bg-white text-neutral-950 hover:bg-neutral-200'
          }`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Listen</span>
            </>
          )}
        </button>

        {/* Direct Download Button */}
        <a
          href={sermon.audioUrl}
          download={safeFilename}
          className="w-full sm:w-auto flex items-center justify-center space-x-1.5 py-2.5 px-3.5 rounded-xl border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 text-sm font-medium transition-colors"
          title={`Download MP3 (${sermon.fileSizeFormatted})`}
        >
          <Download className="w-4 h-4" />
          <span className="sm:hidden">Download MP3</span>
        </a>

        {/* YouTube Stream Link */}
        {sermon.youtubeUrl && (
          <a
            href={sermon.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center p-2.5 rounded-xl border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/60 text-neutral-400 hover:text-red-400 transition-colors"
            title="Watch original live broadcast"
          >
            <Youtube className="w-4 h-4" />
          </a>
        )}
      </div>
    </article>
  );
}
