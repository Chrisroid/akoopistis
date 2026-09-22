'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Sermon } from '@/types/sermon';
import SermonCard from '@/components/SermonCard';
import { Search, Filter, X, ArrowUpDown, ChevronLeft, ChevronRight } from '@/components/icons';

interface SermonListProps {
  initialSermons: Sermon[];
}

const ITEMS_PER_PAGE = 12;

export default function SermonList({ initialSermons }: SermonListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'duration'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  // Extract unique series
  const seriesOptions = useMemo(() => {
    const set = new Set<string>();
    initialSermons.forEach((s) => {
      if (s.series) set.add(s.series);
    });
    return Array.from(set);
  }, [initialSermons]);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSeries, sortBy]);

  // Filter and sort sermons
  const filteredSermons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return initialSermons
      .filter((sermon) => {
        const matchesSeries = selectedSeries === 'ALL' || sermon.series === selectedSeries;
        if (!matchesSeries) return false;

        if (!query) return true;

        // Search specifically across message name, full title, description, speaker, and tags
        const titleMatch = sermon.title.toLowerCase().includes(query);
        const descMatch = sermon.description.toLowerCase().includes(query);
        const tagMatch = sermon.tags.some((t) => t.toLowerCase().includes(query));
        const speakerMatch = sermon.speaker.toLowerCase().includes(query);
        const seriesMatch = sermon.series?.toLowerCase().includes(query);

        return titleMatch || descMatch || tagMatch || speakerMatch || seriesMatch;
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

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredSermons.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedSermons = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredSermons.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSermons, safePage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const catalogEl = document.getElementById('catalog');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedSeries('ALL');
    setSortBy('newest');
    setCurrentPage(1);
  };

  // Generate page numbers array with intelligent ellipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (safePage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  }, [totalPages, safePage]);

  const startIndex = (safePage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(safePage * ITEMS_PER_PAGE, filteredSermons.length);

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
              placeholder="Search by message name, topic, or scripture..."
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
        <div className="mt-4 pt-3 border-t border-neutral-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
          <span>
            {filteredSermons.length > 0
              ? `Showing ${startIndex} to ${endIndex} of ${filteredSermons.length} sermons`
              : 'No sermons match your criteria'}
          </span>
          {(searchQuery || selectedSeries !== 'ALL') && (
            <button
              onClick={resetFilters}
              className="text-amber-400 hover:text-amber-300 underline font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Sermons Grid */}
      {paginatedSermons.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedSermons.map((sermon) => (
              <SermonCard key={sermon.id} sermon={sermon} />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <nav
              aria-label="Sermon catalog pagination"
              className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md"
            >
              <div className="text-xs text-neutral-400">
                Page <span className="font-semibold text-white">{safePage}</span> of{' '}
                <span className="font-semibold text-white">{totalPages}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(safePage - 1)}
                  disabled={safePage === 1}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium border border-neutral-800 bg-neutral-950 text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Previous</span>
                </button>

                <div className="flex items-center gap-1">
                  {pageNumbers.map((page, idx) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2 text-xs text-neutral-500">
                          ...
                        </span>
                      );
                    }
                    const pageNum = page as number;
                    const isActive = pageNum === safePage;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-8 h-8 rounded-xl text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20'
                            : 'border border-neutral-800 bg-neutral-950 text-neutral-400 hover:bg-neutral-800 hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(safePage + 1)}
                  disabled={safePage === totalPages}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium border border-neutral-800 bg-neutral-950 text-neutral-300 hover:bg-neutral-800 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  aria-label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </nav>
          )}
        </>
      ) : (
        <div className="text-center py-16 bg-neutral-900/40 border border-neutral-800/80 rounded-2xl px-4">
          <p className="text-neutral-400 text-sm mb-4">
            No sermons found matching &ldquo;{searchQuery}&rdquo;.
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
