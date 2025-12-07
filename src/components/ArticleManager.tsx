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
  ai_score: number | null;
  word_count: number | null;
  status: string;
  wp_post_id: number | null;
  wp_post_url: string | null;
  wp_published_at: string | null;
  version: number;
  parent_article_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  workflow_name?: string;
  website_name?: string;
  client_name?: string;
  wp_url?: string;
  wp_user?: string;
  wp_app_password?: string;
}

interface ArticleManagerProps {
  isOpen: boolean;
  onClose: () => void;
  filterByWebsite?: number;
  filterByClient?: number;
  filterByWorkflow?: number;
}

type ViewMode = 'list' | 'view' | 'edit';

const ArticleManager: React.FC<ArticleManagerProps> = ({
  isOpen,
  onClose,
  filterByWebsite,
  filterByClient,
  filterByWorkflow
}) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Editor state
  const [editContent, setEditContent] = useState('');
  const [editMetaTitles, setEditMetaTitles] = useState<string[]>([]);
  const [editMetaDescriptions, setEditMetaDescriptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Version history
  const [versions, setVersions] = useState<Article[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchArticles();
    }
  }, [isOpen, filterByWebsite, filterByClient, filterByWorkflow, statusFilter]);

  const fetchArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/articles?limit=100';
      if (filterByWorkflow) url += `&workflowId=${filterByWorkflow}`;
      else if (filterByWebsite) url += `&websiteId=${filterByWebsite}`;
      else if (filterByClient) url += `&clientId=${filterByClient}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url);
      if (!res.ok) {
        // Database tables may not exist
        setArticles([]);
        return;
      }
      const data = await res.json();
      setArticles(Array.isArray(data) ? data : (Array.isArray(data.articles) ? data.articles : []));
    } catch (err) {
      setArticles([]);
      // Don't show error for missing tables
    } finally {
      setLoading(false);
    }
  };

  const fetchArticle = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/articles/${id}`);
      const data = await res.json();
      setSelectedArticle(data.article);
      setEditContent(data.article.final_content || '');
      setEditMetaTitles(data.article.meta_titles || []);
      setEditMetaDescriptions(data.article.meta_descriptions || []);
    } catch (err) {
      setError('Failed to fetch article');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionHistory = async (id: number) => {
    try {
      const res = await fetch(`/api/articles/${id}/history`);
      const data = await res.json();
      setVersions(data.versions || []);
      setShowVersions(true);
    } catch (err) {
      console.error('Failed to fetch version history:', err);
    }
  };

  const saveArticle = async (createNewVersion: boolean = false) => {
    if (!selectedArticle) return;
    setSaving(true);
    try {
      const endpoint = createNewVersion
        ? `/api/articles/${selectedArticle.id}/new-version`
        : `/api/articles/${selectedArticle.id}`;

      const method = createNewVersion ? 'POST' : 'PUT';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalContent: editContent,
          metaTitles: editMetaTitles,
          metaDescriptions: editMetaDescriptions,
          status: 'edited'
        })
      });

      const data = await res.json();
      if (data.article) {
        setSelectedArticle(data.article);
        fetchArticles(); // Refresh list
      }
    } catch (err) {
      setError('Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  const publishToWordPress = async () => {
    if (!selectedArticle) return;

    // Check for WP credentials
    const wpUrl = selectedArticle.wp_url;
    const wpUser = selectedArticle.wp_user;
    const wpPassword = selectedArticle.wp_app_password;

    if (!wpUrl || !wpUser || !wpPassword) {
      setError('WordPress credentials not configured for this website');
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch('/api/wordpress/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl,
          wpUser,
          wpPassword,
          contentType: 'pages',
          title: selectedArticle.keyword,
          content: editContent || selectedArticle.final_content,
          status: 'draft'
        })
      });

      const wpData = await res.json();

      if (wpData.success) {
        // Update article with WP info
        await fetch(`/api/articles/${selectedArticle.id}/wp-status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wpPostId: wpData.id,
            wpPostUrl: wpData.link,
            status: 'published'
          })
        });

        // Refresh article
        fetchArticle(selectedArticle.id);
        fetchArticles();
      } else {
        setError(wpData.error || 'Failed to publish to WordPress');
      }
    } catch (err) {
      setError('Failed to publish to WordPress');
    } finally {
      setPublishing(false);
    }
  };

  const viewArticle = (article: Article) => {
    setSelectedArticle(article);
    fetchArticle(article.id);
    setViewMode('view');
  };

  const editArticle = () => {
    setViewMode('edit');
  };

  const backToList = () => {
    setSelectedArticle(null);
    setViewMode('list');
    setShowVersions(false);
  };

  const filteredArticles = articles.filter(a =>
    a.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-500';
      case 'edited': return 'bg-blue-500';
      case 'flagged': return 'bg-red-500';
      case 'passed': return 'bg-emerald-500';
      default: return 'bg-gray-500';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg w-[90vw] h-[85vh] flex flex-col overflow-hidden border border-brand-cyan/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-cyan/30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-white">Article Library</h2>
            {viewMode !== 'list' && (
              <button
                onClick={backToList}
                className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
              >
                <span>&larr;</span> Back to List
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {error && (
            <div className="bg-red-500/20 text-red-400 p-3 m-4 rounded">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </div>
          )}

          {viewMode === 'list' && (
            <div className="h-full flex flex-col p-4">
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Search by keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-gray-800 border border-brand-cyan/30 rounded px-3 py-2 text-white"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-800 border border-brand-cyan/30 rounded px-3 py-2 text-white"
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
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="text-center text-gray-400 py-8">Loading...</div>
                ) : filteredArticles.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">No articles found</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-800">
                      <tr className="text-left text-gray-400">
                        <th className="p-2">Keyword</th>
                        <th className="p-2">Tag</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">AI Score</th>
                        <th className="p-2">Words</th>
                        <th className="p-2">Workflow</th>
                        <th className="p-2">Created</th>
                        <th className="p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArticles.map((article) => (
                        <tr
                          key={article.id}
                          className="border-t border-brand-cyan/30 hover:bg-gray-800/50"
                        >
                          <td className="p-2 text-white font-medium">
                            {article.keyword}
                            {article.version > 1 && (
                              <span className="ml-2 text-xs text-gray-500">v{article.version}</span>
                            )}
                          </td>
                          <td className="p-2">
                            {article.tag && (
                              <span className="px-2 py-0.5 bg-purple-600 rounded text-xs">
                                {article.tag}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(article.status)}`}>
                              {article.status}
                            </span>
                          </td>
                          <td className="p-2 text-gray-300">
                            {article.ai_score !== null ? `${article.ai_score}%` : '-'}
                          </td>
                          <td className="p-2 text-gray-300">{article.word_count || '-'}</td>
                          <td className="p-2 text-gray-400 text-xs">{article.workflow_name || '-'}</td>
                          <td className="p-2 text-gray-400 text-xs">
                            {new Date(article.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-2">
                            <button
                              onClick={() => viewArticle(article)}
                              className="text-brand-cyan hover:text-brand-cyan-light text-xs mr-2"
                            >
                              View
                            </button>
                            {article.wp_post_url && (
                              <a
                                href={article.wp_post_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-400 hover:text-green-300 text-xs"
                              >
                                WP Link
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {(viewMode === 'view' || viewMode === 'edit') && selectedArticle && (
            <div className="h-full flex">
              {/* Main content area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Article header */}
                <div className="p-4 border-b border-brand-cyan/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{selectedArticle.keyword}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        {selectedArticle.tag && (
                          <span className="px-2 py-0.5 bg-purple-600 rounded text-xs text-white">
                            {selectedArticle.tag}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(selectedArticle.status)}`}>
                          {selectedArticle.status}
                        </span>
                        <span>AI: {selectedArticle.ai_score ?? '-'}%</span>
                        <span>{selectedArticle.word_count ?? '-'} words</span>
                        <span>v{selectedArticle.version}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {viewMode === 'view' ? (
                        <>
                          <button
                            onClick={editArticle}
                            className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-sm text-slate-900 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => fetchVersionHistory(selectedArticle.id)}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                          >
                            History
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => saveArticle(false)}
                            disabled={saving}
                            className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-sm text-slate-900 font-medium disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => saveArticle(true)}
                            disabled={saving}
                            className="px-3 py-1.5 bg-brand-gold hover:bg-brand-gold-dark hover:shadow-glow-gold rounded text-sm text-slate-900 font-medium disabled:opacity-50"
                          >
                            Save as New Version
                          </button>
                          <button
                            onClick={publishToWordPress}
                            disabled={publishing}
                            className="px-3 py-1.5 bg-brand-gold hover:bg-brand-gold-dark hover:shadow-glow-gold rounded text-sm text-slate-900 font-medium disabled:opacity-50"
                          >
                            {publishing ? 'Publishing...' : 'Publish to WP'}
                          </button>
                          <button
                            onClick={() => setViewMode('view')}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content area */}
                <div className="flex-1 overflow-auto p-4">
                  {viewMode === 'view' ? (
                    <div className="prose prose-invert max-w-none">
                      <div
                        className="text-gray-200 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: selectedArticle.final_content || '<em>No content</em>'
                        }}
                      />
                    </div>
                  ) : (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-full bg-gray-800 border border-brand-cyan/30 rounded p-4 text-white resize-none font-mono text-sm"
                      placeholder="Article content..."
                    />
                  )}
                </div>

                {/* Meta section */}
                <div className="border-t border-brand-cyan/30 p-4 bg-gray-800/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Meta Titles</h4>
                      {viewMode === 'view' ? (
                        <ul className="text-sm text-gray-300 space-y-1">
                          {(selectedArticle.meta_titles || []).map((title, i) => (
                            <li key={i}>{i + 1}. {title}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="space-y-1">
                          {editMetaTitles.map((title, i) => (
                            <input
                              key={i}
                              value={title}
                              onChange={(e) => {
                                const newTitles = [...editMetaTitles];
                                newTitles[i] = e.target.value;
                                setEditMetaTitles(newTitles);
                              }}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">Meta Descriptions</h4>
                      {viewMode === 'view' ? (
                        <ul className="text-sm text-gray-300 space-y-1">
                          {(selectedArticle.meta_descriptions || []).map((desc, i) => (
                            <li key={i}>{i + 1}. {desc}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="space-y-1">
                          {editMetaDescriptions.map((desc, i) => (
                            <textarea
                              key={i}
                              value={desc}
                              onChange={(e) => {
                                const newDescs = [...editMetaDescriptions];
                                newDescs[i] = e.target.value;
                                setEditMetaDescriptions(newDescs);
                              }}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white resize-none"
                              rows={2}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Side panel - Chain outputs & versions */}
              <div className="w-80 border-l border-brand-cyan/30 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-brand-cyan/30">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowVersions(false)}
                      className={`px-3 py-1 rounded text-sm font-medium ${!showVersions ? 'bg-brand-cyan text-slate-900' : 'bg-gray-700 text-gray-300'}`}
                    >
                      Chain Outputs
                    </button>
                    <button
                      onClick={() => fetchVersionHistory(selectedArticle.id)}
                      className={`px-3 py-1 rounded text-sm font-medium ${showVersions ? 'bg-brand-cyan text-slate-900' : 'bg-gray-700 text-gray-300'}`}
                    >
                      Versions
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-3">
                  {!showVersions ? (
                    <div className="space-y-3">
                      {Object.entries(selectedArticle.chain_outputs || {}).map(([key, value]) => (
                        <div key={key} className="bg-gray-800 rounded p-3">
                          <h5 className="text-sm font-medium text-purple-400 mb-2">{key}</h5>
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-40 overflow-auto">
                            {value}
                          </pre>
                        </div>
                      ))}
                      {Object.keys(selectedArticle.chain_outputs || {}).length === 0 && (
                        <div className="text-gray-500 text-sm text-center py-4">
                          No chain outputs recorded
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {versions.map((v) => (
                        <div
                          key={v.id}
                          onClick={() => fetchArticle(v.id)}
                          className={`p-3 rounded cursor-pointer ${
                            v.id === selectedArticle.id
                              ? 'bg-blue-600/30 border border-blue-500'
                              : 'bg-gray-800 hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-white">Version {v.version}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(v.status)}`}>
                              {v.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(v.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                      {versions.length === 0 && (
                        <div className="text-gray-500 text-sm text-center py-4">
                          No version history
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArticleManager;
