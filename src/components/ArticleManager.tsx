import React, { useState, useEffect } from 'react';
import SEOSetupGuide from './SEOSetupGuide';

// Image associated with an article
interface ArticleImage {
  id: string;
  url: string;
  prompt: string;
  placement: string; // e.g., "hero", "section-1", "section-2"
  wpMediaId?: number;
  keywords?: string[]; // Keywords this image matches
  createdAt: string;
  pushedToWp?: boolean;
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
  // Generated images for this article
  generated_images: ArticleImage[];
  // Meta SEO selection fields
  selected_meta_title: string | null;
  selected_meta_description: string | null;
  meta_seo_status: 'pending' | 'selected' | 'pushed' | null;
  meta_pushed_at: string | null;
  // Push tracking fields
  article_title: string | null;
  article_push_auto_at: string | null;
  article_push_manual_count: number;
  article_push_manual_dates: string[];
  meta_push_auto_at: string | null;
  meta_push_manual_count: number;
  meta_push_manual_dates: string[];
  // Joined fields
  workflow_name?: string;
  workflow_state?: {
    wpTitleTemplate?: string;
    placeholders?: Array<{ key: string; value: string; tag?: string }>;
    metaPublishMode?: 'draft' | 'wordpress';
    articlePublishMode?: 'draft' | 'wordpress';
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
  const [expandedContent, setExpandedContent] = useState(false);
  const [localSeoPlugin, setLocalSeoPlugin] = useState<string>('rankmath');
  const [showSEOGuide, setShowSEOGuide] = useState(false);

  // Image management state
  const [pushingImages, setPushingImages] = useState(false);
  const [pushingSingleImage, setPushingSingleImage] = useState<string | null>(null);
  const [regeneratingImage, setRegeneratingImage] = useState<string | null>(null);
  const [expandedImages, setExpandedImages] = useState(false);
  const [viewingImage, setViewingImage] = useState<ArticleImage | null>(null);

  // Helper to strip tag suffix like "(H)" from item names
  const stripTagFromName = (name: string): string => {
    return name.replace(/\s*\([^)]+\)\s*$/, '').trim();
  };

