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
  const [loading, setLoading] = useState(false);

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

  const pendingCount = pendingArticles.length;

  if (pendingCount === 0) {
    return null;
  }

  return (
    <>
      {/* Notification Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 transition-all"
        title={`${pendingCount} article(s) need meta selection`}
      >
        {/* Bell Icon */}
        <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Pulse Animation */}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500 text-[10px] text-white items-center justify-center font-bold">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        </span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-slate-900 border border-pink-500/30 rounded-lg shadow-lg shadow-pink-500/10 z-50 max-h-[70vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-pink-500/30 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-pink-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Pending Meta Selections
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Article List */}
          <div className="flex-1 overflow-auto p-2">
            {pendingArticles.map(article => (
              <div
                key={article.id}
                className="p-3 mb-2 bg-slate-800 rounded-lg border border-pink-500/20 hover:border-pink-500/50 transition-all"
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
                        <span className="px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded text-xs">
                          Title: {article.meta_titles.length} options
                        </span>
                      )}
                      {article.selected_meta_title && article.meta_seo_status !== 'pushed' && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                          Title: Selected
                        </span>
                      )}
                      {!article.selected_meta_description && article.meta_descriptions?.length > 0 && (
                        <span className="px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded text-xs">
                          Desc: {article.meta_descriptions.length} options
                        </span>
                      )}
                      {article.selected_meta_description && article.meta_seo_status !== 'pushed' && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
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
                    className="px-3 py-1.5 bg-pink-500/20 hover:bg-pink-500/40 border border-pink-500/50 rounded text-pink-400 text-xs font-medium transition whitespace-nowrap"
                  >
                    Select Meta
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-pink-500/30 text-center">
            <span className="text-xs text-gray-500">
              {pendingCount} article{pendingCount !== 1 ? 's' : ''} need attention
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default PendingMetaNotification;
