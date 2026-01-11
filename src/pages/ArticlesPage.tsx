import React, { useState, useEffect } from 'react';
import ArticleListView from '../components/articles/ArticleListView';
import DripFeedView from '../components/articles/DripFeedView';
import SiteBrowserView from '../components/articles/SiteBrowserView';
import HierarchyView from '../components/articles/HierarchyView';
import MediaLibraryView from '../components/articles/MediaLibraryView';
import VisualEditor from '../components/articles/VisualEditor';
import ImageReplacementModal from '../components/articles/ImageReplacementModal';
import TextEditModal from '../components/articles/TextEditModal';

interface Website {
  id: number;
  name: string;
  wp_url: string;
  client_name?: string;
}

interface Article {
  id: number;
  keyword: string;
  wp_post_id: number | null;
  wp_post_url: string | null;
  website_id: number | null;
  wp_url?: string;
}

interface ElementPosition {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isImage: boolean;
  isText: boolean;
}

type ViewTab = 'list' | 'drip-feed' | 'hierarchy' | 'browser' | 'media';

interface ArticlesPageProps {
  isOpen: boolean;
  onClose: () => void;
  defaultWebsiteId?: number;
  workflowId?: number;
}

const ArticlesPage: React.FC<ArticlesPageProps> = ({ isOpen, onClose, defaultWebsiteId, workflowId }) => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('list');
  const [loading, setLoading] = useState(true);

  // Visual editor state
  const [visualEditorArticle, setVisualEditorArticle] = useState<Article | null>(null);
  const [imageEditWidget, setImageEditWidget] = useState<{ widgetId: string; element: ElementPosition } | null>(null);
  const [textEditWidget, setTextEditWidget] = useState<{ widgetId: string; element: ElementPosition } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchWebsites();
    }
  }, [isOpen]);

  const fetchWebsites = async () => {
    try {
      const res = await fetch('/api/websites');
      if (res.ok) {
        const data = await res.json();
        const websitesList = data.websites || [];
        setWebsites(websitesList);
        // Set default website based on prop, otherwise first in list
        if (defaultWebsiteId) {
          const defaultSite = websitesList.find((w: Website) => w.id === defaultWebsiteId);
          if (defaultSite) {
            setSelectedWebsite(defaultSite);
          } else if (websitesList.length > 0) {
            setSelectedWebsite(websitesList[0]);
          }
        } else if (websitesList.length > 0) {
          setSelectedWebsite(websitesList[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch websites:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditVisual = (article: Article) => {
    // Allow visual editing for any article with a WordPress post ID (drafts work too)
    if (article.wp_post_id) {
      setVisualEditorArticle(article);
    }
  };

  const handleImageEdit = (widgetId: string, element: ElementPosition) => {
    setImageEditWidget({ widgetId, element });
  };

  const handleTextEdit = (widgetId: string, element: ElementPosition) => {
    setTextEditWidget({ widgetId, element });
  };

  const handleImageReplaced = async (newImageUrl: string, source: 'upload' | 'ai_generated' | 'url', prompt?: string) => {
    if (!imageEditWidget || !visualEditorArticle) return;

    try {
      // Save to image versions
      await fetch('/api/image-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: visualEditorArticle.id,
          elementorWidgetId: imageEditWidget.widgetId,
          imageUrl: newImageUrl,
          source,
          imagePrompt: prompt
        })
      });

      // TODO: Push to WordPress Elementor data

      setImageEditWidget(null);
    } catch (err) {
      console.error('Failed to save image replacement:', err);
    }
  };

  const handleTextSaved = async (newContent: string) => {
    if (!textEditWidget || !visualEditorArticle) return;

    try {
      // TODO: Push to WordPress Elementor data
      console.log('Saving text for widget:', textEditWidget.widgetId, newContent);

      setTextEditWidget(null);
    } catch (err) {
      console.error('Failed to save text:', err);
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
      id: 'drip-feed',
      label: 'Drip Feed',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
      id: 'browser',
      label: 'Browse Site',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
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

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-brand-cyan animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-900 rounded-lg w-[95vw] h-[90vh] overflow-hidden border border-brand-cyan/30 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-brand-cyan/30 bg-slate-800/50 flex-shrink-0">
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
          <ArticleListView
            websiteId={selectedWebsite?.id}
            onEditVisual={handleEditVisual}
          />
        )}
        {activeTab === 'drip-feed' && (
          <DripFeedView websiteId={selectedWebsite?.id} />
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

      {/* Visual Editor Overlay */}
      {visualEditorArticle && visualEditorArticle.wp_post_id && selectedWebsite && (
        <VisualEditor
          pageUrl={visualEditorArticle.wp_post_url || ''}
          wpPostId={visualEditorArticle.wp_post_id}
          wpUrl={visualEditorArticle.wp_url || selectedWebsite.wp_url}
          websiteId={selectedWebsite.id}
          articleId={visualEditorArticle.id}
          onClose={() => setVisualEditorArticle(null)}
          onImageEdit={handleImageEdit}
          onTextEdit={handleTextEdit}
        />
      )}

      {/* Image Replacement Modal */}
      {imageEditWidget && visualEditorArticle && selectedWebsite && (
        <ImageReplacementModal
          widgetId={imageEditWidget.widgetId}
          articleId={visualEditorArticle.id}
          websiteId={selectedWebsite.id}
          onClose={() => setImageEditWidget(null)}
          onReplace={handleImageReplaced}
        />
      )}

      {/* Text Edit Modal */}
      {textEditWidget && visualEditorArticle && selectedWebsite && (
        <TextEditModal
          widgetId={textEditWidget.widgetId}
          articleId={visualEditorArticle.id}
          websiteId={selectedWebsite.id}
          onClose={() => setTextEditWidget(null)}
          onSave={handleTextSaved}
        />
      )}
      </div>
    </div>
  );
};

export default ArticlesPage;
