'use client';

import { useEffect, useState, useCallback, ReactNode } from 'react';
import { PerformanceWithDetails } from '@/lib/types';
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

const formatAxis = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return v.toLocaleString();
};


function renderMarkdown(md: string): ReactNode[] {
  return md.split('\n').map((line, i) => {
    if (line.startsWith('### '))
      return <h3 key={i} className="text-base font-semibold text-[var(--foreground)] mt-4 mb-2">{line.slice(4)}</h3>;
    if (line.startsWith('## '))
      return <h2 key={i} className="text-lg font-bold text-[var(--foreground)] mt-5 mb-2">{line.slice(3)}</h2>;
    if (line.startsWith('# '))
      return <h2 key={i} className="text-xl font-bold text-[var(--foreground)] mt-5 mb-2">{line.slice(2)}</h2>;
    if (line.startsWith('- **')) {
      const match = line.match(/^- \*\*(.+?)\*\*:?\s*(.*)/);
      if (match)
        return (
          <li key={i} className="ml-4 mb-1 text-[var(--foreground)]">
            <strong>{match[1]}</strong>{match[2] ? `: ${match[2]}` : ''}
          </li>
        );
    }
    if (line.startsWith('- '))
      return <li key={i} className="ml-4 mb-1 text-[var(--foreground)]">{line.slice(2)}</li>;
    if (line.trim() === '') return <br key={i} />;
    // Handle bold text within paragraphs
    const boldRegex = /\*\*(.+?)\*\*/g;
    const parts = line.split(boldRegex);
    if (parts.length > 1) {
      return (
        <p key={i} className="mb-1 text-[var(--foreground)]">
          {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
        </p>
      );
    }
    return <p key={i} className="mb-1 text-[var(--foreground)]">{line}</p>;
  });
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [sortField, setSortField] = useState<string>('avgViews');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/performance');
      const json = await res.json();
      setData(json.performance || []);
    } catch (err) {
      console.error('Failed to fetch performance data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const generateInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch('/api/performance/insights', { method: 'POST' });
      const json = await res.json();
      setInsights(json.insights || null);
    } catch (err) {
      console.error('Failed to generate insights:', err);
    } finally {
      setInsightsLoading(false);
    }
  };

  // === Summary stats ===
  const totalViews = data.reduce((sum, p) => sum + (p.views || 0), 0);
  const avgViews = data.length > 0 ? Math.round(totalViews / data.length) : 0;
  const totalLikes = data.reduce((sum, p) => sum + (p.likes || 0), 0);
  const avgLikes = data.length > 0 ? Math.round(totalLikes / data.length) : 0;
  const totalShares = data.reduce((sum, p) => sum + (p.shares || 0), 0);
  const avgShares = data.length > 0 ? Math.round(totalShares / data.length) : 0;
  const hookRateEntries = data.filter((p) => p.hook_rate != null);
  const avgHookRate = hookRateEntries.length > 0
    ? (hookRateEntries.reduce((sum, p) => sum + (p.hook_rate || 0), 0) / hookRateEntries.length).toFixed(1)
    : '—';

  // Category aggregation
  const categoryStats: Record<string, { views: number; likes: number; shares: number; saves: number; comments: number; hookRates: number[]; count: number }> = {};
  data.forEach((p) => {
    const cat = p.topics?.category || 'Unknown';
    if (!categoryStats[cat]) categoryStats[cat] = { views: 0, likes: 0, shares: 0, saves: 0, comments: 0, hookRates: [], count: 0 };
    categoryStats[cat].views += p.views || 0;
    categoryStats[cat].likes += p.likes || 0;
    categoryStats[cat].shares += p.shares || 0;
    categoryStats[cat].saves += p.saves || 0;
    categoryStats[cat].comments += p.comments || 0;
    if (p.hook_rate != null) categoryStats[cat].hookRates.push(p.hook_rate);
    categoryStats[cat].count += 1;
  });

  const categorySummary = Object.entries(categoryStats)
    .map(([name, s]) => ({
      name,
      reels: s.count,
      avgViews: Math.round(s.views / s.count),
      avgLikes: Math.round(s.likes / s.count),
      avgShares: Math.round(s.shares / s.count),
      avgSaves: Math.round(s.saves / s.count),
      avgComments: Math.round(s.comments / s.count),
      avgHookRate: s.hookRates.length > 0 ? (s.hookRates.reduce((a, b) => a + b, 0) / s.hookRates.length).toFixed(1) : '—',
    }))
    .sort((a, b) => {
      const key = sortField as keyof typeof a;
      const aVal = key === 'avgHookRate' ? (a[key] === '—' ? -1 : parseFloat(a[key] as string)) : (a[key] as number);
      const bVal = key === 'avgHookRate' ? (b[key] === '—' ? -1 : parseFloat(b[key] as string)) : (b[key] as number);
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Daily views bar chart data
  const dailyViews: Record<string, { total: number; count: number }> = {};
  data
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
    .forEach((p) => {
      const date = new Date(p.logged_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      if (!dailyViews[date]) dailyViews[date] = { total: 0, count: 0 };
      dailyViews[date].total += p.views || 0;
      dailyViews[date].count += 1;
    });

  const dailyBarData = Object.entries(dailyViews).map(([date, d]) => ({
    date,
    views: Math.round(d.total / d.count),
  }));

  return (
    <div>
      {/* AI Insights — at the top */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">AI Insights</h2>
          <button
            onClick={generateInsights}
            disabled={insightsLoading || data.length === 0}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {insightsLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing...
              </span>
            ) : (
              'Generate Insights'
            )}
          </button>
        </div>
        {insights ? (
          <div className="text-sm leading-relaxed">{renderMarkdown(insights)}</div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {data.length === 0
              ? 'Add performance data to enable AI insights.'
              : 'Click "Generate Insights" to get AI-powered analysis of your performance data.'}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted)] mb-1">Avg Views</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">
            {avgViews.toLocaleString()}
          </p>
        </div>
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted)] mb-1">Avg Likes</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">{avgLikes.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted)] mb-1">Avg Shares</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">{avgShares.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted)] mb-1">Avg Hook Rate</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">{avgHookRate}{avgHookRate !== '—' && '%'}</p>
        </div>
      </div>

      {/* Daily Views Line Chart */}
      {dailyBarData.length > 0 && (
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 mb-8">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Daily Views</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyBarData}>
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={formatAxis} />
              <Tooltip formatter={(v) => Number(v).toLocaleString()} />
              <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Views" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category Summary Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-[var(--accent)]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 bg-[var(--card)] rounded-xl border border-[var(--border)]">
          <p className="text-lg text-[var(--muted)]">No performance data yet</p>
          <p className="text-sm text-[var(--muted)] mt-2">
            Mark scripts as &quot;Shot&quot; and log performance to see data here
          </p>
        </div>
      ) : (
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Category Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Category</th>
                  {[
                    { key: 'reels', label: 'Reels' },
                    { key: 'avgViews', label: 'Avg Views' },
                    { key: 'avgLikes', label: 'Avg Likes' },
                    { key: 'avgShares', label: 'Avg Shares' },
                    { key: 'avgSaves', label: 'Avg Saves' },
                    { key: 'avgComments', label: 'Avg Comments' },
                    { key: 'avgHookRate', label: 'Avg Hook %' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="text-right px-4 py-3 font-medium text-[var(--muted)] cursor-pointer hover:text-[var(--foreground)] select-none"
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label} {sortField === col.key ? (sortAsc ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categorySummary.map((cat) => (
                  <tr key={cat.name} className="border-b border-[var(--border)] hover:bg-[var(--background)]">
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-medium">
                        {cat.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--foreground)]">{cat.reels}</td>
                    <td className="px-4 py-3 text-right font-medium text-[var(--foreground)]">{cat.avgViews.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-[var(--foreground)]">{cat.avgLikes.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-[var(--foreground)]">{cat.avgShares.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-[var(--foreground)]">{cat.avgSaves.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-[var(--foreground)]">{cat.avgComments.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-[var(--foreground)]">{cat.avgHookRate}{cat.avgHookRate !== '—' && '%'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
