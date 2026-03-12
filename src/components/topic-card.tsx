'use client';

import { Topic } from '@/lib/types';
import { useState } from 'react';

const categoryColors: Record<string, string> = {
  'Tax Saving': 'bg-green-100 text-green-800',
  'Insurance': 'bg-purple-100 text-purple-800',
  'Credit Cards': 'bg-orange-100 text-orange-800',
  'Scam Alert': 'bg-red-100 text-red-800',
  'Institutional Tricks': 'bg-red-100 text-red-800',
  'Market & Portfolio': 'bg-blue-100 text-blue-800',
  'Business Opportunities': 'bg-yellow-100 text-yellow-800',
  'Wealth Growth': 'bg-emerald-100 text-emerald-800',
  'Misc Finance': 'bg-gray-100 text-gray-800',
};

interface TopicCardProps {
  topic: Topic;
  onGenerateScript?: (topicId: string) => Promise<void>;
  onDiscard?: (topicId: string) => Promise<void>;
  onViewScript?: (topicId: string) => void;
  onDelete?: (topicId: string) => Promise<void>;
}

export function TopicCard({ topic, onGenerateScript, onDiscard, onViewScript, onDelete }: TopicCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!onGenerateScript) return;
    setLoading(true);
    try {
      await onGenerateScript(topic.id);
    } finally {
      setLoading(false);
    }
  };

  const colorClass = categoryColors[topic.category] || 'bg-gray-100 text-gray-800';

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-lg font-semibold text-[var(--foreground)] leading-tight">
          {topic.title}
        </h3>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}>
          {topic.category}
        </span>
      </div>

      <div className="mb-3">
        <p className="text-sm font-medium text-[var(--accent)] mb-1">Hook:</p>
        <p className="text-sm text-[var(--foreground)] italic">&ldquo;{topic.hook_line}&rdquo;</p>
      </div>

      <div className="mb-3">
        <p className="text-sm font-medium text-[var(--muted)] mb-1">Core Insight:</p>
        <p className="text-sm text-[var(--foreground)]">{topic.core_insight}</p>
      </div>

      <div className="mb-3">
        <p className="text-sm font-medium text-[var(--muted)] mb-1">Talking Points:</p>
        <ul className="list-disc list-inside text-sm text-[var(--foreground)] space-y-1">
          {topic.talking_points.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>

      <div className="mb-4">
        <p className="text-sm text-[var(--muted)]">
          <span className="font-medium">CTA:</span> {topic.cta}
        </p>
      </div>

      {topic.source_url && (
        <div className="mb-4">
          <a
            href={topic.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Source &rarr;
          </a>
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-[var(--border)]">
        {topic.status === 'pending' && (
          <>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Script'
              )}
            </button>
            <button
              onClick={() => onDiscard?.(topic.id)}
              className="px-4 py-2 border border-[var(--border)] text-[var(--muted)] text-sm font-medium rounded-lg hover:bg-[var(--background)] transition-colors"
            >
              Discard
            </button>
          </>
        )}
        {topic.status === 'script_requested' && (
          <div className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-[var(--muted)]">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating script...
          </div>
        )}
        {(topic.status === 'script_ready' || topic.status === 'approved') && (
          <button
            onClick={() => onViewScript?.(topic.id)}
            className="flex-1 px-4 py-2 bg-[var(--success)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            View Script &rarr;
          </button>
        )}
        {topic.status === 'shot' && (
          <span className="flex-1 text-center py-2 text-sm text-[var(--success)] font-medium">
            Shot
          </span>
        )}
        {topic.status === 'discarded' && (
          <span className="flex-1 text-center py-2 text-sm text-[var(--muted)] font-medium">
            Discarded
          </span>
        )}

        {/* Delete button */}
        {onDelete && (
          confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { onDelete(topic.id); setConfirmDelete(false); }}
                className="px-3 py-2 bg-[var(--danger)] text-white text-xs font-medium rounded-lg hover:opacity-90"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 border border-[var(--border)] text-[var(--muted)] text-xs rounded-lg hover:bg-[var(--background)]"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-2 text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
              title="Delete idea"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )
        )}
      </div>
    </div>
  );
}
