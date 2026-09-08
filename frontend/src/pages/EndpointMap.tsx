import React, { useState, useEffect } from 'react';
import {
  Grid,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Radio,
  Layers
} from 'lucide-react';
import { getTestResults } from '../services/api';
import { TestResult, TestRun } from '../types';

interface EndpointMapProps {
  run: TestRun | null;
  onSelectEndpoint: (endpointPath: string) => void;
}

interface EndpointSummary {
  path: string;
  method: string;
  totalTests: number;
  passed: number;
  failed: number;
  warning: number;
  hasCriticalFail: boolean;
  categories: string[];
}

export const EndpointMap: React.FC<EndpointMapProps> = ({ run, onSelectEndpoint }) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const isRunning = run?.status === 'RUNNING';

  useEffect(() => {
    if (!run?.id) return;
    const fetchResults = async () => {
      setLoading(true);
      try {
        const data = await getTestResults(run.id, { limit: 300 });
        setResults(data);
      } catch (err) {
        console.error('Failed to load results for endpoint map:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [run?.id, isRunning]);

  // Aggregate results by endpoint
  const endpointMap = new Map<string, EndpointSummary>();

  for (const r of results) {
    const key = `${r.http_method} ${r.endpoint_path}`;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, {
        path: r.endpoint_path,
        method: r.http_method,
        totalTests: 0,
        passed: 0,
        failed: 0,
        warning: 0,
        hasCriticalFail: false,
        categories: [],
      });
    }

    const item = endpointMap.get(key)!;
    item.totalTests += 1;
    if (r.status === 'PASS') item.passed += 1;
    else if (r.status === 'FAIL') {
      item.failed += 1;
      if (r.severity === 'CRITICAL' || r.severity === 'HIGH') {
        item.hasCriticalFail = true;
      }
    } else {
      item.warning += 1;
    }

    if (!item.categories.includes(r.test_category)) {
      item.categories.push(r.test_category);
    }
  }

  const endpoints = Array.from(endpointMap.values());
  const criticalEndpointsCount = endpoints.filter((e) => e.hasCriticalFail).length;
  const cleanEndpointsCount = endpoints.filter((e) => e.failed === 0 && e.warning === 0).length;

  if (!run) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-2xl card mx-auto flex items-center justify-center text-warmash mb-4 shadow-sm">
          <Grid className="w-8 h-8 text-bronze" />
        </div>
        <h2 className="text-xl font-bold text-bone mb-2">No Test Run Selected</h2>
        <p className="text-sm text-warmash mb-6">
          Launch an audit run to generate the visual endpoint security &amp; contract compliance map.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-bronze-hairline pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-bone tracking-tight">
              Endpoint Compliance &amp; Risk Map
            </h1>
            {isRunning && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-obsidian-surface text-bronze border border-bronze/40 text-xs font-mono font-bold animate-pulse shadow-sm">
                <Radio className="w-3.5 h-3.5 text-bronze" />
                <span>Active Radar Scanning</span>
              </span>
            )}
          </div>
          <p className="text-sm text-warmash mt-1">
            Visual topology of all evaluated routes color-coded by multi-tenant isolation and contract compliance status.
          </p>
        </div>

        {/* Aggregate Counters */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl card text-xs">
            <span className="text-warmash">Total Routes:</span>{' '}
            <strong className="text-bone font-mono">{endpoints.length}</strong>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-red-950/30 border border-red-500/30 text-xs shadow-sm">
            <span className="text-rose-300">Critical Routes:</span>{' '}
            <strong className="text-rose-300 font-mono">{criticalEndpointsCount}</strong>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs shadow-sm">
            <span className="text-emerald-300">Conforming:</span>{' '}
            <strong className="text-emerald-300 font-mono">{cleanEndpointsCount}</strong>
          </div>
        </div>
      </div>

      {/* Endpoint Grid Container with Scanning Line Effect */}
      <div className="scanner-container relative card rounded-2xl p-6 min-h-[400px] shadow-sm">
        {/* Animated Scanner Beam (active while running) */}
        {isRunning && <div className="scanner-beam" />}

        {endpoints.length === 0 ? (
          <div className="py-20 text-center text-warmash font-mono text-sm">
            <Layers className="w-8 h-8 mx-auto mb-2 text-bronze animate-bounce" />
            <span>Scanning API routes and mapping endpoints...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {endpoints.map((ep) => {
              const hasFailure = ep.failed > 0;
              const hasWarning = ep.warning > 0;

              const borderColor = ep.hasCriticalFail
                ? 'border-red-500/50 hover:border-red-400'
                : hasFailure
                ? 'border-amber-500/50 hover:border-amber-400'
                : hasWarning
                ? 'border-yellow-500/40 hover:border-yellow-400'
                : 'border-emerald-500/30 hover:border-emerald-400';

              return (
                <div
                  key={`${ep.method}-${ep.path}`}
                  onClick={() => onSelectEndpoint(ep.path)}
                  className={`bg-obsidian border ${borderColor} rounded-xl p-5 hover:scale-[1.01] transition-all duration-200 cursor-pointer flex flex-col justify-between`}
                >
                  <div>
                    {/* Top Row: Method & Health Indicator */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded font-mono uppercase ${
                          ep.method === 'GET'
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                            : ep.method === 'POST'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                            : ep.method === 'DELETE'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                        }`}
                      >
                        {ep.method}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            ep.hasCriticalFail
                              ? 'bg-red-500 animate-ping'
                              : hasFailure
                              ? 'bg-red-500'
                              : hasWarning
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            ep.hasCriticalFail
                              ? 'text-rose-400'
                              : hasFailure
                              ? 'text-amber-400'
                              : hasWarning
                              ? 'text-yellow-400'
                              : 'text-emerald-300'
                          }`}
                        >
                          {ep.hasCriticalFail
                            ? 'Critical Leak'
                            : hasFailure
                            ? 'Schema Drift'
                            : hasWarning
                            ? 'Warning'
                            : 'Conforming'}
                        </span>
                      </div>
                    </div>

                    {/* Endpoint Path */}
                    <h3 className="font-mono text-sm font-bold text-bone mb-2 break-all">
                      {ep.path}
                    </h3>

                    {/* Category Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {ep.categories.slice(0, 3).map((cat) => (
                        <span
                          key={cat}
                          className="text-[9px] px-2 py-0.5 rounded-full bg-obsidian-surface text-warmash font-mono border border-bronze-hairline"
                        >
                          {cat}
                        </span>
                      ))}
                      {ep.categories.length > 3 && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-obsidian-surface text-warmash font-mono">
                          +{ep.categories.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Stats & CTA */}
                  <div className="pt-3 border-t border-bronze-hairline flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">{ep.passed}P</span>
                      <span className="text-rose-400 font-bold">{ep.failed}F</span>
                      <span className="text-amber-400 font-bold">{ep.warning}W</span>
                    </div>

                    <span className="text-bronze text-[11px] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition">
                      <span>View findings</span>
                      <ArrowRight className="w-3.5 h-3.5 text-bronze" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
