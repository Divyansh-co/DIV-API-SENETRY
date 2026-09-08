import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Terminal
} from 'lucide-react';
import { getTestRun, getTestResults } from '../services/api';
import { TestRun, TestResult } from '../types';

interface LiveProgressProps {
  runId: string | null;
  onNavigate: (tab: 'results' | 'map' | 'export') => void;
}

export const LiveProgress: React.FC<LiveProgressProps> = ({ runId, onNavigate }) => {
  const [run, setRun] = useState<TestRun | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) return;

    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const runData = await getTestRun(runId);
        if (isMounted) setRun(runData);

        const resultsData = await getTestResults(runId, { limit: 100 });
        if (isMounted) setResults(resultsData);
      } catch (err) {
        console.error('Error polling test run:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStatus();

    // Poll every 1.5s while running
    const interval = setInterval(() => {
      fetchStatus();
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [runId]);

  if (!runId) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-2xl card mx-auto flex items-center justify-center text-warmash mb-4 shadow-sm">
          <Activity className="w-8 h-8 text-bronze" />
        </div>
        <h2 className="text-xl font-bold text-bone mb-2">No Active Test Run Selected</h2>
        <p className="text-sm text-warmash mb-6">
          Launch a new test run or select a historical run to view live execution logs and progress.
        </p>
      </div>
    );
  }

  const completedCount = (run?.passed_tests || 0) + (run?.failed_tests || 0) + (run?.warning_tests || 0);
  const totalCount = run?.total_tests || 1;
  const progressPercent = Math.min(Math.round((completedCount / totalCount) * 100), 100);
  const isRunning = run?.status === 'RUNNING';

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Top Status Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 card rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-bone">
              {run?.spec_title || 'API Audit Run'}
            </h1>
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isRunning
                  ? 'bg-bronze/20 text-bronze-highlight border border-bronze/40 animate-pulse'
                  : run?.status === 'COMPLETED'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              }`}
            >
              {isRunning && <RefreshCw className="w-3 h-3 animate-spin text-bronze" />}
              <span>{run?.status}</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-warmash font-mono mt-2">
            <span>Target: <strong className="text-bone">{run?.target_base_url}</strong></span>
            <span>&bull;</span>
            <span>Run ID: <span className="text-bronze font-semibold">{run?.id}</span></span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('results')}
            className="px-4 py-2 rounded-xl btn-secondary text-xs font-semibold"
          >
            View Results Table
          </button>
          <button
            onClick={() => onNavigate('map')}
            className="px-4 py-2 rounded-xl btn-secondary text-xs font-semibold"
          >
            Endpoint Map
          </button>
          <button
            onClick={() => onNavigate('export')}
            className="px-4 py-2 rounded-xl btn-primary text-obsidian text-xs font-bold shadow-sm"
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between text-xs mb-2.5 font-mono">
          <span className="text-warmash flex items-center gap-2">
            {isRunning ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bronze opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-bronze"></span>
              </span>
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>{isRunning ? 'Auditing Endpoints & Validating Schema Contracts...' : 'Execution Completed'}</span>
          </span>
          <span className="text-bone font-bold font-mono">{completedCount} / {run?.total_tests || 0} Tests ({progressPercent}%)</span>
        </div>
        <div className="w-full bg-obsidian h-2.5 rounded-full overflow-hidden border border-bronze-hairline">
          <div
            className="bg-bronze h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Real-Time Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Compliance Score with rare Champagne Glow highlight */}
        <div className="card rounded-2xl p-5 shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-warmash font-semibold block mb-1">
            Compliance Score
          </span>
          <div className="text-3xl font-extrabold text-champagne font-mono">
            {run?.compliance_score}%
          </div>
        </div>

        <div className="card rounded-2xl p-5 shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold block mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Passed
          </span>
          <div className="text-3xl font-extrabold text-bone font-mono">
            {run?.passed_tests || 0}
          </div>
        </div>

        <div className="card rounded-2xl p-5 shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-rose-400 font-semibold block mb-1 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-400" /> Failures
          </span>
          <div className="text-3xl font-extrabold text-rose-400 font-mono">
            {run?.failed_tests || 0}
          </div>
        </div>

        <div className="card rounded-2xl p-5 shadow-sm">
          <span className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold block mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Warnings
          </span>
          <div className="text-3xl font-extrabold text-amber-400 font-mono">
            {run?.warning_tests || 0}
          </div>
        </div>
      </div>

      {/* Live Execution Stream Log */}
      <div className="card rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-bronze-hairline bg-obsidian flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-bronze" />
            <h3 className="text-xs font-bold text-bone uppercase tracking-wider">Live Execution Activity Stream</h3>
          </div>
          <span className="text-[11px] text-warmash font-mono">
            {results.length} events logged
          </span>
        </div>

        <div className="divide-y divide-bronze-hairline max-h-[440px] overflow-y-auto font-mono text-xs">
          {results.length === 0 ? (
            <div className="py-12 text-center text-warmash">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-bronze" />
              <span>Synthesizing test cases and dispatching HTTP probes...</span>
            </div>
          ) : (
            results.map((res) => (
              <div
                key={res.id}
                className="px-6 py-3 flex items-center justify-between hover:bg-obsidian/40 transition gap-4"
              >
                <div className="flex items-center gap-3 truncate">
                  <span
                    className={`w-14 text-center text-[10px] font-bold py-0.5 rounded uppercase ${
                      res.http_method === 'GET'
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                        : res.http_method === 'POST'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                        : res.http_method === 'DELETE'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                    }`}
                  >
                    {res.http_method}
                  </span>

                  <span className="text-bone font-medium truncate max-w-xs md:max-w-md" title={res.endpoint_path}>
                    {res.endpoint_path}
                  </span>

                  <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-obsidian border border-bronze-hairline text-warmash">
                    {res.test_category}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {res.status_code_received && (
                    <span className="text-warmash text-[11px]">
                      HTTP {res.status_code_received}
                    </span>
                  )}

                  {res.duration_ms !== undefined && (
                    <span className="text-warmash text-[11px]">
                      {res.duration_ms}ms
                    </span>
                  )}

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      res.status === 'PASS'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : res.status === 'FAIL'
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {res.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
