'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { TopicCard } from '@/components/topic-card';
import { Topic, TopicBatch } from '@/lib/types';

interface BatchWithTopics extends TopicBatch {
  topics: Topic[];
}

export default function DailyIdeasPage() {
  const [batch, setBatch] = useState<BatchWithTopics | null>(null);
  const [manualTopics, setManualTopics] = useState<Topic[]>([]);
  const [pastBatches, setPastBatches] = useState<BatchWithTopics[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'today' | 'past'>('today');

  // Research box state
  const [research, setResearch] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [ideaFilter, setIdeaFilter] = useState('all');
  const [pastFilter, setPastFilter] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasInput = research.trim().length > 0 || file !== null;
  const isBusy = generatingScript || generatingIdeas;

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/topics/today');
      const data = await res.json();
      setBatch(data.batch);
      setManualTopics(data.manualTopics || []);
      setDate(data.date);
    } catch (err) {
      console.error('Failed to fetch today\'s topics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPastBatches = useCallback(async () => {
    try {
      const url = selectedDate
        ? `/api/topics/batches?date=${selectedDate}`
        : '/api/topics/batches';
      const res = await fetch(url);
      const data = await res.json();
      setPastBatches(data.batches || []);
    } catch (err) {
      console.error('Failed to fetch past batches:', err);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  useEffect(() => {
    if (tab === 'past') {
      fetchPastBatches();
    }
  }, [tab, fetchPastBatches]);

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('research', research.trim());
    if (file) formData.append('file', file);
    if (startPage) formData.append('startPage', startPage);
    if (endPage) formData.append('endPage', endPage);
    return formData;
  };

  const clearInputs = () => {
    setResearch('');
    setFile(null);
    setStartPage('');
    setEndPage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerateIdeas = async () => {
    if (!hasInput || isBusy) return;

    setGeneratingIdeas(true);
    setGenError(null);

    try {
      const res = await fetch('/api/topics/custom/ideas', {
        method: 'POST',
        body: buildFormData(),
      });

      const data = await res.json();

      if (!res.ok) {
        setGenError(data.error || 'Something went wrong');
        return;
      }

      setManualTopics((prev) => [...prev, ...(data.topics || [])]);
      clearInputs();
    } catch {
      setGenError('Failed to connect to the server');
    } finally {
      setGeneratingIdeas(false);
    }
  };

  const handleGenerateFromResearch = async () => {
    if (!hasInput || isBusy) return;

    setGeneratingScript(true);
    setGenError(null);

    try {
      const res = await fetch('/api/topics/custom', {
        method: 'POST',
        body: buildFormData(),
      });

      const data = await res.json();

      if (!res.ok) {
        setGenError(data.error || 'Something went wrong');
        return;
      }

      clearInputs();
      window.location.href = `/scripts?topic=${data.topic.id}`;
    } catch {
      setGenError('Failed to connect to the server');
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleGenerateScript = async (topicId: string) => {
    const updateTopics = (topics: Topic[]) =>
      topics.map((t) =>
        t.id === topicId ? { ...t, status: 'script_requested' as const } : t
      );

    if (batch) {
      setBatch({ ...batch, topics: updateTopics(batch.topics) });
    }
    setManualTopics((prev) => updateTopics(prev));

    try {
      const res = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId }),
      });

      if (res.ok) {
        const markReady = (topics: Topic[]) =>
          topics.map((t) =>
            t.id === topicId ? { ...t, status: 'script_ready' as const } : t
          );

        setBatch((prev) => (prev ? { ...prev, topics: markReady(prev.topics) } : null));
        setManualTopics((prev) => markReady(prev));
      }
    } catch (err) {
      console.error('Failed to generate script:', err);
      fetchToday();
    }
  };

  const handleDiscard = async (topicId: string) => {
    const discard = (topics: Topic[]) =>
      topics.map((t) =>
        t.id === topicId ? { ...t, status: 'discarded' as const } : t
      );

    if (batch) {
      setBatch({ ...batch, topics: discard(batch.topics) });
    }
    setManualTopics((prev) => discard(prev));
  };

  const handleViewScript = (topicId: string) => {
    window.location.href = `/scripts?topic=${topicId}`;
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      const res = await fetch(`/api/topics/${topicId}`, { method: 'DELETE' });
      if (res.ok) {
        if (batch) {
          setBatch({ ...batch, topics: batch.topics.filter((t) => t.id !== topicId) });
        }
        setManualTopics((prev) => prev.filter((t) => t.id !== topicId));
        setPastBatches((prev) =>
          prev.map((b) => ({ ...b, topics: b.topics.filter((t) => t.id !== topicId) }))
        );
      }
    } catch (err) {
      console.error('Failed to delete topic:', err);
    }
  };

  const topics = batch?.topics?.sort((a, b) => a.position - b.position) || [];

  const spinner = (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  return (
    <div>
      <div className="flex items-center mb-8">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'today'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTab('past')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'past'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--background)]'
            }`}
          >
            Past Ideas
          </button>
        </div>
      </div>

      {tab === 'today' && (
        <>
          {/* Drop your research box */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 mb-8">
            <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">
              Drop your research
            </h2>
            <textarea
              value={research}
              onChange={(e) => setResearch(e.target.value)}
              placeholder="Paste your notes, articles, ideas, or raw research here... Or attach a PDF below."
              rows={4}
              className="w-full px-4 py-3 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent resize-none"
            />

            {/* File upload */}
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[var(--border)] rounded-lg text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,text/plain,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const selected = e.target.files?.[0] || null;
                      setFile(selected);
                      setStartPage('');
                      setEndPage('');
                    }}
                  />
                  {file ? file.name : 'Attach PDF or text file'}
                </label>
                {file && (
                  <button
                    onClick={() => {
                      setFile(null);
                      setStartPage('');
                      setEndPage('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-sm text-[var(--danger)] hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Page range for PDFs */}
              {file && (file.type === 'application/pdf' || file.name.endsWith('.pdf')) && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-[var(--muted)]">Page range (optional):</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="From"
                    value={startPage}
                    onChange={(e) => setStartPage(e.target.value)}
                    className="w-20 px-2 py-1 border border-[var(--border)] rounded text-xs"
                  />
                  <span className="text-xs text-[var(--muted)]">to</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="To"
                    value={endPage}
                    onChange={(e) => setEndPage(e.target.value)}
                    className="w-20 px-2 py-1 border border-[var(--border)] rounded text-xs"
                  />
                </div>
              )}
            </div>

            {genError && (
              <p className="text-sm text-[var(--danger)] mt-2">{genError}</p>
            )}

            {/* Two action buttons */}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={handleGenerateIdeas}
                disabled={isBusy || !hasInput}
                className="px-6 py-2.5 border border-[var(--accent)] text-[var(--accent)] text-sm font-medium rounded-lg hover:bg-[var(--accent-light)] disabled:opacity-50 transition-colors"
              >
                {generatingIdeas ? (
                  <span className="flex items-center gap-2">
                    {spinner}
                    Generating Ideas...
                  </span>
                ) : (
                  'Generate Ideas'
                )}
              </button>
              <button
                onClick={handleGenerateFromResearch}
                disabled={isBusy || !hasInput}
                className="px-6 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {generatingScript ? (
                  <span className="flex items-center gap-2">
                    {spinner}
                    Generating Script...
                  </span>
                ) : (
                  'Generate Script'
                )}
              </button>
            </div>
          </div>

          {/* Ideas grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="animate-spin h-8 w-8 text-[var(--accent)]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : topics.length === 0 && manualTopics.length === 0 ? (
            <div className="text-center py-16 bg-[var(--card)] rounded-xl border border-[var(--border)]">
              <p className="text-lg text-[var(--muted)]">
                Today&apos;s AI ideas will be ready at 9 AM IST
              </p>
              <p className="text-sm text-[var(--muted)] mt-2">
                Or drop your own research above to generate ideas or a script
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {topics.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">
                      AI-Generated Ideas
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">
                      {topics.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {topics.map((topic) => (
                      <TopicCard
                        key={topic.id}
                        topic={topic}
                        onGenerateScript={handleGenerateScript}
                        onDiscard={handleDiscard}
                        onViewScript={handleViewScript}
                        onDelete={handleDeleteTopic}
                      />
                    ))}
                  </div>
                </div>
              )}

              {manualTopics.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">
                      Your Ideas
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--success-light)] text-[var(--success)]">
                      {manualTopics.length}
                    </span>
                    <select
                      value={ideaFilter}
                      onChange={(e) => setIdeaFilter(e.target.value)}
                      className="text-xs px-2 py-1 border border-[var(--border)] rounded-lg bg-[var(--card)] text-[var(--foreground)]"
                    >
                      <option value="all">All Categories</option>
                      <option value="Tax Saving">Tax Saving</option>
                      <option value="Insurance">Insurance</option>
                      <option value="Credit Cards">Credit Cards</option>
                      <option value="Scam Alert">Scam Alert</option>
                      <option value="Institutional Tricks">Institutional Tricks</option>
                      <option value="Market & Portfolio">Market & Portfolio</option>
                      <option value="Business Opportunities">Business Opportunities</option>
                      <option value="Wealth Growth">Wealth Growth</option>
                      <option value="Misc Finance">Misc Finance</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {manualTopics
                      .filter((t) => ideaFilter === 'all' || t.category === ideaFilter)
                      .sort((a, b) => a.position - b.position)
                      .map((topic) => (
                        <TopicCard
                          key={topic.id}
                          topic={topic}
                          onGenerateScript={handleGenerateScript}
                          onDiscard={handleDiscard}
                          onViewScript={handleViewScript}
                          onDelete={handleDeleteTopic}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'past' && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--card)] text-[var(--foreground)]"
            />
            <select
              value={pastFilter}
              onChange={(e) => setPastFilter(e.target.value)}
              className="text-xs px-2 py-1 border border-[var(--border)] rounded-lg bg-[var(--card)] text-[var(--foreground)]"
            >
              <option value="all">All Categories</option>
              <option value="Tax Saving">Tax Saving</option>
              <option value="Insurance">Insurance</option>
              <option value="Credit Cards">Credit Cards</option>
              <option value="Scam Alert">Scam Alert</option>
              <option value="Institutional Tricks">Institutional Tricks</option>
              <option value="Market & Portfolio">Market & Portfolio</option>
              <option value="Business Opportunities">Business Opportunities</option>
              <option value="Wealth Growth">Wealth Growth</option>
              <option value="Misc Finance">Misc Finance</option>
            </select>
            {(selectedDate || pastFilter !== 'all') && (
              <button
                onClick={() => { setSelectedDate(''); setPastFilter('all'); }}
                className="text-sm text-[var(--accent)] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {pastBatches.length === 0 ? (
            <div className="text-center py-20 bg-[var(--card)] rounded-xl border border-[var(--border)]">
              <p className="text-lg text-[var(--muted)]">No past ideas found</p>
            </div>
          ) : (
            <div className="space-y-8">
              {pastBatches.map((b) => (
                <div key={b.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-lg font-semibold">{b.generated_date}</h2>
                    <span className="text-xs px-2 py-1 rounded-full bg-[var(--background)] text-[var(--muted)]">
                      {b.source_type === 'manual' ? 'Your Ideas' : 'Daily'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(b.topics || [])
                      .filter((t: Topic) => pastFilter === 'all' || t.category === pastFilter)
                      .sort((a: Topic, b: Topic) => a.position - b.position)
                      .map((topic: Topic) => (
                        <TopicCard
                          key={topic.id}
                          topic={topic}
                          onGenerateScript={handleGenerateScript}
                          onDiscard={handleDiscard}
                          onViewScript={handleViewScript}
                          onDelete={handleDeleteTopic}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
