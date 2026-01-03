/**
 * PageDetailModal - THE Central Hub for Page Management
 *
 * This is the single focal point for viewing and managing all page types
 * (service, location, blog, supporting articles) from Site Planning.
 *
 * 4 Tabs:
 * - Content: Formatted article view (as it would appear on final webpage)
 * - Images: Hero + inline images with smart placement
 * - Meta SEO: Meta title/description management
 * - Chain Outputs: View all prompt chain outputs
 */

import React, { useState, useEffect, useCallback } from 'react';

interface SitePlanNode {
  id: number;
  site_plan_id: number;
  parent_id: number | null;
  title: string;
  slug: string;
  page_type: string;
  status: string;
  wp_page_id: number | null;
  wp_post_url: string | null;
  target_keyword: string | null;
  meta_title: string | null;
  meta_description: string | null;
  content_brief: string | null;
  assigned_article_id: number | null;
  sort_order: number;
  depth: number;
  is_pillar_page: boolean;
  is_in_menu: boolean;
  menu_order: number | null;
}

interface Article {
  id: number;
  title: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  status: string;
  generated_images: GeneratedImage[] | null;
  chain_outputs: Record<string, any> | null;
  workflow_id: number | null;
  website_id: number | null;
  client_id: number | null;
  workflow_name?: string;
  website_name?: string;
  wp_url?: string;
  wp_user?: string;
  wp_app_password?: string;
  created_at: string;
  updated_at: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  prompt?: string;
  placement?: 'hero' | 'inline';
  imageSide?: 'left' | 'right';
  matchedKeyword?: string;
  pushedToWp?: boolean;
  wpMediaId?: number;
  wpMediaUrl?: string;
}

interface Props {
  node: SitePlanNode;
  onClose: () => void;
  onNodeUpdate?: (node: SitePlanNode) => void;
  showNotification: (message: string, type: 'success' | 'info' | 'error') => void;
}

type TabType = 'content' | 'images' | 'meta' | 'chain';

