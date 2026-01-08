import React, { useState, useEffect } from 'react';
import ElementorPreview from './ElementorPreview';

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
  const [metaSaved, setMetaSaved] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [customMetaTitle, setCustomMetaTitle] = useState('');
  const [customMetaDesc, setCustomMetaDesc] = useState('');
  const [useCustomTitle, setUseCustomTitle] = useState(false);
  const [useCustomDesc, setUseCustomDesc] = useState(false);
  const [pushingAll, setPushingAll] = useState(false);

  // Image management
  const [showImages, setShowImages] = useState(false);
  const [showImageReport, setShowImageReport] = useState(false);

  // Tab state for article modal
  const [activeTab, setActiveTab] = useState<'content' | 'preview' | 'images' | 'meta'>('preview');
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());
  const [pushingImages, setPushingImages] = useState(false);
  const [pushingMeta, setPushingMeta] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState<string | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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

        // Reset meta saved state
        setMetaSaved(false);
      }
    } catch (err) {
      setError('Failed to load article details');
    }
  };

  // Save meta selections to database
  const saveMetaSelections = async () => {
    if (!selectedArticle) return;

    // Use custom values if selected, otherwise use the selected option
    const metaTitle = useCustomTitle && customMetaTitle.trim()
      ? customMetaTitle.trim()
      : (selectedTitleIndex !== null && selectedArticle.meta_titles
        ? selectedArticle.meta_titles[selectedTitleIndex]
        : null);
    const metaDesc = useCustomDesc && customMetaDesc.trim()
      ? customMetaDesc.trim()
      : (selectedDescIndex !== null && selectedArticle.meta_descriptions
        ? selectedArticle.meta_descriptions[selectedDescIndex]
        : null);

    if (!metaTitle && !metaDesc) {
      setError('Please select or enter a meta title and/or description first');
      return;
    }

    setSavingMeta(true);
    try {
      const res = await fetch(`/api/articles/${selectedArticle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedMetaTitle: metaTitle,
          selectedMetaDescription: metaDesc
        })
      });

      if (res.ok) {
        setMetaSaved(true);
        // Update the selected article with the new meta values
        setSelectedArticle({
          ...selectedArticle,
          selected_meta_title: metaTitle,
          selected_meta_description: metaDesc
        });
        fetchArticles(); // Refresh list
      } else {
        setError('Failed to save meta selections');
      }
    } catch (err) {
      setError('Failed to save meta selections');
    } finally {
      setSavingMeta(false);
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

  // Push ALL to WordPress (article + meta + images)
  const pushAllToWordPress = async () => {
    if (!selectedArticle) return;

    const wpUrl = selectedArticle.wp_url;
    const wpUser = selectedArticle.wp_user;
    const wpPassword = selectedArticle.wp_app_password;

    if (!wpUrl || !wpUser || !wpPassword) {
      setError('WordPress credentials not configured for this website');
      return;
    }

    // Check if meta is saved
    if (!selectedArticle.selected_meta_title && !selectedArticle.selected_meta_description) {
      setError('Please save your meta title & description first before pushing all to WordPress');
      return;
    }

    setPushingAll(true);
    setError(null);

    try {
      // Step 1: Publish article if not already published
      let wpPostId = selectedArticle.wp_post_id;
      if (!wpPostId) {
        const articleRes = await fetch('/api/elementor/publish', {
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
        const articleData = await articleRes.json();
        if (articleData.success && articleData.page) {
          wpPostId = articleData.page.id;
          await fetch(`/api/articles/${selectedArticle.id}/wp-status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wpPostId: articleData.page.id,
              wpPostUrl: articleData.page.link,
              status: 'published'
            })
          });
        } else {
          throw new Error(articleData.error || 'Failed to publish article');
        }
      }

      // Step 2: Push meta to SEO plugin
      if (wpPostId && (selectedArticle.selected_meta_title || selectedArticle.selected_meta_description)) {
        const metaRes = await fetch('/api/seo/push-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wpUrl,
            wpUser,
            wpPassword,
            postId: wpPostId,
            metaTitle: selectedArticle.selected_meta_title,
            metaDescription: selectedArticle.selected_meta_description,
            articleId: selectedArticle.id
          })
        });
        const metaData = await metaRes.json();
        if (!metaData.success) {
          console.warn('Meta push warning:', metaData.error);
        }
      }

      // Step 3: Push images to WordPress
      if (selectedArticle.images && selectedArticle.images.length > 0) {
        const imagesRes = await fetch(`/api/articles/${selectedArticle.id}/push-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wpUrl, wpUser, wpPassword })
        });
        const imagesData = await imagesRes.json();
        if (!imagesData.success) {
          console.warn('Images push warning:', imagesData.error);
        }
      }

      // Refresh article data
      fetchArticleDetails(selectedArticle.id);
      fetchArticles();
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to push all to WordPress');
    } finally {
      setPushingAll(false);
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

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredArticles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredArticles.map(a => a.id)));
    }
  };

  const toggleSelectArticle = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const bulkDeleteArticles = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} article${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;

    setBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      }
      setSelectedIds(new Set());
      fetchArticles();
    } catch (err) {
      setError('Failed to delete some articles');
    } finally {
      setBulkDeleting(false);
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
    setActiveTab('preview');
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

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-slate-800 rounded-lg border border-brand-cyan/30 mb-2">
          <span className="text-sm text-gray-300">
            {selectedIds.size} article{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={bulkDeleteArticles}
            disabled={bulkDeleting}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium transition disabled:opacity-50"
          >
            {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-gray-300 text-sm transition"
          >
            Clear Selection
          </button>
        </div>
      )}

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
                <th className="p-2 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredArticles.length && filteredArticles.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-brand-cyan focus:ring-brand-cyan"
                  />
                </th>
                <th className="p-2">Keyword</th>
                <th className="p-2">Status</th>
                <th className="p-2">Tag</th>
                <th className="p-2">Created</th>
                <th className="p-2">Article</th>
                <th className="p-2">Meta</th>
                <th className="p-2">Image</th>
                <th className="p-2">Bank</th>
                <th className="p-2">Live</th>
                <th className="p-2">AI</th>
                <th className="p-2">Words</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredArticles.map((article) => (
                <tr
                  key={article.id}
                  className={`border-b border-brand-cyan/10 hover:bg-slate-800/50 transition ${selectedIds.has(article.id) ? 'bg-brand-cyan/10' : ''}`}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(article.id)}
                      onChange={() => toggleSelectArticle(article.id)}
                      className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-brand-cyan focus:ring-brand-cyan"
                    />
                  </td>
                  <td className="p-2 font-medium text-white">
                    {article.keyword}
                    {article.version && article.version > 1 && (
                      <span className="ml-2 text-xs text-gray-500">v{article.version}</span>
                    )}
                  </td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(article.status)}`}>
                      {article.status}
                    </span>
                  </td>
                  <td className="p-2">
                    {article.tag && (
                      <span className="px-2 py-0.5 bg-brand-gold/20 text-brand-gold rounded text-xs font-medium">
                        {article.tag}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                    {new Date(article.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      article.wp_post_id ? 'bg-green-600/30 text-green-400' : 'bg-amber-600/30 text-amber-400'
                    }`}>
                      {article.wp_post_id ? 'WP' : 'Draft'}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      article.selected_meta_title ? 'bg-green-600/30 text-green-400' : 'bg-amber-600/30 text-amber-400'
                    }`}>
                      {article.selected_meta_title ? 'WP' : 'Draft'}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      !article.images || (Array.isArray(article.images) ? article.images.length === 0 : true)
                        ? 'bg-slate-600/30 text-slate-400'
                        : (Array.isArray(article.images) && article.images.some((img: ArticleImage) => img.pushedToWp))
                          ? 'bg-green-600/30 text-green-400'
                          : 'bg-amber-600/30 text-amber-400'
                    }`}>
                      {!article.images || (Array.isArray(article.images) ? article.images.length === 0 : true)
                        ? 'Off'
                        : (Array.isArray(article.images) && article.images.some((img: ArticleImage) => img.pushedToWp))
                          ? 'WP'
                          : 'Draft'}
                    </span>
                  </td>
                  <td className="p-2 text-xs">
                    <span className={`${
                      (article.image_decision_report?.images?.filter((img: ImageDecisionReportImage) => img.source === 'bank').length || 0) > 0
                        ? 'text-brand-gold' : 'text-gray-500'
                    }`}>
                      {article.image_decision_report?.images?.filter((img: ImageDecisionReportImage) => img.source === 'bank').length || 0}
                    </span>
                  </td>
                  <td className="p-2 text-xs">
                    <span className={`${
                      (article.image_decision_report?.images?.filter((img: ImageDecisionReportImage) => img.source === 'generated').length || 0) > 0
                        ? 'text-brand-cyan' : 'text-gray-500'
                    }`}>
                      {article.image_decision_report?.images?.filter((img: ImageDecisionReportImage) => img.source === 'generated').length || 0}
                    </span>
                  </td>
                  <td className="p-2 text-gray-300 text-xs">
                    {article.ai_score !== null && article.ai_score !== undefined
                      ? `${article.ai_score}%`
                      : '-'}
                  </td>
                  <td className="p-2 text-gray-300 text-xs">
                    {article.word_count || '-'}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
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

      {/* Article Detail Modal - Full Width Tabbed Interface */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 rounded-lg w-[95vw] h-[90vh] flex flex-col border border-brand-cyan/30 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-brand-cyan/30 bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-brand-gold">{selectedArticle.keyword}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(selectedArticle.status)}`}>
                      {selectedArticle.status}
                    </span>
                    {selectedArticle.tag && (
                      <span className="px-2 py-0.5 bg-brand-gold/20 text-brand-gold rounded text-xs font-medium">
                        {selectedArticle.tag}
                      </span>
                    )}
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-400 text-sm">{selectedArticle.word_count || 0} words</span>
                    <span className="text-gray-400 text-sm">AI: {selectedArticle.ai_score ?? '-'}%</span>
                    {selectedArticle.images && selectedArticle.images.length > 0 && (
                      <span className="text-amber-400 text-sm">{selectedArticle.images.length} images</span>
                    )}
                    {/* Created Date/Time */}
                    {selectedArticle.created_at && (
                      <span className="text-gray-500 text-sm ml-2">
                        {new Date(selectedArticle.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })} {new Date(selectedArticle.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric', minute: '2-digit', hour12: true
                        })}
                      </span>
                    )}
                  </div>
                  {/* Status Badges Row */}
                  <div className="flex items-center gap-2 mt-1 text-xs font-mono">
                    {/* Article: Draft/WP */}
                    <span className={`px-2 py-0.5 rounded font-medium ${
                      selectedArticle.wp_post_id ? 'bg-green-600/30 text-green-400' : 'bg-amber-600/30 text-amber-400'
                    }`}>
                      Article: {selectedArticle.wp_post_id ? 'WP' : 'Draft'}
                    </span>
                    {/* Meta: Draft/WP */}
                    <span className={`px-2 py-0.5 rounded font-medium ${
                      selectedArticle.selected_meta_title ? 'bg-green-600/30 text-green-400' : 'bg-amber-600/30 text-amber-400'
                    }`}>
                      Meta: {selectedArticle.selected_meta_title ? 'WP' : 'Draft'}
                    </span>
                    {/* Image: Draft/WP/Off */}
                    <span className={`px-2 py-0.5 rounded font-medium ${
                      !selectedArticle.images || selectedArticle.images.length === 0
                        ? 'bg-slate-600/30 text-slate-400'
                        : selectedArticle.images.some(img => img.pushedToWp)
                          ? 'bg-green-600/30 text-green-400'
                          : 'bg-amber-600/30 text-amber-400'
                    }`}>
                      Image: {!selectedArticle.images || selectedArticle.images.length === 0
                        ? 'Off'
                        : selectedArticle.images.some(img => img.pushedToWp)
                          ? 'WP'
                          : 'Draft'}
                    </span>
                    {/* Bank Count */}
                    <span className={`px-2 py-0.5 rounded font-medium ${
                      (selectedArticle.image_decision_report?.images?.filter(img => img.source === 'bank').length || 0) > 0
                        ? 'bg-brand-gold/30 text-brand-gold' : 'bg-slate-600/30 text-slate-400'
                    }`}>
                      📦 Bank: {selectedArticle.image_decision_report?.images?.filter(img => img.source === 'bank').length || 0}
                    </span>
                    {/* Live Count */}
                    <span className={`px-2 py-0.5 rounded font-medium ${
                      (selectedArticle.image_decision_report?.images?.filter(img => img.source === 'generated').length || 0) > 0
                        ? 'bg-brand-cyan/30 text-brand-cyan' : 'bg-slate-600/30 text-slate-400'
                    }`}>
                      ⚡ Live: {selectedArticle.image_decision_report?.images?.filter(img => img.source === 'generated').length || 0}
                    </span>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 ml-6">
                  {[
                    { id: 'preview', label: 'Preview', icon: '👁️' },
                    { id: 'content', label: 'Edit', icon: '✏️' },
                    { id: 'images', label: 'Images', icon: '🖼️' },
                    { id: 'meta', label: 'Meta SEO', icon: '🔍' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-brand-cyan text-slate-900'
                          : 'text-gray-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Push All to WP Button */}
                <div className="relative group">
                  <button
                    onClick={pushAllToWordPress}
                    disabled={pushingAll || !selectedArticle.selected_meta_title}
                    className={`px-4 py-1.5 rounded text-white font-medium text-sm transition flex items-center gap-2 ${
                      selectedArticle.selected_meta_title
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
                        : 'bg-gray-600 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {pushingAll ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Pushing All...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Push All to WP
                      </>
                    )}
                  </button>
                  {/* Tooltip when disabled */}
                  {!selectedArticle.selected_meta_title && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 border border-amber-500/50 rounded-lg text-xs text-amber-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Save Meta Title & Description first
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                  )}
                </div>
                {/* WordPress Link */}
                {selectedArticle.wp_post_url && (
                  <a
                    href={selectedArticle.wp_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm font-medium flex items-center gap-2 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
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

            {/* Modal Content - Tabbed Panels */}
            <div className="flex-1 overflow-auto">
              {/* Error banner */}
              {error && (
                <div className="mx-6 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">&times;</button>
                </div>
              )}

              {/* Preview Tab - Elementor-accurate visual preview */}
              {activeTab === 'preview' && (
                <div className="p-6 bg-slate-700/30">
                  <div className="max-w-5xl mx-auto shadow-2xl">
                    <ElementorPreview
                      content={selectedArticle.final_content || ''}
                      title={selectedArticle.selected_meta_title || selectedArticle.meta_titles?.[0] || selectedArticle.keyword}
                      images={selectedArticle.images}
                      heroImageSide="right"
                    />
                  </div>
                </div>
              )}

              {/* Content/Edit Tab */}
              {activeTab === 'content' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-white">Article Content</h4>
                    <div className="flex gap-2">
                      {!isEditing ? (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium text-sm transition"
                        >
                          Edit Content
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={saveArticle}
                            disabled={saving}
                            className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium text-sm transition disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(false);
                              setEditContent(selectedArticle.final_content || '');
                            }}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-[calc(100vh-300px)] bg-slate-800 border border-brand-cyan/30 rounded-lg p-4 text-white font-mono text-sm resize-none focus:border-brand-cyan focus:outline-none"
                      placeholder="Article content..."
                    />
                  ) : (
                    <div className="bg-slate-800 rounded-lg p-6 max-h-[calc(100vh-300px)] overflow-auto">
                      <div
                        className="prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedArticle.final_content || '<em class="text-gray-500">No content</em>' }}
                      />
                    </div>
                  )}

                  {/* Chain Outputs */}
                  {selectedArticle.chain_outputs && Object.keys(selectedArticle.chain_outputs).length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-sm font-medium text-gray-400 mb-3">Chain Outputs</h4>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
              )}

              {/* Images Tab */}
              {activeTab === 'images' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-white">
                      Article Images
                      {selectedArticle.images && selectedArticle.images.length > 0 && (
                        <span className="ml-2 text-sm text-gray-400">({selectedArticle.images.length} images)</span>
                      )}
                    </h4>
                    {selectedArticle.images && selectedArticle.images.length > 0 && (
                      <button
                        onClick={pushImagesToWordPress}
                        disabled={pushingImages}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded text-white font-medium text-sm transition disabled:opacity-50"
                      >
                        {pushingImages ? 'Pushing to WP...' : 'Push All to WordPress'}
                      </button>
                    )}
                  </div>

                  {selectedArticle.images && selectedArticle.images.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {selectedArticle.images.map((image, idx) => (
                        <div key={image.id} className="relative bg-slate-900 rounded-lg overflow-hidden border border-slate-700 hover:border-brand-cyan/50 transition flex flex-col">
                          {/* Image container - shows real aspect ratio */}
                          <div className="relative">
                            <img
                              src={image.url}
                              alt={image.placement || 'Article image'}
                              className="w-full h-auto"
                            />
                            {/* Placement badge */}
                            <div className="absolute top-2 left-2">
                              <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                                image.placement === 'hero' || image.placement?.includes('hero')
                                  ? 'bg-brand-gold text-slate-900'
                                  : 'bg-slate-600 text-white'
                              }`}>
                                {image.placement || `Image ${idx + 1}`}
                              </span>
                            </div>
                            {/* WP status badge */}
                            {image.pushedToWp && (
                              <div className="absolute top-2 right-2">
                                <span className="px-1.5 py-0.5 bg-green-600 rounded text-white text-[10px] flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                  </svg>
                                  WP
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Buttons - always visible below image */}
                          <div className="p-2 bg-slate-800 flex gap-1">
                            <button
                              onClick={() => regenerateImage(image.id)}
                              disabled={regeneratingImage === image.id}
                              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                              {regeneratingImage === image.id && (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              )}
                              {regeneratingImage === image.id ? 'Regenerating...' : 'Regenerate'}
                            </button>
                            <a
                              href={image.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-white text-xs"
                            >
                              View
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                      <svg className="w-16 h-16 opacity-30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-lg">No images generated yet</p>
                      <p className="text-sm mt-1">Generate images from the Image Creation section</p>
                    </div>
                  )}

                  {/* Image Decision Report */}
                  {selectedArticle.image_decision_report && (
                    <div className="mt-8 border-t border-slate-700 pt-6">
                      <button
                        onClick={() => setShowImageReport(!showImageReport)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition mb-4"
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
                        <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
                          {/* Report Header */}
                          <div className="flex items-center gap-4 text-sm flex-wrap">
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
                            {selectedArticle.image_decision_report.smartMatchingEnabled && (
                              <span className="px-2 py-0.5 bg-emerald-600/30 text-emerald-400 rounded text-xs">
                                Smart Matching ON
                              </span>
                            )}
                          </div>

                          {/* Image Decisions Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                                    img.type === 'hero' ? 'bg-brand-gold' : 'bg-slate-600'
                                  }`}>
                                    {img.position}
                                  </div>
                                  <div className="flex-1 min-w-0">
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
                                        {img.source === 'bank' ? 'From Bank' : img.source === 'generated' ? 'Generated' : 'Not Found'}
                                      </span>
                                    </div>
                                    {img.matchedKeywords && img.matchedKeywords.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {img.matchedKeywords.map((kw: string, kwIdx: number) => (
                                          <span key={kwIdx} className="text-[10px] bg-emerald-900/30 text-emerald-400 px-1.5 py-0.5 rounded">
                                            {kw}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {img.url && (
                                    <img src={img.url} alt="" className="w-12 h-12 object-cover rounded shrink-0" />
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
              )}

              {/* Meta SEO Tab */}
              {activeTab === 'meta' && (
                <div className="p-6">
                  <div className="max-w-4xl mx-auto">
                    {/* Action Buttons */}
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-lg font-medium text-white">Meta Title & Description</h4>
                      <div className="flex gap-2">
                        {!metaSaved ? (
                          <button
                            onClick={saveMetaSelections}
                            disabled={savingMeta}
                            className="px-4 py-2 bg-brand-cyan hover:bg-brand-cyan/80 rounded text-slate-900 font-medium text-sm transition disabled:opacity-50"
                          >
                            {savingMeta ? 'Saving...' : 'Save Meta'}
                          </button>
                        ) : (
                          <button
                            onClick={pushMetaToWordPress}
                            disabled={pushingMeta || !selectedArticle.wp_post_id}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium text-sm transition disabled:opacity-50"
                            title={!selectedArticle.wp_post_id ? 'Publish article first' : 'Push meta to WordPress'}
                          >
                            {pushingMeta ? 'Pushing...' : 'Push to WordPress'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      {/* Meta Titles */}
                      <div>
                        <h5 className="text-sm font-medium text-brand-gold mb-3 flex items-center gap-2">
                          Meta Titles
                          {useCustomTitle && customMetaTitle ? (
                            <span className="text-xs text-gray-500">({customMetaTitle.length} chars)</span>
                          ) : selectedTitleIndex !== null && selectedArticle.meta_titles && (
                            <span className="text-xs text-gray-500">
                              ({selectedArticle.meta_titles[selectedTitleIndex]?.length || 0} chars)
                            </span>
                          )}
                        </h5>
                        {selectedArticle.meta_titles && selectedArticle.meta_titles.length > 0 ? (
                          <div className="space-y-2">
                            {selectedArticle.meta_titles.map((title, i) => (
                              <label
                                key={i}
                                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition ${
                                  selectedTitleIndex === i && !useCustomTitle
                                    ? 'bg-brand-gold/20 border-brand-gold'
                                    : 'bg-slate-800 border-transparent hover:border-brand-gold/50'
                                }`}
                                onClick={() => { setSelectedTitleIndex(i); setUseCustomTitle(false); setMetaSaved(false); }}
                              >
                                <input
                                  type="radio"
                                  name="metaTitle"
                                  checked={selectedTitleIndex === i && !useCustomTitle}
                                  onChange={() => { setSelectedTitleIndex(i); setUseCustomTitle(false); setMetaSaved(false); }}
                                  className="mt-1 accent-yellow-500"
                                />
                                <div className="flex-1">
                                  <span className="text-sm text-white">{title}</span>
                                  <div className="mt-1 text-xs text-gray-500">
                                    {title.length} characters
                                    {title.length < 50 && <span className="text-amber-400 ml-2">Too short</span>}
                                    {title.length > 60 && <span className="text-red-400 ml-2">Too long</span>}
                                    {title.length >= 50 && title.length <= 60 && <span className="text-green-400 ml-2">Optimal</span>}
                                  </div>
                                </div>
                              </label>
                            ))}
                            {/* Custom Title Input */}
                            <label
                              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition ${
                                useCustomTitle
                                  ? 'bg-brand-gold/20 border-brand-gold'
                                  : 'bg-slate-800 border-transparent hover:border-brand-gold/50'
                              }`}
                              onClick={() => { setUseCustomTitle(true); setMetaSaved(false); }}
                            >
                              <input
                                type="radio"
                                name="metaTitle"
                                checked={useCustomTitle}
                                onChange={() => { setUseCustomTitle(true); setMetaSaved(false); }}
                                className="mt-1 accent-yellow-500"
                              />
                              <div className="flex-1">
                                <input
                                  type="text"
                                  placeholder="Write custom meta title..."
                                  value={customMetaTitle}
                                  onChange={(e) => { setCustomMetaTitle(e.target.value); setUseCustomTitle(true); setMetaSaved(false); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold"
                                />
                                {useCustomTitle && customMetaTitle && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    {customMetaTitle.length} characters
                                    {customMetaTitle.length < 50 && <span className="text-amber-400 ml-2">Too short</span>}
                                    {customMetaTitle.length > 60 && <span className="text-red-400 ml-2">Too long</span>}
                                    {customMetaTitle.length >= 50 && customMetaTitle.length <= 60 && <span className="text-green-400 ml-2">Optimal</span>}
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No meta titles generated</p>
                        )}
                      </div>

                      {/* Meta Descriptions */}
                      <div>
                        <h5 className="text-sm font-medium text-brand-cyan mb-3 flex items-center gap-2">
                          Meta Descriptions
                          {useCustomDesc && customMetaDesc ? (
                            <span className="text-xs text-gray-500">({customMetaDesc.length} chars)</span>
                          ) : selectedDescIndex !== null && selectedArticle.meta_descriptions && (
                            <span className="text-xs text-gray-500">
                              ({selectedArticle.meta_descriptions[selectedDescIndex]?.length || 0} chars)
                            </span>
                          )}
                        </h5>
                        {selectedArticle.meta_descriptions && selectedArticle.meta_descriptions.length > 0 ? (
                          <div className="space-y-2">
                            {selectedArticle.meta_descriptions.map((desc, i) => (
                              <label
                                key={i}
                                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition ${
                                  selectedDescIndex === i && !useCustomDesc
                                    ? 'bg-brand-cyan/20 border-brand-cyan'
                                    : 'bg-slate-800 border-transparent hover:border-brand-cyan/50'
                                }`}
                                onClick={() => { setSelectedDescIndex(i); setUseCustomDesc(false); setMetaSaved(false); }}
                              >
                                <input
                                  type="radio"
                                  name="metaDesc"
                                  checked={selectedDescIndex === i && !useCustomDesc}
                                  onChange={() => { setSelectedDescIndex(i); setUseCustomDesc(false); setMetaSaved(false); }}
                                  className="mt-1 accent-cyan-500"
                                />
                                <div className="flex-1">
                                  <span className="text-sm text-white">{desc}</span>
                                  <div className="mt-1 text-xs text-gray-500">
                                    {desc.length} characters
                                    {desc.length < 150 && <span className="text-amber-400 ml-2">Too short</span>}
                                    {desc.length > 160 && <span className="text-red-400 ml-2">Too long</span>}
                                    {desc.length >= 150 && desc.length <= 160 && <span className="text-green-400 ml-2">Optimal</span>}
                                  </div>
                                </div>
                              </label>
                            ))}
                            {/* Custom Description Input */}
                            <label
                              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition ${
                                useCustomDesc
                                  ? 'bg-brand-cyan/20 border-brand-cyan'
                                  : 'bg-slate-800 border-transparent hover:border-brand-cyan/50'
                              }`}
                              onClick={() => { setUseCustomDesc(true); setMetaSaved(false); }}
                            >
                              <input
                                type="radio"
                                name="metaDesc"
                                checked={useCustomDesc}
                                onChange={() => { setUseCustomDesc(true); setMetaSaved(false); }}
                                className="mt-1 accent-cyan-500"
                              />
                              <div className="flex-1">
                                <textarea
                                  placeholder="Write custom meta description..."
                                  value={customMetaDesc}
                                  onChange={(e) => { setCustomMetaDesc(e.target.value); setUseCustomDesc(true); setMetaSaved(false); }}
                                  onClick={(e) => e.stopPropagation()}
                                  rows={3}
                                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan resize-none"
                                />
                                {useCustomDesc && customMetaDesc && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    {customMetaDesc.length} characters
                                    {customMetaDesc.length < 150 && <span className="text-amber-400 ml-2">Too short</span>}
                                    {customMetaDesc.length > 160 && <span className="text-red-400 ml-2">Too long</span>}
                                    {customMetaDesc.length >= 150 && customMetaDesc.length <= 160 && <span className="text-green-400 ml-2">Optimal</span>}
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No meta descriptions generated</p>
                        )}
                      </div>
                    </div>

                    {/* Google Preview */}
                    <div className="mt-8 border-t border-slate-700 pt-6">
                      <h5 className="text-sm font-medium text-gray-400 mb-3">Google Search Preview</h5>
                      <div className="bg-white rounded-lg p-4 max-w-2xl">
                        <div className="text-blue-800 text-lg font-medium truncate hover:underline cursor-pointer">
                          {useCustomTitle && customMetaTitle
                            ? customMetaTitle
                            : (selectedTitleIndex !== null && selectedArticle.meta_titles
                              ? selectedArticle.meta_titles[selectedTitleIndex]
                              : selectedArticle.keyword)}
                        </div>
                        <div className="text-green-700 text-sm truncate mt-1">
                          {selectedArticle.wp_post_url || 'https://example.com/' + selectedArticle.keyword.toLowerCase().replace(/\s+/g, '-')}
                        </div>
                        <div className="text-gray-600 text-sm mt-1 line-clamp-2">
                          {useCustomDesc && customMetaDesc
                            ? customMetaDesc
                            : (selectedDescIndex !== null && selectedArticle.meta_descriptions
                              ? selectedArticle.meta_descriptions[selectedDescIndex]
                              : 'No description selected...')}
                        </div>
                      </div>
                    </div>
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
