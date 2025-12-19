import React, { useState, useEffect, useRef } from 'react';

interface Idea {
  id: string;
  title: string;
  description: string;
  tags: string[];
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest, 5 = lowest
  status: 'idea' | 'planned' | 'in_progress' | 'done';
  created_at: string;
  updated_at: string;
  source?: string; // e.g., "AI Chat", "Manual", "Claude suggestion"
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface IdeasBacklogProps {
  isOpen: boolean;
  onClose: () => void;
}

const IdeasBacklog: React.FC<IdeasBacklogProps> = ({ isOpen, onClose }) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('priority');
  const [showNewIdeaModal, setShowNewIdeaModal] = useState(false);
  const [showChatMode, setShowChatMode] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // New idea form
  const [newIdea, setNewIdea] = useState({
    title: '',
    description: '',
    tags: [] as string[],
    priority: 3 as 1 | 2 | 3 | 4 | 5,
    tagInput: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadIdeas();
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadIdeas = async () => {
    try {
      const res = await fetch('/api/ideas');
      const data = await res.json();
      if (data.ideas) {
        setIdeas(data.ideas);
        // If these are seeded ideas, save to localStorage for persistence
        if (data.seeded) {
          localStorage.setItem('promptflow_ideas', JSON.stringify(data.ideas));
        }
      }
    } catch (error) {
      console.error('Failed to load ideas:', error);
      // Load from localStorage as fallback
      const stored = localStorage.getItem('promptflow_ideas');
      if (stored) {
        setIdeas(JSON.parse(stored));
      }
    }
  };

  const saveIdeas = async (updatedIdeas: Idea[]) => {
    setIdeas(updatedIdeas);
    localStorage.setItem('promptflow_ideas', JSON.stringify(updatedIdeas));

    try {
      await fetch('/api/ideas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideas: updatedIdeas })
      });
    } catch (error) {
      console.error('Failed to save ideas to server:', error);
    }
  };

  const addIdea = (idea: Omit<Idea, 'id' | 'created_at' | 'updated_at'>) => {
    const newIdea: Idea = {
      ...idea,
      id: `idea_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    saveIdeas([newIdea, ...ideas]);
    return newIdea;
  };

  const updateIdea = (id: string, updates: Partial<Idea>) => {
    const updatedIdeas = ideas.map(idea =>
      idea.id === id
        ? { ...idea, ...updates, updated_at: new Date().toISOString() }
        : idea
    );
    saveIdeas(updatedIdeas);
  };

  const deleteIdea = (id: string) => {
    if (confirm('Delete this idea?')) {
      saveIdeas(ideas.filter(idea => idea.id !== id));
      setSelectedIdea(null);
    }
  };

  const handleAddManualIdea = () => {
    if (!newIdea.title.trim()) return;

    addIdea({
      title: newIdea.title,
      description: newIdea.description,
      tags: newIdea.tags,
      priority: newIdea.priority,
      status: 'idea',
      source: 'Manual'
    });

    setNewIdea({ title: '', description: '', tags: [], priority: 3, tagInput: '' });
    setShowNewIdeaModal(false);
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/ideas/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', content: userMessage }],
          context: 'idea_formulation'
        })
      });

      const data = await res.json();

      if (data.message) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }]);

        // Check if AI suggested creating a card
        if (data.suggestedIdea) {
          // AI extracted a structured idea from the conversation
          const created = addIdea({
            ...data.suggestedIdea,
            source: 'AI Chat'
          });
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `I've added "${created.title}" to your backlog with priority ${created.priority}. You can find it in the Ideas list.`
          }]);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting. For now, you can add ideas manually using the '+ New Idea' button. Once the AI integration is set up, I'll be able to help formulate your ideas!"
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const addTagToNewIdea = () => {
    if (newIdea.tagInput.trim() && !newIdea.tags.includes(newIdea.tagInput.trim())) {
      setNewIdea(prev => ({
        ...prev,
        tags: [...prev.tags, prev.tagInput.trim()],
        tagInput: ''
      }));
    }
  };