const PageDetailModal: React.FC<Props> = ({ node, onClose, onNodeUpdate, showNotification }) => {
  const [activeTab, setActiveTab] = useState<TabType>('content');
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushingImages, setPushingImages] = useState(false);
  const [pushingMeta, setPushingMeta] = useState(false);

  // Editable fields
  const [metaTitle, setMetaTitle] = useState(node.meta_title || '');
  const [metaDescription, setMetaDescription] = useState(node.meta_description || '');

  // Load article data if node has assigned_article_id
  const loadArticle = useCallback(async () => {
    if (!node.assigned_article_id) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/articles/${node.assigned_article_id}`);
      const data = await res.json();

      if (data.article) {
        setArticle(data.article);
        // Use article meta if node meta is empty
        if (!metaTitle && data.article.meta_title) {
          setMetaTitle(data.article.meta_title);
        }
        if (!metaDescription && data.article.meta_description) {
          setMetaDescription(data.article.meta_description);
        }
      }
    } catch (error) {
      console.error('Failed to load article:', error);
      showNotification('Failed to load article data', 'error');
    }
    setLoading(false);
  }, [node.assigned_article_id, metaTitle, metaDescription, showNotification]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  // Save meta updates
  const saveMeta = async () => {
    setSaving(true);
    try {
      // Update node meta
      const res = await fetch(`/api/site-planning/nodes/${node.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta_title: metaTitle,
          meta_description: metaDescription,
        }),
      });

      if (res.ok) {
        showNotification('Meta saved successfully', 'success');
        if (onNodeUpdate) {
          onNodeUpdate({ ...node, meta_title: metaTitle, meta_description: metaDescription });
        }
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      showNotification('Failed to save meta', 'error');
    }
    setSaving(false);
  };

  // Push images to WordPress
  const pushImages = async () => {
    if (!article || !article.generated_images?.length) {
      showNotification('No images to push', 'info');
      return;
    }

    if (!article.wp_url || !article.wp_user || !article.wp_app_password) {
      showNotification('WordPress credentials not configured for this website', 'error');
      return;
    }

    setPushingImages(true);
    try {
      // Correct endpoint: /api/articles/:articleId/push-images
      const res = await fetch(`/api/articles/${article.id}/push-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl: article.wp_url,
          wpUser: article.wp_user,
          wpPassword: article.wp_app_password,
        }),
      });

      const data = await res.json();

      if (data.success) {
        showNotification(`Pushed ${data.results?.filter((r: any) => r.status === 'success').length || 0} images to WordPress`, 'success');
        // Reload article to get updated image data
        await loadArticle();
      } else {
        throw new Error(data.error || 'Failed to push images');
      }
    } catch (error: any) {
      showNotification(error.message || 'Failed to push images', 'error');
    }
    setPushingImages(false);
  };

  // Push meta to WordPress
  const pushMeta = async () => {
    if (!article?.wp_url) {
      showNotification('WordPress not configured', 'error');
      return;
    }

    setPushingMeta(true);
    try {
      const res = await fetch(`/api/seo/push/${article.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaTitle,
          metaDescription,
        }),
      });

      const data = await res.json();

      if (data.success) {
        showNotification('Meta pushed to WordPress', 'success');
      } else {
        throw new Error(data.error || 'Failed to push meta');
      }
    } catch (error: any) {
      showNotification(error.message || 'Failed to push meta', 'error');
    }
    setPushingMeta(false);
  };

  // Render formatted content (like final webpage)
  const renderContent = () => {
    if (!article?.content) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No content generated yet</p>
          <p className="text-sm mt-2">Generate content from Site Planning to populate this page</p>
        </div>
      );
    }

    // Parse content - handle both HTML and markdown-style content
    const content = article.content;
    const images = article.generated_images || [];

    // Find hero image
    const heroImage = images.find(img => img.placement === 'hero');
    const inlineImages = images.filter(img => img.placement === 'inline' || (!img.placement && img !== heroImage));

    return (
      <div className="prose prose-invert max-w-none">
        {/* Hero Image */}
        {heroImage && (
          <div className={`mb-6 ${heroImage.imageSide === 'left' ? 'float-left mr-6' : 'float-right ml-6'} w-1/2`}>
            <img
              src={heroImage.url}
              alt={heroImage.matchedKeyword || 'Hero image'}
              className="rounded-lg w-full"
            />
            {heroImage.matchedKeyword && (
              <p className="text-xs text-gray-500 mt-1 italic">{heroImage.matchedKeyword}</p>
            )}
          </div>
        )}

        {/* Article Content with Inline Images */}
        <div
          className="article-content"
          dangerouslySetInnerHTML={{ __html: formatContent(content, inlineImages) }}
        />

        <div className="clear-both" />
      </div>
    );
  };

  // Format content with inline images inserted at appropriate positions
  const formatContent = (content: string, inlineImages: GeneratedImage[]): string => {
    // If content is already HTML, use it directly
    if (content.includes('<h1') || content.includes('<h2') || content.includes('<p>')) {
      return content;
    }

    // Convert markdown-style content to HTML
    let html = content
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-white mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-white mt-8 mb-4">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/\n\n/g, '</p><p class="text-gray-300 mb-4">')
      .replace(/\n/g, '<br/>');

    // Wrap in paragraphs if not already
    if (!html.startsWith('<')) {
      html = `<p class="text-gray-300 mb-4">${html}</p>`;
    }

    return html;
  };

  // Render images tab
  const renderImages = () => {
    const images = article?.generated_images || [];

    if (images.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No images generated yet</p>
          <p className="text-sm mt-2">Images will be generated based on the Smart Content Matching algorithm</p>
        </div>
      );
    }

    const heroImage = images.find(img => img.placement === 'hero');
    const inlineImages = images.filter(img => img.placement === 'inline' || (!img.placement && img !== heroImage));

    return (
      <div className="space-y-6">
        {/* Push to WordPress button */}
        <div className="flex justify-end">
          <button
            onClick={pushImages}
            disabled={pushingImages || images.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-white transition flex items-center gap-2"
          >
            {pushingImages ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Pushing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Push Images to WordPress
              </>
            )}
          </button>
        </div>

        {/* Hero Image Section */}
        {heroImage && (
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-purple-600 rounded text-xs text-white">HERO</span>
              Hero Image
              {heroImage.imageSide && (
                <span className="text-xs text-gray-500">({heroImage.imageSide} side)</span>
              )}
            </h3>
            <div className="flex gap-4">
              <img
                src={heroImage.url}
                alt="Hero"
                className="w-64 h-40 object-cover rounded-lg"
              />
              <div className="flex-1 text-sm">
                {heroImage.matchedKeyword && (
                  <p className="text-gray-400">
                    <span className="text-gray-500">Keyword:</span> {heroImage.matchedKeyword}
                  </p>
                )}
                {heroImage.prompt && (
                  <p className="text-gray-400 mt-2">
                    <span className="text-gray-500">Prompt:</span> {heroImage.prompt.substring(0, 200)}...
                  </p>
                )}
                <div className="mt-3">
                  {heroImage.pushedToWp ? (
                    <span className="inline-flex items-center gap-1 text-green-400 text-xs">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Pushed to WordPress
                    </span>
                  ) : (
                    <span className="text-yellow-400 text-xs">Not yet pushed to WordPress</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inline Images Grid */}
        {inlineImages.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-600 rounded text-xs text-white">INLINE</span>
              Inline Images ({inlineImages.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {inlineImages.map((img, idx) => (
                <div key={img.id || idx} className="bg-slate-800 rounded-lg p-3">
                  <img
                    src={img.url}
                    alt={img.matchedKeyword || `Inline ${idx + 1}`}
                    className="w-full h-32 object-cover rounded mb-2"
                  />
                  <div className="text-xs">
                    {img.imageSide && (
                      <span className={`inline-block px-2 py-0.5 rounded mr-2 ${img.imageSide === 'left' ? 'bg-orange-600' : 'bg-cyan-600'}`}>
                        {img.imageSide}
                      </span>
                    )}
                    {img.matchedKeyword && (
                      <span className="text-gray-400">{img.matchedKeyword}</span>
                    )}
                    <div className="mt-2">
                      {img.pushedToWp ? (
                        <span className="text-green-400">✓ Pushed</span>
                      ) : (
                        <span className="text-gray-500">Pending</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Meta SEO tab
  const renderMeta = () => {
    const titleLength = metaTitle.length;
    const descLength = metaDescription.length;
    const titleOptimal = titleLength >= 50 && titleLength <= 60;
    const descOptimal = descLength >= 150 && descLength <= 160;

    return (
      <div className="space-y-6">
        {/* Meta Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Meta Title
            <span className={`ml-2 text-xs ${titleOptimal ? 'text-green-400' : 'text-yellow-400'}`}>
              ({titleLength}/60 characters)
            </span>
          </label>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="Enter meta title..."
          />
          <div className="mt-2 h-1 bg-slate-700 rounded overflow-hidden">
            <div
              className={`h-full transition-all ${titleOptimal ? 'bg-green-500' : titleLength > 60 ? 'bg-red-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min((titleLength / 60) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Meta Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Meta Description
            <span className={`ml-2 text-xs ${descOptimal ? 'text-green-400' : 'text-yellow-400'}`}>
              ({descLength}/160 characters)
            </span>
          </label>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={4}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
            placeholder="Enter meta description..."
          />
          <div className="mt-2 h-1 bg-slate-700 rounded overflow-hidden">
            <div
              className={`h-full transition-all ${descOptimal ? 'bg-green-500' : descLength > 160 ? 'bg-red-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min((descLength / 160) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Google Preview</h4>
          <div className="bg-white rounded-lg p-4">
            <div className="text-blue-600 text-lg hover:underline cursor-pointer">
              {metaTitle || node.title || 'Page Title'}
            </div>
            <div className="text-green-700 text-sm">
              {article?.wp_url || 'https://example.com'}/{node.slug}
            </div>
            <div className="text-gray-600 text-sm mt-1">
              {metaDescription || 'Meta description will appear here...'}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={saveMeta}
            disabled={saving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-white transition"
          >
            {saving ? 'Saving...' : 'Save Meta'}
          </button>
          {article && (
            <button
              onClick={pushMeta}
              disabled={pushingMeta}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-white transition"
            >
              {pushingMeta ? 'Pushing...' : 'Push to WordPress'}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render Chain Outputs tab
  const renderChainOutputs = () => {
    const chainOutputs = article?.chain_outputs;

    if (!chainOutputs || Object.keys(chainOutputs).length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No chain outputs available</p>
          <p className="text-sm mt-2">Chain outputs will be stored here after content generation</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(chainOutputs).map(([key, value]) => (
          <div key={key} className="bg-slate-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-gray-300">{key}</span>
            </h4>
            <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-64 overflow-auto">
              {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              node.page_type === 'service' ? 'bg-green-600' :
              node.page_type === 'location' ? 'bg-amber-600' :
              node.page_type === 'blog' ? 'bg-pink-600' :
              'bg-blue-600'
            }`}>
              {node.page_type.toUpperCase()}
            </span>
            <h2 className="text-xl font-semibold text-white">{node.title}</h2>
            {node.status && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                node.status === 'published' ? 'bg-green-600' :
                node.status === 'built' ? 'bg-blue-600' :
                node.status === 'in_progress' ? 'bg-yellow-600' :
                'bg-slate-600'
              }`}>
                {node.status}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 transition"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 shrink-0">
          {[
            { id: 'content', label: 'Content', icon: '📄' },
            { id: 'images', label: 'Images', icon: '🖼️' },
            { id: 'meta', label: 'Meta SEO', icon: '🔍' },
            { id: 'chain', label: 'Chain Outputs', icon: '🔗' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-6 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-400'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <>
              {activeTab === 'content' && renderContent()}
              {activeTab === 'images' && renderImages()}
              {activeTab === 'meta' && renderMeta()}
              {activeTab === 'chain' && renderChainOutputs()}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4 flex items-center justify-between shrink-0 bg-slate-800/50">
          <div className="text-sm text-gray-400">
            {article ? (
              <span>Article ID: {article.id} • Last updated: {new Date(article.updated_at).toLocaleDateString()}</span>
            ) : (
              <span>No article linked • <button className="text-blue-400 hover:underline">Generate Content</button></span>
            )}
          </div>
          <div className="flex gap-2">
            {node.wp_post_url && (
              <a
                href={node.wp_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View in WordPress
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageDetailModal;
