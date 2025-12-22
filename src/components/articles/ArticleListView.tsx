import React, { useState, useEffect } from 'react';

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
                      {onEditVisual && article.wp_post_url && (
                        <button
                          onClick={() => onEditVisual(article)}
                          className="px-2 py-1 bg-brand-gold/20 hover:bg-brand-gold/30 border border-brand-gold/50 rounded text-brand-gold text-xs font-medium transition"
                          title="Visual Editor"
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
                <h3 className="text-lg font-semibold text-white">{selectedArticle.keyword}</h3>
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
                    {onEditVisual && selectedArticle.wp_post_url && (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleListView;
