'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ScriptWithTopic, Performance } from '@/lib/types';
import { Pencil } from 'lucide-react';

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<ScriptWithTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending_review' | 'approved' | 'shot'>('pending_review');
  const [expandedScript, setExpandedScript] = useState<string | null>(null);

  // Performance state
  const [performanceMap, setPerformanceMap] = useState<Record<string, Performance>>({});
  const [performanceForm, setPerformanceForm] = useState<string | null>(null);
  const [perfData, setPerfData] = useState({
    views: '',
    likes: '',
    shares: '',
    saves: '',
    comments: '',
    hookRate: '',
    notes: '',
  });

  // Editing state
  const [editingScript, setEditingScript] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Revision state
  const [revisionTarget, setRevisionTarget] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [revising, setRevising] = useState(false);

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch('/api/scripts');
      const data = await res.json();
      setScripts(data.scripts || []);
    } catch (err) {
      console.error('Failed to fetch scripts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPerformance = useCallback(async () => {
    try {
      const res = await fetch('/api/performance');
      const data = await res.json();
      const map: Record<string, Performance> = {};
      (data.performance || []).forEach((p: Performance) => {
        if (p.script_id) map[p.script_id] = p;
      });
      setPerformanceMap(map);
    } catch (err) {
      console.error('Failed to fetch performance:', err);
    }
  }, []);

  useEffect(() => {
    fetchScripts();
    fetchPerformance();
  }, [fetchScripts, fetchPerformance]);

  const updateScriptStatus = async (scriptId: string, status: string) => {
    try {
      const res = await fetch(`/api/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setScripts((prev) =>
          prev.map((s) =>
            s.id === scriptId ? { ...s, status: status as ScriptWithTopic['status'] } : s
          )
        );

        if (status === 'shot') {
          openPerformanceForm(scriptId);
        }
      }
    } catch (err) {
      console.error('Failed to update script:', err);
    }
  };

  const handleRequestRevision = async (scriptId: string) => {
    if (!revisionFeedback.trim() || revising) return;

    setRevising(true);
    try {
      const res = await fetch('/api/scripts/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId, feedback: revisionFeedback.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setScripts((prev) =>
          prev.map((s) => (s.id === scriptId ? data.script : s))
        );
        setRevisionTarget(null);
        setRevisionFeedback('');
      }
    } catch (err) {
      console.error('Failed to revise script:', err);
    } finally {
      setRevising(false);
    }
  };

  const [confirmDeleteScript, setConfirmDeleteScript] = useState<string | null>(null);

  const handleDeleteScript = async (scriptId: string) => {
    try {
      const res = await fetch(`/api/scripts/${scriptId}`, { method: 'DELETE' });
      if (res.ok) {
        setScripts((prev) => prev.filter((s) => s.id !== scriptId));
        setConfirmDeleteScript(null);
      }
    } catch (err) {
      console.error('Failed to delete script:', err);
    }
  };

  const handleEditSave = async (scriptId: string) => {
    try {
      const res = await fetch(`/api/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });

      if (res.ok) {
        setScripts((prev) =>
          prev.map((s) =>
            s.id === scriptId ? { ...s, content: editContent } : s
          )
        );
        setEditingScript(null);
      }
    } catch (err) {
      console.error('Failed to save script edit:', err);
    }
  };

  const openPerformanceForm = (scriptId: string) => {
    const existing = performanceMap[scriptId];
    if (existing) {
      setPerfData({
        views: existing.views?.toString() || '',
        likes: existing.likes?.toString() || '',
        shares: existing.shares?.toString() || '',
        saves: existing.saves?.toString() || '',
        comments: existing.comments?.toString() || '',
        hookRate: existing.hook_rate?.toString() || '',
        notes: existing.notes || '',
      });
    } else {
      setPerfData({ views: '', likes: '', shares: '', saves: '', comments: '', hookRate: '', notes: '' });
    }
    setPerformanceForm(scriptId);
    setTimeout(() => {
      perfFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const perfFormRef = useRef<HTMLDivElement>(null);

  const submitPerformance = async (scriptId: string) => {
    const script = scripts.find((s) => s.id === scriptId);
    if (!script) return;

    const existingPerf = performanceMap[scriptId];
    const method = existingPerf ? 'PATCH' : 'POST';
    const url = existingPerf ? `/api/performance/${existingPerf.id}` : '/api/performance';

    const body: Record<string, unknown> = {
      views: perfData.views ? parseInt(perfData.views) : null,
      likes: perfData.likes ? parseInt(perfData.likes) : null,
      shares: perfData.shares ? parseInt(perfData.shares) : null,
      saves: perfData.saves ? parseInt(perfData.saves) : null,
      comments: perfData.comments ? parseInt(perfData.comments) : null,
      hook_rate: perfData.hookRate ? parseFloat(perfData.hookRate) : null,
      notes: perfData.notes || null,
    };

    if (!existingPerf) {
      body.topicId = script.topic_id;
      body.scriptId = script.id;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchPerformance();
        setPerformanceForm(null);
        setPerfData({ views: '', likes: '', shares: '', saves: '', comments: '', hookRate: '', notes: '' });
      }
    } catch (err) {
      console.error('Failed to log performance:', err);
    }
  };

  const filtered = scripts.filter((s) => s.status === activeTab);

  const tabs = [
    { key: 'pending_review' as const, label: 'Pending Review', count: scripts.filter((s) => s.status === 'pending_review').length },
    { key: 'approved' as const, label: 'Approved', count: scripts.filter((s) => s.status === 'approved').length },
    { key: 'shot' as const, label: 'Shot', count: scripts.filter((s) => s.status === 'shot').length },
  ];

  const perfFields = ['views', 'likes', 'shares', 'saves', 'comments', 'hookRate'] as const;

  return (
    <div>

      <div className="flex gap-2 mb-8">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === t.key ? 'bg-white/20' : 'bg-[var(--background)]'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-[var(--accent)]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[var(--card)] rounded-xl border border-[var(--border)]">
          <p className="text-lg text-[var(--muted)]">
            No {activeTab.replace('_', ' ')} scripts
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((script) => {
            const topic = script.topics;
            const isExpanded = expandedScript === script.id;
            const isRevising = revisionTarget === script.id;
            const isEditing = editingScript === script.id;
            const hasPerf = !!performanceMap[script.id];

            return (
              <div
                key={script.id}
                className={`bg-[var(--card)] rounded-xl border overflow-hidden ${
                  script.status === 'shot'
                    ? hasPerf
                      ? 'border-l-4 border-l-[var(--success)] border-[var(--border)]'
                      : 'border-l-4 border-l-[var(--danger)] border-[var(--border)]'
                    : 'border-[var(--border)]'
                }`}
              >
                <div
                  className="p-6 cursor-pointer hover:bg-[var(--background)] transition-colors"
                  onClick={() => setExpandedScript(isExpanded ? null : script.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">{topic?.title || 'Untitled'}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        {topic?.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">
                            {topic.category}
                          </span>
                        )}
                        <span className="text-xs text-[var(--muted)]">
                          {new Date(script.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {hasPerf && (() => {
                        const p = performanceMap[script.id];
                        return (
                          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--muted)]">
                            {p.views != null && <span><strong className="text-[var(--foreground)]">{p.views.toLocaleString()}</strong> views</span>}
                            {p.likes != null && <span><strong className="text-[var(--foreground)]">{p.likes.toLocaleString()}</strong> likes</span>}
                            {p.shares != null && <span><strong className="text-[var(--foreground)]">{p.shares.toLocaleString()}</strong> shares</span>}
                            {p.saves != null && <span><strong className="text-[var(--foreground)]">{p.saves.toLocaleString()}</strong> saves</span>}
                            {p.hook_rate != null && <span><strong className="text-[var(--foreground)]">{p.hook_rate}%</strong> hook</span>}
                          </div>
                        );
                      })()}
                    </div>
                    <span className="text-[var(--muted)] text-lg">
                      {isExpanded ? '−' : '+'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[var(--border)]">
                    <div className="p-6 bg-[var(--background)]">
                      {isEditing ? (
                        <div>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-4 py-3 border border-[var(--border)] rounded-lg text-sm font-mono leading-relaxed resize-none bg-[var(--card)]"
                            rows={20}
                            autoFocus
                          />
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleEditSave(script.id)}
                              className="px-4 py-2 bg-[var(--success)] text-white text-sm font-medium rounded-lg hover:opacity-90"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={() => setEditingScript(null)}
                              className="px-4 py-2 border border-[var(--border)] text-[var(--muted)] text-sm rounded-lg hover:bg-[var(--card)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative group">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditContent(script.content);
                              setEditingScript(script.id);
                            }}
                            className="absolute top-2 right-2 p-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit script"
                          >
                            <Pencil size={14} />
                          </button>
                          <div className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed text-[var(--foreground)]">
                            {script.content}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex gap-2 border-t border-[var(--border)]">
                      {script.status === 'approved' && (
                        <button
                          onClick={() => updateScriptStatus(script.id, 'shot')}
                          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90"
                        >
                          Mark as Shot
                        </button>
                      )}
                      {script.status === 'shot' && performanceForm !== script.id && (
                        <button
                          onClick={() => openPerformanceForm(script.id)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg hover:opacity-90 ${
                            hasPerf
                              ? 'bg-[var(--warning)] text-white'
                              : 'bg-[var(--success)] text-white'
                          }`}
                        >
                          {hasPerf ? 'Update Performance' : 'Add Performance'}
                        </button>
                      )}
                      {script.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => updateScriptStatus(script.id, 'approved')}
                            className="px-4 py-2 bg-[var(--success)] text-white text-sm font-medium rounded-lg hover:opacity-90"
                          >
                            Approve for Shooting
                          </button>
                          <button
                            onClick={() => {
                              setRevisionTarget(isRevising ? null : script.id);
                              setRevisionFeedback('');
                            }}
                            className={`px-4 py-2 border text-sm font-medium rounded-lg transition-colors ${
                              isRevising
                                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-light)]'
                                : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]'
                            }`}
                          >
                            Request Revision
                          </button>
                        </>
                      )}

                      {/* Delete script button */}
                      <div className="ml-auto">
                        {confirmDeleteScript === script.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteScript(script.id)}
                              className="px-3 py-2 bg-[var(--danger)] text-white text-xs font-medium rounded-lg hover:opacity-90"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmDeleteScript(null)}
                              className="px-3 py-2 border border-[var(--border)] text-[var(--muted)] text-xs rounded-lg hover:bg-[var(--background)]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteScript(script.id)}
                            className="px-3 py-2 text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                            title="Delete script"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Revision feedback box */}
                    {isRevising && (
                      <div className="p-4 bg-[var(--accent-light)] border-t border-[var(--border)]">
                        <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                          What changes do you want?
                        </label>
                        <textarea
                          value={revisionFeedback}
                          onChange={(e) => setRevisionFeedback(e.target.value)}
                          placeholder="e.g. Make the hook more aggressive, add a real number example, shorten the closing..."
                          rows={3}
                          className="w-full px-4 py-3 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none bg-[var(--card)]"
                          autoFocus
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleRequestRevision(script.id)}
                            disabled={revising || !revisionFeedback.trim()}
                            className="px-5 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {revising ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Regenerating...
                              </span>
                            ) : (
                              'Generate script again'
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setRevisionTarget(null);
                              setRevisionFeedback('');
                            }}
                            className="px-4 py-2 border border-[var(--border)] text-[var(--muted)] text-sm rounded-lg hover:bg-[var(--background)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Performance form */}
                    {performanceForm === script.id && (
                      <div ref={perfFormRef} className="p-4 bg-[var(--success-light)] border-t border-[var(--border)]">
                        <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                          {hasPerf ? 'Update Performance' : 'Log Performance'}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-3">
                          {perfFields.map((field) => (
                            <div key={field}>
                              <label className="text-xs text-[var(--muted)] capitalize">
                                {field === 'hookRate' ? 'Hook Rate %' : field}
                              </label>
                              <input
                                type="number"
                                step={field === 'hookRate' ? '0.1' : '1'}
                                value={perfData[field]}
                                onChange={(e) => setPerfData({ ...perfData, [field]: e.target.value })}
                                className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--card)]"
                                placeholder={field === 'hookRate' ? '0.0' : '0'}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="mb-3">
                          <label className="text-xs text-[var(--muted)]">Notes</label>
                          <textarea
                            value={perfData.notes}
                            onChange={(e) => setPerfData({ ...perfData, notes: e.target.value })}
                            className="w-full mt-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--card)]"
                            rows={2}
                            placeholder="Any notes about this reel..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitPerformance(script.id)}
                            className="px-4 py-2 bg-[var(--success)] text-white text-sm font-medium rounded-lg hover:opacity-90"
                          >
                            {hasPerf ? 'Update' : 'Save'} Performance
                          </button>
                          <button
                            onClick={() => {
                              setPerformanceForm(null);
                              setPerfData({ views: '', likes: '', shares: '', saves: '', comments: '', hookRate: '', notes: '' });
                            }}
                            className="px-4 py-2 border border-[var(--border)] text-[var(--muted)] text-sm rounded-lg hover:bg-[var(--background)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
