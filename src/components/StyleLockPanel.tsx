import React, { useState, useEffect, useRef } from 'react';

interface StyleLockPanelProps {
  websiteId: number;
  styleDNA: any;
  referenceImages: string[];
  openaiKey?: string;
  replicateKey?: string;
}

interface RoundImage {
  url: string;
  localData?: string;
  prompt: string;
  generatorIndex: number;
  votes: { voterIndex: number; score: number; feedback: string }[];
  avgScore: number;
  isWinner: boolean;
}

interface RoundData {
  roundNum: number;
  images: RoundImage[];
  bestScore: number;
  winnerIndex: number;
}

interface KnowledgeFile {
  id: number;
  name: string;
  filename: string;
  file_type: string;
  item_count: number;
  created_at: string;
}

const StyleLockPanel: React.FC<StyleLockPanelProps> = ({
  websiteId,
  styleDNA,
  referenceImages,
  openaiKey,
  replicateKey
}) => {
  // Settings state
  const [preset, setPreset] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [settings, setSettings] = useState({
    numGenerators: 3, numVoters: 3, numJudges: 3,
    advanceThreshold: 85, blindTestThreshold: 66,
    maxRounds: 10, maxCost: 5.00
  });
  const [showSettings, setShowSettings] = useState(false);
  const [targetDescription, setTargetDescription] = useState('');

  // Job state
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [result, setResult] = useState<any>(null);
  const [totalCost, setTotalCost] = useState(0);

  // Knowledge files
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Editable prompts
  const [prompts, setPrompts] = useState<any[]>([]);
  const [showPrompts, setShowPrompts] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);

  const presetValues = {
    conservative: { numGenerators: 2, numVoters: 3, numJudges: 3, advanceThreshold: 80, blindTestThreshold: 50, maxRounds: 5, maxCost: 2.00 },
    balanced: { numGenerators: 3, numVoters: 3, numJudges: 3, advanceThreshold: 85, blindTestThreshold: 66, maxRounds: 10, maxCost: 5.00 },
    aggressive: { numGenerators: 5, numVoters: 5, numJudges: 5, advanceThreshold: 90, blindTestThreshold: 80, maxRounds: 15, maxCost: 10.00 }
  };

  useEffect(() => {
    loadKnowledgeFiles();
    loadPrompts();
  }, []);

  const loadKnowledgeFiles = async () => {
    try {
      const res = await fetch('/api/knowledge/files');
      const data = await res.json();
      if (data.success) setKnowledgeFiles(data.files || []);
    } catch (e) { console.error('Failed to load knowledge:', e); }
  };

  const loadPrompts = async () => {
    try {
      const res = await fetch('/api/knowledge/prompts');
      const data = await res.json();
      if (data.success) setPrompts(data.prompts || []);
    } catch (e) { console.error('Failed to load prompts:', e); }
  };

  const handlePresetChange = (p: 'conservative' | 'balanced' | 'aggressive') => {
    setPreset(p);
    setSettings(presetValues[p]);
  };

  const uploadKnowledgeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const content = JSON.parse(text);

      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name.replace('.json', ''),
          filename: file.name,
          fileType: 'training',
          content
        })
      });

      const data = await res.json();
      if (data.success) {
        loadKnowledgeFiles();
        alert(`Uploaded ${data.file.item_count} training items`);
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (err: any) {
      alert('Invalid JSON file: ' + err.message);
    }

    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  const deleteKnowledgeFile = async (id: number) => {
    if (!confirm('Delete this knowledge file?')) return;
    await fetch(`/api/knowledge/files/${id}`, { method: 'DELETE' });
    loadKnowledgeFiles();
  };

  const savePrompt = async (promptType: string, promptText: string) => {
    await fetch(`/api/knowledge/prompts/${promptType}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptText })
    });
    loadPrompts();
    setEditingPrompt(null);
  };

  const runStyleLock = async () => {
    if (!styleDNA || !targetDescription) {
      alert('Please extract Style DNA and enter a target description');
      return;
    }

    setRunning(true);
    setRounds([]);
    setResult(null);
    setTotalCost(0);
    setStatus('starting');

    try {
      const res = await fetch('/api/images/stylelock/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId,
          referenceImages,
          targetDescription,
          openaiApiKey: openaiKey,
          replicateApiKey: replicateKey,
          settingsOverrides: {
            generation: { numGenerators: settings.numGenerators, maxRounds: settings.maxRounds },
            voting: { numVoters: settings.numVoters, advanceThreshold: settings.advanceThreshold },
            blindTest: { numJudges: settings.numJudges, passThreshold: settings.blindTestThreshold / 100 },
            limits: { maxCost: settings.maxCost }
          }
        })
      });

      const data = await res.json();
      if (data.success && data.jobId) {
        setJobId(data.jobId);
        pollJob(data.jobId);
      } else {
        alert('Failed: ' + (data.error || 'Unknown error'));
        setRunning(false);
      }
    } catch (err) {
      console.error(err);
      setRunning(false);
    }
  };

  const pollJob = async (jid: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/images/stylelock/job/${jid}`);
        const data = await res.json();

        setStatus(data.status);

        // Parse progress into rounds with images
        if (data.progress) {
          const roundsMap: { [key: number]: RoundData } = {};

          for (const p of data.progress) {
            if (p.round && p.status === 'image_generated') {
              if (!roundsMap[p.round]) {
                roundsMap[p.round] = { roundNum: p.round, images: [], bestScore: 0, winnerIndex: -1 };
              }
              roundsMap[p.round].images.push({
                url: p.imageUrl,
                localData: p.localData,
                prompt: p.prompt,
                generatorIndex: p.generatorIndex,
                votes: [],
                avgScore: 0,
                isWinner: false
              });
            }
            if (p.round && p.status === 'votes_received') {
              if (roundsMap[p.round]) {
                const img = roundsMap[p.round].images.find(i => i.generatorIndex === p.generatorIndex);
                if (img) {
                  img.votes = p.votes || [];
                  img.avgScore = p.avgScore || 0;
                  img.isWinner = p.isWinner || false;
                }
              }
            }
            if (p.round && p.status === 'round_complete') {
              if (roundsMap[p.round]) {
                roundsMap[p.round].bestScore = p.bestScore || 0;
              }
            }
            if (p.cost) setTotalCost(p.cost);
          }

          setRounds(Object.values(roundsMap).sort((a, b) => a.roundNum - b.roundNum));
        }

        if (data.result) setResult(data.result);

        if (data.status === 'running') {
          setTimeout(poll, 2000);
        } else {
          setRunning(false);
        }
      } catch (e) {
        console.error(e);
        setRunning(false);
      }
    };
    poll();
  };

  return (
    <div className="space-y-3">
      {/* Header with Preset */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-purple-400">StyleLock Engine</h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">${(settings.maxCost * 0.3).toFixed(2)}-${settings.maxCost.toFixed(2)}</span>
          <select value={preset} onChange={e => handlePresetChange(e.target.value as any)}
            className="bg-slate-800 border border-purple-500/50 rounded px-2 py-0.5 text-[10px] text-white">
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>
      </div>

      {/* Target Description */}
      <input type="text" placeholder="Describe the image (e.g., 'A plumber fixing a kitchen sink')"
        value={targetDescription} onChange={e => setTargetDescription(e.target.value)}
        className="w-full bg-slate-800 border border-purple-500/30 rounded px-2 py-1.5 text-xs text-white" />

      {/* Compact Settings - 8 columns */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShowSettings(!showSettings)}
          className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
          <svg className={`w-3 h-3 transition ${showSettings ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          Settings
        </button>
        <button onClick={() => setShowKnowledge(!showKnowledge)}
          className="text-[10px] text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
          <svg className={`w-3 h-3 transition ${showKnowledge ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          Knowledge ({knowledgeFiles.length})
        </button>
        <button onClick={() => setShowPrompts(!showPrompts)}
          className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
          <svg className={`w-3 h-3 transition ${showPrompts ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          Prompts
        </button>
      </div>

      {showSettings && (
        <div className="grid grid-cols-8 gap-1 p-2 bg-slate-800/50 rounded text-[10px]">
          <div><label className="text-gray-500">Gen</label>
            <select value={settings.numGenerators} onChange={e => setSettings(s => ({...s, numGenerators: +e.target.value}))}
              className="w-full bg-slate-700 rounded px-1 py-0.5 text-white">
              <option value={2}>2</option><option value={3}>3</option><option value={5}>5</option>
            </select></div>
          <div><label className="text-gray-500">Vote</label>
            <select value={settings.numVoters} onChange={e => setSettings(s => ({...s, numVoters: +e.target.value}))}
              className="w-full bg-slate-700 rounded px-1 py-0.5 text-white">
              <option value={3}>3</option><option value={5}>5</option><option value={7}>7</option>
            </select></div>
          <div><label className="text-gray-500">Judge</label>
            <select value={settings.numJudges} onChange={e => setSettings(s => ({...s, numJudges: +e.target.value}))}
              className="w-full bg-slate-700 rounded px-1 py-0.5 text-white">
              <option value={3}>3</option><option value={5}>5</option><option value={7}>7</option>
            </select></div>
          <div><label className="text-gray-500">Max$</label>
            <select value={settings.maxCost} onChange={e => setSettings(s => ({...s, maxCost: +e.target.value}))}
              className="w-full bg-slate-700 rounded px-1 py-0.5 text-white">
              <option value={2}>$2</option><option value={5}>$5</option><option value={10}>$10</option>
            </select></div>
          <div><label className="text-gray-500">Pass%</label>
            <select value={settings.advanceThreshold} onChange={e => setSettings(s => ({...s, advanceThreshold: +e.target.value}))}
              className="w-full bg-slate-700 rounded px-1 py-0.5 text-white">
              <option value={80}>80</option><option value={85}>85</option><option value={90}>90</option>
            </select></div>
          <div><label className="text-gray-500">Blind%</label>
            <select value={settings.blindTestThreshold} onChange={e => setSettings(s => ({...s, blindTestThreshold: +e.target.value}))}
              className="w-full bg-slate-700 rounded px-1 py-0.5 text-white">
              <option value={50}>50</option><option value={66}>66</option><option value={80}>80</option>
            </select></div>
          <div><label className="text-gray-500">Rnds</label>
            <select value={settings.maxRounds} onChange={e => setSettings(s => ({...s, maxRounds: +e.target.value}))}
              className="w-full bg-slate-700 rounded px-1 py-0.5 text-white">
              <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option>
            </select></div>
          <div className="flex items-end">
            <button onClick={() => handlePresetChange(preset)} className="text-[10px] text-purple-400">Reset</button>
          </div>
        </div>
      )}

      {/* Knowledge Files */}
      {showKnowledge && (
        <div className="p-2 bg-slate-800/50 rounded">
          <div className="flex items-center gap-2 mb-2">
            <input type="file" ref={jsonInputRef} accept=".json" onChange={uploadKnowledgeFile} className="hidden" />
            <button onClick={() => jsonInputRef.current?.click()}
              className="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-[10px] text-white">
              Upload JSON
            </button>
            <span className="text-[10px] text-gray-500">Course Engine Training Files</span>
          </div>
          {knowledgeFiles.length > 0 ? (
            <div className="space-y-1 max-h-24 overflow-auto">
              {knowledgeFiles.map(f => (
                <div key={f.id} className="flex items-center justify-between text-[10px] p-1 bg-slate-700/50 rounded">
                  <span className="text-white">{f.name}</span>
                  <span className="text-gray-500">{f.item_count} items</span>
                  <button onClick={() => deleteKnowledgeFile(f.id)} className="text-red-400 hover:text-red-300">×</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-500">No training files uploaded</p>
          )}
        </div>
      )}

      {/* Editable Prompts */}
      {showPrompts && (
        <div className="p-2 bg-slate-800/50 rounded max-h-40 overflow-auto">
          {prompts.map(p => (
            <div key={p.prompt_type} className="mb-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-cyan-400 font-bold">{p.name}</span>
                <button onClick={() => setEditingPrompt(editingPrompt === p.prompt_type ? null : p.prompt_type)}
                  className="text-[10px] text-gray-400 hover:text-white">
                  {editingPrompt === p.prompt_type ? 'Cancel' : 'Edit'}
                </button>
              </div>
              {editingPrompt === p.prompt_type ? (
                <div>
                  <textarea defaultValue={p.prompt_text} id={`prompt-${p.prompt_type}`}
                    className="w-full h-20 bg-slate-700 rounded p-1 text-[10px] text-white mt-1" />
                  <button onClick={() => {
                    const el = document.getElementById(`prompt-${p.prompt_type}`) as HTMLTextAreaElement;
                    savePrompt(p.prompt_type, el.value);
                  }} className="px-2 py-0.5 bg-cyan-600 rounded text-[10px] text-white mt-1">Save</button>
                </div>
              ) : (
                <p className="text-[9px] text-gray-500 truncate">{p.prompt_text.slice(0, 100)}...</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Run Button */}
      <button onClick={runStyleLock} disabled={running || !targetDescription}
        className="w-full py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded text-white text-xs font-bold disabled:opacity-50">
        {running ? `Running... ${status}` : 'Run StyleLock'}
      </button>

      {/* Status & Cost */}
      {(running || result) && (
        <div className="flex items-center justify-between text-[10px]">
          <span className={`font-bold ${status === 'complete' ? 'text-green-400' : status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
            {status.toUpperCase()}
          </span>
          <span className="text-green-400">${totalCost.toFixed(2)}</span>
        </div>
      )}

      {/* Visual Round Logs - THE KEY FEATURE */}
      {rounds.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-auto">
          {rounds.map(round => (
            <div key={round.roundNum} className="p-2 bg-slate-800/50 rounded border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-white">Round {round.roundNum}</span>
                <span className="text-[10px] text-purple-400">Best: {round.bestScore}%</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {round.images.map((img, idx) => (
                  <div key={idx} className={`relative ${img.isWinner ? 'ring-2 ring-green-500' : ''}`}>
                    <img src={img.localData || img.url} alt={`Gen ${img.generatorIndex + 1}`}
                      className="w-full aspect-square object-cover rounded" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-white">G{img.generatorIndex + 1}</span>
                        <span className={`text-[9px] font-bold ${img.avgScore >= 85 ? 'text-green-400' : img.avgScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {img.avgScore.toFixed(0)}%
                        </span>
                      </div>
                      {img.votes.length > 0 && (
                        <div className="text-[8px] text-gray-400 truncate">
                          {img.votes.map((v, vi) => `V${vi + 1}:${v.score}`).join(' ')}
                        </div>
                      )}
                    </div>
                    {img.isWinner && (
                      <div className="absolute top-1 right-1 bg-green-500 text-[8px] text-white px-1 rounded">WIN</div>
                    )}
                  </div>
                ))}
              </div>
              {/* Voter feedback for winner */}
              {round.images.filter(i => i.isWinner).map(winner => (
                winner.votes.length > 0 && (
                  <div key="feedback" className="mt-2 text-[9px] text-gray-400">
                    {winner.votes.map((v, vi) => (
                      <p key={vi}><span className="text-purple-400">V{vi + 1}:</span> {v.feedback || 'No feedback'}</p>
                    ))}
                  </div>
                )
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Final Result */}
      {result && (
        <div className="p-2 bg-slate-800/50 rounded border border-green-500/50">
          <div className="flex items-center gap-2">
            {result.imageUrl && (
              <img src={result.imageUrl} alt="Final" className="w-20 h-20 rounded object-cover" />
            )}
            <div className="text-[10px]">
              <p><span className="text-gray-500">Tier:</span> <span className={`font-bold ${result.tier === 'PERFECT' ? 'text-green-400' : result.tier === 'GOOD_ENOUGH' ? 'text-yellow-400' : 'text-red-400'}`}>{result.tier}</span></p>
              <p><span className="text-gray-500">Score:</span> {result.score}%</p>
              <p><span className="text-gray-500">Cost:</span> ${result.totalCost?.toFixed(2)}</p>
              <p><span className="text-gray-500">Rounds:</span> {result.rounds}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StyleLockPanel;
