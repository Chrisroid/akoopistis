'use client';

import React, { useMemo, useState } from 'react';
import { Sermon } from '@/types/sermon';
import SermonCard from '@/components/SermonCard';
import { Search, Filter, X, ArrowUpDown } from '@/components/icons';

interface SermonListProps {
  initialSermons: Sermon[];
}

export default function SermonList({ initialSermons }: SermonListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'duration'>('newest');

  // Extract unique series
  const seriesOptions = useMemo(() => {
    const set = new Set<string>();
    initialSermons.forEach((s) => {
      if (s.series) set.add(s.series);
    });
    return Array.from(set);
  }, [initialSermons]);

  // Filter and sort sermons
  const filteredSermons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return initialSermons
      .filter((sermon) => {
        const matchesSeries = selectedSeries === 'ALL' || sermon.series === selectedSeries;
        if (!matchesSeries) return false;

        if (!query) return true;

        const titleMatch = sermon.title.toLowerCase().includes(query);
        const descMatch = sermon.description.toLowerCase().includes(query);
        const tagMatch = sermon.tags.some((t) => t.toLowerCase().includes(query));
        const speakerMatch = sermon.speaker.toLowerCase().includes(query);

        return titleMatch || descMatch || tagMatch || speakerMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        if (sortBy === 'duration') {
          return b.duration - a.duration;
        }
        return 0;
      });
  }, [initialSermons, searchQuery, selectedSeries, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedSeries('ALL');
    setSortBy('newest');
  };

  return (
    <section className="py-8" id="catalog">
      {/* Search and Filters Bar */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 md:p-6 mb-8 backdrop-blur-md">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search Field */}
          <div className="relative w-full md:w-1/2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sermons by topic, title, or scripture..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                aria-label="Clear search input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Series & Sort Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            {/* Series dropdown */}
            <div className="relative flex-1 sm:flex-initial">
              <select
                value={selectedSeries}
                onChange={(e) => setSelectedSeries(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 appearance-none pr-8 cursor-pointer"
                aria-label="Filter by series"
              >
                <option value="ALL">All Series ({initialSermons.length})</option>
                {seriesOptions.map((series) => (
                  <option key={series} value={series}>
                    {series}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>

            {/* Sort order dropdown */}
            <div className="relative flex-1 sm:flex-initial">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'duration')}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500 appearance-none pr-8 cursor-pointer"
                aria-label="Sort sermons"
              >
                <option value="newest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="duration">Longest First</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Filter Summary */}
        {(searchQuery || selectedSeries !== 'ALL') && (
          <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400">
            <span>
              Found {filteredSermons.length} {filteredSermons.length === 1 ? 'sermon' : 'sermons'}
            </span>
            <button
              onClick={resetFilters}
              className="text-amber-400 hover:text-amber-300 underline font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Sermons Grid */}
      {filteredSermons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSermons.map((sermon) => (
            <SermonCard key={sermon.id} sermon={sermon} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl px-4">
          <p className="text-neutral-400 text-sm mb-4">
            No sermons found matching your current filter criteria.
          </p>
          <button
            onClick={resetFilters}
            className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-medium text-xs hover:bg-amber-400 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </section>
  );
}
