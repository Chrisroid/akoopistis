import React from 'react';
import HeroBanner from '@/components/HeroBanner';
import SermonList from '@/components/SermonList';
import sermonsData from '../../data/sermons.json';
import { Sermon } from '@/types/sermon';

export default function HomePage() {
  const sermons = sermonsData as Sermon[];
  const featuredSermon = sermons.find((s) => s.featured) || sermons[0];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      <HeroBanner featuredSermon={featuredSermon} />
      <SermonList initialSermons={sermons} />
    </main>
  );
}