  const removeTagFromNewIdea = (tag: string) => {
    setNewIdea(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  // Get all unique tags
  const allTags = [...new Set(ideas.flatMap(idea => idea.tags))];

  // Filter and sort ideas
  const filteredIdeas = ideas
    .filter(idea => filterTag === 'all' || idea.tags.includes(filterTag))
    .filter(idea => filterStatus === 'all' || idea.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'priority') return a.priority - b.priority;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 2: return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 3: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 4: return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 5: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idea': return 'bg-purple-500/20 text-purple-400';
      case 'planned': return 'bg-blue-500/20 text-blue-400';
      case 'in_progress': return 'bg-yellow-500/20 text-yellow-400';
      case 'done': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border-2 border-brand-gold shadow-glow-gold flex flex-col">
        {/* Header */}
        <div className="bg-slate-800/50 px-6 py-4 border-b border-brand-gold/30 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-brand-gold">Ideas Backlog</h2>
            <p className="text-sm text-gray-400">Future features, improvements, and crazy ideas</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowChatMode(!showChatMode)}
              className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                showChatMode
                  ? 'bg-brand-cyan text-slate-900'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              AI Assist
            </button>
            <button
              onClick={() => setShowNewIdeaModal(true)}
              className="px-4 py-2 bg-brand-gold hover:bg-brand-gold/80 text-slate-900 rounded-lg font-medium transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Idea
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Content */}
          <div className={`flex-1 flex flex-col overflow-hidden ${showChatMode ? 'w-1/2' : 'w-full'}`}>
            {/* Filters */}
            <div className="p-4 border-b border-slate-700 flex items-center gap-4 flex-shrink-0">
              <select
                value={filterTag}
                onChange={e => setFilterTag(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="all">All Tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="all">All Status</option>
                <option value="idea">Ideas</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'priority' | 'date')}
                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="priority">Sort by Priority</option>
                <option value="date">Sort by Date</option>
              </select>
              <span className="text-sm text-gray-400 ml-auto">{filteredIdeas.length} ideas</span>
            </div>

