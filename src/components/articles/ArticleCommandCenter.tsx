import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Article types (matching ArticleListView patterns)
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

interface Article {
  id: number;
  workflow_id: number | null;
  website_id: number | null;
  keyword: string;
  tag: string | null;
  final_content: string | null;
  meta_titles: string[];
  meta_descriptions: string[];
  status: string;
  wp_post_id: number | null;
  wp_post_url: string | null;
  created_at: string;
  updated_at: string;
  word_count?: number | null;
  wp_url?: string;
  wp_user?: string;
  wp_app_password?: string;
  seo_plugin?: string;
  selected_meta_title?: string | null;
  selected_meta_description?: string | null;
  images?: ArticleImage[];
  generated_images?: ArticleImage[];
}

interface ArticleCommandCenterProps {
  websiteId?: number;
  isOpen: boolean;
  onClose: () => void;
}

// Strip internal tags like (H), (J), (C) from keywords - Golden Rule 17
const stripTagFromKeyword = (keyword: string | null | undefined): string => {
  if (!keyword) return '';
  return keyword.replace(/\s*\([A-Za-z]\)\s*$/, '').trim();
};

const ArticleCommandCenter: React.FC<ArticleCommandCenterProps> = ({ websiteId, isOpen, onClose }) => {
  // --- Articles data ---
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // --- Navigation ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [browseMode, setBrowseMode] = useState<'all' | 'flagged'>('all');
  const [pinnedTabs, setPinnedTabs] = useState<number[]>([]);
  const [activeArticleId, setActiveArticleId] = useState<number | null>(null);

  // --- Current article ---
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [editContent, setEditContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // --- Flagging ---
  const [flaggedArticles, setFlaggedArticles] = useState<Set<number>>(new Set());

  // --- Find & Replace ---
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);

  // --- Meta ---
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  // --- Loading states ---
  const [saving, setSaving] = useState(false);
  const [pushingContent, setPushingContent] = useState(false);
  const [pushingMeta, setPushingMeta] = useState(false);
  const [pushingImages, setPushingImages] = useState(false);
  const [pushingAll, setPushingAll] = useState(false);
  const [regeneratingImage, setRegeneratingImage] = useState<string>('');
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // --- Feedback ---
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- Refs ---
  const editorRef = useRef<HTMLDivElement>(null);
  const editorContentRef = useRef<string>('');

  // --- Derived data ---
  const filteredArticles = browseMode === 'flagged'
    ? articles.filter(a => flaggedArticles.has(a.id))
    : articles;

  const currentArticle = filteredArticles[currentIndex] || null;

  // --- Fetch articles ---
  const fetchArticles = useCallback(async () => {
    if (!websiteId) {
      setArticles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/articles?websiteId=${websiteId}&limit=500`);
      const data = await res.json();
      if (data.articles) {
        setArticles(data.articles);
        setTotalCount(data.total || data.articles.length);
      }
    } catch (err: any) {
      setError('Failed to load articles: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  // --- Fetch article details ---
  const fetchArticleDetails = useCallback(async (articleId: number) => {
    setFetchingDetails(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}`);
      const data = await res.json();
      if (data.article) {
        setSelectedArticle(data.article);
        const content = data.article.final_content || '';
        setEditContent(content);
        setOriginalContent(content);
        editorContentRef.current = content;
        setIsDirty(false);

        // Load meta - preserve existing selections (Golden Rule 5)
        setMetaTitle(data.article.selected_meta_title || (data.article.meta_titles?.[0]) || '');
        setMetaDescription(data.article.selected_meta_description || (data.article.meta_descriptions?.[0]) || '');

        // Set editor content
        if (editorRef.current) {
          editorRef.current.innerHTML = content;
        }
      }
    } catch (err: any) {
      setError('Failed to load article details: ' + err.message);
    } finally {
      setFetchingDetails(false);
    }
  }, []);

  // --- Load articles on open ---
  useEffect(() => {
    if (isOpen && websiteId) {
      fetchArticles();
    }
  }, [isOpen, websiteId, fetchArticles]);

  // --- Load article details when current article changes ---
  useEffect(() => {
    if (currentArticle && isOpen) {
      // If we have a pinned tab active, load that instead
      if (activeArticleId && pinnedTabs.includes(activeArticleId)) {
        fetchArticleDetails(activeArticleId);
      } else {
        setActiveArticleId(currentArticle.id);
        fetchArticleDetails(currentArticle.id);
      }
    }
  }, [currentIndex, browseMode, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Load pinned article when tab clicked ---
  useEffect(() => {
    if (activeArticleId && pinnedTabs.includes(activeArticleId)) {
      fetchArticleDetails(activeArticleId);
    }
  }, [activeArticleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Set editor content when editContent changes from article load ---
  useEffect(() => {
    if (editorRef.current && editContent && !isDirty) {
      editorRef.current.innerHTML = editContent;
    }
  }, [editContent, isDirty]);

  // --- ESC key handler ---
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't close if focused in the editor
        const active = document.activeElement;
        if (active && (active === editorRef.current || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // --- Find match count ---
  useEffect(() => {
    if (!findText || !editContent) {
      setMatchCount(0);
      return;
    }
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    // Count matches in text content only (strip HTML tags for counting)
    const textOnly = editContent.replace(/<[^>]*>/g, '');
    const matches = textOnly.match(regex);
    setMatchCount(matches ? matches.length : 0);
  }, [findText, editContent]);

  // --- Clear feedback after timeout ---
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // --- Navigation ---
  const navigatePrev = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard and navigate?')) return;
    setCurrentIndex(prev => Math.max(0, prev - 1));
    setIsDirty(false);
    setActiveArticleId(null);
  };

  const navigateNext = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard and navigate?')) return;
    setCurrentIndex(prev => Math.min(filteredArticles.length - 1, prev + 1));
    setIsDirty(false);
    setActiveArticleId(null);
  };

  // --- Editor input handler ---
  const handleEditorInput = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      editorContentRef.current = newContent;
      setEditContent(newContent);
      setIsDirty(true);
    }
  };

  // --- Get current editor content ---
  const getEditorContent = (): string => {
    if (editorRef.current) {
      return editorRef.current.innerHTML;
    }
    return editorContentRef.current || editContent;
  };

  // --- Save article ---
  const saveArticle = async () => {
    if (!selectedArticle) return;
    setSaving(true);
    setError(null);
    const content = getEditorContent();
    try {
      const res = await fetch(`/api/articles/${selectedArticle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalContent: content,
          status: 'edited'
        })
      });
      if (res.ok) {
        setOriginalContent(content);
        setEditContent(content);
        setIsDirty(false);
        setSelectedArticle({ ...selectedArticle, final_content: content, status: 'edited' });
        setSuccess('Article saved');
        fetchArticles(); // Refresh list counts
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to save article');
      }
    } catch (err: any) {
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Push Content to WordPress ---
  const pushContent = async () => {
    if (!selectedArticle) return;
    const content = getEditorContent();

    // Save first if dirty
    if (isDirty) {
      await saveArticle();
    }

    const wpUrl = selectedArticle.wp_url;
    const wpUser = selectedArticle.wp_user;
    const wpPassword = selectedArticle.wp_app_password;

    if (!wpUrl || !wpUser || !wpPassword) {
      setError('Missing WordPress credentials for this article\'s website');
      return;
    }

    setPushingContent(true);
    setError(null);
    try {
      if (selectedArticle.wp_post_id) {
        // Article already on WP - update it
        const res = await fetch('/api/elementor/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wpUrl, wpUser, wpPassword,
            title: stripTagFromKeyword(selectedArticle.keyword),
            keyword: selectedArticle.keyword,
            content: content,
            status: 'draft',
            articleId: selectedArticle.id,
            workflowId: selectedArticle.workflow_id,
            isManualPush: true,
            articleOnly: true,
            existingPostId: selectedArticle.wp_post_id
          })
        });
        const data = await res.json();
        if (data.success) {
          setSuccess('Content pushed to WordPress');
          fetchArticleDetails(selectedArticle.id);
        } else {
          setError(data.error || 'Failed to push content');
        }
      } else {
        // New article - create page (article only, no images)
        const res = await fetch('/api/elementor/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wpUrl, wpUser, wpPassword,
            title: stripTagFromKeyword(selectedArticle.keyword),
            keyword: selectedArticle.keyword,
            content: content,
            status: 'draft',
            articleId: selectedArticle.id,
            workflowId: selectedArticle.workflow_id,
            isManualPush: true,
            articleOnly: true
          })
        });
        const data = await res.json();
        if (data.success && data.page) {
          // Update WP status
          await fetch(`/api/articles/${selectedArticle.id}/wp-status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wpPostId: data.page.id,
              wpPostUrl: data.page.link,
              status: 'published'
            })
          });
          setSuccess('Article published to WordPress');
          fetchArticleDetails(selectedArticle.id);
          fetchArticles();
        } else {
          setError(data.error || 'Failed to publish article');
        }
      }
    } catch (err: any) {
      setError('Push failed: ' + err.message);
    } finally {
      setPushingContent(false);
    }
  };

  // --- Push Images ---
  const pushImages = async () => {
    if (!selectedArticle) return;
    const imgs = selectedArticle.images || selectedArticle.generated_images || [];
    if (imgs.length === 0) {
      setError('No images to push');
      return;
    }
    setPushingImages(true);
    setError(null);
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
        setSuccess('Images pushed to WordPress');
        fetchArticleDetails(selectedArticle.id);
      } else {
        setError(data.error || 'Failed to push images');
      }
    } catch (err: any) {
      setError('Image push failed: ' + err.message);
    } finally {
      setPushingImages(false);
    }
  };

  // --- Push Meta ---
  const pushMeta = async () => {
    if (!selectedArticle) return;
    if (!metaTitle && !metaDescription) {
      setError('Please enter a meta title and/or description first');
      return;
    }
    setPushingMeta(true);
    setError(null);
    try {
      const res = await fetch(`/api/seo/push/${selectedArticle.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaTitle,
          metaDescription
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Meta pushed to WordPress');
        fetchArticleDetails(selectedArticle.id);
      } else {
        setError(data.error || 'Failed to push meta');
      }
    } catch (err: any) {
      setError('Meta push failed: ' + err.message);
    } finally {
      setPushingMeta(false);
    }
  };

  // --- Push Everything (Images → Page → Meta) - following pipeline order ---
  const pushEverything = async () => {
    if (!selectedArticle) return;
    const wpUrl = selectedArticle.wp_url;
    const wpUser = selectedArticle.wp_user;
    const wpPassword = selectedArticle.wp_app_password;

    if (!wpUrl || !wpUser || !wpPassword) {
      setError('Missing WordPress credentials');
      return;
    }

    // Save first if dirty
    if (isDirty) {
      await saveArticle();
    }

    setPushingAll(true);
    setError(null);

    try {
      const content = getEditorContent();
      const hasImages = (selectedArticle.generated_images?.length || 0) > 0;

      // Step 1: Images first (Golden Rule: Images → Page → Meta)
      if (hasImages) {
        const imagesRes = await fetch(`/api/articles/${selectedArticle.id}/push-images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wpUrl, wpUser, wpPassword })
        });
        const imagesData = await imagesRes.json();
        if (!imagesData.success) {
          console.warn('Images upload warning:', imagesData.error);
        }
      }

      // Step 2: Page
      let wpPostId = selectedArticle.wp_post_id;
      if (!wpPostId) {
        const articleRes = await fetch('/api/elementor/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wpUrl, wpUser, wpPassword,
            title: stripTagFromKeyword(selectedArticle.keyword),
            keyword: selectedArticle.keyword,
            content,
            status: 'draft',
            articleId: selectedArticle.id,
            workflowId: selectedArticle.workflow_id,
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
          setError(articleData.error || 'Failed to publish article');
          setPushingAll(false);
          return;
        }
      }

      // Step 3: Meta
      if (wpPostId && (metaTitle || metaDescription)) {
        const metaRes = await fetch('/api/seo/push-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wpUrl, wpUser, wpPassword,
            postId: wpPostId,
            metaTitle,
            metaDescription,
            seoPlugin: selectedArticle.seo_plugin || 'rankmath'
          })
        });
        const metaData = await metaRes.json();
        if (!metaData.success) {
          console.warn('Meta push warning:', metaData.error);
        }
      }

      setSuccess('Everything pushed to WordPress');
      fetchArticleDetails(selectedArticle.id);
      fetchArticles();
    } catch (err: any) {
      setError('Push failed: ' + err.message);
    } finally {
      setPushingAll(false);
    }
  };

  // --- Regenerate Image ---
  const regenerateImage = async (imageId: string) => {
    if (!selectedArticle) return;
    const image = (selectedArticle.images || selectedArticle.generated_images || []).find(i => i.id === imageId);
    if (!image) return;

    setRegeneratingImage(imageId);
    try {
      const res = await fetch(`/api/articles/${selectedArticle.id}/regenerate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, prompt: image.prompt })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedArticle(prev => prev ? {
          ...prev,
          images: prev.images?.map(img => img.id === imageId ? data.image : img),
          generated_images: prev.generated_images?.map(img => img.id === imageId ? data.image : img)
        } : null);
        setSuccess('Image regenerated');
      } else {
        setError(data.error || 'Failed to regenerate image');
      }
    } catch (err: any) {
      setError('Regeneration failed: ' + err.message);
    } finally {
      setRegeneratingImage('');
    }
  };

  // --- Find & Replace ---
  const doReplace = (replaceAll: boolean) => {
    if (!findText) return;
    const content = getEditorContent();
    const escapedFind = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedFind, replaceAll ? 'gi' : 'i');
    const newContent = content.replace(regex, replaceText);

    if (newContent !== content) {
      setEditContent(newContent);
      editorContentRef.current = newContent;
      if (editorRef.current) {
        editorRef.current.innerHTML = newContent;
      }
      setIsDirty(true);
      setSuccess(replaceAll ? `Replaced all occurrences` : 'Replaced first occurrence');
    }
  };

  // --- Toggle flag ---
  const toggleFlag = () => {
    if (!selectedArticle) return;
    setFlaggedArticles(prev => {
      const next = new Set(prev);
      if (next.has(selectedArticle.id)) {
        next.delete(selectedArticle.id);
      } else {
        next.add(selectedArticle.id);
      }
      return next;
    });
  };

  // --- Revert content ---
  const revertContent = () => {
    if (!originalContent) return;
    if (!window.confirm('Revert to last saved version? Current changes will be lost.')) return;
    setEditContent(originalContent);
    editorContentRef.current = originalContent;
    if (editorRef.current) {
      editorRef.current.innerHTML = originalContent;
    }
    setIsDirty(false);
    setSuccess('Content reverted');
  };

  // --- Pin article as tab ---
  const pinArticle = (articleId: number) => {
    if (!pinnedTabs.includes(articleId)) {
      setPinnedTabs(prev => [...prev, articleId]);
    }
    setActiveArticleId(articleId);
  };

  // --- Close pinned tab ---
  const closePinnedTab = (articleId: number) => {
    setPinnedTabs(prev => prev.filter(id => id !== articleId));
    if (activeArticleId === articleId) {
      setActiveArticleId(null);
    }
  };

  // --- Switch to browse mode ---
  const switchBrowseMode = (mode: 'all' | 'flagged') => {
    if (isDirty && !window.confirm('You have unsaved changes. Discard and switch?')) return;
    setBrowseMode(mode);
    setCurrentIndex(0);
    setActiveArticleId(null);
    setIsDirty(false);
  };

  if (!isOpen) return null;

  // --- Images for current article ---
  const articleImages = selectedArticle?.images || selectedArticle?.generated_images || [];

  // --- Status badge ---
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      published: 'bg-green-500/20 text-green-400 border-green-500/50',
      edited: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      draft: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
      generated: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    };
    return colors[status] || colors.draft;
  };

  // --- The overlay (React Portal per Golden Rule 7) ---
  const overlay = (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex flex-col"
      style={{ zIndex: 9999 }}
    >
      {/* === HEADER === */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-brand-cyan/30 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <h1 className="text-lg font-bold text-brand-gold">Article Editor</h1>
          {isDirty && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30">
              Unsaved changes
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl px-3 py-1 hover:bg-slate-700 rounded transition"
          title="Close (Esc)"
        >
          &times; Close
        </button>
      </header>

      {/* === TAB BAR === */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-slate-700 bg-slate-900/80 flex-shrink-0 overflow-x-auto">
        <button
          onClick={() => switchBrowseMode('all')}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            browseMode === 'all' && !pinnedTabs.includes(activeArticleId || 0)
              ? 'bg-brand-cyan text-slate-900'
              : 'text-gray-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          All ({articles.length})
        </button>
        <button
          onClick={() => switchBrowseMode('flagged')}
          className={`px-3 py-1.5 rounded text-sm font-medium transition ${
            browseMode === 'flagged' && !pinnedTabs.includes(activeArticleId || 0)
              ? 'bg-brand-cyan text-slate-900'
              : 'text-gray-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          Flagged ({flaggedArticles.size})
        </button>

        {/* Pinned article tabs */}
        {pinnedTabs.map(tabId => {
          const art = articles.find(a => a.id === tabId);
          if (!art) return null;
          return (
            <div
              key={tabId}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition cursor-pointer ${
                activeArticleId === tabId
                  ? 'bg-brand-cyan text-slate-900'
                  : 'text-gray-400 hover:text-white hover:bg-slate-700'
              }`}
              onClick={() => {
                setActiveArticleId(tabId);
                fetchArticleDetails(tabId);
              }}
            >
              <span className="max-w-[120px] truncate">
                {stripTagFromKeyword(art.keyword).substring(0, 20)}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); closePinnedTab(tabId); }}
                className="ml-1 hover:text-red-400 text-xs"
                title="Close tab"
              >
                &times;
              </button>
            </div>
          );
        })}
      </div>

      {/* === LOADING STATE === */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400">Loading articles...</div>
        </div>
      ) : articles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-lg">No articles found</p>
            <p className="text-gray-500 text-sm mt-2">Generate articles first using the workflow, then come back here to edit and push.</p>
          </div>
        </div>
      ) : (
        <>
          {/* === NAVIGATION BAR === */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
            <button
              onClick={navigatePrev}
              disabled={currentIndex === 0}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded text-sm text-white transition flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>

            <div className="flex items-center gap-3 text-center">
              <span className="text-sm text-gray-400">
                Article {currentIndex + 1} of {filteredArticles.length}
              </span>
              {selectedArticle && (
                <>
                  <span className="text-white font-medium max-w-[400px] truncate">
                    "{stripTagFromKeyword(selectedArticle.keyword)}"
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${getStatusBadge(selectedArticle.status)}`}>
                    {selectedArticle.status}
                  </span>
                  {selectedArticle.wp_post_id && (
                    <span className="text-xs text-gray-500">WP ID: {selectedArticle.wp_post_id}</span>
                  )}
                  <button
                    onClick={() => selectedArticle && pinArticle(selectedArticle.id)}
                    className="text-xs text-gray-400 hover:text-brand-cyan px-2 py-0.5 border border-slate-600 rounded hover:border-brand-cyan/50 transition"
                    title="Pin to tab"
                  >
                    Pin
                  </button>
                </>
              )}
            </div>

            <button
              onClick={navigateNext}
              disabled={currentIndex >= filteredArticles.length - 1}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded text-sm text-white transition flex items-center gap-1"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* === FEEDBACK BAR === */}
          {(error || success) && (
            <div className={`px-4 py-2 text-sm flex-shrink-0 ${error ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
              {error || success}
            </div>
          )}

          {/* === MAIN CONTENT AREA === */}
          <div className="flex-1 flex overflow-hidden">
            {/* --- LEFT: Content Editor --- */}
            <div className="flex-1 flex flex-col border-r border-slate-700 min-w-0">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800/30 flex-shrink-0">
                <h3 className="text-sm font-medium text-gray-300">Article Content</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {selectedArticle?.word_count && (
                    <span>{selectedArticle.word_count} words</span>
                  )}
                  {fetchingDetails && <span className="text-brand-cyan">Loading...</span>}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  className="prose prose-invert max-w-none min-h-full focus:outline-none text-gray-200 leading-relaxed
                    [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-4
                    [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-brand-cyan [&_h2]:mb-3 [&_h2]:mt-6
                    [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-gray-200 [&_h3]:mb-2 [&_h3]:mt-4
                    [&_p]:mb-3 [&_p]:text-gray-300
                    [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3
                    [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3
                    [&_li]:mb-1 [&_li]:text-gray-300
                    [&_strong]:text-white [&_strong]:font-semibold
                    [&_a]:text-brand-cyan [&_a]:underline"
                  spellCheck
                />
              </div>
            </div>

            {/* --- RIGHT: Sidebar --- */}
            <div className="w-[340px] flex-shrink-0 overflow-y-auto bg-slate-900/50">
              {/* IMAGES Section */}
              <SidebarSection title="IMAGES" count={articleImages.length}>
                {articleImages.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {articleImages.map((img) => (
                        <div key={img.id} className="relative group">
                          <img
                            src={img.url}
                            alt={img.placement}
                            className="w-full h-24 object-cover rounded border border-slate-600"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-gray-300 px-1 py-0.5 rounded-b truncate">
                            {img.placement}
                          </div>
                          <button
                            onClick={() => regenerateImage(img.id)}
                            disabled={regeneratingImage === img.id}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-slate-800/90 hover:bg-slate-700 text-xs text-white px-1.5 py-0.5 rounded transition"
                            title="Regenerate"
                          >
                            {regeneratingImage === img.id ? '...' : 'Regen'}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={pushImages}
                        disabled={pushingImages}
                        className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded text-xs text-white font-medium transition"
                      >
                        {pushingImages ? 'Pushing...' : 'Push Images'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-500">No images generated</p>
                )}
              </SidebarSection>

              {/* ACTIONS Section */}
              <SidebarSection title="ACTIONS">
                <div className="space-y-2">
                  <button
                    onClick={pushContent}
                    disabled={pushingContent}
                    className="w-full px-3 py-2 bg-brand-cyan hover:bg-brand-cyan/80 disabled:opacity-50 rounded text-sm text-slate-900 font-medium transition flex items-center justify-center gap-2"
                  >
                    {pushingContent ? 'Pushing...' : 'Push Content'}
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  </button>
                  <button
                    onClick={pushEverything}
                    disabled={pushingAll}
                    className="w-full px-3 py-2 bg-brand-gold hover:bg-brand-gold/80 disabled:opacity-50 rounded text-sm text-slate-900 font-medium transition flex items-center justify-center gap-2"
                  >
                    {pushingAll ? 'Pushing...' : 'Push Everything'}
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  </button>
                  {selectedArticle?.wp_post_url && (
                    <a
                      href={selectedArticle.wp_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white font-medium transition flex items-center justify-center gap-2"
                    >
                      View on WordPress
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={toggleFlag}
                      className={`flex-1 px-3 py-2 rounded text-sm font-medium transition flex items-center justify-center gap-1 ${
                        selectedArticle && flaggedArticles.has(selectedArticle.id)
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50 hover:bg-orange-500/30'
                          : 'bg-slate-700 hover:bg-slate-600 text-gray-300'
                      }`}
                    >
                      {selectedArticle && flaggedArticles.has(selectedArticle.id) ? 'Flagged' : 'Flag'}
                    </button>
                    <button
                      onClick={revertContent}
                      disabled={!isDirty}
                      className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-sm text-gray-300 font-medium transition flex items-center justify-center gap-1"
                    >
                      Revert
                    </button>
                  </div>
                </div>
              </SidebarSection>

              {/* FIND & REPLACE Section */}
              <SidebarSection title="FIND & REPLACE">
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Find:</label>
                    <input
                      type="text"
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      placeholder="Search text..."
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-gray-500 focus:border-brand-cyan focus:outline-none"
                    />
                    {findText && (
                      <span className="text-xs text-gray-500 mt-1 block">
                        {matchCount} match{matchCount !== 1 ? 'es' : ''} found
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Replace:</label>
                    <input
                      type="text"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      placeholder="Replace with..."
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-gray-500 focus:border-brand-cyan focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => doReplace(false)}
                      disabled={!findText}
                      className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-xs text-white font-medium transition"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => doReplace(true)}
                      disabled={!findText}
                      className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-xs text-white font-medium transition"
                    >
                      Replace All
                    </button>
                  </div>
                </div>
              </SidebarSection>

              {/* META Section */}
              <SidebarSection title="META">
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Title:</label>
                    <input
                      type="text"
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      placeholder="Meta title..."
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-gray-500 focus:border-brand-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Description:</label>
                    <textarea
                      value={metaDescription}
                      onChange={(e) => setMetaDescription(e.target.value)}
                      placeholder="Meta description..."
                      rows={3}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-gray-500 focus:border-brand-cyan focus:outline-none resize-none"
                    />
                  </div>
                  <button
                    onClick={pushMeta}
                    disabled={pushingMeta || (!metaTitle && !metaDescription)}
                    className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 rounded text-xs text-white font-medium transition"
                  >
                    {pushingMeta ? 'Pushing...' : 'Push Meta'}
                  </button>
                </div>
              </SidebarSection>
            </div>
          </div>

          {/* === FOOTER === */}
          <footer className="flex items-center justify-between px-4 py-2 border-t border-slate-700 bg-slate-900 flex-shrink-0">
            <button
              onClick={navigatePrev}
              disabled={currentIndex === 0}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded text-sm text-white transition flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={saveArticle}
                disabled={saving || !isDirty}
                className="px-4 py-1.5 bg-brand-cyan hover:bg-brand-cyan/80 disabled:opacity-30 rounded text-sm text-slate-900 font-medium transition"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={pushEverything}
                disabled={pushingAll}
                className="px-4 py-1.5 bg-brand-gold hover:bg-brand-gold/80 disabled:opacity-50 rounded text-sm text-slate-900 font-medium transition flex items-center gap-1"
              >
                {pushingAll ? 'Pushing...' : 'Push to WP'}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </button>
              <button
                onClick={revertContent}
                disabled={!isDirty}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-sm text-gray-300 font-medium transition"
              >
                Revert
              </button>
            </div>

            <button
              onClick={navigateNext}
              disabled={currentIndex >= filteredArticles.length - 1}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded text-sm text-white transition flex items-center gap-1"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </footer>
        </>
      )}
    </div>
  );

  // Render via React Portal (Golden Rule 7)
  return createPortal(overlay, document.body);
};

// --- Sidebar Section component ---
const SidebarSection: React.FC<{
  title: string;
  count?: number;
  children: React.ReactNode;
}> = ({ title, count, children }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-300 transition"
      >
        <span className="flex items-center gap-2">
          {title}
          {count !== undefined && (
            <span className="text-gray-500">({count})</span>
          )}
        </span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  );
};

export default ArticleCommandCenter;
