import { Youtube, Heart } from '@/components/icons';

export default function Footer() {
  return (
    <footer className="border-t border-neutral-800/80 bg-neutral-950 py-12 text-neutral-400 text-xs mt-16 mb-24 md:mb-16">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p className="font-semibold text-neutral-300">
            Henry Dimoko Ministries Audio Archive
          </p>
          <p className="mt-1 text-neutral-500">
            Sharing the Gospel through high-efficiency, data-friendly audio distributions.
          </p>
        </div>

        <div className="flex items-center space-x-6 text-neutral-400">
          <a
            href="https://www.youtube.com/@henrydimokoministries4431/streams"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 hover:text-white transition-colors"
          >
            <Youtube className="w-4 h-4 text-red-500" />
            <span>Official Livestreams</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
