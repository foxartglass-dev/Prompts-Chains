import React, { useState, useEffect } from 'react';

interface ArticleImage {
  id: string;
  url: string;
  prompt: string;
  placement: string;
  wpMediaId?: number;
  keywords?: string[];
  createdAt: string;
  pushedToWp?: boolean;
}

interface ImageDecisionReportImage {
  position: number;
  type: 'hero' | 'inline';
  source: 'bank' | 'generated' | 'none';
  side?: string;
  matchedKeywords?: string[];
  variationUsed?: string;
  prompt?: string;
  url?: string;
  reason?: string;
}

interface ImageDecisionReport {
  mode: 'bank' | 'live' | 'none';
  model?: string | null;
  quality?: string | null;
  smartMatchingEnabled?: boolean;
  images: ImageDecisionReportImage[];
}

interface Article {
  id: number;
  workflow_id: number | null;
  website_id: number | null;
  client_id: number | null;
  keyword: string;
  tag: string | null;
  final_content: string | null;
  meta_titles: string[];
  meta_descriptions: string[];
  chain_outputs: Record<string, string>;
  status: string;
  wp_post_id: number | null;
  wp_post_url: string | null;
  created_at: string;
  updated_at: string;
  workflow_name?: string;
  website_name?: string;
  client_name?: string;
  ai_score?: number | null;
  word_count?: number | null;
  version?: number;
  wp_url?: string;
  wp_user?: string;
  wp_app_password?: string;
  selected_meta_title?: string | null;
  selected_meta_description?: string | null;
  images?: ArticleImage[];
  image_decision_report?: ImageDecisionReport | null;
}

interface ArticleListViewProps {
  websiteId?: number;
  onEditVisual?: (article: Article) => void;
}

