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
  // Meta SEO selection fields
  selected_meta_title: string | null;
  selected_meta_description: string | null;
  meta_seo_status: 'pending' | 'selected' | 'pushed' | null;
  meta_pushed_at: string | null;
  // Joined fields
  workflow_name?: string;
  workflow_state?: {
    wpTitleTemplate?: string;
    placeholders?: Array<{ key: string; value: string; tag?: string }>;
    [key: string]: unknown;
  };
  website_name?: string;
  client_name?: string;
  wp_url?: string;
  wp_user?: string;
  wp_app_password?: string;
  seo_plugin?: string;
}

interface ArticleManagerProps {
  isOpen: boolean;
  onClose: () => void;
  filterByWebsite?: number;
  filterByClient?: number;
  filterByWorkflow?: number;
  wpCredentials?: { url: string; user: string; password: string };
  wpContentType?: 'pages' | 'posts';
}

type ViewMode = 'list' | 'view' | 'edit';

const ArticleManager: React.FC<ArticleManagerProps> = ({
  isOpen,
  onClose,
  filterByWebsite,
  filterByClient,
  filterByWorkflow,
  wpCredentials,
  wpContentType = 'pages'
}) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [websiteFilter, setWebsiteFilter] = useState<string>('');

  // Get unique clients and websites for filter dropdowns
  const uniqueClients = [...new Set(articles.map(a => a.client_name).filter(Boolean))];
  const uniqueWebsites = [...new Set(articles.map(a => a.website_name).filter(Boolean))];

  // Editor state
  const [editContent, setEditContent] = useState('');
  const [editMetaTitles, setEditMetaTitles] = useState<string[]>([]);
  const [editMetaDescriptions, setEditMetaDescriptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Version history
  const [versions, setVersions] = useState<Article[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  // Meta selection state
  const [selectedTitleIndex, setSelectedTitleIndex] = useState<number | null>(null);
  const [selectedDescIndex, setSelectedDescIndex] = useState<number | null>(null);
  const [customMetaTitle, setCustomMetaTitle] = useState('');
  const [customMetaDesc, setCustomMetaDesc] = useState('');
  const [pushingSeo, setPushingSeo] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Helper to strip tag suffix like "(H)" from item names
  const stripTagFromName = (name: string): string => {
    return name.replace(/\s*\([^)]+\)\s*$/, '').trim();
  };

  // Fill a simple template with data (supports <angle brackets> syntax)
  const fillSimpleTemplate = (template: string, data: Record<string, string | null | undefined>): string => {
    return template.replace(/<([^<>]+)>/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = data[trimmedKey];
      return value !== null && value !== undefined ? String(value) : match;
    });
  };

  // Generate the page title from template or fall back to keyword
  const generatePageTitle = (article: Article): string => {
    const wpTitleTemplate = article.workflow_state?.wpTitleTemplate;

    if (wpTitleTemplate) {
      // Build template data from workflow placeholders
      const placeholderData = (article.workflow_state?.placeholders || []).reduce((acc, p) => {
        if (!p.tag) {
          acc[p.key] = p.value;
        }
        return acc;
      }, {} as Record<string, string>);

      const templateData = {
        ...placeholderData,
        item_name: stripTagFromName(article.keyword),
        tag: article.tag || '',
        status: article.status || '',
      };

      const generatedTitle = fillSimpleTemplate(wpTitleTemplate, templateData);
      if (generatedTitle.trim()) {
        return generatedTitle;
      }
    }

    // Fall back to keyword with tag stripped
    return stripTagFromName(article.keyword);
  };

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

      // Initialize meta selection state from article
      const article = data.article;
      if (article.selected_meta_title) {
        const titleIdx = (article.meta_titles || []).indexOf(article.selected_meta_title);
        if (titleIdx >= 0) {
          setSelectedTitleIndex(titleIdx);
          setCustomMetaTitle('');
        } else {
          setSelectedTitleIndex(-1); // Custom
          setCustomMetaTitle(article.selected_meta_title);
        }
      } else {
        setSelectedTitleIndex(null);
        setCustomMetaTitle('');
      }

      if (article.selected_meta_description) {
        const descIdx = (article.meta_descriptions || []).indexOf(article.selected_meta_description);
        if (descIdx >= 0) {
          setSelectedDescIndex(descIdx);
          setCustomMetaDesc('');
        } else {
          setSelectedDescIndex(-1); // Custom
          setCustomMetaDesc(article.selected_meta_description);
        }
      } else {
        setSelectedDescIndex(null);
        setCustomMetaDesc('');
      }
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

  const publishToWordPress = async (useElementor: boolean = true) => {
    if (!selectedArticle) return;

    // Check for WP credentials - use article's website credentials first, fall back to passed props
    const wpUrl = selectedArticle.wp_url || wpCredentials?.url;
    const wpUser = selectedArticle.wp_user || wpCredentials?.user;
    const wpPassword = selectedArticle.wp_app_password || wpCredentials?.password;

    if (!wpUrl || !wpUser || !wpPassword) {
      setError('WordPress credentials not configured. Please set them in Settings > WordPress Publishing.');
      return;
    }

    setPublishing(true);
    try {
      let res;
      let wpData;

      // Generate the page title from template
      const pageTitle = generatePageTitle(selectedArticle);

      if (useElementor) {
        // Use Elementor publishing endpoint
        res = await fetch('/api/elementor/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wpUrl,
            wpUser,
            wpPassword,
            title: pageTitle,
            content: editContent || selectedArticle.final_content,
            status: 'draft',
            ctaText: 'Book Now!',
            ctaUrl: '#',
            includeStatsBar: false,
            articleId: selectedArticle.id
          })
        });

        wpData = await res.json();

        if (wpData.success && wpData.page) {
          // Update article with WP info
          await fetch(`/api/articles/${selectedArticle.id}/wp-status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wpPostId: wpData.page.id,
              wpPostUrl: wpData.page.link,
              status: 'published'
            })
          });

          // Refresh article
          fetchArticle(selectedArticle.id);
          fetchArticles();
        } else {
          setError(wpData.error || 'Failed to publish Elementor page');
        }
      } else {
        // Use regular WordPress endpoint
        res = await fetch('/api/wordpress/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wpUrl,
            wpUser,
            wpPassword,
            contentType: 'pages',
            title: pageTitle,
            content: editContent || selectedArticle.final_content,
            status: 'draft'
          })
        });

        wpData = await res.json();

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
      }
    } catch (err) {
      setError('Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  // Get the currently selected meta values
  const getSelectedMetaTitle = () => {
    if (selectedTitleIndex === -1) return customMetaTitle;
    if (selectedTitleIndex !== null && selectedArticle?.meta_titles?.[selectedTitleIndex]) {
      return selectedArticle.meta_titles[selectedTitleIndex];
    }
    return null;
  };

  const getSelectedMetaDesc = () => {
    if (selectedDescIndex === -1) return customMetaDesc;
    if (selectedDescIndex !== null && selectedArticle?.meta_descriptions?.[selectedDescIndex]) {
      return selectedArticle.meta_descriptions[selectedDescIndex];
    }
    return null;
  };

  // Save meta selection (without pushing to SEO yet)
  const saveMetaSelection = async () => {
    if (!selectedArticle) return;

    const metaTitle = getSelectedMetaTitle();
    const metaDesc = getSelectedMetaDesc();

    if (!metaTitle && !metaDesc) {
      setError('Please select at least one meta title or description');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/seo/select/${selectedArticle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedMetaTitle: metaTitle,
          selectedMetaDescription: metaDesc
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save meta selection');
        return;
      }

      if (data.article) {
        setSelectedArticle(data.article);
        fetchArticles();
      } else {
        setError('Failed to save meta selection - no article returned');
      }
    } catch (err) {
      console.error('Save meta selection error:', err);
      setError('Failed to save meta selection');
    } finally {
      setSaving(false);
    }
  };

  // Push selected meta to SEO plugin
  const pushToSeo = async () => {
    if (!selectedArticle) return;

    const metaTitle = getSelectedMetaTitle();
    const metaDesc = getSelectedMetaDesc();

    if (!metaTitle && !metaDesc) {
      setError('Please select a meta title and/or description first');
      return;
    }

    if (!selectedArticle.wp_post_id) {
      setError('Article must be published to WordPress first');
      return;
    }

    // Get WP credentials - use article's website credentials first, fall back to passed props
    const wpUrl = selectedArticle.wp_url || wpCredentials?.url;
    const wpUser = selectedArticle.wp_user || wpCredentials?.user;
    const wpPassword = selectedArticle.wp_app_password || wpCredentials?.password;

    if (!wpUrl || !wpUser || !wpPassword) {
      setError('WordPress credentials not configured. Please set them in Settings > WordPress Publishing.');
      return;
    }

    // Get the SEO plugin from website settings (default to 'aioseo')
    const seoPlugin = selectedArticle.seo_plugin || 'aioseo';

    setPushingSeo(true);
    try {
      // Use direct push endpoint with credentials
      const res = await fetch('/api/seo/push-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl,
          wpUser,
          wpPassword,
          postId: selectedArticle.wp_post_id,
          metaTitle,
          metaDescription: metaDesc,
          seoPlugin,
          postType: wpContentType
        })
      });

      const data = await res.json();

      if (data.success) {
        // Update the article's meta status in the database
        await fetch(`/api/seo/select/${selectedArticle.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selectedMetaTitle: metaTitle,
            selectedMetaDescription: metaDesc,
            metaSeoStatus: 'pushed'
          })
        });

        // Refresh article to show updated status
        fetchArticle(selectedArticle.id);
        fetchArticles();
      } else {
        setError(data.error || 'Failed to push to SEO plugin');
      }
    } catch (err) {
      setError('Failed to push to SEO plugin');
    } finally {
      setPushingSeo(false);
    }
  };

  // Delete article
  const deleteArticle = async (id: number) => {
    if (!confirm('Are you sure you want to delete this article? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchArticles();
        if (selectedArticle?.id === id) {
          backToList();
        }
      } else {
        setError('Failed to delete article');
      }
    } catch (err) {
      setError('Failed to delete article');
    } finally {
      setDeleting(false);
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

  const filteredArticles = articles.filter(a => {
    const matchesSearch = a.keyword.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = !clientFilter || a.client_name === clientFilter;
    const matchesWebsite = !websiteFilter || a.website_name === websiteFilter;
    return matchesSearch && matchesClient && matchesWebsite;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-500 text-white';
      case 'edited': return 'bg-brand-gold text-slate-900 font-medium';
      case 'flagged': return 'bg-brand-gold text-slate-900 font-medium';
      case 'passed': return 'bg-emerald-500 text-white';
      case 'draft': return 'bg-slate-600 text-white';
      case 'generated': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg w-[90vw] h-[85vh] flex flex-col overflow-hidden border border-brand-cyan/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-cyan/30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-brand-gold">Workflow Results</h2>
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
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="bg-gray-800 border border-brand-cyan/30 rounded px-3 py-2 text-white"
                >
                  <option value="">All Clients</option>
                  {uniqueClients.map((client) => (
                    <option key={client} value={client}>{client}</option>
                  ))}
                </select>
                <select
                  value={websiteFilter}
                  onChange={(e) => setWebsiteFilter(e.target.value)}
                  className="bg-gray-800 border border-brand-cyan/30 rounded px-3 py-2 text-white"
                >
                  <option value="">All Websites</option>
                  {uniqueWebsites.map((website) => (
                    <option key={website} value={website}>{website}</option>
                  ))}
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
                        <th className="p-2">Client</th>
                        <th className="p-2">Website</th>
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
                              <span className="px-2 py-0.5 bg-brand-gold rounded text-xs text-slate-900 font-medium">
                                {article.tag}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(article.status)}`}>
                              {article.status}
                            </span>
                            {article.wp_post_url && article.status !== 'published' && (
                              <span className="ml-1 text-yellow-400 text-xs" title="Article has WP link but status isn't 'published' - may need sync">⚠️</span>
                            )}
                          </td>
                          <td className="p-2 text-gray-400 text-xs">{article.client_name || '-'}</td>
                          <td className="p-2 text-gray-400 text-xs">{article.website_name || '-'}</td>
                          <td className="p-2 text-gray-300">
                            {article.ai_score !== null ? `${article.ai_score}%` : '-'}
                          </td>
                          <td className="p-2 text-gray-300">{article.word_count || '-'}</td>
                          <td className="p-2 text-gray-400 text-xs">{article.workflow_name || '-'}</td>
                          <td className="p-2 text-gray-400 text-xs">
                            {new Date(article.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-2 flex items-center gap-2">
                            <button
                              onClick={() => viewArticle(article)}
                              className="text-brand-cyan hover:text-brand-cyan-light text-xs"
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
                            <button
                              onClick={() => deleteArticle(article.id)}
                              className="text-red-400 hover:text-red-300 text-xs"
                              title="Delete article"
                            >
                              Delete
                            </button>
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
                          <span className="px-2 py-0.5 bg-brand-gold rounded text-xs text-slate-900 font-medium">
                            {selectedArticle.tag}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedArticle.status)}`}>
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
                            onClick={() => publishToWordPress(true)}
                            disabled={publishing}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm text-white font-medium disabled:opacity-50"
                          >
                            {publishing ? 'Publishing...' : 'Publish Elementor Page'}
                          </button>
                          <button
                            onClick={() => publishToWordPress(false)}
                            disabled={publishing}
                            className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                            title="Publish as plain HTML (no Elementor formatting)"
                          >
                            Plain WP
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

                {/* Meta SEO Selection Section */}
                <div className="border-t border-brand-cyan/30 p-4 bg-gray-800/50">
                  {/* SEO Status Banner */}
                  {selectedArticle.meta_seo_status && (
                    <div className={`mb-4 p-2 rounded text-sm flex items-center justify-between ${
                      selectedArticle.meta_seo_status === 'pushed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                      selectedArticle.meta_seo_status === 'selected' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                      'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                    }`}>
                      <span>
                        {selectedArticle.meta_seo_status === 'pushed' && '✓ Meta pushed to SEO plugin'}
                        {selectedArticle.meta_seo_status === 'selected' && '⏳ Meta selected - ready to push'}
                        {selectedArticle.meta_seo_status === 'pending' && '⚠ Meta selection pending'}
                      </span>
                      {selectedArticle.meta_pushed_at && (
                        <span className="text-xs opacity-70">
                          Pushed: {new Date(selectedArticle.meta_pushed_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    {/* Meta Titles Selection */}
                    <div className="bg-slate-900 rounded-lg p-4 border border-brand-gold/30">
                      <h4 className="text-sm font-semibold text-brand-gold mb-3 flex items-center justify-between">
                        <span>Meta Titles</span>
                        {selectedTitleIndex !== null && (
                          <span className="text-xs bg-brand-gold/20 px-2 py-0.5 rounded">Selected</span>
                        )}
                      </h4>
                      <div className="space-y-2">
                        {(selectedArticle.meta_titles || []).map((title, i) => (
                          <label
                            key={i}
                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition border ${
                              selectedTitleIndex === i
                                ? 'bg-brand-gold/20 border-brand-gold'
                                : 'bg-gray-800 border-transparent hover:border-brand-gold/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="metaTitle"
                              checked={selectedTitleIndex === i}
                              onChange={() => {
                                setSelectedTitleIndex(i);
                                setCustomMetaTitle('');
                              }}
                              className="mt-1 accent-yellow-500"
                            />
                            <span className="text-sm text-white">{title}</span>
                          </label>
                        ))}
                        {/* Custom option */}
                        <label
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition border ${
                            selectedTitleIndex === -1
                              ? 'bg-brand-gold/20 border-brand-gold'
                              : 'bg-gray-800 border-transparent hover:border-brand-gold/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="metaTitle"
                            checked={selectedTitleIndex === -1}
                            onChange={() => setSelectedTitleIndex(-1)}
                            className="mt-1 accent-yellow-500"
                          />
                          <div className="flex-1">
                            <span className="text-sm text-brand-gold/70 block mb-1">Custom:</span>
                            <input
                              type="text"
                              value={customMetaTitle}
                              onChange={(e) => {
                                setCustomMetaTitle(e.target.value);
                                setSelectedTitleIndex(-1);
                              }}
                              placeholder="Enter custom meta title..."
                              className="w-full bg-gray-900 border border-brand-gold/50 rounded px-2 py-1 text-sm text-white focus:ring-1 focus:ring-brand-gold transition"
                              onClick={() => setSelectedTitleIndex(-1)}
                            />
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Meta Descriptions Selection */}
                    <div className="bg-slate-900 rounded-lg p-4 border border-brand-cyan/30">
                      <h4 className="text-sm font-semibold text-brand-cyan mb-3 flex items-center justify-between">
                        <span>Meta Descriptions</span>
                        {selectedDescIndex !== null && (
                          <span className="text-xs bg-brand-cyan/20 px-2 py-0.5 rounded">Selected</span>
                        )}
                      </h4>
                      <div className="space-y-2">
                        {(selectedArticle.meta_descriptions || []).map((desc, i) => (
                          <label
                            key={i}
                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition border ${
                              selectedDescIndex === i
                                ? 'bg-brand-cyan/20 border-brand-cyan'
                                : 'bg-gray-800 border-transparent hover:border-brand-cyan/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="metaDesc"
                              checked={selectedDescIndex === i}
                              onChange={() => {
                                setSelectedDescIndex(i);
                                setCustomMetaDesc('');
                              }}
                              className="mt-1 accent-cyan-500"
                            />
                            <span className="text-sm text-white">{desc}</span>
                          </label>
                        ))}
                        {/* Custom option */}
                        <label
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition border ${
                            selectedDescIndex === -1
                              ? 'bg-brand-cyan/20 border-brand-cyan'
                              : 'bg-gray-800 border-transparent hover:border-brand-cyan/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="metaDesc"
                            checked={selectedDescIndex === -1}
                            onChange={() => setSelectedDescIndex(-1)}
                            className="mt-1 accent-cyan-500"
                          />
                          <div className="flex-1">
                            <span className="text-sm text-brand-cyan/70 block mb-1">Custom:</span>
                            <textarea
                              value={customMetaDesc}
                              onChange={(e) => {
                                setCustomMetaDesc(e.target.value);
                                setSelectedDescIndex(-1);
                              }}
                              placeholder="Enter custom meta description..."
                              className="w-full bg-gray-900 border border-brand-cyan/50 rounded px-2 py-1 text-sm text-white focus:ring-1 focus:ring-brand-cyan transition resize-none"
                              rows={2}
                              onClick={() => setSelectedDescIndex(-1)}
                            />
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      <span>SEO Plugin: <span className="text-gray-400 capitalize">{selectedArticle.seo_plugin || 'aioseo'}</span></span>
                    </div>
                    <div className="flex gap-3">
                      {/* Show Save Selection when user has made a selection OR meta options exist */}
                      {(selectedTitleIndex !== null || selectedDescIndex !== null ||
                        (selectedArticle.meta_titles?.length > 0 || selectedArticle.meta_descriptions?.length > 0)) && (
                        <button
                          onClick={saveMetaSelection}
                          disabled={saving || (selectedTitleIndex === null && selectedDescIndex === null)}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save Selection'}
                        </button>
                      )}

                      {/* Show Push button when: article is published to WP AND (selection made OR meta already selected OR has meta options) */}
                      {selectedArticle.wp_post_id && (
                        (selectedTitleIndex !== null || selectedDescIndex !== null ||
                         selectedArticle.meta_seo_status === 'selected' || selectedArticle.meta_seo_status === 'pushed' ||
                         selectedArticle.selected_meta_title || selectedArticle.selected_meta_description) && (
                          <button
                            onClick={pushToSeo}
                            disabled={pushingSeo}
                            className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-lg text-sm text-white font-medium transition disabled:opacity-50 flex items-center gap-2"
                          >
                            {pushingSeo ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Pushing...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Push to {(selectedArticle.seo_plugin || 'aioseo').charAt(0).toUpperCase() + (selectedArticle.seo_plugin || 'aioseo').slice(1)}
                              </>
                            )}
                          </button>
                        )
                      )}

                      {/* Show warning when not published to WP yet */}
                      {!selectedArticle.wp_post_id && (selectedTitleIndex !== null || selectedDescIndex !== null) && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Publish to WordPress first to push SEO
                        </span>
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
                          <h5 className="text-sm font-medium text-brand-gold mb-2">{key}</h5>
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
                              ? 'bg-brand-cyan/30 border border-brand-cyan'
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
