import React, { useState, useEffect } from 'react';

interface Article {
  id: number;
  workflow_id: number | null;
  website_id: number | null;
  client_id: number | null;
  keyword: string;
  tag: string | null;
  final_content: string | null;
  status: string;
  wp_post_id: number | null;
  wp_post_url: string | null;
  created_at: string;
  workflow_name?: string;
  website_name?: string;
  client_name?: string;
  ai_score?: number | null;
  word_count?: number | null;
}

interface ArticleListViewProps {
  websiteId?: number;
}

const ArticleListView: React.FC<ArticleListViewProps> = ({ websiteId }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-brand-cyan animate-pulse">Loading articles...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
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
                        className="px-2 py-1 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan/50 rounded text-brand-cyan text-xs font-medium transition"
                        title="View article"
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
                          WP
                        </a>
                      )}
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
    </div>
  );
};

export default ArticleListView;
