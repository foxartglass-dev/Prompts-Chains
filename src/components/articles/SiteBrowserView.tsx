import React, { useState } from 'react';

interface Website {
  id: number;
  name: string;
  wp_url: string;
}

interface SiteBrowserViewProps {
  website: Website;
}

const SiteBrowserView: React.FC<SiteBrowserViewProps> = ({ website }) => {
  const [currentUrl, setCurrentUrl] = useState(website.wp_url);
  const [inputUrl, setInputUrl] = useState(website.wp_url);
  const [loading, setLoading] = useState(false);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUrl(inputUrl);
  };

  const handleRefresh = () => {
    // Force iframe refresh by adding timestamp
    setCurrentUrl(currentUrl.includes('?')
      ? `${currentUrl}&_t=${Date.now()}`
      : `${currentUrl}?_t=${Date.now()}`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Browser toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-brand-cyan/30">
        {/* Navigation buttons */}
        <button
          onClick={handleRefresh}
          className="p-2 hover:bg-slate-700 rounded transition"
          title="Refresh"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button
          onClick={() => {
            setInputUrl(website.wp_url);
            setCurrentUrl(website.wp_url);
          }}
          className="p-2 hover:bg-slate-700 rounded transition"
          title="Go to homepage"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>

        {/* URL bar */}
        <form onSubmit={handleNavigate} className="flex-1 flex gap-2">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 bg-slate-900 border border-brand-cyan/30 rounded-lg px-4 py-1.5 text-white text-sm focus:border-brand-cyan focus:outline-none"
            placeholder="Enter URL..."
          />
          <button
            type="submit"
            className="px-4 py-1.5 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium text-sm rounded-lg transition"
          >
            Go
          </button>
        </form>

        {/* Open in new tab */}
        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 hover:bg-slate-700 rounded transition"
          title="Open in new tab"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* iframe container */}
      <div className="flex-1 relative bg-white">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10">
            <div className="text-brand-cyan animate-pulse">Loading...</div>
          </div>
        )}
        <iframe
          src={currentUrl}
          className="w-full h-full border-0"
          onLoad={() => setLoading(false)}
          onLoadStart={() => setLoading(true)}
          title="Site Browser"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>

      {/* Footer with edit mode button */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-t border-brand-cyan/30">
        <span className="text-sm text-gray-400">
          Viewing: {website.name}
        </span>
        <button
          className="px-4 py-1.5 bg-brand-gold hover:bg-brand-gold/80 text-slate-900 font-medium text-sm rounded-lg transition flex items-center gap-2"
          title="Enter visual edit mode (coming soon)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Edit Mode
        </button>
      </div>
    </div>
  );
};

export default SiteBrowserView;
