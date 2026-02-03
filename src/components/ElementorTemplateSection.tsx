/**
 * ElementorTemplateSection Component
 * UI for creating and managing Elementor page templates per workflow
 */

import React, { useState, useEffect, useCallback } from 'react';

interface ElementorTemplateProps {
  workflowId: number | null;
  websiteUrl?: string;
}

interface TemplateStatus {
  hasTemplate: boolean;
  sourcePageId?: number;
  sourcePageUrl?: string;
  sourcePageTitle?: string;
  createdAt?: string;
  extractedStyles?: any;
}

interface PreviewData {
  pageInfo: {
    id: number;
    title: string;
    url: string;
  };
  preview: {
    summary: string;
    elements: Record<string, Record<string, string>>;
  };
}

const ElementorTemplateSection: React.FC<ElementorTemplateProps> = ({
  workflowId,
  websiteUrl
}) => {
  const [pageIdInput, setPageIdInput] = useState('');
  const [templateStatus, setTemplateStatus] = useState<TemplateStatus>({ hasTemplate: false });
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch template status when workflow changes
  const fetchTemplateStatus = useCallback(async () => {
    if (!workflowId) return;

    try {
      const response = await fetch(`/api/workflows/${workflowId}/elementor-style`);
      const data = await response.json();

      if (data.success) {
        setTemplateStatus({
          hasTemplate: data.hasTemplate,
          sourcePageId: data.style?.sourcePageId,
          sourcePageUrl: data.style?.sourcePageUrl,
          sourcePageTitle: data.style?.sourcePageTitle,
          createdAt: data.style?.createdAt,
          extractedStyles: data.style?.extractedStyles
        });
      }
    } catch (err) {
      console.error('Failed to fetch template status:', err);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchTemplateStatus();
  }, [fetchTemplateStatus]);

  // Preview styles from a page
  const handlePreview = async () => {
    if (!workflowId || !pageIdInput.trim()) {
      setError('Please enter a WordPress page ID');
      return;
    }

    setIsPreviewLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflows/${workflowId}/elementor-style/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: parseInt(pageIdInput.trim()) })
      });

      const data = await response.json();

      if (data.success) {
        setPreviewData(data);
        setShowPreview(true);
      } else {
        setError(data.error || 'Failed to preview styles');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to server');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Create/import template
  const handleCreateTemplate = async () => {
    if (!workflowId || !pageIdInput.trim()) {
      setError('Please enter a WordPress page ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/workflows/${workflowId}/elementor-style/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: parseInt(pageIdInput.trim()) })
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage(`Template created from "${data.pageInfo.title}"`);
        setTemplateStatus({
          hasTemplate: true,
          sourcePageId: data.pageInfo.id,
          sourcePageUrl: data.pageInfo.url,
          sourcePageTitle: data.pageInfo.title,
          createdAt: new Date().toISOString()
        });
        setPageIdInput('');
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(data.error || 'Failed to create template');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async () => {
    if (!workflowId) return;

    if (!confirm('Are you sure you want to remove this template? Generated pages will use default styles.')) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${workflowId}/elementor-style`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setTemplateStatus({ hasTemplate: false });
        setSuccessMessage('Template removed');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Failed to remove template');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to server');
    }
  };

  if (!workflowId) {
    return (
      <div className="text-gray-500 text-sm italic">
        Select a workflow to configure page template
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-brand-gold/30">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-brand-gold flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          Page Style Template
        </h4>
        {/* Status indicator light */}
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              templateStatus.hasTemplate
                ? 'bg-green-500 shadow-lg shadow-green-500/50'
                : 'bg-red-500 shadow-lg shadow-red-500/50'
            }`}
            title={templateStatus.hasTemplate ? 'Template configured' : 'No template - using defaults'}
          />
          <span className="text-xs text-gray-400">
            {templateStatus.hasTemplate ? 'Active' : 'Not Set'}
          </span>
        </div>
      </div>

      {/* Current template info */}
      {templateStatus.hasTemplate && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-400 font-medium">
                Template: {templateStatus.sourcePageTitle || `Page #${templateStatus.sourcePageId}`}
              </p>
              {templateStatus.sourcePageUrl && (
                <a
                  href={templateStatus.sourcePageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-300/70 hover:text-green-300 underline"
                >
                  View source page
                </a>
              )}
            </div>
            <button
              onClick={handleDeleteTemplate}
              className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded border border-red-400/30 hover:border-red-400"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Input and buttons row */}
      <div className="flex items-end gap-2">
        {/* Page ID input */}
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">WordPress Page ID</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={pageIdInput}
              onChange={(e) => setPageIdInput(e.target.value)}
              placeholder="e.g., 1481"
              className="flex-1 bg-slate-900 border border-brand-gold/50 rounded px-2 py-1.5 text-white text-sm focus:ring-1 focus:ring-brand-gold focus:border-brand-gold"
            />
            {/* Instructions button */}
            <button
              onClick={() => setShowInstructions(true)}
              className="px-2 py-1.5 bg-slate-800 border border-brand-gold/50 rounded text-brand-gold hover:bg-slate-700 text-sm font-bold"
              title="How to find Page ID"
            >
              ?
            </button>
          </div>
        </div>

        {/* Preview button */}
        <button
          onClick={handlePreview}
          disabled={isPreviewLoading || !pageIdInput.trim()}
          className="px-3 py-1.5 bg-slate-700 border border-brand-cyan/50 rounded text-brand-cyan hover:bg-slate-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPreviewLoading ? 'Loading...' : 'Preview'}
        </button>

        {/* Create Template button */}
        <button
          onClick={handleCreateTemplate}
          disabled={isLoading || !pageIdInput.trim()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
            templateStatus.hasTemplate
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:animate-none`}
        >
          {isLoading
            ? 'Creating...'
            : templateStatus.hasTemplate
            ? 'Update Template'
            : 'Create Template'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-500/50 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="mt-2 p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 text-sm">
          {successMessage}
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-lg w-full mx-4 border border-brand-gold">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-brand-gold">How to Find Page ID</h3>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-gray-300">
              <div className="bg-slate-900 rounded-lg p-4">
                <p className="font-semibold text-brand-cyan mb-2">Step 1: Go to WordPress Admin</p>
                <p className="text-sm">Navigate to your WordPress dashboard at:</p>
                <code className="block mt-1 text-xs bg-slate-950 px-2 py-1 rounded text-brand-gold">
                  {websiteUrl || 'https://yoursite.com'}/wp-admin
                </code>
              </div>

              <div className="bg-slate-900 rounded-lg p-4">
                <p className="font-semibold text-brand-cyan mb-2">Step 2: Edit Your Template Page</p>
                <p className="text-sm">Go to Pages &rarr; All Pages, then click "Edit" on the page you want to copy styles from.</p>
              </div>

              <div className="bg-slate-900 rounded-lg p-4">
                <p className="font-semibold text-brand-cyan mb-2">Step 3: Find the ID in URL</p>
                <p className="text-sm">Look at the URL in your browser. You'll see something like:</p>
                <code className="block mt-1 text-xs bg-slate-950 px-2 py-1 rounded text-white">
                  /wp-admin/post.php?post=<span className="text-brand-gold font-bold">1481</span>&action=edit
                </code>
                <p className="text-sm mt-2">The number after <code className="text-brand-gold">post=</code> is your Page ID!</p>
              </div>

              <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-3">
                <p className="text-sm text-amber-300">
                  <strong>Tip:</strong> Make sure the page was built with Elementor and has the styling you want to copy (buttons, headings, text, etc.)
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="mt-4 w-full py-2 bg-brand-gold text-black rounded font-medium hover:bg-brand-gold/90"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full mx-4 border border-brand-cyan max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-brand-cyan">Style Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                &times;
              </button>
            </div>

            {/* Page info */}
            <div className="bg-slate-900 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-400">Source Page:</p>
              <p className="text-white font-medium">{previewData.pageInfo.title}</p>
              <a
                href={previewData.pageInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-cyan hover:underline"
              >
                {previewData.pageInfo.url}
              </a>
            </div>

            {/* Summary */}
            <p className="text-sm text-gray-300 mb-4">{previewData.preview.summary}</p>

            {/* Extracted styles */}
            <div className="space-y-3">
              {Object.entries(previewData.preview.elements).map(([elementName, styles]) => (
                <div key={elementName} className="bg-slate-900 rounded-lg p-3">
                  <h4 className="text-brand-gold font-semibold capitalize mb-2">{elementName}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(styles as Record<string, string>).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-400">{key}:</span>
                        <span className="text-white font-mono text-xs">
                          {key.toLowerCase().includes('color') && value !== 'not set' ? (
                            <span className="flex items-center gap-1">
                              <span
                                className="inline-block w-3 h-3 rounded border border-white/30"
                                style={{ backgroundColor: value }}
                              />
                              {value}
                            </span>
                          ) : (
                            value
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  handleCreateTemplate();
                }}
                className="flex-1 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-500"
              >
                Use This Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElementorTemplateSection;
