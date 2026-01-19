import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Props {
  websiteId?: number;
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
}

// Types
interface Project {
  id: number;
  website_id: number;
  name: string;
  description?: string;
  default_model: string;
  image_model: string;
  created_at: string;
}

interface Conversation {
  id: number;
  project_id: number;
  name: string;
  purpose?: string;
  process_order: 'image_first' | 'bank_first';
  created_at: string;
  updated_at: string;
}

interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: { url?: string; base64?: string; filename?: string }[];
  generated_prompt?: {
    sections: PromptSection[];
    fullPrompt: string;
  };
  test_image?: { url: string; wpUrl?: string; prompt: string };
  created_at: string;
}

interface PromptSection {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  order: number;
}

interface Template {
  id: number;
  website_id?: number;
  name: string;
  description?: string;
  is_baseline: boolean;
  sections: PromptSection[];
}

interface Draft {
  id: number;
  conversation_id: number;
  draft_number: number;
  tag?: string;
  description?: string;
  prompt_text: string;
  prompt_sections?: { sections: PromptSection[] };
  is_default: boolean;
  default_label?: string;
  test_image_url?: string;
  test_image_wp_url?: string;
  created_at: string;
}

interface PastedImage {
  id: string;
  base64: string;
  filename: string;
  preview: string;
}

interface AudienceAvatar {
  id: number;
  name: string;
  tag?: string;
  mainPrompt: string;
}

interface ImageCreationSettings {
  audience_avatars: AudienceAvatar[];
}

