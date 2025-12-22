import React, { useState, useEffect } from 'react';
import ArticleListView from '../components/articles/ArticleListView';
import SiteBrowserView from '../components/articles/SiteBrowserView';
import HierarchyView from '../components/articles/HierarchyView';
import MediaLibraryView from '../components/articles/MediaLibraryView';

interface Website {
  id: number;
  name: string;
  wp_url: string;
  client_name?: string;
}

type ViewTab = 'list' | 'browser' | 'hierarchy' | 'media';

interface ArticlesPageProps {
  onClose?: () => void;
}

const ArticlesPage: React.FC<ArticlesPageProps> = ({ onClose }) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWebsites();
  }, []);

  const fetchWebsites = async () => {
    try {
      const res = await fetch('/api/websites');
      if (res.ok) {
        const data = await res.json();
        setWebsites(data);
        if (data.length > 0) {
          setSelectedWebsite(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch websites:', err);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: ViewTab; label: string; icon: JSX.Element }[] = [
    {
      id: 'list',
      label: 'Articles',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      )
    },
    {
      id: 'browser',
      label: 'Browse Site',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      )
    },
    {
      id: 'hierarchy',
      label: 'Site Map',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'media',
      label: 'Media',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="text-brand-cyan animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-brand-cyan/30 bg-slate-900">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-brand-gold">Articles</h1>

          {/* Website Selector */}
          <select
            value={selectedWebsite?.id || ''}
            onChange={(e) => {
              const website = websites.find(w => w.id === parseInt(e.target.value));
              setSelectedWebsite(website || null);
            }}
            className="bg-slate-800 border border-brand-cyan/30 rounded-lg px-3 py-1.5 text-white text-sm focus:border-brand-cyan focus:outline-none"
          >
            <option value="">All Websites</option>
            {websites.map(w => (
              <option key={w.id} value={w.id}>
                {w.name} {w.client_name ? `(${w.client_name})` : ''}
              </option>
            ))}
          </select>

          {/* Sync button */}
          {selectedWebsite && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/wp-browser/sync/${selectedWebsite.id}`, { method: 'POST' });
                  const data = await res.json();
                  if (data.success) {
                    alert(`Synced ${data.synced} pages from WordPress`);
                  } else {
                    alert(`Sync failed: ${data.error}`);
                  }
                } catch (err) {
                  alert('Sync failed');
                }
              }}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-brand-cyan/30 rounded-lg text-sm text-gray-300 hover:text-white transition flex items-center gap-2"
              title="Sync pages from WordPress"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand-cyan text-slate-900'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Close button if in modal mode */}
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl ml-2"
              title="Close"
            >
              &times;
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'list' && (
          <ArticleListView websiteId={selectedWebsite?.id} />
        )}
        {activeTab === 'browser' && selectedWebsite && (
          <SiteBrowserView website={selectedWebsite} />
        )}
        {activeTab === 'hierarchy' && selectedWebsite && (
          <HierarchyView websiteId={selectedWebsite.id} />
        )}
        {activeTab === 'media' && (
          <MediaLibraryView websiteId={selectedWebsite?.id} />
        )}

        {/* No website selected warnings for tabs that require it */}
        {(activeTab === 'browser' || activeTab === 'hierarchy') && !selectedWebsite && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <p>Please select a website to view this tab</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ArticlesPage;