            {/* Ideas Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredIdeas.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">💡</div>
                  <h3 className="text-xl font-bold text-white mb-2">No ideas yet!</h3>
                  <p className="text-gray-400 mb-4">Start capturing your feature ideas and improvements</p>
                  <button
                    onClick={() => setShowChatMode(true)}
                    className="px-4 py-2 bg-brand-cyan text-slate-900 rounded-lg font-medium"
                  >
                    Chat with AI to brainstorm
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredIdeas.map(idea => (
                    <div
                      key={idea.id}
                      onClick={() => setSelectedIdea(idea)}
                      className={`bg-slate-800/50 rounded-xl p-4 border cursor-pointer transition-all hover:shadow-lg ${
                        selectedIdea?.id === idea.id
                          ? 'border-brand-gold shadow-glow-gold'
                          : 'border-slate-700 hover:border-brand-gold/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-white text-sm line-clamp-2">{idea.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityColor(idea.priority)}`}>
                          P{idea.priority}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs line-clamp-2 mb-3">{idea.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {idea.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-slate-700 text-gray-300 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                          {idea.tags.length > 2 && (
                            <span className="text-xs text-gray-500">+{idea.tags.length - 2}</span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(idea.status)}`}>
                          {idea.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Chat Panel */}
          {showChatMode && (
            <div className="w-1/2 border-l border-slate-700 flex flex-col bg-slate-800/30">
              <div className="p-4 border-b border-slate-700 flex-shrink-0">
                <h3 className="font-bold text-brand-cyan">AI Idea Assistant</h3>
                <p className="text-xs text-gray-400">Describe your idea and I'll help formulate it into a card</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🤖</div>
                    <p className="text-gray-400 text-sm">
                      Tell me about your idea! I'll help you refine it and turn it into an actionable feature card.
                    </p>
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-gray-500">Try saying:</p>
                      <button
                        onClick={() => setChatInput("I have an idea for a feature that...")}
                        className="block w-full text-left px-3 py-2 bg-slate-700 rounded text-sm text-gray-300 hover:bg-slate-600"
                      >
                        "I have an idea for a feature that..."
                      </button>
                      <button
                        onClick={() => setChatInput("What if we could...")}
                        className="block w-full text-left px-3 py-2 bg-slate-700 rounded text-sm text-gray-300 hover:bg-slate-600"
                      >
                        "What if we could..."
                      </button>
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-brand-cyan text-slate-900'
                          : 'bg-slate-700 text-white'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-700 rounded-lg px-4 py-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t border-slate-700 flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                    placeholder="Describe your idea..."
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:border-brand-cyan focus:outline-none"
                  />
                  <button
                    onClick={handleChatSubmit}
                    disabled={chatLoading || !chatInput.trim()}
                    className="px-4 py-2 bg-brand-cyan text-slate-900 rounded-lg font-medium disabled:opacity-50 transition"
                  >
                    Send
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  When ready, say "add this as a card" to save the idea
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Selected Idea Detail Modal */}
        {selectedIdea && (
          <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4" onClick={() => setSelectedIdea(null)}>
            <div className="bg-slate-800 rounded-xl w-full max-w-2xl border border-brand-gold/50 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded text-sm font-medium border ${getPriorityColor(selectedIdea.priority)}`}>
                    Priority {selectedIdea.priority}
                  </span>
                  <span className={`px-3 py-1 rounded text-sm ${getStatusColor(selectedIdea.status)}`}>
                    {selectedIdea.status}
                  </span>
                </div>
                <button onClick={() => setSelectedIdea(null)} className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3">{selectedIdea.title}</h3>
                <p className="text-gray-300 whitespace-pre-wrap mb-4">{selectedIdea.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedIdea.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-slate-700 text-gray-300 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="text-xs text-gray-500 mb-4">
                  Created: {new Date(selectedIdea.created_at).toLocaleDateString()}
                  {selectedIdea.source && ` • Source: ${selectedIdea.source}`}
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={selectedIdea.status}
                    onChange={e => {
                      updateIdea(selectedIdea.id, { status: e.target.value as Idea['status'] });
                      setSelectedIdea({ ...selectedIdea, status: e.target.value as Idea['status'] });
                    }}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                  >
                    <option value="idea">Idea</option>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                  <select
                    value={selectedIdea.priority}
                    onChange={e => {
                      const newPriority = parseInt(e.target.value) as 1|2|3|4|5;
                      updateIdea(selectedIdea.id, { priority: newPriority });
                      setSelectedIdea({ ...selectedIdea, priority: newPriority });
                    }}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white"
                  >
                    <option value={1}>P1 - Critical</option>
                    <option value={2}>P2 - High</option>
                    <option value={3}>P3 - Medium</option>
                    <option value={4}>P4 - Low</option>
                    <option value={5}>P5 - Nice to have</option>
                  </select>
                  <button
                    onClick={() => deleteIdea(selectedIdea.id)}
                    className="ml-auto px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Idea Modal */}
        {showNewIdeaModal && (
          <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4" onClick={() => setShowNewIdeaModal(false)}>
            <div className="bg-slate-800 rounded-xl w-full max-w-lg border border-brand-gold/50 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-brand-gold">New Idea</h3>
                <button onClick={() => setShowNewIdeaModal(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Title</label>
                  <input
                    type="text"
                    value={newIdea.title}
                    onChange={e => setNewIdea(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Brief title for the idea"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-brand-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Description</label>
                  <textarea
                    value={newIdea.description}
                    onChange={e => setNewIdea(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the idea in detail..."
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-brand-gold focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Tags</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newIdea.tagInput}
                      onChange={e => setNewIdea(prev => ({ ...prev, tagInput: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTagToNewIdea())}
                      placeholder="Add a tag"
                      className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:border-brand-gold focus:outline-none"
                    />
                    <button
                      onClick={addTagToNewIdea}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newIdea.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-slate-700 text-gray-300 rounded text-sm flex items-center gap-1">
                        {tag}
                        <button onClick={() => removeTagFromNewIdea(tag)} className="text-gray-500 hover:text-white">×</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Priority</label>
                  <select
                    value={newIdea.priority}
                    onChange={e => setNewIdea(prev => ({ ...prev, priority: parseInt(e.target.value) as 1|2|3|4|5 }))}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option value={1}>P1 - Critical (Do ASAP)</option>
                    <option value={2}>P2 - High</option>
                    <option value={3}>P3 - Medium</option>
                    <option value={4}>P4 - Low</option>
                    <option value={5}>P5 - Nice to have</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowNewIdeaModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddManualIdea}
                  disabled={!newIdea.title.trim()}
                  className="px-4 py-2 bg-brand-gold hover:bg-brand-gold/80 rounded-lg text-slate-900 font-medium transition disabled:opacity-50"
                >
                  Add Idea
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IdeasBacklog;