const ReverseImageSection: React.FC<Props> = ({ websiteId, showNotification }) => {
  // State - Projects & Conversations
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // State - Messages & Chat
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processOrder, setProcessOrder] = useState<'image_first' | 'bank_first'>('image_first');

  // State - Prompt Output
  const [currentPrompt, setCurrentPrompt] = useState<{ sections: PromptSection[]; fullPrompt: string } | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  // State - Drafts Board
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftFilter, setDraftFilter] = useState<string>('all');
  const [showDraftsBoard, setShowDraftsBoard] = useState(true);

  // State - Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  // State - Avatar Integration
  const [avatars, setAvatars] = useState<AudienceAvatar[]>([]);
  const [showAvatarModal, setShowAvatarModal] = useState<'import' | 'export' | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<number | null>(null);

  // State - UI
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newConversationName, setNewConversationName] = useState('');
  const [newConversationPurpose, setNewConversationPurpose] = useState('');

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Default sections for new prompts
  const defaultSections: PromptSection[] = [
    { id: 'lighting', title: 'Lighting', content: '', enabled: true, order: 1 },
    { id: 'subject', title: 'Subject/Worker', content: '', enabled: true, order: 2 },
    { id: 'eyes', title: 'Eyes/Face', content: '', enabled: true, order: 3 },
    { id: 'logo', title: 'Logo/Branding', content: '', enabled: true, order: 4 },
    { id: 'environment', title: 'Environment/Setting', content: '', enabled: true, order: 5 },
    { id: 'composition', title: 'Composition/Framing', content: '', enabled: true, order: 6 },
    { id: 'style', title: 'Style/Mood', content: '', enabled: true, order: 7 },
    { id: 'technical', title: 'Technical Details', content: '', enabled: true, order: 8 },
  ];

  // Load projects when websiteId changes
  useEffect(() => {
    if (websiteId) {
      loadProjects();
      loadTemplates();
      loadAvatars();
    }
  }, [websiteId]);

  // Load conversations when project changes
  useEffect(() => {
    if (selectedProject) {
      loadConversations();
    }
  }, [selectedProject]);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadMessages();
      loadDrafts();
      setProcessOrder(selectedConversation.process_order);
    }
  }, [selectedConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // API Functions
  const loadProjects = async () => {
    try {
      const res = await fetch(`/api/reverse-image/projects?website_id=${websiteId}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0 && !selectedProject) {
          setSelectedProject(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const loadConversations = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/reverse-image/conversations?project_id=${selectedProject.id}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        if (data.length > 0 && !selectedConversation) {
          setSelectedConversation(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadMessages = async () => {
    if (!selectedConversation) return;
    try {
      const res = await fetch(`/api/reverse-image/messages?conversation_id=${selectedConversation.id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        // If last message has a generated prompt, set it as current
        const lastAssistant = [...data].reverse().find((m: Message) => m.role === 'assistant' && m.generated_prompt);
        if (lastAssistant?.generated_prompt) {
          setCurrentPrompt(lastAssistant.generated_prompt);
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const loadDrafts = async () => {
    if (!selectedConversation) return;
    try {
      const res = await fetch(`/api/reverse-image/drafts?conversation_id=${selectedConversation.id}`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(data);
      }
    } catch (err) {
      console.error('Failed to load drafts:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch(`/api/reverse-image/templates?website_id=${websiteId}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        // Select baseline template by default
        const baseline = data.find((t: Template) => t.is_baseline);
        if (baseline) setSelectedTemplate(baseline);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const loadAvatars = async () => {
    if (!websiteId) return;
    try {
      const res = await fetch(`/api/image-creation/settings?website_id=${websiteId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.audience_avatars) {
          setAvatars(data.audience_avatars);
        }
      }
      // Silently fail - avatars are optional for import/export feature
    } catch {
      // Avatar loading is optional, don't show error
    }
  };

  // Import prompt from Audience Avatar
  const importFromAvatar = async (avatarId: number) => {
    const avatar = avatars.find(a => a.id === avatarId);
    if (!avatar || !avatar.mainPrompt) {
      showNotification('Avatar has no main prompt', 'error');
      return;
    }

    // Create a new prompt with the avatar's mainPrompt
    // Parse into sections if possible, otherwise put everything in a "custom" section
    const sections: PromptSection[] = defaultSections.map(s => ({ ...s, content: '' }));

    // Try to find section markers in the prompt
    const sectionPatterns = [
      { pattern: /\[lighting\][:.]?\s*(.*?)(?=\[|$)/is, id: 'lighting' },
      { pattern: /\[subject.*?\][:.]?\s*(.*?)(?=\[|$)/is, id: 'subject' },
      { pattern: /\[eyes.*?\][:.]?\s*(.*?)(?=\[|$)/is, id: 'eyes' },
      { pattern: /\[logo.*?\][:.]?\s*(.*?)(?=\[|$)/is, id: 'logo' },
      { pattern: /\[environment.*?\][:.]?\s*(.*?)(?=\[|$)/is, id: 'environment' },
      { pattern: /\[composition.*?\][:.]?\s*(.*?)(?=\[|$)/is, id: 'composition' },
      { pattern: /\[style.*?\][:.]?\s*(.*?)(?=\[|$)/is, id: 'style' },
      { pattern: /\[technical.*?\][:.]?\s*(.*?)(?=\[|$)/is, id: 'technical' },
    ];

    let foundSections = false;
    for (const { pattern, id } of sectionPatterns) {
      const match = avatar.mainPrompt.match(pattern);
      if (match) {
        foundSections = true;
        const section = sections.find(s => s.id === id);
        if (section) {
          section.content = match[1].trim();
        }
      }
    }

    // If no sections found, put the whole prompt in the first section
    if (!foundSections) {
      sections[0].content = avatar.mainPrompt;
    }

    setCurrentPrompt({
      sections,
      fullPrompt: avatar.mainPrompt,
    });
    setShowAvatarModal(null);
    showNotification(`Imported from "${avatar.name}"`, 'success');
  };

  // Export current prompt to Audience Avatar
  const exportToAvatar = async (avatarId: number) => {
    if (!currentPrompt || !websiteId) return;

    try {
      // Get current settings
      const res = await fetch(`/api/image-creation/settings?website_id=${websiteId}`);
      if (!res.ok) throw new Error('Failed to load settings');

      const settings = await res.json();
      const updatedAvatars = settings.audience_avatars.map((a: AudienceAvatar) => {
        if (a.id === avatarId) {
          return { ...a, mainPrompt: currentPrompt.fullPrompt };
        }
        return a;
      });

      // Update settings
      const updateRes = await fetch(`/api/image-creation/settings?website_id=${websiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience_avatars: updatedAvatars,
        }),
      });

      if (updateRes.ok) {
        setAvatars(updatedAvatars);
        setShowAvatarModal(null);
        showNotification(`Exported to avatar`, 'success');
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (err) {
      console.error('Failed to export to avatar:', err);
      showNotification('Failed to export to avatar', 'error');
    }
  };

  const createProject = async () => {
    if (!websiteId || !newProjectName.trim()) return;
    try {
      const res = await fetch('/api/reverse-image/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_id: websiteId,
          name: newProjectName.trim(),
        }),
      });
      if (res.ok) {
        const project = await res.json();
        setProjects([...projects, project]);
        setSelectedProject(project);
        setShowNewProjectModal(false);
        setNewProjectName('');
        showNotification('Project created', 'success');
      }
    } catch (err) {
      showNotification('Failed to create project', 'error');
    }
  };

  const createConversation = async () => {
    if (!selectedProject || !newConversationName.trim()) return;
    try {
      const res = await fetch('/api/reverse-image/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          name: newConversationName.trim(),
          purpose: newConversationPurpose.trim() || undefined,
        }),
      });
      if (res.ok) {
        const conversation = await res.json();
        setConversations([...conversations, conversation]);
        setSelectedConversation(conversation);
        setMessages([]);
        setDrafts([]);
        setCurrentPrompt(null);
        setShowNewConversationModal(false);
        setNewConversationName('');
        setNewConversationPurpose('');
        showNotification('Conversation created', 'success');
      }
    } catch (err) {
      showNotification('Failed to create conversation', 'error');
    }
  };

  // Image handling
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const newImage: PastedImage = {
              id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              base64,
              filename: `pasted-${Date.now()}.png`,
              preview: base64,
            };
            setPastedImages(prev => [...prev, newImage]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const newImage: PastedImage = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            base64,
            filename: file.name,
            preview: base64,
          };
          setPastedImages(prev => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      }
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (id: string) => {
    setPastedImages(prev => prev.filter(img => img.id !== id));
  };

  // Send message to GPT-5.2
  const sendMessage = async () => {
    if (!selectedConversation || (!inputText.trim() && pastedImages.length === 0)) return;
    if (isProcessing) return;

    setIsProcessing(true);
    const userContent = inputText.trim();
    const userImages = pastedImages.map(img => ({ base64: img.base64, filename: img.filename }));

    // Add user message to UI immediately
    const tempUserMsg: Message = {
      id: Date.now(),
      conversation_id: selectedConversation.id,
      role: 'user',
      content: userContent,
      images: userImages,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setInputText('');
    setPastedImages([]);

    try {
      // Get template sections for structured output
      const templateSections = selectedTemplate?.sections || defaultSections;

      const res = await fetch('/api/reverse-image/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          content: userContent,
          images: userImages,
          template_sections: templateSections,
          process_order: processOrder,
          model: selectedProject?.default_model || 'gpt-5.2',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Reload messages to get the saved ones
        await loadMessages();
        if (data.generated_prompt) {
          setCurrentPrompt(data.generated_prompt);
        }
      } else {
        const error = await res.json();
        showNotification(error.error || 'Failed to analyze image', 'error');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      showNotification('Failed to send message', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Prompt section editing
  const updateSection = (sectionId: string, content: string) => {
    if (!currentPrompt) return;
    const updatedSections = currentPrompt.sections.map(s =>
      s.id === sectionId ? { ...s, content } : s
    );
    const fullPrompt = updatedSections
      .filter(s => s.enabled && s.content.trim())
      .map(s => `[${s.title}]\n${s.content}`)
      .join('\n\n');
    setCurrentPrompt({ sections: updatedSections, fullPrompt });
  };

  const toggleSectionEnabled = (sectionId: string) => {
    if (!currentPrompt) return;
    const updatedSections = currentPrompt.sections.map(s =>
      s.id === sectionId ? { ...s, enabled: !s.enabled } : s
    );
    const fullPrompt = updatedSections
      .filter(s => s.enabled && s.content.trim())
      .map(s => `[${s.title}]\n${s.content}`)
      .join('\n\n');
    setCurrentPrompt({ sections: updatedSections, fullPrompt });
  };

  // Save draft
  const saveDraft = async (tag?: string, description?: string) => {
    if (!selectedConversation || !currentPrompt) return;

    try {
      const res = await fetch('/api/reverse-image/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          tag: tag || undefined,
          description: description || undefined,
          prompt_text: currentPrompt.fullPrompt,
          prompt_sections: { sections: currentPrompt.sections },
        }),
      });

      if (res.ok) {
        await loadDrafts();
        showNotification('Draft saved', 'success');
      }
    } catch (err) {
      showNotification('Failed to save draft', 'error');
    }
  };

  // Mark draft as default
  const toggleDraftDefault = async (draftId: number, label?: string) => {
    try {
      const draft = drafts.find(d => d.id === draftId);
      if (!draft) return;

      const res = await fetch(`/api/reverse-image/drafts/${draftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_default: !draft.is_default,
          default_label: label || 'Default',
        }),
      });

      if (res.ok) {
        await loadDrafts();
      }
    } catch (err) {
      showNotification('Failed to update draft', 'error');
    }
  };

  // Delete draft
  const deleteDraft = async (draftId: number) => {
    try {
      const res = await fetch(`/api/reverse-image/drafts/${draftId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
      }
    } catch (err) {
      showNotification('Failed to delete draft', 'error');
    }
  };

  // Generate test image
  const generateTestImage = async () => {
    if (!currentPrompt || !selectedConversation) return;
    setIsProcessing(true);

    try {
      const res = await fetch('/api/reverse-image/generate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          prompt: currentPrompt.fullPrompt,
          model: selectedProject?.image_model || 'gpt-image-1.5',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await loadMessages();
        showNotification('Test image generated', 'success');
      } else {
        const error = await res.json();
        showNotification(error.error || 'Failed to generate image', 'error');
      }
    } catch (err) {
      showNotification('Failed to generate test image', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy prompt to clipboard
  const copyPrompt = () => {
    if (!currentPrompt) return;
    navigator.clipboard.writeText(currentPrompt.fullPrompt);
    showNotification('Prompt copied to clipboard', 'success');
  };

  // Get unique tags from drafts
  const uniqueTags = Array.from(new Set(drafts.filter(d => d.tag).map(d => d.tag)));

  // Filter drafts
  const filteredDrafts = draftFilter === 'all'
    ? drafts
    : drafts.filter(d => d.tag === draftFilter);

  // No website selected
  if (!websiteId) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <p>Select a website to use the Reverse Image system</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Project Selector */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-400">Project:</label>
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const project = projects.find(p => p.id === Number(e.target.value));
              setSelectedProject(project || null);
              setSelectedConversation(null);
              setMessages([]);
              setDrafts([]);
              setCurrentPrompt(null);
            }}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm"
          >
            {projects.length === 0 && <option value="">No projects</option>}
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm"
          >
            + New Project
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Vision Model:</span>
          <span className="text-xs text-purple-400 font-medium">{selectedProject?.default_model || 'gpt-5.2'}</span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-12 gap-4" style={{ minHeight: '600px' }}>
        {/* Left Sidebar - Conversations */}
        <div className="col-span-3 bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col">
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300">Conversations</span>
            <button
              onClick={() => setShowNewConversationModal(true)}
              disabled={!selectedProject}
              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-xs"
            >
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full text-left px-3 py-2 rounded-lg transition ${
                  selectedConversation?.id === conv.id
                    ? 'bg-purple-600/30 border border-purple-500'
                    : 'hover:bg-slate-700/50'
                }`}
              >
                <div className="text-sm font-medium truncate">{conv.name}</div>
                {conv.purpose && (
                  <div className="text-xs text-slate-500 truncate">{conv.purpose}</div>
                )}
              </button>
            ))}
            {conversations.length === 0 && selectedProject && (
              <p className="text-xs text-slate-500 text-center py-4">No conversations yet</p>
            )}
          </div>
        </div>

        {/* Center - Chat Area */}
        <div className="col-span-5 bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col">
          {/* Chat Header */}
          <div className="p-3 border-b border-slate-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300">
              {selectedConversation?.name || 'Select a conversation'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Process:</span>
              <select
                value={processOrder}
                onChange={(e) => setProcessOrder(e.target.value as 'image_first' | 'bank_first')}
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
              >
                <option value="image_first">Image First</option>
                <option value="bank_first">Bank First</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-purple-600/30 border border-purple-500/50'
                    : 'bg-slate-700/50 border border-slate-600'
                }`}>
                  {/* Images */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img.base64 || img.url}
                          alt={img.filename || 'Reference'}
                          className="w-20 h-20 object-cover rounded border border-slate-600"
                        />
                      ))}
                    </div>
                  )}
                  {/* Content */}
                  {msg.content && (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {/* Test Image */}
                  {msg.test_image && (
                    <div className="mt-2">
                      <img
                        src={msg.test_image.url}
                        alt="Generated"
                        className="max-w-full rounded border border-slate-600"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-slate-400">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-slate-700">
            {/* Pasted Images Preview */}
            {pastedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pastedImages.map(img => (
                  <div key={img.id} className="relative">
                    <img
                      src={img.preview}
                      alt={img.filename}
                      className="w-16 h-16 object-cover rounded border border-slate-600"
                    />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Paste images or describe what you want... (Shift+Enter for newline)"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm resize-none"
                  rows={2}
                  disabled={!selectedConversation || isProcessing}
                />
              </div>
              <div className="flex flex-col gap-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedConversation}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-xs"
                  title="Upload images"
                >
                  📁
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!selectedConversation || isProcessing || (!inputText.trim() && pastedImages.length === 0)}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-xs"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Prompt Output & Drafts */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Structured Prompt Output */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 flex-1 flex flex-col">
            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">Structured Prompt</span>
              <div className="flex items-center gap-2">
                {currentPrompt && (
                  <>
                    <button
                      onClick={copyPrompt}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => {
                        const tag = prompt('Enter tag (e.g., lighting, logo):');
                        saveDraft(tag || undefined);
                      }}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-xs"
                    >
                      Save Draft
                    </button>
                    <button
                      onClick={generateTestImage}
                      disabled={isProcessing}
                      className="px-2 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded text-xs"
                    >
                      Test Image
                    </button>
                    {avatars.length > 0 && (
                      <button
                        onClick={() => setShowAvatarModal('export')}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 rounded text-xs"
                        title="Export to Audience Avatar"
                      >
                        → Avatar
                      </button>
                    )}
                  </>
                )}
                {avatars.length > 0 && (
                  <button
                    onClick={() => setShowAvatarModal('import')}
                    className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs"
                    title="Import from Audience Avatar"
                  >
                    ← Import
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {currentPrompt ? (
                currentPrompt.sections.map(section => (
                  <div
                    key={section.id}
                    className={`rounded-lg border ${
                      section.enabled
                        ? 'bg-slate-700/30 border-slate-600'
                        : 'bg-slate-800/50 border-slate-700 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                      <span className="text-sm font-medium">{section.title}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingSectionId(
                            editingSectionId === section.id ? null : section.id
                          )}
                          className="text-xs text-purple-400 hover:text-purple-300"
                        >
                          {editingSectionId === section.id ? 'Done' : 'Edit'}
                        </button>
                        <button
                          onClick={() => toggleSectionEnabled(section.id)}
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                            section.enabled
                              ? 'bg-emerald-600/30 text-emerald-400'
                              : 'bg-slate-700 text-slate-500'
                          }`}
                        >
                          {section.enabled ? '✓' : '○'}
                        </button>
                      </div>
                    </div>
                    {editingSectionId === section.id ? (
                      <textarea
                        value={section.content}
                        onChange={(e) => updateSection(section.id, e.target.value)}
                        className="w-full bg-slate-800 px-3 py-2 text-xs resize-none"
                        rows={3}
                      />
                    ) : (
                      <p className="px-3 py-2 text-xs text-slate-400">
                        {section.content || <em className="text-slate-600">Empty</em>}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">
                  Send a message with reference images to generate a prompt
                </p>
              )}
            </div>
          </div>

          {/* Prompt Drafts Board */}
          <div className={`bg-slate-800/50 rounded-lg border border-amber-600/50 ${showDraftsBoard ? 'flex-1' : ''} flex flex-col`}>
            <div
              className="p-3 border-b border-amber-600/30 flex items-center justify-between cursor-pointer"
              onClick={() => setShowDraftsBoard(!showDraftsBoard)}
            >
              <span className="text-sm font-semibold text-amber-400">
                Prompt Drafts ({drafts.length})
              </span>
              <svg
                className={`w-4 h-4 text-amber-400 transform transition-transform ${showDraftsBoard ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {showDraftsBoard && (
              <>
                {/* Tag Filter */}
                <div className="p-2 border-b border-slate-700 flex flex-wrap gap-1">
                  <button
                    onClick={() => setDraftFilter('all')}
                    className={`px-2 py-1 rounded text-xs ${
                      draftFilter === 'all'
                        ? 'bg-amber-600/30 text-amber-400 border border-amber-500'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    All
                  </button>
                  {uniqueTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setDraftFilter(tag!)}
                      className={`px-2 py-1 rounded text-xs ${
                        draftFilter === tag
                          ? 'bg-amber-600/30 text-amber-400 border border-amber-500'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                {/* Drafts Grid */}
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {filteredDrafts.map(draft => (
                      <div
                        key={draft.id}
                        className={`bg-slate-700/30 rounded-lg border p-2 ${
                          draft.is_default
                            ? 'border-amber-500'
                            : 'border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-300">#{draft.draft_number}</span>
                          {draft.tag && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-600/30 rounded text-purple-400">
                              {draft.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-3 mb-2">
                          {draft.prompt_text.substring(0, 100)}...
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (draft.prompt_sections) {
                                setCurrentPrompt({
                                  sections: draft.prompt_sections.sections,
                                  fullPrompt: draft.prompt_text,
                                });
                              }
                            }}
                            className="flex-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => toggleDraftDefault(draft.id)}
                            className={`px-2 py-1 rounded text-xs ${
                              draft.is_default
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-600 hover:bg-slate-500'
                            }`}
                            title={draft.is_default ? 'Remove default' : 'Set as default'}
                          >
                            ★
                          </button>
                          <button
                            onClick={() => deleteDraft(draft.id)}
                            className="px-2 py-1 bg-red-600/30 hover:bg-red-600/50 rounded text-xs text-red-400"
                          >
                            ×
                          </button>
                        </div>
                        {draft.is_default && draft.default_label && (
                          <div className="mt-1 text-xs text-amber-400">{draft.default_label}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  {filteredDrafts.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">
                      No drafts yet. Save prompts as you work.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-600 p-6 w-96">
            <h3 className="text-lg font-bold mb-4">New Project</h3>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewProjectModal(false);
                  setNewProjectName('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                disabled={!newProjectName.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewConversationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-600 p-6 w-96">
            <h3 className="text-lg font-bold mb-4">New Conversation</h3>
            <input
              type="text"
              value={newConversationName}
              onChange={(e) => setNewConversationName(e.target.value)}
              placeholder="Conversation name"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 mb-3"
              autoFocus
            />
            <input
              type="text"
              value={newConversationPurpose}
              onChange={(e) => setNewConversationPurpose(e.target.value)}
              placeholder="Purpose (optional) - e.g., Worker photos, Interior shots"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewConversationModal(false);
                  setNewConversationName('');
                  setNewConversationPurpose('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={createConversation}
                disabled={!newConversationName.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Import/Export Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-600 p-6 w-96">
            <h3 className="text-lg font-bold mb-4">
              {showAvatarModal === 'import' ? 'Import from Audience Avatar' : 'Export to Audience Avatar'}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {showAvatarModal === 'import'
                ? 'Select an avatar to import its main prompt:'
                : 'Select an avatar to export the current prompt to:'}
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {avatars.map(avatar => (
                <button
                  key={avatar.id}
                  onClick={() => {
                    if (showAvatarModal === 'import') {
                      importFromAvatar(avatar.id);
                    } else {
                      exportToAvatar(avatar.id);
                    }
                  }}
                  className="w-full text-left px-4 py-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition"
                >
                  <div className="font-medium">{avatar.name}</div>
                  {avatar.tag && (
                    <span className="text-xs text-purple-400">Tag: {avatar.tag}</span>
                  )}
                  {avatar.mainPrompt && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {avatar.mainPrompt.substring(0, 100)}...
                    </p>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowAvatarModal(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReverseImageSection;
