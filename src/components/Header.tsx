import { Radio, Youtube, ExternalLink } from '@/components/icons';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Ministry Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm tracking-wider">
            HDM
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight leading-none">
              Henry Dimoko Ministries
            </div>
            <div className="text-[11px] text-amber-400/90 font-medium">
              Audio Broadcast Portal
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="flex items-center space-x-4">
          <a
            href="https://www.youtube.com/@henrydimokoministries4431/streams"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium transition-colors"
          >
            <Youtube className="w-3.5 h-3.5 text-red-500" />
            <span className="hidden sm:inline">YouTube Channel</span>
            <ExternalLink className="w-3 h-3 text-neutral-500" />
          </a>
        </div>
      </div>
    </header>
  );
}