  // Fill a simple template with data (supports both <angle brackets> and {curly braces} syntax)
  const fillSimpleTemplate = (template: string, data: Record<string, string | null | undefined>): string => {
    let result = template;
    // First pass: handle <angle brackets>
    result = result.replace(/<([^<>]+)>/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = data[trimmedKey];
      return value !== null && value !== undefined ? String(value) : match;
    });
    // Second pass: handle {curly braces}
    result = result.replace(/{([^{}]+)}/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = data[trimmedKey];
      return value !== null && value !== undefined ? String(value) : match;
    });
    return result;
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

  // Auto-select first AI-generated option when article changes (Draft mode pre-selection)
  useEffect(() => {
    if (selectedArticle) {
      // Pre-select first meta title if available and not already selected
      if (selectedArticle.meta_titles?.length > 0 && selectedTitleIndex === null) {
        // If user already has a saved selection, use that
        if (selectedArticle.selected_meta_title) {
          const savedIndex = selectedArticle.meta_titles.indexOf(selectedArticle.selected_meta_title);
          setSelectedTitleIndex(savedIndex >= 0 ? savedIndex : 0);
        } else {
          setSelectedTitleIndex(0);
        }
      }
      // Pre-select first meta description if available and not already selected
      if (selectedArticle.meta_descriptions?.length > 0 && selectedDescIndex === null) {
        // If user already has a saved selection, use that
        if (selectedArticle.selected_meta_description) {
          const savedIndex = selectedArticle.meta_descriptions.indexOf(selectedArticle.selected_meta_description);
          setSelectedDescIndex(savedIndex >= 0 ? savedIndex : 0);
        } else {
          setSelectedDescIndex(0);
        }
      }
    } else {
      // Reset when no article selected
      setSelectedTitleIndex(null);
      setSelectedDescIndex(null);
      setCustomMetaTitle('');
      setCustomMetaDesc('');
    }
  }, [selectedArticle?.id]);

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

      // Set local SEO plugin from article's website (only on initial load, not refresh)
      // Check if we're loading a different article
      if (!selectedArticle || selectedArticle.id !== article.id) {
        setLocalSeoPlugin(article.seo_plugin || 'rankmath');
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
            includeStatsBar: false,
            articleId: selectedArticle.id,
            isManualPush: true // Track as manual push from ArticleManager
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
          seoPlugin: localSeoPlugin,
          postType: 'pages', // Elementor always creates pages, not posts
          articleId: selectedArticle.id,
          isManualPush: true // Track as manual push from ArticleManager
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

        // Save current plugin selection before refresh (closure issue workaround)
        const currentPlugin = localSeoPlugin;

        // Refresh article to show updated status
        await fetchArticle(selectedArticle.id);
        fetchArticles();

        // Restore plugin selection after refresh
        setLocalSeoPlugin(currentPlugin);
      } else {
        setError(data.error || 'Failed to push to SEO plugin');
      }
    } catch (err) {
      setError('Failed to push to SEO plugin');
    } finally {
      setPushingSeo(false);
    }
  };

  // Push images to WordPress media library
  const pushImagesToWordPress = async () => {
    if (!selectedArticle) return;

    const images = selectedArticle.generated_images || [];
    if (images.length === 0) {
      setError('No images to push');
      return;
    }

    if (!selectedArticle.wp_post_id) {
      setError('Article must be published to WordPress first');
      return;
    }

    const wpUrl = selectedArticle.wp_url || wpCredentials?.url;
    const wpUser = selectedArticle.wp_user || wpCredentials?.user;
    const wpPassword = selectedArticle.wp_app_password || wpCredentials?.password;

    if (!wpUrl || !wpUser || !wpPassword) {
      setError('WordPress credentials not configured');
      return;
    }

    setPushingImages(true);
    try {
      const res = await fetch('/api/articles/push-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: selectedArticle.id,
          postId: selectedArticle.wp_post_id,
          images: images,
          wpUrl,
          wpUser,
          wpPassword
        })
      });

      const data = await res.json();
      if (data.success) {
        await fetchArticle(selectedArticle.id);
        setError(null);
      } else {
        setError(data.error || 'Failed to push images');
      }
    } catch (err) {
      setError('Failed to push images to WordPress');
    } finally {
      setPushingImages(false);
    }
  };

  // Push a single image to WordPress media library
  const pushSingleImageToWordPress = async (imageId: string) => {
    if (!selectedArticle) return;

    const image = (selectedArticle.generated_images || []).find(img => img.id === imageId);
    if (!image) {
      setError('Image not found');
      return;
    }

    if (!selectedArticle.wp_post_id) {
      setError('Article must be published to WordPress first');
      return;
    }

    const wpUrl = selectedArticle.wp_url || wpCredentials?.url;
    const wpUser = selectedArticle.wp_user || wpCredentials?.user;
    const wpPassword = selectedArticle.wp_app_password || wpCredentials?.password;

    if (!wpUrl || !wpUser || !wpPassword) {
      setError('WordPress credentials not configured');
      return;
    }

    setPushingSingleImage(imageId);
    try {
      const res = await fetch('/api/articles/push-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: selectedArticle.id,
          postId: selectedArticle.wp_post_id,
          images: [image],
          wpUrl,
          wpUser,
          wpPassword
        })
      });

      const data = await res.json();
      if (data.success) {
        await fetchArticle(selectedArticle.id);
        setError(null);
      } else {
        setError(data.error || 'Failed to push image');
      }
    } catch (err) {
      setError('Failed to push image to WordPress');
    } finally {
      setPushingSingleImage(null);
    }
  };

  // Regenerate a single image
  const regenerateImage = async (imageId: string) => {
    if (!selectedArticle) return;

    const image = (selectedArticle.generated_images || []).find(i => i.id === imageId);
    if (!image) return;

    setRegeneratingImage(imageId);
    try {
      const res = await fetch('/api/articles/regenerate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: selectedArticle.id,
          imageId: imageId,
          prompt: image.prompt,
          workflowId: selectedArticle.workflow_id
        })
      });

      const data = await res.json();
      if (data.success) {
        await fetchArticle(selectedArticle.id);
        setError(null);
      } else {
        setError(data.error || 'Failed to regenerate image');
      }
    } catch (err) {
      setError('Failed to regenerate image');
    } finally {
      setRegeneratingImage(null);
    }
  };

  // Delete a single image from article
  const deleteArticleImage = async (imageId: string) => {
    if (!selectedArticle) return;
    if (!confirm('Are you sure you want to remove this image?')) return;

    try {
      const updatedImages = (selectedArticle.generated_images || []).filter(i => i.id !== imageId);

      const res = await fetch(`/api/articles/${selectedArticle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generated_images: updatedImages
        })
      });

      if (res.ok) {
        await fetchArticle(selectedArticle.id);
      } else {
        setError('Failed to remove image');
      }
    } catch (err) {
      setError('Failed to remove image');
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
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-brand-cyan/30 rounded text-sm text-gray-300 hover:text-white flex items-center gap-1.5 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to List
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
                        <th className="p-2 text-center" title="Article Push Status: A1=Auto, M1/M2/M3=Manual, D=Draft">Article</th>
                        <th className="p-2 text-center" title="Meta Push Status: A1=Auto, M1/M2/M3=Manual, D=Draft">Meta</th>
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
                          {/* Article Push Status */}
                          <td className="p-2 text-center">
                            {(() => {
                              const hasAutoPush = article.article_push_auto_at;
                              const manualCount = article.article_push_manual_count || 0;
                              // Fallback: if wp_post_id exists but no tracking data, assume A1 (legacy auto-push)
                              const hasWpPost = article.wp_post_id;

                              if (hasAutoPush) {
                                return (
                                  <span
                                    className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium cursor-help"
                                    title={`Auto-pushed: ${new Date(article.article_push_auto_at!).toLocaleString()}`}
                                  >
                                    A1
                                  </span>
                                );
                              } else if (manualCount > 0) {
                                const dates = article.article_push_manual_dates || [];
                                const tooltipText = dates.map((d, i) => `M${i + 1}: ${new Date(d).toLocaleString()}`).join('\n');
                                return (
                                  <span
                                    className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium cursor-help"
                                    title={tooltipText || `Manual pushes: ${manualCount}`}
                                  >
                                    M{manualCount}
                                  </span>
                                );
                              } else if (hasWpPost) {
                                // Has WP post but no tracking data - assume legacy auto-push
                                return (
                                  <span
                                    className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium cursor-help"
                                    title={`Published to WordPress (legacy)`}
                                  >
                                    A1
                                  </span>
                                );
                              } else {
                                return (
                                  <span
                                    className="px-1.5 py-0.5 bg-brand-gold/30 text-brand-gold rounded text-xs font-bold animate-pulse cursor-help"
                                    title="Draft - Not yet pushed to WordPress"
                                  >
                                    D
                                  </span>
                                );
                              }
                            })()}
                          </td>
                          {/* Meta Push Status */}
                          <td className="p-2 text-center">
                            {(() => {
                              const hasMetaTitles = article.meta_titles?.length > 0;
                              const hasMetaDescs = article.meta_descriptions?.length > 0;

                              if (!hasMetaTitles && !hasMetaDescs) {
                                return <span className="text-gray-500 text-xs">—</span>;
                              }

                              const hasAutoPush = article.meta_push_auto_at;
                              const manualCount = article.meta_push_manual_count || 0;
                              // Fallback: if meta_seo_status is 'pushed' but no tracking data
                              const metaWasPushed = article.meta_seo_status === 'pushed';

                              if (hasAutoPush) {
                                return (
                                  <span
                                    className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium cursor-help"
                                    title={`Auto-pushed: ${new Date(article.meta_push_auto_at!).toLocaleString()}`}
                                  >
                                    A1
                                  </span>
                                );
                              } else if (manualCount > 0) {
                                const dates = article.meta_push_manual_dates || [];
                                const tooltipText = dates.map((d, i) => `M${i + 1}: ${new Date(d).toLocaleString()}`).join('\n');
                                return (
                                  <span
                                    className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium cursor-help"
                                    title={tooltipText || `Manual pushes: ${manualCount}`}
                                  >
                                    M{manualCount}
                                  </span>
                                );
                              } else if (metaWasPushed) {
                                // Legacy: meta_seo_status is 'pushed' but no tracking data
                                return (
                                  <span
                                    className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium cursor-help"
                                    title={`Meta pushed to SEO (legacy)`}
                                  >
                                    A1
                                  </span>
                                );
                              } else {
                                return (
                                  <span
                                    className="px-1.5 py-0.5 bg-brand-gold/30 text-brand-gold rounded text-xs font-bold animate-pulse cursor-help"
                                    title="Draft - Meta not yet pushed to SEO plugin"
                                  >
                                    D
                                  </span>
                                );
                              }
                            })()}
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
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => viewArticle(article)}
                                className="px-2 py-1 bg-brand-gold/20 hover:bg-brand-gold/40 border border-brand-gold/50 rounded text-brand-gold text-xs font-medium transition"
                              >
                                View
                              </button>
                              {article.wp_post_url && (
                                <a
                                  href={article.wp_post_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-blue-400 text-xs font-medium transition"
                                >
                                  WP Link
                                </a>
                              )}
                              <button
                                onClick={() => deleteArticle(article.id)}
                                className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 hover:text-red-300 text-xs transition"
                                title="Delete article"
                              >
                                ✕
                              </button>
                            </div>
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
                <div className="p-4 border-b border-brand-cyan/30 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{selectedArticle.keyword}</h3>
                      {/* Article Title (generated from template) */}
                      <div className="text-sm text-brand-cyan mt-0.5">
                        {generatePageTitle(selectedArticle)}
                      </div>
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
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-500">{new Date(selectedArticle.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      {/* Edit / View toggle */}
                      {viewMode === 'view' ? (
                        <button
                          onClick={editArticle}
                          className="px-3 py-1.5 bg-brand-cyan hover:bg-brand-cyan-dark hover:shadow-glow-cyan rounded text-sm text-slate-900 font-medium"
                        >
                          Edit
                        </button>
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
                        </>
                      )}

                      {/* Publish buttons - always visible */}
                      <div className="flex items-center gap-2 border-l border-gray-600 pl-2 ml-1">
                        <button
                          onClick={() => publishToWordPress(true)}
                          disabled={publishing}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm text-white font-medium disabled:opacity-50 flex items-center gap-1.5"
                          title={selectedArticle.article_push_auto_at
                            ? `Auto-pushed: ${new Date(selectedArticle.article_push_auto_at).toLocaleString()}`
                            : selectedArticle.article_push_manual_count
                              ? `Manually pushed ${selectedArticle.article_push_manual_count} time(s)`
                              : 'Not yet pushed'}
                        >
                          {publishing ? 'Publishing...' : (
                            <>
                              Push Article to Elementor
                              {(selectedArticle.article_push_auto_at || selectedArticle.article_push_manual_count > 0 || selectedArticle.wp_post_id) && (
                                <span className="px-1.5 py-0.5 bg-slate-800 rounded text-yellow-400 text-[11px] font-semibold tracking-wide">
                                  {selectedArticle.article_push_auto_at
                                    ? 'A1'
                                    : selectedArticle.article_push_manual_count > 0
                                      ? `M${selectedArticle.article_push_manual_count}`
                                      : 'A1'}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => publishToWordPress(false)}
                          disabled={publishing}
                          className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 border border-blue-500/50 rounded text-sm text-blue-300 font-medium disabled:opacity-50"
                          title="Publish as plain HTML (no Elementor formatting)"
                        >
                          Plain WP
                        </button>
                        {/* Push to Rankmath - Duplicate button for toolbar */}
                        {selectedArticle.wp_post_id && (
                          <button
                            onClick={pushToSeo}
                            disabled={pushingSeo}
                            className="px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded text-sm text-white font-medium disabled:opacity-50 flex items-center gap-1.5"
                            title={selectedArticle.meta_push_auto_at
                              ? `Auto-pushed: ${new Date(selectedArticle.meta_push_auto_at).toLocaleString()}`
                              : selectedArticle.meta_push_manual_count
                                ? `Manually pushed ${selectedArticle.meta_push_manual_count} time(s)`
                                : 'Not yet pushed'}
                          >
                            {pushingSeo ? 'Pushing...' : (
                              <>
                                Push to {localSeoPlugin === 'none' ? 'WordPress' : localSeoPlugin.charAt(0).toUpperCase() + localSeoPlugin.slice(1)}
                                {(selectedArticle.meta_push_auto_at || selectedArticle.meta_push_manual_count > 0 || selectedArticle.meta_seo_status === 'pushed') && (
                                  <span className="px-1.5 py-0.5 bg-slate-800 rounded text-yellow-400 text-[11px] font-semibold tracking-wide">
                                    {selectedArticle.meta_push_auto_at
                                      ? 'A1'
                                      : selectedArticle.meta_push_manual_count > 0
                                        ? `M${selectedArticle.meta_push_manual_count}`
                                        : 'A1'}
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* History button */}
                      <button
                        onClick={() => fetchVersionHistory(selectedArticle.id)}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                      >
                        History
                      </button>

                      {/* WP Link if published */}
                      {selectedArticle.wp_post_url && (
                        <a
                          href={selectedArticle.wp_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded text-sm text-blue-400 font-medium"
                        >
                          WP Link
                        </a>
                      )}

                      {/* Cancel button in edit mode */}
                      {viewMode === 'edit' && (
                        <button
                          onClick={() => setViewMode('view')}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scrollable content wrapper */}
                <div className="flex-1 overflow-y-auto">
                  {/* Content area - expandable with proper overflow control */}
                  <div className={`p-4 transition-all border-b border-brand-cyan/30 ${expandedContent ? 'min-h-[60vh]' : 'max-h-48 overflow-hidden'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">Article Content</span>
                    <button
                      onClick={() => setExpandedContent(!expandedContent)}
                      className="text-xs text-brand-cyan hover:text-brand-cyan-light flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"
                    >
                      {expandedContent ? (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                          Collapse
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                          Expand
                        </>
                      )}
                    </button>
                  </div>
                  {viewMode === 'view' ? (
                    <div className="prose prose-invert max-w-none h-full overflow-auto">
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
                  <div className="border-t-2 border-brand-cyan/50 p-4 pb-24 mt-6 bg-gray-800/50">
                  {/* SEO Status Banner */}
                  {selectedArticle.meta_seo_status && (() => {
                    // In WordPress mode with single options, don't show pending warning (auto-push handles it)
                    const isWordPressAutoMode = selectedArticle.workflow_state?.metaPublishMode === 'wordpress';
                    const hasSingleOptions = (selectedArticle.meta_titles?.length === 1) && (selectedArticle.meta_descriptions?.length === 1);
                    const hasMetaPush = selectedArticle.meta_push_auto_at || selectedArticle.meta_push_manual_count > 0;
                    const skipPendingWarning = selectedArticle.meta_seo_status === 'pending' && isWordPressAutoMode && (hasSingleOptions || hasMetaPush);

                    if (skipPendingWarning) return null;

                    return (
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
                    );
                  })()}

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
                        {/* Custom option - always show */}
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
                        {/* Custom option - always show */}
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

                  {/* Article Images Section */}
                  <div className="mt-6 pt-4 border-t border-purple-500/30">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Article Images ({(selectedArticle.generated_images || []).length})
                      </h4>
                      <div className="flex items-center gap-2">
                        {selectedArticle.wp_post_id && (selectedArticle.generated_images || []).length > 0 && (
                          <button
                            onClick={pushImagesToWordPress}
                            disabled={pushingImages}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded text-sm text-white font-medium flex items-center gap-1.5"
                          >
                            {pushingImages ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                                Push Images to WP
                              </>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedImages(!expandedImages)}
                          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"
                        >
                          {expandedImages ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                              </svg>
                              Collapse
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                              Expand
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {(selectedArticle.generated_images || []).length === 0 ? (
                      <div className="bg-slate-900 rounded-lg p-6 border border-purple-500/30 text-center">
                        <svg className="w-12 h-12 mx-auto mb-3 text-purple-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-400 text-sm mb-2">No images generated yet</p>
                        <p className="text-gray-500 text-xs">Images will appear here once generated from the Image Creation section</p>
                      </div>
                    ) : (
                      <div className={`grid gap-3 ${expandedImages ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-4 md:grid-cols-6'}`}>
                        {(selectedArticle.generated_images || []).map((image) => (
                          <div
                            key={image.id}
                            className={`relative group bg-slate-900 rounded-lg border border-purple-500/30 overflow-hidden ${expandedImages ? 'aspect-[4/3]' : 'aspect-square'}`}
                          >
                            <img
                              src={image.url}
                              alt={image.placement || 'Article image'}
                              className="w-full h-full object-cover"
                            />
                            {/* Overlay with actions */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              <span className="text-xs text-white/80 px-2 py-1 bg-black/50 rounded">
                                {image.placement || 'Unassigned'}
                              </span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setViewingImage(image)}
                                  className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white transition"
                                  title="View full size"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => regenerateImage(image.id)}
                                  disabled={regeneratingImage === image.id}
                                  className="p-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded text-white transition"
                                  title="Replace this image"
                                >
                                  {regeneratingImage === image.id ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  )}
                                </button>
                                <button
                                  onClick={() => deleteArticleImage(image.id)}
                                  className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white transition"
                                  title="Remove this image"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                                {/* Push single image to WP */}
                                {selectedArticle.wp_post_id && !image.pushedToWp && (
                                  <button
                                    onClick={() => pushSingleImageToWordPress(image.id)}
                                    disabled={pushingSingleImage === image.id}
                                    className="p-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded text-white transition"
                                    title="Push this image to WordPress"
                                  >
                                    {pushingSingleImage === image.id ? (
                                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                      </svg>
                                    )}
                                  </button>
                                )}
                              </div>
                              {image.pushedToWp && (
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                  </svg>
                                  In WP
                                </span>
                              )}
                            </div>
                            {/* Keywords badge */}
                            {expandedImages && image.keywords && image.keywords.length > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <div className="flex flex-wrap gap-1">
                                  {image.keywords.slice(0, 3).map((kw, idx) => (
                                    <span key={idx} className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded">
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 pt-4 border-t border-brand-cyan/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">SEO Plugin:</span>
                      <select
                        value={localSeoPlugin}
                        onChange={(e) => setLocalSeoPlugin(e.target.value)}
                        className="bg-slate-900 border border-brand-cyan/50 rounded px-2 py-1 text-white text-xs"
                      >
                        <option value="aioseo">All in One SEO</option>
                        <option value="yoast">Yoast SEO</option>
                        <option value="rankmath">Rank Math</option>
                        <option value="seopress">SEOPress</option>
                        <option value="none">Direct to WP</option>
                      </select>
                      <button
                        onClick={() => setShowSEOGuide(true)}
                        className="p-1 text-brand-cyan hover:bg-brand-cyan/20 rounded transition-colors"
                        title="SEO Plugin Setup Guide"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-3">
                      {/* Save Selection button - always shown when meta options exist */}
                      {/* Button lights up (enables) only when BOTH title AND description are selected */}
                      {(selectedArticle.meta_titles?.length > 0 || selectedArticle.meta_descriptions?.length > 0) && (
                        <button
                          onClick={saveMetaSelection}
                          disabled={saving || selectedTitleIndex === null || selectedDescIndex === null}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                            selectedTitleIndex !== null && selectedDescIndex !== null
                              ? 'bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 shadow-glow-cyan'
                              : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                          }`}
                        >
                          {saving ? 'Saving...' : 'Save Selection'}
                        </button>
                      )}

                      {/* Push to WordPress - shows as TEXT until saved, then becomes BUTTON */}
                      {selectedArticle.wp_post_id && (selectedArticle.meta_titles?.length > 0 || selectedArticle.meta_descriptions?.length > 0) && (
                        <>
                          {/* Show as non-clickable TEXT when meta not yet saved (status is pending/null) */}
                          {(!selectedArticle.meta_seo_status || selectedArticle.meta_seo_status === 'pending') &&
                           !selectedArticle.selected_meta_title && !selectedArticle.selected_meta_description && (
                            <span className="px-4 py-2 text-sm text-gray-500 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              Push to {localSeoPlugin === 'none' ? 'WordPress' : localSeoPlugin.charAt(0).toUpperCase() + localSeoPlugin.slice(1)}
                            </span>
                          )}

                          {/* Show as clickable BUTTON when meta has been saved (status is selected/pushed OR has saved selections) */}
                          {(selectedArticle.meta_seo_status === 'selected' || selectedArticle.meta_seo_status === 'pushed' ||
                            selectedArticle.selected_meta_title || selectedArticle.selected_meta_description) && (
                            <button
                              onClick={pushToSeo}
                              disabled={pushingSeo}
                              className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-lg text-sm text-white font-medium transition disabled:opacity-50 flex items-center gap-2"
                              title={selectedArticle.meta_push_auto_at
                                ? `Auto-pushed: ${new Date(selectedArticle.meta_push_auto_at).toLocaleString()}`
                                : selectedArticle.meta_push_manual_count
                                  ? `Manually pushed ${selectedArticle.meta_push_manual_count} time(s)`
                                  : 'Not yet pushed'}
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
                                  Push to {localSeoPlugin === 'none' ? 'WordPress' : localSeoPlugin.charAt(0).toUpperCase() + localSeoPlugin.slice(1)}
                                  {(selectedArticle.meta_push_auto_at || selectedArticle.meta_push_manual_count > 0 || selectedArticle.meta_seo_status === 'pushed') && (
                                    <span className="px-1.5 py-0.5 bg-slate-800 rounded text-yellow-400 text-[11px] font-semibold tracking-wide">
                                      {selectedArticle.meta_push_auto_at
                                        ? 'A1'
                                        : selectedArticle.meta_push_manual_count > 0
                                          ? `M${selectedArticle.meta_push_manual_count}`
                                          : 'A1'}
                                    </span>
                                  )}
                                </>
                              )}
                            </button>
                          )}
                        </>
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

      {/* SEO Plugin Setup Guide */}
      <SEOSetupGuide
        isOpen={showSEOGuide}
        onClose={() => setShowSEOGuide(false)}
        initialPlugin={localSeoPlugin}
      />

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setViewingImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image */}
            <img
              src={viewingImage.url}
              alt={viewingImage.placement || 'Article image'}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />

            {/* Image info and actions */}
            <div className="mt-4 bg-slate-900 rounded-lg p-4 border border-purple-500/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-white font-medium">{viewingImage.placement || 'Unassigned Image'}</h4>
                  {viewingImage.keywords && viewingImage.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {viewingImage.keywords.map((kw, idx) => (
                        <span key={idx} className="text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      regenerateImage(viewingImage.id);
                      setViewingImage(null);
                    }}
                    disabled={regeneratingImage === viewingImage.id}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 rounded-lg text-white font-medium flex items-center gap-2 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Replace Image
                  </button>
                  <button
                    onClick={() => setViewingImage(null)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition"
                  >
                    Close
                  </button>
                </div>
              </div>
              {viewingImage.prompt && (
                <div className="mt-3 pt-3 border-t border-purple-500/20">
                  <span className="text-xs text-gray-500">Generation Prompt:</span>
                  <p className="text-sm text-gray-300 mt-1">{viewingImage.prompt}</p>
                </div>
              )}
              {viewingImage.pushedToWp && (
                <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Already pushed to WordPress
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleManager;
