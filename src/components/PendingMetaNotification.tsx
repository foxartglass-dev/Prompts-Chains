import React, { useState, useEffect } from 'react';

interface PendingArticle {
  id: number;
  keyword: string;
  tag: string | null;
  meta_titles: string[];
  meta_descriptions: string[];
  selected_meta_title: string | null;
  selected_meta_description: string | null;
  meta_seo_status: string;
  wp_post_id: number | null;
  wp_post_url: string | null;
  created_at: string;
  website_name: string | null;
  client_name: string | null;
  seo_plugin: string | null;
}

interface PendingMetaNotificationProps {
  onOpenArticle: (articleId: number) => void;
}

const PendingMetaNotification: React.FC<PendingMetaNotificationProps> = ({ onOpenArticle }) => {
  const [pendingArticles, setPendingArticles] = useState<PendingArticle[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPulseEnabled, setIsPulseEnabled] = useState(() => {
    const saved = localStorage.getItem('pendingMetaPulseEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  const fetchPendingArticles = async () => {
    try {
      const res = await fetch('/api/seo/pending');
      if (res.ok) {
        const data = await res.json();
        setPendingArticles(data.articles || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending meta articles:', err);
    }
  };

  useEffect(() => {
    fetchPendingArticles();
    // Poll every 30 seconds
    const interval = setInterval(fetchPendingArticles, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('pendingMetaPulseEnabled', String(isPulseEnabled));
  }, [isPulseEnabled]);

  const pendingCount = pendingArticles.length;

  if (pendingCount === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Notification Button - Gold outline, dark interior, blue bell icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-brand-gold transition-all hover:shadow-glow-gold`}
        title={`${pendingCount} article(s) need meta selection`}
      >
        {/* Bell Icon - Blue */}
        <svg className="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Badge with optional Pulse Animation - Gold themed */}
        <span className="absolute -top-1 -right-1 flex h-5 w-5">
          {isPulseEnabled && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-75"></span>
          )}
          <span className="relative inline-flex rounded-full h-5 w-5 bg-brand-gold text-[11px] text-slate-900 items-center justify-center font-bold">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        </span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-slate-900 border border-brand-gold/50 rounded-lg shadow-lg shadow-brand-gold/10 z-[100] max-h-[70vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-brand-gold/30 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-brand-gold flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Pending Meta
            </h3>
            <div className="flex items-center gap-3">
              {/* Pulse Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPulseEnabled(!isPulseEnabled);
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${
                  isPulseEnabled
                    ? 'bg-slate-900 text-brand-cyan border border-brand-gold animate-pulse shadow-glow-gold'
                    : 'bg-slate-900 text-brand-cyan border border-brand-gold'
                }`}
                title={isPulseEnabled ? 'Click to disable pulse' : 'Click to enable pulse'}
              >
                <span className={`w-2 h-2 rounded-full ${isPulseEnabled ? 'bg-brand-cyan animate-pulse' : 'bg-brand-cyan'}`}></span>
                Pulse
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Article List */}
          <div className="flex-1 overflow-auto p-2">
            {pendingArticles.map(article => (
              <div
                key={article.id}
                className="p-3 mb-2 bg-slate-900 rounded-lg border border-brand-gold/20 hover:border-brand-gold/50 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">{article.keyword}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      {article.website_name && (
                        <span className="truncate">{article.website_name}</span>
                      )}
                      {article.tag && (
                        <span className="px-1.5 py-0.5 bg-brand-gold/20 text-brand-gold rounded text-[10px]">
                          {article.tag}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {!article.selected_meta_title && article.meta_titles?.length > 0 && (
                        <span className="px-2 py-0.5 bg-brand-cyan/20 text-brand-cyan rounded text-xs border border-brand-cyan">
                          Title: {article.meta_titles.length} options
                        </span>
                      )}
                      {article.selected_meta_title && article.meta_seo_status !== 'pushed' && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs border border-yellow-400">
                          Title: Selected
                        </span>
                      )}
                      {!article.selected_meta_description && article.meta_descriptions?.length > 0 && (
                        <span className="px-2 py-0.5 bg-brand-cyan/20 text-brand-cyan rounded text-xs border border-brand-cyan">
                          Desc: {article.meta_descriptions.length} options
                        </span>
                      )}
                      {article.selected_meta_description && article.meta_seo_status !== 'pushed' && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs border border-yellow-400">
                          Desc: Selected
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onOpenArticle(article.id);
                      setIsOpen(false);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:shadow-glow-gold border border-brand-gold rounded text-brand-gold text-xs font-medium transition-all whitespace-nowrap"
                  >
                    Select Meta
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-brand-gold/30 text-center">
            <span className="text-xs text-gray-500">
              {pendingCount} article{pendingCount !== 1 ? 's' : ''} need attention
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingMetaNotification;
