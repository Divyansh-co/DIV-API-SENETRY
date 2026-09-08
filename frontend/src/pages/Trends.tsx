import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { getTestHistory } from '../services/api';
import { TestRun } from '../types';

interface TrendsProps {
  onSelectRun: (run: TestRun) => void;
}

export const Trends: React.FC<TrendsProps> = ({ onSelectRun }) => {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const historyData = await getTestHistory(30);
        setRuns(historyData);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Prepare chart points (chronological order)
  const completedRuns = runs.filter((r) => r.status === 'COMPLETED').reverse();

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div className="border-b border-bronze-hairline pb-6">
        <h1 className="text-2xl font-bold text-bone tracking-tight flex items-center gap-2">
          <span>Historical Compliance &amp; Security Trends</span>
        </h1>
        <p className="text-sm text-warmash mt-1">
          Track contract pass-rates, regression trends, and schema conformance over repeated audit runs.
        </p>
      </div>

      {/* Visual Trends Chart Card */}
      <div className="card rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold text-bone uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-bronze" />
              <span>Pass-Rate &amp; Compliance Score Over Time</span>
            </h3>
            <p className="text-xs text-warmash mt-0.5">
              Evaluated across {completedRuns.length} completed audit runs
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-bronze" />
              <span className="text-bone">Compliance Score (%)</span>
            </div>
          </div>
        </div>

        {completedRuns.length === 0 ? (
          <div className="py-16 text-center text-warmash font-mono text-xs">
            No completed runs recorded yet. Execute audits to populate historical trend graphs.
          </div>
        ) : (
          <div className="space-y-4">
            {/* SVG Trend Graph */}
            <div className="h-56 w-full relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 800 200" preserveAspectRatio="none">
                {/* Horizontal Grid lines (Hairline Bronze) */}
                <line x1="0" y1="20" x2="800" y2="20" stroke="rgba(176, 141, 87, 0.18)" strokeDasharray="4 4" />
                <line x1="0" y1="70" x2="800" y2="70" stroke="rgba(176, 141, 87, 0.18)" strokeDasharray="4 4" />
                <line x1="0" y1="120" x2="800" y2="120" stroke="rgba(176, 141, 87, 0.18)" strokeDasharray="4 4" />
                <line x1="0" y1="170" x2="800" y2="170" stroke="rgba(176, 141, 87, 0.18)" strokeDasharray="4 4" />

                {/* Y-axis labels */}
                <text x="5" y="24" fill="#A8A6A1" fontSize="10" fontFamily="monospace">100%</text>
                <text x="5" y="74" fill="#A8A6A1" fontSize="10" fontFamily="monospace">75%</text>
                <text x="5" y="124" fill="#A8A6A1" fontSize="10" fontFamily="monospace">50%</text>
                <text x="5" y="174" fill="#A8A6A1" fontSize="10" fontFamily="monospace">25%</text>

                {/* Plot Trend Line (Brushed Bronze) */}
                {completedRuns.length > 1 && (
                  <path
                    d={completedRuns
                      .map((r, i) => {
                        const x = 50 + (i / (completedRuns.length - 1)) * 720;
                        const y = 170 - (r.compliance_score / 100) * 150;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#B08D57"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data Points */}
                {completedRuns.map((r, i) => {
                  const x = completedRuns.length === 1 ? 400 : 50 + (i / (completedRuns.length - 1)) * 720;
                  const y = 170 - (r.compliance_score / 100) * 150;
                  const pointColor = r.compliance_score >= 80 ? '#4ADE80' : r.compliance_score >= 50 ? '#FBBF24' : '#F87171';

                  return (
                    <g key={r.id} className="cursor-pointer" onClick={() => onSelectRun(r)}>
                      <circle cx={x} cy={y} r="6" fill="#0E0F12" stroke={pointColor} strokeWidth="2.5" />
                      <text x={x} y={y - 12} fill="#EDEBE6" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                        {r.compliance_score}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] text-warmash font-mono pt-2">
              <span>Oldest Run</span>
              <span>Latest Run</span>
            </div>
          </div>
        )}
      </div>

      {/* Historical Runs Table */}
      <div className="card rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-bronze-hairline bg-obsidian flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-bronze" />
            <h3 className="text-xs font-bold text-bone uppercase tracking-wider">All Historical Audit Runs</h3>
          </div>
          <span className="text-xs font-mono text-warmash">{runs.length} runs recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-bronze-hairline bg-obsidian text-[11px] font-bold text-warmash uppercase tracking-wider font-mono">
                <th className="py-3 px-6">Timestamp</th>
                <th className="py-3 px-6">Target API</th>
                <th className="py-3 px-6">Spec Title</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Compliance Score</th>
                <th className="py-3 px-6">Tests</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bronze-hairline text-xs font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-warmash font-mono">
                    Loading history...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-warmash font-mono">
                    No runs recorded yet.
                  </td>
                </tr>
              ) : (
                runs.map((r) => {
                  const scoreBadge =
                    r.compliance_score >= 80
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : r.compliance_score >= 50
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30';

                  return (
                    <tr
                      key={r.id}
                      onClick={() => onSelectRun(r)}
                      className="hover:bg-obsidian/40 transition cursor-pointer"
                    >
                      <td className="py-3 px-6 text-warmash">
                        {r.started_at ? new Date(r.started_at).toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-6 text-bone font-bold truncate max-w-xs">
                        {r.target_base_url}
                      </td>
                      <td className="py-3 px-6 text-warmash truncate max-w-xs">
                        {r.spec_title || 'OpenAPI Spec'}
                      </td>
                      <td className="py-3 px-6">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-obsidian border border-bronze-hairline text-warmash">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-6">
                        <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[11px] border ${scoreBadge}`}>
                          {r.compliance_score}%
                        </span>
                      </td>
                      <td className="py-3 px-6 text-warmash">
                        {r.total_tests} tests
                      </td>
                      <td className="py-3 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRun(r);
                          }}
                          className="px-3 py-1 rounded-lg btn-secondary text-xs font-semibold flex items-center gap-1 ml-auto"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3 text-bronze" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