const ArticleListView: React.FC<ArticleListViewProps> = ({ websiteId, onEditVisual }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Meta selection
  const [selectedTitleIndex, setSelectedTitleIndex] = useState<number | null>(null);
  const [selectedDescIndex, setSelectedDescIndex] = useState<number | null>(null);

  // Image management
  const [showImages, setShowImages] = useState(false);
  const [showImageReport, setShowImageReport] = useState(false);
  const [pushingImages, setPushingImages] = useState(false);
  const [pushingMeta, setPushingMeta] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState<string | null>(null);

  useEffect(() => {
    fetchArticles();
  }, [websiteId, statusFilter]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      let url = '/api/articles?limit=100';
      if (websiteId) url += `&websiteId=${websiteId}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setArticles(Array.isArray(data) ? data : (data.articles || []));
      }
    } catch (err) {
      console.error('Failed to fetch articles:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchArticleDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/articles/${id}`);
      if (res.ok) {
        const data = await res.json();
        const article = data.article;

        // Map database field names to our interface
        // DB uses 'generated_images', interface uses 'images'
        if (article.generated_images && !article.images) {
          article.images = article.generated_images;
        }

        setSelectedArticle(article);
        setEditContent(article.final_content || '');

        // Set initial meta selections
        if (article.selected_meta_title && article.meta_titles) {
          const idx = article.meta_titles.indexOf(article.selected_meta_title);
          setSelectedTitleIndex(idx >= 0 ? idx : 0);
        } else if (article.meta_titles?.length > 0) {
          setSelectedTitleIndex(0);
        }

        if (article.selected_meta_description && article.meta_descriptions) {
          const idx = article.meta_descriptions.indexOf(article.selected_meta_description);
          setSelectedDescIndex(idx >= 0 ? idx : 0);
        } else if (article.meta_descriptions?.length > 0) {
          setSelectedDescIndex(0);
        }
      }
    } catch (err) {
      setError('Failed to load article details');
    }
  };

  const saveArticle = async () => {
    if (!selectedArticle) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/articles/${selectedArticle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalContent: editContent,
          status: 'edited'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedArticle(data.article);
        setIsEditing(false);
        fetchArticles();
      } else {
        setError('Failed to save article');
      }
    } catch (err) {
      setError('Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const publishToWordPress = async () => {
    if (!selectedArticle) return;

    const wpUrl = selectedArticle.wp_url;
    const wpUser = selectedArticle.wp_user;
    const wpPassword = selectedArticle.wp_app_password;

    if (!wpUrl || !wpUser || !wpPassword) {
      setError('WordPress credentials not configured for this website');
      return;
    }

    setPublishing(true);
    setError(null);

    try {
      const res = await fetch('/api/elementor/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl,
          wpUser,
          wpPassword,
          title: selectedArticle.keyword,
          content: editContent || selectedArticle.final_content,
          status: 'draft',
          articleId: selectedArticle.id,
          isManualPush: true
        })
      });

      const data = await res.json();

      if (data.success && data.page) {
        await fetch(`/api/articles/${selectedArticle.id}/wp-status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wpPostId: data.page.id,
            wpPostUrl: data.page.link,
            status: 'published'
          })
        });

        fetchArticleDetails(selectedArticle.id);
        fetchArticles();
      } else {
        setError(data.error || 'Failed to publish');
      }
    } catch (err) {
      setError('Failed to publish to WordPress');
    } finally {
      setPublishing(false);
    }
  };

  const deleteArticle = async (id: number) => {
    if (!confirm('Delete this article? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedArticle?.id === id) {
          setSelectedArticle(null);
        }
        fetchArticles();
      }
    } catch (err) {
      setError('Failed to delete article');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-500 text-white';
      case 'edited': return 'bg-brand-gold text-slate-900';
      case 'flagged': return 'bg-red-500 text-white';
      case 'passed': return 'bg-emerald-500 text-white';
      case 'draft': return 'bg-slate-600 text-white';
      case 'generated': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const filteredArticles = articles.filter(a =>
    a.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openArticle = (article: Article) => {
    fetchArticleDetails(article.id);
    setIsEditing(false);
  };

  const closeModal = () => {
    setSelectedArticle(null);
    setIsEditing(false);
    setError(null);
    setShowImages(false);
    setShowImageReport(false);
  };

  // Push all images to WordPress media library
  const pushImagesToWordPress = async () => {
    if (!selectedArticle || !selectedArticle.images || selectedArticle.images.length === 0) return;

    setPushingImages(true);
    try {
      const res = await fetch(`/api/articles/${selectedArticle.id}/push-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl: selectedArticle.wp_url,
          wpUser: selectedArticle.wp_user,
          wpPassword: selectedArticle.wp_app_password
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`Successfully pushed ${data.pushed} images to WordPress!`);
        fetchArticleDetails(selectedArticle.id);
      } else {
        setError(data.error || 'Failed to push images');
      }
    } catch (err) {
      setError('Failed to push images to WordPress');
    } finally {
      setPushingImages(false);
    }
  };

  // Push meta title and description to WordPress
  const pushMetaToWordPress = async () => {
    if (!selectedArticle) return;

    const metaTitle = selectedTitleIndex !== null && selectedArticle.meta_titles
      ? selectedArticle.meta_titles[selectedTitleIndex]
      : null;
    const metaDesc = selectedDescIndex !== null && selectedArticle.meta_descriptions
      ? selectedArticle.meta_descriptions[selectedDescIndex]
      : null;

    if (!metaTitle && !metaDesc) {
      setError('Please select a meta title and/or description first');
      return;
    }

    setPushingMeta(true);
    try {
      const res = await fetch(`/api/articles/${selectedArticle.id}/push-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl: selectedArticle.wp_url,
          wpUser: selectedArticle.wp_user,
          wpPassword: selectedArticle.wp_app_password,
          wpPostId: selectedArticle.wp_post_id,
          metaTitle,
          metaDescription: metaDesc
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('Meta data pushed to WordPress!');
      } else {
        setError(data.error || 'Failed to push meta');
      }
    } catch (err) {
      setError('Failed to push meta to WordPress');
    } finally {
      setPushingMeta(false);
    }
  };

  // Regenerate a single image
  const regenerateImage = async (imageId: string) => {
    if (!selectedArticle) return;

    const image = selectedArticle.images?.find(i => i.id === imageId);
    if (!image) return;

    setRegeneratingImage(imageId);
    try {
      const res = await fetch(`/api/articles/${selectedArticle.id}/regenerate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId,
          prompt: image.prompt
        })
      });

      const data = await res.json();
      if (data.success) {
        fetchArticleDetails(selectedArticle.id);
      } else {
        setError(data.error || 'Failed to regenerate image');
      }
    } catch (err) {
      setError('Failed to regenerate image');
    } finally {
      setRegeneratingImage(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-brand-cyan animate-pulse">Loading articles...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by keyword..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-slate-800 border border-brand-cyan/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-brand-cyan focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-800 border border-brand-cyan/30 rounded-lg px-4 py-2 text-white focus:border-brand-cyan focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="generated">Generated</option>
          <option value="passed">Passed</option>
          <option value="flagged">Flagged</option>
          <option value="edited">Edited</option>
          <option value="published">Published</option>
        </select>
      </div>

      {/* Article List */}
      <div className="flex-1 overflow-auto rounded-lg border border-brand-cyan/20">
        {filteredArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
            <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No articles found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-800 text-left text-gray-400 border-b border-brand-cyan/20">
              <tr>
                <th className="p-3">Keyword</th>
                <th className="p-3">Status</th>
                <th className="p-3">Tag</th>
                <th className="p-3">AI Score</th>
                <th className="p-3">Words</th>
                <th className="p-3">Client</th>
                <th className="p-3">Website</th>
                <th className="p-3">Created</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredArticles.map((article) => (
                <tr
                  key={article.id}
                  className="border-b border-brand-cyan/10 hover:bg-slate-800/50 transition"
                >
                  <td className="p-3 font-medium text-white">
                    {article.keyword}
                    {article.version && article.version > 1 && (
                      <span className="ml-2 text-xs text-gray-500">v{article.version}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(article.status)}`}>
                      {article.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {article.tag && (
                      <span className="px-2 py-0.5 bg-brand-gold/20 text-brand-gold rounded text-xs font-medium">
                        {article.tag}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-gray-300">
                    {article.ai_score !== null && article.ai_score !== undefined
                      ? `${article.ai_score}%`
                      : '-'}
                  </td>
                  <td className="p-3 text-gray-300">
                    {article.word_count || '-'}
                  </td>
                  <td className="p-3 text-gray-400 text-xs">
                    {article.client_name || '-'}
                  </td>
                  <td className="p-3 text-gray-400 text-xs">
                    {article.website_name || '-'}
                  </td>
                  <td className="p-3 text-gray-400 text-xs">
                    {new Date(article.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openArticle(article)}
                        className="px-2 py-1 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan/50 rounded text-brand-cyan text-xs font-medium transition"
                        title="View article"
                      >
                        View
                      </button>
                      {onEditVisual && article.wp_post_id && (
                        <button
                          onClick={() => onEditVisual(article)}
                          className="px-2 py-1 bg-brand-gold/20 hover:bg-brand-gold/30 border border-brand-gold/50 rounded text-brand-gold text-xs font-medium transition"
                          title="Visual Editor (Draft Preview)"
                        >
                          Visual
                        </button>
                      )}
                      {article.wp_post_url && (
                        <a
                          href={article.wp_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-blue-400 text-xs font-medium transition"
                        >
                          WP
                        </a>
                      )}
                      <button
                        onClick={() => deleteArticle(article.id)}
                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 text-xs transition"
                        title="Delete"
                      >
                        &times;
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Count footer */}
      <div className="mt-2 text-sm text-gray-500">
        {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
      </div>

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg w-[90vw] max-w-5xl max-h-[90vh] flex flex-col border border-brand-cyan/30">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-brand-cyan/30">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">{selectedArticle.keyword}</h3>
                  {/* WordPress Page Link */}
                  {selectedArticle.wp_post_url && (
                    <a
                      href={selectedArticle.wp_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white text-xs font-medium flex items-center gap-1 transition"
                      title="View on WordPress"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Page
                    </a>
                  )}
                </div>
                {/* Page Title - show selected or first meta title */}
                {(selectedArticle.selected_meta_title || (selectedArticle.meta_titles && selectedArticle.meta_titles.length > 0)) && (
                  <p className="text-sm text-brand-gold mt-0.5 truncate max-w-xl" title={selectedArticle.selected_meta_title || selectedArticle.meta_titles?.[0]}>
                    {selectedArticle.selected_meta_title || selectedArticle.meta_titles?.[0]}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(selectedArticle.status)}`}>
                    {selectedArticle.status}
                  </span>
                  {selectedArticle.tag && (
                    <span className="px-2 py-0.5 bg-brand-gold/20 text-brand-gold rounded text-xs font-medium">
                      {selectedArticle.tag}
                    </span>
                  )}
                  <span className="text-gray-500">{selectedArticle.word_count || 0} words</span>
                  <span className="text-gray-500">AI: {selectedArticle.ai_score ?? '-'}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium text-sm transition"
                    >
                      Edit
                    </button>
                    {onEditVisual && selectedArticle.wp_post_id && (
                      <button
                        onClick={() => {
                          closeModal();
                          onEditVisual(selectedArticle);
                        }}
                        className="px-3 py-1.5 bg-brand-gold hover:bg-brand-gold/80 rounded text-slate-900 font-medium text-sm transition"
                      >
                        Visual Edit
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={saveArticle}
                      disabled={saving}
                      className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium text-sm transition disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditContent(selectedArticle.final_content || '');
                      }}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition"
                    >
                      Cancel
                    </button>
                  </>
                )}
                <button
                  onClick={publishToWordPress}
                  disabled={publishing}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-white font-medium text-sm transition disabled:opacity-50"
                >
                  {publishing ? 'Publishing...' : 'Publish to WP'}
                </button>
                {selectedArticle.wp_post_id && (
                  <button
                    onClick={pushMetaToWordPress}
                    disabled={pushingMeta}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium text-sm transition disabled:opacity-50"
                    title="Push selected meta title and description to WordPress"
                  >
                    {pushingMeta ? 'Pushing...' : 'Push Meta'}
                  </button>
                )}
                {selectedArticle.images && selectedArticle.images.length > 0 && (
                  <button
                    onClick={pushImagesToWordPress}
                    disabled={pushingImages}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded text-white font-medium text-sm transition disabled:opacity-50"
                    title="Push all images to WordPress media library"
                  >
                    {pushingImages ? 'Pushing...' : `Push ${selectedArticle.images.length} Images`}
                  </button>
                )}
                {selectedArticle.wp_post_url && (
                  <a
                    href={selectedArticle.wp_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-blue-400 text-sm transition"
                  >
                    View on WP
                  </a>
                )}
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-white text-2xl ml-2"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4">
              {/* Error in modal */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
                  {error}
                </div>
              )}

              {/* Content */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Content</h4>
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-64 bg-slate-800 border border-brand-cyan/30 rounded-lg p-4 text-white font-mono text-sm resize-none focus:border-brand-cyan focus:outline-none"
                    placeholder="Article content..."
                  />
                ) : (
                  <div className="bg-slate-800 rounded-lg p-4 max-h-64 overflow-auto">
                    <div
                      className="prose prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: selectedArticle.final_content || '<em class="text-gray-500">No content</em>' }}
                    />
                  </div>
                )}
              </div>

              {/* Meta Titles & Descriptions */}
              <div className="grid grid-cols-2 gap-6">
                {/* Meta Titles */}
                {selectedArticle.meta_titles && selectedArticle.meta_titles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-brand-gold mb-2">Meta Titles</h4>
                    <div className="space-y-2">
                      {selectedArticle.meta_titles.map((title, i) => (
                        <label
                          key={i}
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition ${
                            selectedTitleIndex === i
                              ? 'bg-brand-gold/20 border-brand-gold'
                              : 'bg-slate-800 border-transparent hover:border-brand-gold/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="metaTitle"
                            checked={selectedTitleIndex === i}
                            onChange={() => setSelectedTitleIndex(i)}
                            className="mt-1 accent-yellow-500"
                          />
                          <span className="text-sm text-white">{title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta Descriptions */}
                {selectedArticle.meta_descriptions && selectedArticle.meta_descriptions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-brand-cyan mb-2">Meta Descriptions</h4>
                    <div className="space-y-2">
                      {selectedArticle.meta_descriptions.map((desc, i) => (
                        <label
                          key={i}
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition ${
                            selectedDescIndex === i
                              ? 'bg-brand-cyan/20 border-brand-cyan'
                              : 'bg-slate-800 border-transparent hover:border-brand-cyan/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="metaDesc"
                            checked={selectedDescIndex === i}
                            onChange={() => setSelectedDescIndex(i)}
                            className="mt-1 accent-cyan-500"
                          />
                          <span className="text-sm text-white">{desc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Chain Outputs */}
              {selectedArticle.chain_outputs && Object.keys(selectedArticle.chain_outputs).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Chain Outputs</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(selectedArticle.chain_outputs).map(([key, value]) => (
                      <div key={key} className="bg-slate-800 rounded-lg p-3">
                        <h5 className="text-xs font-medium text-brand-gold mb-1">{key}</h5>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-32 overflow-auto">
                          {value}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Article Images */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setShowImages(!showImages)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition"
                  >
                    <svg className={`w-4 h-4 transition-transform ${showImages ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    Article Images
                    {selectedArticle.images && selectedArticle.images.length > 0 && (
                      <span className="bg-amber-600/30 text-amber-400 px-2 py-0.5 rounded text-xs">
                        {selectedArticle.images.length}
                      </span>
                    )}
                  </button>
                  {selectedArticle.images && selectedArticle.images.length > 0 && showImages && (
                    <div className="flex gap-2">
                      <button
                        onClick={pushImagesToWordPress}
                        disabled={pushingImages}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 rounded text-white text-xs transition disabled:opacity-50"
                      >
                        {pushingImages ? 'Pushing...' : 'Push All to WP'}
                      </button>
                    </div>
                  )}
                </div>

                {showImages && (
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    {selectedArticle.images && selectedArticle.images.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {selectedArticle.images.map((image) => (
                          <div key={image.id} className="relative group bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                            <img
                              src={image.url}
                              alt={image.placement || 'Article image'}
                              className="w-full aspect-square object-cover"
                            />
                            {/* Overlay with info */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                              <p className="text-xs text-white truncate">{image.placement || 'No placement'}</p>
                              {image.pushedToWp && (
                                <span className="text-xs text-green-400">✓ In WordPress</span>
                              )}
                            </div>
                            {/* Action buttons */}
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => regenerateImage(image.id)}
                                disabled={regeneratingImage === image.id}
                                className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs disabled:opacity-50"
                                title="Regenerate image"
                              >
                                {regeneratingImage === image.id ? (
                                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                )}
                              </button>
                              <a
                                href={image.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-slate-600 hover:bg-slate-500 rounded text-white text-xs"
                                title="View full size"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                            {/* Status badge */}
                            {image.pushedToWp && (
                              <div className="absolute top-2 left-2">
                                <span className="px-1.5 py-0.5 bg-green-600 rounded text-white text-[10px]">WP</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No images generated for this article yet.
                        <br />
                        <span className="text-xs">Generate images from the Image Creation section.</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Image Decision Report */}
              {selectedArticle.image_decision_report && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowImageReport(!showImageReport)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition"
                  >
                    <svg className={`w-4 h-4 transition-transform ${showImageReport ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    Image Processing Log
                    <span className="bg-purple-600/30 text-purple-400 px-2 py-0.5 rounded text-xs">
                      {selectedArticle.image_decision_report.images?.length || 0} decisions
                    </span>
                  </button>

                  {showImageReport && (
                    <div className="mt-3 bg-slate-800/50 rounded-lg p-4 space-y-4">
                      {/* Report Header */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Mode:</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            selectedArticle.image_decision_report.mode === 'bank' ? 'bg-blue-600/30 text-blue-400' :
                            selectedArticle.image_decision_report.mode === 'live' ? 'bg-green-600/30 text-green-400' :
                            'bg-gray-600/30 text-gray-400'
                          }`}>
                            {selectedArticle.image_decision_report.mode === 'bank' ? 'Pull from Bank' :
                             selectedArticle.image_decision_report.mode === 'live' ? 'Generate Live' : 'None'}
                          </span>
                        </div>
                        {selectedArticle.image_decision_report.model && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Model:</span>
                            <span className="text-brand-cyan text-xs">{selectedArticle.image_decision_report.model}</span>
                          </div>
                        )}
                        {selectedArticle.image_decision_report.quality && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Quality:</span>
                            <span className="text-brand-gold text-xs">{selectedArticle.image_decision_report.quality}</span>
                          </div>
                        )}
                        {selectedArticle.image_decision_report.smartMatchingEnabled && (
                          <span className="px-2 py-0.5 bg-emerald-600/30 text-emerald-400 rounded text-xs">
                            Smart Matching ON
                          </span>
                        )}
                      </div>

                      {/* Image Decisions */}
                      <div className="space-y-3">
                        {selectedArticle.image_decision_report.images?.map((img, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border ${
                              img.source === 'bank' ? 'bg-blue-900/20 border-blue-500/30' :
                              img.source === 'generated' ? 'bg-green-900/20 border-green-500/30' :
                              'bg-gray-900/20 border-gray-500/30'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Position badge */}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                                img.type === 'hero' ? 'bg-brand-gold' : 'bg-slate-600'
                              }`}>
                                {img.position}
                              </div>

                              <div className="flex-1 min-w-0">
                                {/* Type and Source */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                    img.type === 'hero' ? 'bg-brand-gold/20 text-brand-gold' : 'bg-slate-600/50 text-slate-300'
                                  }`}>
                                    {img.type === 'hero' ? 'Hero' : 'Inline'} {img.side ? `(${img.side})` : ''}
                                  </span>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                    img.source === 'bank' ? 'bg-blue-600/30 text-blue-400' :
                                    img.source === 'generated' ? 'bg-green-600/30 text-green-400' :
                                    'bg-red-600/30 text-red-400'
                                  }`}>
                                    {img.source === 'bank' ? 'From Bank' :
                                     img.source === 'generated' ? 'Generated' : 'Not Found'}
                                  </span>
                                </div>

                                {/* Matched Keywords */}
                                {img.matchedKeywords && img.matchedKeywords.length > 0 && (
                                  <div className="mt-2">
                                    <span className="text-[10px] text-gray-500">Matched Keywords:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {img.matchedKeywords.map((kw, kwIdx) => (
                                        <span key={kwIdx} className="text-[10px] bg-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded">
                                          {kw}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Variation Used */}
                                {img.variationUsed && (
                                  <div className="mt-1 text-xs text-gray-400">
                                    <span className="text-gray-500">Variation:</span> {img.variationUsed}
                                  </div>
                                )}

                                {/* Prompt (truncated) */}
                                {img.prompt && (
                                  <div className="mt-1 text-xs text-gray-400 truncate" title={img.prompt}>
                                    <span className="text-gray-500">Prompt:</span> {img.prompt}
                                  </div>
                                )}

                                {/* Reason (if no image) */}
                                {img.reason && !img.url && (
                                  <div className="mt-1 text-xs text-red-400">
                                    <span className="text-gray-500">Reason:</span> {img.reason}
                                  </div>
                                )}
                              </div>

                              {/* Thumbnail */}
                              {img.url && (
                                <a href={img.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                  <img
                                    src={img.url}
                                    alt={`Position ${img.position}`}
                                    className="w-16 h-16 object-cover rounded border border-gray-700 hover:border-brand-cyan transition"
                                  />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleListView;
