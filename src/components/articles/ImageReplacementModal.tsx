import React, { useState, useRef } from 'react';

interface ImageReplacementModalProps {
  widgetId: string;
  articleId?: number;
  websiteId: number;
  currentImageUrl?: string;
  onClose: () => void;
  onReplace: (newImageUrl: string, source: 'upload' | 'ai_generated' | 'url', prompt?: string) => void;
}

const ImageReplacementModal: React.FC<ImageReplacementModalProps> = ({
  widgetId,
  articleId,
  websiteId,
  currentImageUrl,
  onClose,
  onReplace
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'ai' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI generation state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStyle, setAiStyle] = useState('photorealistic');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // URL state
  const [imageUrl, setImageUrl] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('websiteId', websiteId.toString());
      if (articleId) formData.append('articleId', articleId.toString());
      formData.append('widgetId', widgetId);

      const res = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        onReplace(data.url, 'upload');
      } else {
        const data = await res.json();
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          style: aiStyle,
          websiteId,
          articleId,
          widgetId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedImageUrl(data.url);
      } else {
        const data = await res.json();
        setError(data.error || 'Generation failed');
      }
    } catch (err) {
      setError('Failed to generate image');
    } finally {
      setGenerating(false);
    }
  };

  const handleUseGeneratedImage = () => {
    if (generatedImageUrl) {
      onReplace(generatedImageUrl, 'ai_generated', aiPrompt);
    }
  };

  const handleUseUrl = () => {
    if (!imageUrl.trim()) {
      setError('Please enter an image URL');
      return;
    }

    try {
      new URL(imageUrl);
      onReplace(imageUrl, 'url');
    } catch {
      setError('Invalid URL');
    }
  };

  const tabs = [
    { id: 'upload' as const, label: 'Upload', icon: '↑' },
    { id: 'ai' as const, label: 'AI Generate', icon: '✨' },
    { id: 'url' as const, label: 'From URL', icon: '🔗' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
      <div className="bg-slate-900 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col border border-brand-cyan/30">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-brand-cyan/30">
          <div>
            <h3 className="text-lg font-semibold text-white">Replace Image</h3>
            <p className="text-sm text-gray-500 font-mono">Widget: {widgetId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-brand-cyan/20">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'text-brand-cyan border-b-2 border-brand-cyan bg-brand-cyan/5'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Current Image Preview */}
          {currentImageUrl && (
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Current Image:</p>
              <img
                src={currentImageUrl}
                alt="Current"
                className="w-32 h-32 object-cover rounded-lg border border-gray-700"
              />
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-brand-cyan/30 rounded-lg p-8 text-center cursor-pointer hover:border-brand-cyan/50 hover:bg-brand-cyan/5 transition"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg"
                  />
                ) : (
                  <>
                    <svg className="w-12 h-12 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400">Click to select an image</p>
                    <p className="text-gray-600 text-sm mt-1">PNG, JPG, WebP up to 10MB</p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full py-3 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium rounded-lg transition disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload & Replace'}
                </button>
              )}
            </div>
          )}

          {/* AI Generate Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Describe the image you want
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="A beautiful sunset over the ocean with golden light reflecting on calm waters..."
                  className="w-full h-24 bg-slate-800 border border-brand-cyan/30 rounded-lg p-3 text-white placeholder-gray-500 resize-none focus:border-brand-cyan focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Style
                </label>
                <select
                  value={aiStyle}
                  onChange={(e) => setAiStyle(e.target.value)}
                  className="w-full bg-slate-800 border border-brand-cyan/30 rounded-lg p-3 text-white focus:border-brand-cyan focus:outline-none"
                >
                  <option value="photorealistic">Photorealistic</option>
                  <option value="artistic">Artistic</option>
                  <option value="illustration">Illustration</option>
                  <option value="3d_render">3D Render</option>
                  <option value="watercolor">Watercolor</option>
                </select>
              </div>

              <button
                onClick={handleGenerateAI}
                disabled={generating || !aiPrompt.trim()}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Image'}
              </button>

              {generatedImageUrl && (
                <div className="mt-4">
                  <p className="text-sm text-gray-400 mb-2">Generated Image:</p>
                  <img
                    src={generatedImageUrl}
                    alt="Generated"
                    className="max-h-48 rounded-lg border border-gray-700"
                  />
                  <button
                    onClick={handleUseGeneratedImage}
                    className="mt-3 w-full py-3 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium rounded-lg transition"
                  >
                    Use This Image
                  </button>
                </div>
              )}
            </div>
          )}

          {/* URL Tab */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full bg-slate-800 border border-brand-cyan/30 rounded-lg p-3 text-white placeholder-gray-500 focus:border-brand-cyan focus:outline-none"
                />
              </div>

              {imageUrl && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Preview:</p>
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="max-h-48 rounded-lg border border-gray-700"
                    onError={() => setError('Could not load image from URL')}
                  />
                </div>
              )}

              <button
                onClick={handleUseUrl}
                disabled={!imageUrl.trim()}
                className="w-full py-3 bg-brand-cyan hover:bg-brand-cyan/80 text-slate-900 font-medium rounded-lg transition disabled:opacity-50"
              >
                Use This Image
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageReplacementModal;
